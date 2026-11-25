import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { databaseRows, prepareDataset, verifyRelease } from '../../../scripts/records/database.mjs';
import type { RecordDataset } from './types';

const TABLES = {sources:'sources',teams:'teams',players:'players',games:'games',player_game_stats:'playerStats',team_game_stats:'teamStats',coverage:'coverage',source_artifacts:'sourceArtifacts'} as const;
type Layer = {storage_release_id:string;priority:number;season:number|null};
type Options = {baseReleaseId?:string;maxDbMb?:number;maxAddedMb?:number};

// Retrieval clocks and response-body hashes may vary without a basketball change.
// Keep original provenance in storage; omit only transport metadata from identity.
function canonical(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([k])=>!['retrievedAt','fetchedAt','collectedAt','generatedAt'].includes(k)).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  return value;
}
export function seasonContentHash(dataset:RecordDataset):string {
  const content={...dataset} as Record<string,unknown>;
  delete content.sourceArtifacts;
  return createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex');
}
export function inheritSeasonLayers(previous:Layer[],baseReleaseId:string,season:number,storageId:string):Layer[] {
  if(!previous.some(l=>l.storage_release_id===baseReleaseId&&l.season===null)) throw new Error('Current release does not contain the selected historical base.');
  const layers=previous.filter(l=>l.season!==season);
  layers.push({storage_release_id:storageId,priority:season,season});
  if(new Set(layers.map(l=>l.priority)).size!==layers.length) throw new Error('Layer priorities collide.');
  return layers.sort((a,b)=>a.priority-b.priority);
}

export function assertSeasonReplacement(previous:{id:string;season:number}[],dataset:RecordDataset,season:number):void {
  const ids=new Set(dataset.games.map(g=>g.id));
  if(previous.some(g=>g.season===season&&!ids.has(g.id))) throw new Error('Replacement would remove an already published game.');
  if(previous.some(g=>g.season!==season&&ids.has(g.id))) throw new Error('Game ID collides with another season.');
  const sides=new Set(dataset.teamStats.map(s=>`${s.gameId}:${s.teamId}`));
  if(dataset.games.some(g=>![g.homeTeamId,g.awayTeamId].every(team=>sides.has(`${g.id}:${team}`)))) throw new Error('Season publication requires both team box scores for every game.');
}

/** Writer-only. Migration 003 must already exist. Never invoke with the public reader. */
export async function publishSeason(db:PrismaClient,dataset:RecordDataset,options:Options) {
  const prepared=prepareDataset(dataset);
  const seasons=new Set(dataset.games.map(g=>g.season));
  if(seasons.size!==1||dataset.coverage.some(c=>!seasons.has(c.season))) throw new Error('A season release must contain exactly one season.');
  if(dataset.games.some(g=>g.status!=='final')) throw new Error('Only completed games may be published.');
  const season=[...seasons][0],sha=seasonContentHash(dataset),storageId=`s_${sha.slice(0,24)}`;
  const maxBytes=(options.maxDbMb??450)*1024*1024,maxAdded=(options.maxAddedMb??40)*1024*1024;
  if(!Number.isFinite(maxBytes)||maxBytes<=0||maxBytes>500*1024*1024||!Number.isFinite(maxAdded)||maxAdded<=0) throw new Error('Invalid storage budget.');
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(937226541)::text`;
    const [size]=await tx.$queryRaw<{bytes:string}[]>`SELECT pg_database_size(current_database())::text AS bytes`;
    const before=Number(size.bytes);
    async function budget() {
      const [s]=await tx.$queryRaw<{bytes:string}[]>`SELECT pg_database_size(current_database())::text AS bytes`;
      if(Number(s.bytes)>maxBytes||Number(s.bytes)-before>maxAdded) throw new Error('Storage budget exceeded; season publication rolled back.');
    }
    if(before>maxBytes) throw new Error('Database already exceeds storage budget.');
    const [current]=await tx.$queryRaw<{release_id:string}[]>`SELECT release_id FROM records.current_release WHERE singleton=true`;
    if(!current) throw new Error('No current historical release.');
    const previous=await tx.$queryRaw<Layer[]>`SELECT storage_release_id,priority,season FROM records.release_layers WHERE published_release_id=${current.release_id}`;
    const bases=previous.filter(l=>l.season===null);
    if(bases.length!==1) throw new Error('Expected one historical base layer.');
    const baseReleaseId=bases[0].storage_release_id;
    if(options.baseReleaseId && options.baseReleaseId!==baseReleaseId && options.baseReleaseId!==current.release_id) {
      const supplied=await tx.$queryRaw<Layer[]>`SELECT storage_release_id,priority,season FROM records.release_layers WHERE published_release_id=${options.baseReleaseId} AND season IS NULL`;
      if(supplied.length!==1||supplied[0].storage_release_id!==baseReleaseId) throw new Error('Selected historical base differs from current release.');
    }
    const [overlap]=await tx.$queryRaw<{total:number}[]>`SELECT count(*)::integer AS total FROM records.games_storage WHERE release_id=${baseReleaseId} AND season=${season}`;
    if(overlap.total) throw new Error('Historical base overlaps the replacement season.');
    const priorGames=await tx.$queryRaw<{id:string;season:number}[]>`SELECT id,season FROM records.games WHERE release_id=${current.release_id}`;
    assertSeasonReplacement(priorGames,dataset,season);
    const layers=inheritSeasonLayers(previous,baseReleaseId,season,storageId);
    const logicalHash=createHash('sha256').update(JSON.stringify(layers)).digest('hex'),releaseId=`r_${logicalHash.slice(0,24)}`;
    // Do not resurrect a historical snapshot if current layers have newer other seasons.
    const [existing]=await tx.$queryRaw<{id:string}[]>`SELECT id FROM records.releases WHERE id=${releaseId}`;
    if(existing) {
      const verified=await verifyRelease(tx,releaseId);
      if(current.release_id!==releaseId) await tx.$executeRaw`UPDATE records.current_release SET release_id=${releaseId},published_at=now() WHERE singleton=true`;
      return {...verified,imported:false};
    }
    const [stored]=await tx.$queryRaw<{id:string}[]>`SELECT id FROM records.releases WHERE id=${storageId}`;
    if(!stored) {
      if(before+prepared.bytes*2>maxBytes||prepared.bytes*2>maxAdded) throw new Error('Estimated season storage exceeds budget.');
      await tx.$executeRaw`INSERT INTO records.releases(id,content_sha256,dataset_version,counts,input_bytes) VALUES (${storageId},${sha},1,${JSON.stringify(prepared.counts)}::jsonb,${prepared.bytes})`;
      for(const [table,key] of Object.entries(TABLES)) {
        const rows=databaseRows(table,(dataset as any)[key]??[]);
        for(let offset=0;offset<rows.length;offset+=500) {
          const payload=JSON.stringify(rows.slice(offset,offset+500).map(row=>({...row,release_id:storageId})));
          const ident=Prisma.raw(`records.${table}_storage`);
          await tx.$executeRaw(Prisma.sql`INSERT INTO ${ident} SELECT * FROM jsonb_populate_recordset(NULL::${ident},${payload}::jsonb)`);
          await budget();
        }
      }
      await tx.$executeRaw`INSERT INTO records.release_layers(published_release_id,storage_release_id,priority,season) VALUES (${storageId},${storageId},${season},${season})`;
      await verifyRelease(tx,storageId);
    }
    await tx.$executeRaw`INSERT INTO records.releases(id,content_sha256,dataset_version,counts,input_bytes) VALUES (${releaseId},${logicalHash},1,'{}'::jsonb,0)`;
    for(const l of layers) await tx.$executeRaw`INSERT INTO records.release_layers(published_release_id,storage_release_id,priority,season) VALUES (${releaseId},${l.storage_release_id},${l.priority},${l.season})`;
    const counts:Record<string,number>={};
    for(const [table,key] of Object.entries(TABLES)) {
      if(table==='source_artifacts') continue;
      const [row]=await tx.$queryRaw<{total:number}[]>(Prisma.sql`SELECT count(*)::integer AS total FROM ${Prisma.raw(`records.${table}`)} WHERE release_id=${releaseId}`);
      counts[key]=row.total;
    }
    await tx.$executeRaw`UPDATE records.releases SET counts=${JSON.stringify(counts)}::jsonb WHERE id=${releaseId}`;
    // Views have no own ANALYZE; analyze their physical sources before verification.
    await tx.$executeRawUnsafe('ANALYZE records.release_layers, records.sources_storage, records.teams_storage, records.players_storage, records.games_storage, records.player_game_stats_storage, records.team_game_stats_storage, records.coverage_storage');
    const verified=await verifyRelease(tx,releaseId);
    await budget();
    await tx.$executeRaw`UPDATE records.current_release SET release_id=${releaseId},published_at=now() WHERE singleton=true`;
    return {...verified,imported:true};
  },{maxWait:30000,timeout:600000});
}

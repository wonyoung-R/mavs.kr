import { PrismaClient } from '@prisma/client';
import { gzipSync } from 'node:zlib';
import { createHash,timingSafeEqual } from 'node:crypto';
import { collectSeason } from './season-source';
import { publishSeason } from './season-publish';
import type { RecordDataset } from './types';

export function authorizeRecordsSync(header:string|null,secret:string|undefined):boolean {
  if(!secret||secret.length<16||!header)return false;
  const actual=Buffer.from(header),expected=Buffer.from(`Bearer ${secret}`);
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function currentNbaSeason(now:Date):number {
  return now.getUTCFullYear()-(now.getUTCMonth()<8?1:0);
}
export async function syncRecordsSeason(db:PrismaClient,options:{season?:number;asOf?:Date}={}) {
  const asOf=options.asOf??new Date(),season=options.season??currentNbaSeason(asOf);
  if(!Number.isInteger(season)||season<2026||season>currentNbaSeason(asOf))throw new Error('Invalid collection season.');
  // An expiring lease prevents concurrent scheduled/manual collectors. Publication
  // also takes a transaction advisory lock; a failed fetch never changes current.
  const leases=await db.$queryRaw<{name:string}[]>`INSERT INTO records.sync_leases(name,expires_at) VALUES ('season',now()+interval '8 minutes') ON CONFLICT(name) DO UPDATE SET expires_at=EXCLUDED.expires_at WHERE records.sync_leases.expires_at<now() RETURNING name`;
  if(!leases.length)return {status:'busy' as const};
  try {
    const [current]=await db.$queryRaw<{release_id:string}[]>`SELECT release_id FROM records.current_release WHERE singleton=true`;
    if(!current)throw new Error('Historical baseline missing.');
    const [meta]=await db.$queryRaw<any[]>`SELECT
      (SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'nameKo',name_ko,'aliases',aliases,'abbreviation',abbreviation)) FROM records.teams WHERE release_id=${current.release_id}) teams,
      (SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'nameKo',name_ko,'aliases',aliases)) FROM records.players WHERE release_id=${current.release_id}) players`;
    const baseline:RecordDataset={version:1,teams:meta.teams??[],players:meta.players??[],games:[],playerStats:[],teamStats:[],coverage:[],sources:[]};
    const collected=await collectSeason({season,asOf,baseline});
    if(!collected.dataset.games.length)return {status:'no_completed_games' as const,season,report:collected.report};
    // Preserve byte-exact source responses before publication, deduplicated by SHA.
    await db.$transaction(async tx=>{
      const [size]=await tx.$queryRaw<{bytes:string}[]>`SELECT pg_database_size(current_database())::text AS bytes`;
      const bodies=(collected as any).rawBodies as Record<string,string>;
      if(!bodies)throw new Error('Byte-exact source evidence missing.');
      const entries=Object.entries(bodies).map(([url,body])=>({url,body,sha:createHash('sha256').update(body).digest('hex')}));
      if(Number(size.bytes)+entries.reduce((n,e)=>n+Buffer.byteLength(e.body),0)>440*1024*1024)throw new Error('Source evidence storage budget exceeded.');
      for(const entry of entries) {
        if(entry.sha!==collected.report.rawHashes[entry.url])throw new Error('Source hash mismatch.');
        const compressed=gzipSync(entry.body);
        await tx.$executeRaw`INSERT INTO records.source_responses(sha256,url,retrieved_at,body_gzip) VALUES (${entry.sha},${entry.url},${asOf},${compressed}) ON CONFLICT(sha256) DO NOTHING`;
      }
    },{timeout:60000});
    const [base]=await db.$queryRaw<{storage_release_id:string}[]>`SELECT storage_release_id FROM records.release_layers WHERE published_release_id=${current.release_id} AND season IS NULL`;
    if(!base)throw new Error('Historical base layer missing.');
    const result=await publishSeason(db,collected.dataset,{baseReleaseId:base.storage_release_id});
    await db.$executeRaw`INSERT INTO records.sync_runs(season,release_id,report) VALUES (${season},${result.releaseId},${JSON.stringify(collected.report)}::jsonb)`;
    return {status:'ok' as const,season,...result,report:collected.report};
  } finally {
    await db.$executeRaw`DELETE FROM records.sync_leases WHERE name='season'`;
  }
}

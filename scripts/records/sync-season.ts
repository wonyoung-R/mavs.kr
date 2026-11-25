import dotenv from 'dotenv';
import {PrismaClient} from '@prisma/client';
import {syncRecordsSeason} from '../../src/lib/records/season-sync';
import {getRecordsWriterDatabaseUrl} from '../../src/lib/records/connection';
dotenv.config({path:'.env.local',quiet:true});
async function main(){
  const url=getRecordsWriterDatabaseUrl();
  if(!url)throw new Error('Explicit RECORDS_WRITER_DATABASE_URL required.');
  const db=new PrismaClient({datasources:{db:{url}},log:[]});
  try{const season=process.argv[2]===undefined?undefined:Number(process.argv[2]);console.log(JSON.stringify(await syncRecordsSeason(db,{season})));}finally{await db.$disconnect();}
}
main().catch(()=>{console.error('Season sync failed; existing published records preserved. No credentials logged.');process.exitCode=1;});

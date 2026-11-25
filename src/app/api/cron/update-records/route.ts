import { NextRequest,NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authorizeRecordsSync,syncRecordsSeason } from '@/lib/records/season-sync';
import { getRecordsWriterDatabaseUrl } from '@/lib/records/connection';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:NextRequest) {
  if(!authorizeRecordsSync(request.headers.get('authorization'),process.env.CRON_SECRET))return NextResponse.json({error:'Unauthorized'},{status:401});
  let url:string|undefined;
  try {url=getRecordsWriterDatabaseUrl();}
  catch {return NextResponse.json({error:'Records writer configuration is invalid'},{status:503});}
  if(!url)return NextResponse.json({error:'Records writer is not configured'},{status:503});
  const db=new PrismaClient({datasources:{db:{url}},log:[]});
  try {
    const result=await syncRecordsSeason(db);
    console.info('records_sync',JSON.stringify(result));
    return NextResponse.json(result,{status:result.status==='busy'?409:200});
  } catch {
    console.error('records_sync_failed: existing published records preserved');
    return NextResponse.json({error:'Record collection failed. Existing records remain available.'},{status:502});
  } finally {await db.$disconnect();}
}

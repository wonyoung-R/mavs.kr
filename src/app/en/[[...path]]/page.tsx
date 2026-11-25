import { notFound } from 'next/navigation';
import { recordPage, recordMetadata, type PageSearch, type RecordSection } from '@/lib/records-page';
import { decodeRecordRouteId } from '@/lib/records/route-id';

type Props = { params: Promise<{ path?: string[] }>; searchParams: PageSearch };
const sections = ['search', 'seasons', 'players', 'records', 'compare', 'history', 'data'];
export const dynamic = 'auto';
function resolve(path: string[] = []): {section:RecordSection; id?:string} {
  if (!path.length) return {section:'home'};
  if (path.length === 1 && sections.includes(path[0])) return {section:path[0] as RecordSection};
  if (path.length === 2 && ['games','players'].includes(path[0])) return {section:path[0] === 'games' ? 'game' : 'player',id:decodeRecordRouteId(path[1]) ?? notFound()};
  notFound();
}
export async function generateMetadata({ params }: Props) {
  const {path} = await params;
  const {section,id} = resolve(path);
  return recordMetadata('en', section, id ? `${path![0]}/${encodeURIComponent(id)}` : path?.join('/') ?? '');
}
export default async function Page({ params, searchParams }: Props) {
  const {section,id} = resolve((await params).path);
  return recordPage('en', section, searchParams, id);
}

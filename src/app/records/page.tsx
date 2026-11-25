import { recordPage, recordMetadata, type PageSearch } from '@/lib/records-page';

export const dynamic = 'auto';
export const metadata = recordMetadata('ko', 'records', 'records');

export default function Page({ searchParams }: { searchParams: PageSearch }) {
  return recordPage('ko', 'records', searchParams);
}

import { recordPage, recordMetadata, type PageSearch } from '@/lib/records-page';

export const dynamic = 'auto';
export const metadata = recordMetadata('ko', 'seasons', 'seasons');

export default function Page({ searchParams }: { searchParams: PageSearch }) {
  return recordPage('ko', 'seasons', searchParams);
}

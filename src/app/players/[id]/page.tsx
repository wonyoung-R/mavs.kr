import {
  recordPage,
  recordMetadata,
  type PageSearch,
} from "@/lib/records-page";
import { notFound } from "next/navigation";
import { decodeRecordRouteId } from "@/lib/records/route-id";

export const dynamic = "auto";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = decodeRecordRouteId((await params).id) ?? notFound();
  return recordMetadata("ko", "player", `players/${encodeURIComponent(id)}`);
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: PageSearch;
}) {
  const id = decodeRecordRouteId((await params).id) ?? notFound();
  return recordPage("ko", "player", searchParams, id);
}

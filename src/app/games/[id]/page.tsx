import { recordPage, recordMetadata } from "@/lib/records-page";
import { notFound } from "next/navigation";
import { decodeRecordRouteId } from "@/lib/records/route-id";

export const revalidate = 300;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = decodeRecordRouteId((await params).id) ?? notFound();
  return recordMetadata("ko", "game", `games/${encodeURIComponent(id)}`);
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = decodeRecordRouteId((await params).id) ?? notFound();
  return recordPage("ko", "game", undefined, id);
}

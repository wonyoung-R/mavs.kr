import { recordPage, recordMetadata } from "@/lib/records-page";

export const revalidate = 300;
export const metadata = recordMetadata("ko", "players", "players");

export default function Page() {
  return recordPage("ko", "players");
}

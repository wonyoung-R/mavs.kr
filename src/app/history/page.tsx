import { recordPage, recordMetadata } from "@/lib/records-page";

export const revalidate = 300;
export const metadata = recordMetadata("ko", "history", "history");

export default function Page() {
  return recordPage("ko", "history");
}

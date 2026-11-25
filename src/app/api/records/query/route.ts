import { NextRequest, NextResponse } from "next/server";
import {
  RecordReleaseError,
  requestedRecordRelease,
  requireRecordRelease,
  recordsCacheControl,
} from "@/lib/records/repository";
import { serverRecordRepository } from "@/lib/records/server-repository";

export const dynamic = "auto";
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  if (!query.trim() || query.length > 500)
    return NextResponse.json(
      { error: "A query of 1–500 characters is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  try {
    const releaseId = requestedRecordRelease(request.nextUrl.searchParams);
    const result = await serverRecordRepository.queryRecords(query, releaseId);
    requireRecordRelease(releaseId, result.releaseId);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": ["ready", "empty"].includes(result.status)
          ? recordsCacheControl(releaseId)
          : "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      error instanceof RecordReleaseError
        ? {
            status: error.status === 404 ? "not_found" : "invalid",
            message: error.message,
          }
        : {
            status: "unavailable",
            message: "The archive is temporarily unavailable.",
          },
      {
        status: error instanceof RecordReleaseError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

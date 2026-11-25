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
  try {
    const releaseId = requestedRecordRelease(request.nextUrl.searchParams);
    const snapshot = await serverRecordRepository.readRecordCatalog(releaseId);
    requireRecordRelease(releaseId, snapshot.releaseId);
    return NextResponse.json(
      {
        status: snapshot.status,
        releaseId: snapshot.releaseId,
        totalGames: snapshot.totalGames,
        totalPlayerStatRows: snapshot.totalPlayerStatRows,
        seasons: snapshot.availableSeasons,
        coverage: snapshot.dataset.coverage,
        sources: snapshot.dataset.sources,
      },
      {
        status: snapshot.status === "invalid" ? 503 : 200,
        headers: {
          "Cache-Control":
            snapshot.status === "invalid"
              ? "no-store"
              : recordsCacheControl(releaseId, 60),
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      error instanceof RecordReleaseError
        ? {
            status: error.status === 404 ? "not_found" : "invalid",
            message: error.message,
          }
        : { status: "unavailable" },
      {
        status: error instanceof RecordReleaseError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  RecordReleaseError,
  requestedRecordRelease,
  requireRecordRelease,
  recordsCacheControl,
} from "@/lib/records/repository";
import {
  serverRecordRepository,
  isRecordScopeCacheable,
} from "@/lib/records/server-repository";
import type { RecordScope } from "@/lib/records/repository";
import type { Competition } from "@/lib/records/types";

export const dynamic = "auto";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind");
  const id = params.get("id") ?? undefined;
  const year = params.get("season");
  const competition = params.get("competition") || "regular";
  const page = params.get("page") || "1";
  const validCompetition = [
    "regular",
    "playoffs",
    "playin",
    "cup_final",
    "preseason",
    "summer",
  ].includes(competition);
  if (
    !["game", "season", "player"].includes(kind || "") ||
    (kind !== "season" && (!id || id.length > 100)) ||
    (kind === "season" && !year) ||
    (year &&
      (!/^\d{4}$/.test(year) || Number(year) < 1980 || Number(year) > 2100)) ||
    !validCompetition ||
    !/^\d+$/.test(page) ||
    Number(page) < 1 ||
    Number(page) > 100
  ) {
    return NextResponse.json(
      {
        error: "Specify a game, a DAL player, or one season with a valid page.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const scope: RecordScope = {
    kind: kind as RecordScope["kind"],
    id,
    season: year ? Number(year) : undefined,
    competition: competition as Competition,
    offset: (Number(page) - 1) * 200,
    limit: 200,
  };
  try {
    const releaseId = requestedRecordRelease(params);
    const snapshot = await serverRecordRepository.readRecordScope({
      ...scope,
      releaseId,
    });
    requireRecordRelease(releaseId, snapshot.releaseId);
    return NextResponse.json(snapshot, {
      status: snapshot.status === "invalid" ? 503 : 200,
      headers: {
        "Cache-Control": isRecordScopeCacheable(snapshot, scope)
          ? recordsCacheControl(releaseId, 60)
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
        : { status: "unavailable" },
      {
        status: error instanceof RecordReleaseError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

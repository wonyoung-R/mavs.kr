import type { RecordPlayerStat } from "@/lib/records/types";

// Unknown catalog metadata must not imply that a venue filter is supported.
export function hasVenueClassification(metadata: {
  venueClassifiedGames?: number;
}): boolean {
  return (
    typeof metadata.venueClassifiedGames === "number" &&
    metadata.venueClassifiedGames > 0
  );
}

export function auditPlayerPoints(
  rows: RecordPlayerStat[],
  teamPoints: number | null | undefined,
) {
  const participants = rows.filter(
    (row) => row.participation === "played" || row.participation === "unknown",
  );
  const known = participants.filter((row) => row.values.PTS !== null);
  const playerPoints = known.length
    ? known.reduce((sum, row) => sum + row.values.PTS!, 0)
    : null;
  const reportedTeamPoints = teamPoints ?? null;
  return {
    playerPoints,
    teamPoints: reportedTeamPoints,
    difference:
      playerPoints !== null && reportedTeamPoints !== null
        ? playerPoints - reportedTeamPoints
        : null,
    missingPoints: participants.length - known.length,
    unknownParticipation: participants.filter(
      (row) => row.participation === "unknown",
    ).length,
  };
}

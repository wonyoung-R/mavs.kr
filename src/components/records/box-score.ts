import type { RecordPlayerStat } from '../../lib/records/types';

export type LineupRole = 'Starter' | 'Bench' | 'Unknown' | 'DNP' | 'Inactive';

export function organizeBoxScore(rows: RecordPlayerStat[]) {
  const starters = rows.filter(row => row.starter === true);
  // Older source seasons sometimes mark more than five players as starters.
  // Never choose five by minutes, or infer a lineup from a player's profile.
  const lineupKnown = starters.length === 5 && starters.every(row => row.participation === 'played');
  const role = (row: RecordPlayerStat): LineupRole => {
    if (row.participation === 'dnp') return 'DNP';
    if (row.participation === 'inactive') return 'Inactive';
    if (!lineupKnown || row.participation !== 'played') return 'Unknown';
    return row.starter ? 'Starter' : 'Bench';
  };
  const rank: Record<LineupRole, number> = { Starter: 0, Bench: 1, Unknown: 2, DNP: 3, Inactive: 3 };
  const positionRank = { G: 0, F: 1, C: 2 };
  const sorted = rows.map(row => ({ row, role: role(row) })).sort((a, b) => {
    const group = rank[a.role] - rank[b.role];
    if (group) return group;
    if (a.role === 'Starter') {
      const position = (positionRank[a.row.starterPosition!] ?? 3) - (positionRank[b.row.starterPosition!] ?? 3);
      if (position) return position;
    }
    const minutes = (b.row.values.MIN_SECONDS ?? -1) - (a.row.values.MIN_SECONDS ?? -1);
    return minutes || a.row.playerId.localeCompare(b.row.playerId);
  });
  return { lineupKnown, rows: sorted };
}

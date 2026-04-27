export enum GameStatus {
  FINAL = 'Final',
  LIVE = 'Live',
  SCHEDULED = 'Scheduled',
  POSTPONED = 'Postponed',
}

export interface Game {
  id: string;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: GameStatus;
  scheduledAt: Date;
  quarter?: number;
  timeRemaining?: string;
  broadcasts: string[];
  stats?: unknown;
  highlights: string[];
  createdAt: Date;
  updatedAt: Date;
}

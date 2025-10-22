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
  stats?: GameStats;
  highlights: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GameStats {
  homeTeam: TeamStats;
  awayTeam: TeamStats;
  quarters: QuarterStats[];
}

export interface TeamStats {
  points: number;
  fieldGoals: {
    made: number;
    attempted: number;
    percentage: number;
  };
  threePointers: {
    made: number;
    attempted: number;
    percentage: number;
  };
  freeThrows: {
    made: number;
    attempted: number;
    percentage: number;
  };
  rebounds: {
    offensive: number;
    defensive: number;
    total: number;
  };
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
}

export interface QuarterStats {
  quarter: number;
  homeScore: number;
  awayScore: number;
}

export enum GameStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  FINAL = 'FINAL',
  POSTPONED = 'POSTPONED',
}

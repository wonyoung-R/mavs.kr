export interface Player {
  id: string;
  name: string;
  position: string;
  jerseyNumber: number;
  height: string;
  weight: string;
  age: number;
  college?: string;
  draftYear?: number;
  draftPick?: number;
  salary?: number;
  contract?: Contract;
  stats: PlayerStats;
  imageUrl?: string;
}

export interface Contract {
  startYear: number;
  endYear: number;
  totalValue: number;
  averageSalary: number;
  guaranteed: number;
}

export interface PlayerStats {
  season: string;
  gamesPlayed: number;
  minutesPerGame: number;
  pointsPerGame: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  stealsPerGame: number;
  blocksPerGame: number;
  fieldGoalPercentage: number;
  threePointPercentage: number;
  freeThrowPercentage: number;
  turnoversPerGame: number;
  foulsPerGame: number;
}

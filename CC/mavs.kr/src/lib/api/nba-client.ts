// src/lib/api/nba-client.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Game, GameStatus } from '@/types/game';
import { Player } from '@/types/player';

interface NBAApiResponse<T> {
  data: T[];
  meta: {
    total_pages: number;
    current_page: number;
    next_page: number | null;
    per_page: number;
    total_count: number;
  };
}

interface NBAGame {
  id: number;
  date: string;
  home_team: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
    full_name: string;
  };
  visitor_team: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
    full_name: string;
  };
  home_team_score: number | null;
  visitor_team_score: number | null;
  period: number;
  status: string;
  time: string;
  postseason: boolean;
  season: number;
}

interface NBAPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height_feet: number | null;
  height_inches: number | null;
  weight_pounds: number | null;
  team: {
    id: number;
    abbreviation: string;
    city: string;
    name: string;
    full_name: string;
  };
}

export class NBAApiClient {
  private client: AxiosInstance;
  private readonly baseUrl = 'https://www.balldontlie.io/api/v1';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'User-Agent': 'MAVS.KR/1.0 (https://mavs.kr)',
        'Accept': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`NBA API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('NBA API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('NBA API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get games for a specific date range
   */
  async getGames(
    startDate?: string,
    endDate?: string,
    teamId?: number
  ): Promise<Game[]> {
    try {
      const params: Record<string, any> = {};

      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (teamId) params.team_ids = [teamId];

      const response: AxiosResponse<NBAApiResponse<NBAGame>> = await this.client.get('/games', {
        params,
      });

      return response.data.data.map(this.transformGame);
    } catch (error) {
      console.error('Failed to fetch games:', error);
      throw new Error('Failed to fetch games from NBA API');
    }
  }

  /**
   * Get live games (games happening today)
   */
  async getLiveGames(): Promise<Game[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getGames(today, today);
  }

  /**
   * Get upcoming games for Dallas Mavericks
   */
  async getUpcomingGames(): Promise<Game[]> {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    // Dallas Mavericks team ID (assuming it's 6, you'll need to verify this)
    const mavsTeamId = 6;

    return this.getGames(today, futureDateStr, mavsTeamId);
  }

  /**
   * Get team roster
   */
  async getTeamRoster(teamId: number): Promise<Player[]> {
    try {
      const response: AxiosResponse<NBAApiResponse<NBAPlayer>> = await this.client.get('/players', {
        params: {
          team_ids: [teamId],
          per_page: 25,
        },
      });

      return response.data.data.map(this.transformPlayer);
    } catch (error) {
      console.error('Failed to fetch team roster:', error);
      throw new Error('Failed to fetch team roster from NBA API');
    }
  }

  /**
   * Get player stats for a specific game
   */
  async getPlayerStats(gameId: number): Promise<any> {
    try {
      const response = await this.client.get(`/stats`, {
        params: {
          game_ids: [gameId],
          per_page: 50,
        },
      });

      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch player stats:', error);
      throw new Error('Failed to fetch player stats from NBA API');
    }
  }

  /**
   * Transform NBA API game data to our Game type
   */
  private transformGame(nbaGame: NBAGame): Game {
    const isMavsHome = nbaGame.home_team.full_name === 'Dallas Mavericks';
    const mavsTeam = isMavsHome ? nbaGame.home_team : nbaGame.visitor_team;
    const opponentTeam = isMavsHome ? nbaGame.visitor_team : nbaGame.home_team;

    return {
      id: nbaGame.id.toString(),
      gameId: `NBA-${nbaGame.id}`,
      homeTeam: nbaGame.home_team.full_name,
      awayTeam: nbaGame.visitor_team.full_name,
      homeScore: nbaGame.home_team_score || undefined,
      awayScore: nbaGame.visitor_team_score || undefined,
      status: this.transformGameStatus(nbaGame.status),
      scheduledAt: new Date(nbaGame.date),
      quarter: nbaGame.period,
      timeRemaining: nbaGame.time,
      broadcasts: [], // NBA API doesn't provide broadcast info
      stats: undefined,
      highlights: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Transform NBA API player data to our Player type
   */
  private transformPlayer(nbaPlayer: NBAPlayer): Player {
    const height = nbaPlayer.height_feet && nbaPlayer.height_inches
      ? `${nbaPlayer.height_feet}'${nbaPlayer.height_inches}"`
      : 'N/A';

    const weight = nbaPlayer.weight_pounds
      ? `${nbaPlayer.weight_pounds} lbs`
      : 'N/A';

    return {
      id: nbaPlayer.id.toString(),
      name: `${nbaPlayer.first_name} ${nbaPlayer.last_name}`,
      position: nbaPlayer.position,
      jerseyNumber: 0, // NBA API doesn't provide jersey number
      height,
      weight,
      age: 0, // Would need additional API call to get age
      college: undefined,
      draftYear: undefined,
      draftPick: undefined,
      salary: undefined,
      contract: undefined,
      stats: {
        season: '2023-24',
        gamesPlayed: 0,
        minutesPerGame: 0,
        pointsPerGame: 0,
        reboundsPerGame: 0,
        assistsPerGame: 0,
        stealsPerGame: 0,
        blocksPerGame: 0,
        fieldGoalPercentage: 0,
        threePointPercentage: 0,
        freeThrowPercentage: 0,
        turnoversPerGame: 0,
        foulsPerGame: 0,
      },
      imageUrl: undefined,
    };
  }

  /**
   * Transform NBA API status to our GameStatus enum
   */
  private transformGameStatus(status: string): GameStatus {
    switch (status.toLowerCase()) {
      case 'final':
        return GameStatus.FINAL;
      case 'in progress':
      case 'live':
        return GameStatus.LIVE;
      case 'scheduled':
        return GameStatus.SCHEDULED;
      case 'postponed':
        return GameStatus.POSTPONED;
      default:
        return GameStatus.SCHEDULED;
    }
  }
}

// Singleton instance
export const nbaApiClient = new NBAApiClient();

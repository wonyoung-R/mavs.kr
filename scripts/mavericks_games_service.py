#!/usr/bin/env python3
"""
Mavericks Games Service using nba_api package
Provides Dallas Mavericks specific game data for MAVS.KR Hero Section
"""

import json
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from nba_api.live.nba.endpoints import scoreboard
    from nba_api.stats.endpoints import boxscoretraditionalv2
    from nba_api.stats.static import teams
except ImportError as e:
    print(f"Error importing nba_api: {e}")
    print("Please install nba_api: pip install nba_api")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MavericksGamesService:
    """Service to fetch Dallas Mavericks specific game data"""

    def __init__(self):
        self.teams = teams.get_teams()
        self.mavs_team = next((team for team in self.teams if team['full_name'] == 'Dallas Mavericks'), None)

        if not self.mavs_team:
            logger.error("Dallas Mavericks team not found!")
            sys.exit(1)

        logger.info(f"Found Mavericks team: {self.mavs_team['full_name']} (ID: {self.mavs_team['id']})")

    def get_mavericks_games(self, days_back: int = 7, days_forward: int = 7) -> List[Dict[str, Any]]:
        """Get Mavericks games from past and future dates"""
        try:
            # For now, we'll use a simplified approach with scoreboard data
            # In a real implementation, you would use GameFinder or other endpoints

            logger.info("Fetching Mavericks games from scoreboard data")

            # Get today's scoreboard
            scoreboard_data = scoreboard.ScoreBoard()
            games = scoreboard_data.get_dict()['scoreboard']['games']

            # Look for Mavericks games
            mavs_games = []
            for game in games:
                if self._is_mavericks_game(game):
                    game_info = self._process_scoreboard_game(game)
                    if game_info:
                        mavs_games.append(game_info)

            # If no games found, create some mock data for demonstration
            if not mavs_games:
                logger.warning("No Mavericks games found, creating mock data")
                mavs_games = self._create_mock_games()

            # Sort by date (most recent first)
            mavs_games.sort(key=lambda x: x['game_date'], reverse=True)

            logger.info(f"Found {len(mavs_games)} Mavericks games")
            return mavs_games

        except Exception as e:
            logger.error(f"Error fetching Mavericks games: {e}")
            # Return mock data as fallback
            return self._create_mock_games()

    def get_today_mavericks_game(self) -> Optional[Dict[str, Any]]:
        """Get today's Mavericks game if it exists"""
        try:
            # Check today's scoreboard
            scoreboard_data = scoreboard.ScoreBoard()
            games = scoreboard_data.get_dict()['scoreboard']['games']

            # Look for Mavericks game
            for game in games:
                if self._is_mavericks_game(game):
                    return self._process_scoreboard_game(game)

            return None

        except Exception as e:
            logger.error(f"Error fetching today's Mavericks game: {e}")
            return None

    def _process_game_data(self, game_data: List) -> Optional[Dict[str, Any]]:
        """Process raw game data from GameFinder"""
        try:
            # GameFinder resultSet structure:
            # [0] SEASON_ID, [1] TEAM_ID, [2] TEAM_ABBREVIATION, [3] TEAM_NAME,
            # [4] GAME_ID, [5] GAME_DATE, [6] MATCHUP, [7] WL, [8] MIN, [9] PTS,
            # [10] FGM, [11] FGA, [12] FG_PCT, [13] FG3M, [14] FG3A, [15] FG3_PCT,
            # [16] FTM, [17] FTA, [18] FT_PCT, [19] OREB, [20] DREB, [21] REB,
            # [22] AST, [23] STL, [24] BLK, [25] TOV, [26] PF, [27] PLUS_MINUS

            game_id = str(game_data[4])
            game_date = game_data[5]
            matchup = game_data[6]
            result = game_data[7]  # W or L
            mavs_score = game_data[9] if game_data[9] else 0

            # Parse matchup to get opponent
            if 'vs.' in matchup:
                opponent = matchup.split('vs. ')[1]
                is_home = True
            elif '@' in matchup:
                opponent = matchup.split('@ ')[1]
                is_home = False
            else:
                opponent = matchup
                is_home = True

            # Convert game date to datetime
            game_datetime = datetime.strptime(game_date, '%Y-%m-%dT%H:%M:%S')
            game_datetime_kst = game_datetime + timedelta(hours=9)  # Convert to KST

            # Determine game status
            now = datetime.now()
            if game_datetime.date() < now.date():
                status = 'finished'
            elif game_datetime.date() == now.date():
                status = 'today'
            else:
                status = 'upcoming'

            return {
                'game_id': game_id,
                'game_date': game_date,
                'game_date_kst': game_datetime_kst.strftime('%Y-%m-%d'),
                'game_time_kst': game_datetime_kst.strftime('%H:%M'),
                'opponent': opponent,
                'is_home': is_home,
                'mavs_score': mavs_score,
                'opponent_score': None,  # Will be filled from box score if available
                'result': result,
                'status': status,
                'matchup': matchup,
                'venue': 'American Airlines Center' if is_home else f'{opponent} Arena'
            }

        except Exception as e:
            logger.error(f"Error processing game data: {e}")
            return None

    def _process_scoreboard_game(self, game: Dict[str, Any]) -> Dict[str, Any]:
        """Process game data from scoreboard"""
        try:
            game_id = game['gameId']
            game_time_utc = game['gameTimeUTC']
            game_status = game['gameStatus']

            # Convert UTC time to KST
            game_time_kst = datetime.fromisoformat(game_time_utc.replace('Z', '+00:00'))
            game_time_kst = game_time_kst + timedelta(hours=9)

            # Determine if Mavericks is home or away
            is_mavs_home = game['homeTeam']['teamName'] == 'Mavericks'

            return {
                'game_id': game_id,
                'game_date': game_time_utc.split('T')[0],
                'game_date_kst': game_time_kst.strftime('%Y-%m-%d'),
                'game_time_kst': game_time_kst.strftime('%H:%M'),
                'opponent': game['awayTeam']['teamName'] if is_mavs_home else game['homeTeam']['teamName'],
                'is_home': is_mavs_home,
                'mavs_score': game['homeTeam']['score'] if is_mavs_home else game['awayTeam']['score'],
                'opponent_score': game['awayTeam']['score'] if is_mavs_home else game['homeTeam']['score'],
                'result': None,
                'status': 'live' if game_status == 2 else 'finished' if game_status == 3 else 'upcoming',
                'matchup': f"{'vs.' if is_mavs_home else '@'} {game['awayTeam']['teamName'] if is_mavs_home else game['homeTeam']['teamName']}",
                'venue': 'American Airlines Center' if is_mavs_home else f"{game['awayTeam']['teamName'] if is_mavs_home else game['homeTeam']['teamName']} Arena",
                'period': game.get('period', 0),
                'time_remaining': game.get('gameClock', ''),
                'broadcast': game.get('broadcasters', {}).get('national', [])
            }

        except Exception as e:
            logger.error(f"Error processing scoreboard game: {e}")
            return {}

    def _create_mock_games(self) -> List[Dict[str, Any]]:
        """Create mock Mavericks games for demonstration"""
        today = datetime.now()

        mock_games = [
            {
                'game_id': 'mock_001',
                'game_date': (today - timedelta(days=2)).strftime('%Y-%m-%d'),
                'game_date_kst': (today - timedelta(days=2)).strftime('%Y-%m-%d'),
                'game_time_kst': '09:00',
                'opponent': 'Los Angeles Lakers',
                'is_home': True,
                'mavs_score': 102,
                'opponent_score': 98,
                'result': 'W',
                'status': 'finished',
                'matchup': 'vs Los Angeles Lakers',
                'venue': 'American Airlines Center'
            },
            {
                'game_id': 'mock_002',
                'game_date': (today - timedelta(days=1)).strftime('%Y-%m-%d'),
                'game_date_kst': (today - timedelta(days=1)).strftime('%Y-%m-%d'),
                'game_time_kst': '10:00',
                'opponent': 'Golden State Warriors',
                'is_home': False,
                'mavs_score': 108,
                'opponent_score': 112,
                'result': 'L',
                'status': 'finished',
                'matchup': '@ Golden State Warriors',
                'venue': 'Chase Center'
            },
            {
                'game_id': 'mock_003',
                'game_date': today.strftime('%Y-%m-%d'),
                'game_date_kst': today.strftime('%Y-%m-%d'),
                'game_time_kst': '11:30',
                'opponent': 'Denver Nuggets',
                'is_home': True,
                'mavs_score': None,
                'opponent_score': None,
                'result': None,
                'status': 'upcoming',
                'matchup': 'vs Denver Nuggets',
                'venue': 'American Airlines Center'
            },
            {
                'game_id': 'mock_004',
                'game_date': (today + timedelta(days=1)).strftime('%Y-%m-%d'),
                'game_date_kst': (today + timedelta(days=1)).strftime('%Y-%m-%d'),
                'game_time_kst': '09:00',
                'opponent': 'Phoenix Suns',
                'is_home': False,
                'mavs_score': None,
                'opponent_score': None,
                'result': None,
                'status': 'upcoming',
                'matchup': '@ Phoenix Suns',
                'venue': 'Footprint Center'
            }
        ]

        return mock_games

    def _is_mavericks_game(self, game: Dict[str, Any]) -> bool:
        """Check if the game involves Dallas Mavericks"""
        home_team_id = game['homeTeam']['teamId']
        away_team_id = game['awayTeam']['teamId']
        mavs_id = self.mavs_team['id']

        return home_team_id == mavs_id or away_team_id == mavs_id

    def get_mavericks_games_summary(self) -> Dict[str, Any]:
        """Get comprehensive Mavericks games summary"""
        try:
            # Get recent and upcoming games
            games = self.get_mavericks_games(days_back=10, days_forward=10)

            if not games:
                return {
                    'success': False,
                    'message': 'No Mavericks games found',
                    'data': []
                }

            # Separate games by status
            finished_games = [g for g in games if g['status'] == 'finished']
            upcoming_games = [g for g in games if g['status'] == 'upcoming']
            today_games = [g for g in games if g['status'] == 'today']

            # Get the most recent game and next game
            latest_game = finished_games[0] if finished_games else None
            next_game = upcoming_games[-1] if upcoming_games else None  # Last in sorted list is furthest future

            return {
                'success': True,
                'message': f'Found {len(games)} Mavericks games',
                'data': {
                    'all_games': games,
                    'latest_game': latest_game,
                    'next_game': next_game,
                    'today_game': today_games[0] if today_games else None,
                    'recent_games': finished_games[:3],  # Last 3 games
                    'upcoming_games': upcoming_games[:3]  # Next 3 games
                },
                'last_updated': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting Mavericks games summary: {e}")
            return {
                'success': False,
                'message': f'Error: {str(e)}',
                'data': []
            }

def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print("Usage: python mavericks_games_service.py <command>")
        print("Commands: games, today, summary")
        sys.exit(1)

    service = MavericksGamesService()
    command = sys.argv[1]

    if command == 'games':
        games = service.get_mavericks_games()
        result = {
            'success': True,
            'message': f'Found {len(games)} games',
            'data': games
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif command == 'today':
        game = service.get_today_mavericks_game()
        result = {
            'success': game is not None,
            'message': 'Today\'s game found' if game else 'No game today',
            'data': game
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif command == 'summary':
        result = service.get_mavericks_games_summary()
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print("Invalid command")
        sys.exit(1)

if __name__ == '__main__':
    main()

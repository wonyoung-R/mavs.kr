#!/usr/bin/env python3
"""
NBA API Service using nba_api package
Provides real-time box scores and game data for MAVS.KR
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

class NBABoxScoreService:
    """Service to fetch NBA box scores and game data"""

    def __init__(self):
        self.teams = teams.get_teams()
        self.mavs_team = next((team for team in self.teams if team['full_name'] == 'Dallas Mavericks'), None)

    def get_today_games(self) -> List[Dict[str, Any]]:
        """Get today's NBA games"""
        try:
            scoreboard_data = scoreboard.ScoreBoard()
            games = scoreboard_data.get_dict()['scoreboard']['games']

            # Return all games for today
            return games

        except Exception as e:
            logger.error(f"Error fetching today's games: {e}")
            return []

    def get_live_box_score(self, game_id: str) -> Optional[Dict[str, Any]]:
        """Get live box score for a specific game"""
        try:
            box_score = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id)
            data = box_score.get_dict()

            return {
                'game_id': game_id,
                'home_team': data['resultSets'][0]['headers'],
                'away_team': data['resultSets'][1]['headers'],
                'home_stats': data['resultSets'][0]['rowSet'],
                'away_stats': data['resultSets'][1]['rowSet'],
                'last_updated': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Error fetching box score for game {game_id}: {e}")
            return None

    def get_game_summary(self, game: Dict[str, Any]) -> Dict[str, Any]:
        """Get summary information for a game"""
        try:
            game_id = game['gameId']
            game_time_utc = game['gameTimeUTC']
            game_status = game['gameStatus']

            # Convert UTC time to KST (UTC+9)
            game_time_kst = datetime.fromisoformat(game_time_utc.replace('Z', '+00:00'))
            game_time_kst = game_time_kst + timedelta(hours=9)

            return {
                'game_id': game_id,
                'home_team': game['homeTeam']['teamName'],
                'away_team': game['awayTeam']['teamName'],
                'home_score': game['homeTeam']['score'],
                'away_score': game['awayTeam']['score'],
                'status': game_status,
                'period': game.get('period', 0),
                'time_remaining': game.get('gameClock', ''),
                'game_time_kst': game_time_kst.strftime('%H:%M'),
                'game_date_kst': game_time_kst.strftime('%m/%d'),
                'is_mavs_game': self._is_mavs_game(game),
                'is_live': game_status == 2,  # 2 = Live
                'is_finished': game_status == 3,  # 3 = Finished
                'broadcast': game.get('broadcasters', {}).get('national', [])
            }

        except Exception as e:
            logger.error(f"Error processing game summary: {e}")
            return {}

    def _is_mavs_game(self, game: Dict[str, Any]) -> bool:
        """Check if the game involves Dallas Mavericks"""
        if not self.mavs_team:
            return False

        home_team_id = game['homeTeam']['teamId']
        away_team_id = game['awayTeam']['teamId']
        mavs_id = self.mavs_team['id']

        return home_team_id == mavs_id or away_team_id == mavs_id

    def get_daily_box_scores(self) -> Dict[str, Any]:
        """Get daily box scores for banner display"""
        try:
            games = self.get_today_games()

            if not games:
                return {
                    'success': False,
                    'message': 'No games found for today',
                    'data': []
                }

            game_summaries = []
            for game in games:
                summary = self.get_game_summary(game)
                if summary:
                    game_summaries.append(summary)

            return {
                'success': True,
                'message': f'Found {len(game_summaries)} games',
                'data': game_summaries,
                'last_updated': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Error getting daily box scores: {e}")
            return {
                'success': False,
                'message': f'Error: {str(e)}',
                'data': []
            }

def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print("Usage: python nba_api_service.py <command>")
        print("Commands: today, live <game_id>")
        sys.exit(1)

    service = NBABoxScoreService()
    command = sys.argv[1]

    if command == 'today':
        result = service.get_daily_box_scores()
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif command == 'live' and len(sys.argv) > 2:
        game_id = sys.argv[2]
        result = service.get_live_box_score(game_id)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print("Invalid command")
        sys.exit(1)

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Convert the pinned public CSV snapshot into DAL regular-season/playoff records.

Missing numbers and venue classifications remain unknown. Original rows that fail
arithmetic checks are retained as observations and withheld from the affected table.
"""
import argparse
import csv
from collections import Counter, defaultdict
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/records/raw/kaggle'
OUT = ROOT / 'data/records/normalized'
DAL = '1610612742'
FIELDS = {'PTS': 'points', 'REB': 'reboundsTotal', 'AST': 'assists', 'STL': 'steals',
          'BLK': 'blocks', 'TOV': 'turnovers', 'PF': 'foulsPersonal', 'FGM': 'fieldGoalsMade',
          'FGA': 'fieldGoalsAttempted', 'FG3M': 'threePointersMade', 'FG3A': 'threePointersAttempted',
          'FTM': 'freeThrowsMade', 'FTA': 'freeThrowsAttempted', 'OREB': 'reboundsOffensive',
          'DREB': 'reboundsDefensive', 'PLUS_MINUS': 'plusMinusPoints', 'MIN_SECONDS': 'numMinutes'}
PLAYER_NAMES_KO = {'1717': ('디르크 노비츠키', ['노비츠키', 'Dirk', 'Nowitzki']),
                   '1629029': ('루카 돈치치', ['돈치치', '루카', 'Luka', 'Doncic', 'Dončić']),
                   '202681': ('카이리 어빙', ['카이리', '어빙', 'Kyrie', 'Irving']),
                   '467': ('제이슨 키드', ['키드', 'Kidd']),
                   '201142': ('케빈 듀란트', ['듀란트']),
                   '203076': ('앤서니 데이비스', ['데이비스', 'Anthony Davis'])}


def rows(name):
    with (RAW / name).open(newline='', encoding='utf-8-sig') as handle:
        yield from csv.DictReader(handle)


def number(raw):
    if raw is None or raw.strip() in ('', '-', '--', 'N/A', 'NaN', 'nan'):
        return None
    value = Decimal(raw)
    if value != value.to_integral_value():
        raise ValueError('Non-integral count: ' + raw)
    return int(value)


def values(row, team=False):
    result = {}
    for metric, column in FIELDS.items():
        column = 'teamScore' if team and metric == 'PTS' else column
        raw = row.get(column, '')
        if metric == 'MIN_SECONDS':
            result[metric] = int((Decimal(raw) * 60).quantize(Decimal('1'), rounding=ROUND_HALF_UP)) if raw.strip() else None
        else:
            result[metric] = number(raw)
    return result


def stat_issues(v):
    issues = []
    for key, val in v.items():
        if val is not None and val < 0 and key != 'PLUS_MINUS':
            issues.append('negative_' + key)
    for made, attempts in [('FGM', 'FGA'), ('FG3M', 'FG3A'), ('FTM', 'FTA'), ('FG3A', 'FGA'), ('FG3M', 'FGM')]:
        if v[made] is not None and v[attempts] is not None and v[made] > v[attempts]:
            issues.append(made + '_exceeds_' + attempts)
    if all(v[k] is not None for k in ('FGM', 'FG3M', 'FTM', 'PTS')) and 2*v['FGM']+v['FG3M']+v['FTM'] != v['PTS']:
        issues.append('points_disagree_with_shots')
    if all(v[k] is not None for k in ('OREB', 'DREB', 'REB')) and v['OREB']+v['DREB'] != v['REB']:
        issues.append('rebound_components_disagree')
    return issues


def withhold_inconsistent_fields(stat):
    """Keep uncontested values; do not choose which contradictory input is correct."""
    issues = stat_issues(stat)
    for issue in issues:
        if issue == 'rebound_components_disagree':
            stat['OREB'] = stat['DREB'] = None
        elif issue == 'points_disagree_with_shots':
            for key in ('FGM', 'FGA', 'FG3M', 'FG3A', 'FTM', 'FTA'):
                stat[key] = None
        elif '_exceeds_' in issue:
            for key in issue.split('_exceeds_'):
                stat[key] = None
        elif issue.startswith('negative_'):
            stat[issue.removeprefix('negative_')] = None
    return issues


def source_team(row, game):
    raw_id = row['playerteamId']
    if raw_id:
        return raw_id
    # Home flag plus exact contemporaneous ledger labels is an evidenced join.
    side = 'home' if row.get('home') == '1' else 'away' if row.get('home') == '0' else None
    if side and row['playerteamCity'] == game[side+'teamCity'] and row['playerteamName'] == game[side+'teamName']:
        return game[side+'teamId']
    return ''


def starting_position(row):
    """Retain the game's source position, never a player's profile position."""
    position = row.get('startingPosition', '').strip()
    return position if position in ('G', 'F', 'C') else None


def output_paths(output_dir):
    """Published snapshots remain reproducible; reruns need a new directory."""
    paths = {name: output_dir / name for name in ('dataset.json', 'observations.json', 'report.json')}
    if any(path.exists() for path in paths.values()):
        raise FileExistsError('An output snapshot already exists. Use --output-dir with a new directory.')
    return paths


def attach_advanced(data, source_games):
    excluded = set(FIELDS.values()) | {'gameId','personId','teamId','opponentTeamId','opponentteamId','playerteamId',
                                     'home','win','teamScore','opponentScore','seriesGameNumber','seed'}
    added = {}
    for filename, key, id_column in [('PlayerStatisticsExtended.csv','playerStats','personId'),
                                     ('TeamStatisticsExtended.csv','teamStats','teamId')]:
        if not (RAW/filename).exists():
            continue
        target = {(r['gameId'],r['playerId'] if key=='playerStats' else r['teamId']): r for r in data[key]}
        count = 0
        for row in rows(filename):
            if row['gameId'] not in source_games:
                continue
            ref = (identity('game',row['gameId']),identity('player' if key=='playerStats' else 'team',row[id_column]))
            item = target.get(ref)
            if not item or (key=='playerStats' and item['participation']!='played'):
                continue
            extra = {}
            for column, raw in row.items():
                if column in excluded:
                    continue
                if not raw.strip():
                    continue
                try:
                    value = float(raw)
                except ValueError:
                    continue
                if math.isfinite(value):
                    extra[column] = value
            if extra:
                item['advanced'] = extra
                count += 1
        added[key] = count
    return added


def identity(kind, raw):
    return 'nba:' + kind + ':' + (raw.zfill(10) if kind == 'game' else raw)


def season_year(game_id):
    year = int(game_id.zfill(10)[3:5])
    return 1900 + year if year >= 80 else 2000 + year


def main(output_dir=OUT):
    outputs = output_paths(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata = json.loads((RAW / 'source-metadata.json').read_text())
    version = metadata['currentVersionNumber']
    source_id = f'kaggle-nba-v{version}'
    observations = []
    corrections = json.loads((ROOT/'scripts/records/corrections.json').read_text())
    manifests = [json.loads(p.read_text()) for p in RAW.glob('*.manifest.json')]
    if len(manifests) < 5 or any(m['version'] != version for m in manifests):
        raise ValueError('All five source artifacts must be from the same pinned dataset version.')
    data = {'version': 1, 'teams': [], 'players': [], 'games': [], 'playerStats': [], 'teamStats': [], 'coverage': [], 'corrections': corrections,
            'sourceArtifacts': [{'id': m['file'], 'sourceId': source_id, 'url': m['source_url'],
                                 'sha256': m['csv_sha256'], 'byteSize': m['csv_bytes'], 'retrievedAt': m['retrieved_at'],
                                 'metadata': {'datasetVersion': m['version'], 'downloadSha256': m['download_sha256']}} for m in manifests],
            'sources': [{'id': source_id, 'name': 'Eoin Moore NBA historical dataset (NBA.com-derived)',
                         'url': 'https://www.kaggle.com/datasets/eoinamoore/historical-nba-data-and-player-box-scores',
                         'retrievedAt': max(m['retrieved_at'] for m in manifests), 'transformVersion': 'kaggle-dal-2-lineup',
                         'rights': {'storage': True, 'display': True, 'commercial': False,
                                    'evidence': f'Publisher metadata for version {version} declares CC0: Public Domain. Anonymous public download. Original NBA.com data rights not independently reviewed; commercial clearance not asserted.'}}]}
    all_games = {}
    excluded = Counter()
    for row in rows('Games.csv'):
        if DAL not in (row['hometeamId'], row['awayteamId']):
            continue
        game_id = row['gameId'].zfill(10)
        game_type = row['gameType']
        if game_id.startswith('002') and game_type in ('Regular Season', 'NBA Emirates Cup'):
            competition = 'regular'
        elif game_id.startswith('004') and game_type == 'Playoffs':
            competition = 'playoffs'
        else:
            excluded[game_type] += 1
            continue
        if row['gameId'] in all_games:
            raise ValueError('Duplicate source game identifier')
        all_games[row['gameId']] = row
        game = {'id': identity('game', row['gameId']), 'season': season_year(game_id), 'competition': competition,
                'date': row['gameDate'][:10], 'tipoffUtc': None,
                'homeTeamId': identity('team', row['hometeamId']), 'awayTeamId': identity('team', row['awayteamId']),
                'homeTeamName': (row['hometeamCity']+' '+row['hometeamName']).strip(),
                'awayTeamName': (row['awayteamCity']+' '+row['awayteamName']).strip(),
                'arenaName': row['arenaName'], 'neutral': None, 'status': 'final',
                'homeScore': number(row['homeScore']), 'awayScore': number(row['awayScore']),
                'sourceId': source_id, 'sourceGameId': game_id,
                'cup': game_type == 'NBA Emirates Cup' or 'cup' in row['gameLabel'].lower() or 'in-season' in row['gameSubtype'].lower()}
        for correction in corrections:
            if correction['entityType']=='game' and correction['gameId']==game['id']:
                if game[correction['field']] != correction['previous']:
                    raise ValueError('Source changed; re-review the versioned score correction.')
                game[correction['field']] = correction['replacement']
        # Explicit bubble arenas, not inferred from nominal home/away assignments.
        if game['date'] >= '2020-07-30' and game['date'] <= '2020-10-11' and ('Field House' in row['arenaName'] or 'Arena' == row['arenaName'] or 'AdventHealth' in row['arenaName']):
            game['neutral'] = True
        data['games'].append(game)
    game_map = {g['id']: g for g in data['games']}
    referenced_teams = {g[k] for g in data['games'] for k in ('homeTeamId', 'awayTeamId')}
    histories = defaultdict(list)
    for row in rows('TeamHistories.csv'):
        if identity('team', row['teamId']) in referenced_teams:
            histories[row['teamId']].append(row)
    for team_id, history in histories.items():
        latest = max(history, key=lambda x: int(x['seasonActiveTill']))
        names = [(r['teamCity']+' '+r['teamName']).strip() for r in history]
        data['teams'].append({'id': identity('team', team_id), 'abbreviation': latest['teamAbbrev'].strip(),
                              'name': names[history.index(latest)], 'nameKo': '댈러스 매버릭스' if team_id == DAL else '',
                              'aliases': sorted(set(names+[r['teamAbbrev'].strip() for r in history])),
                              'history': history})
    known_players = {}
    seen_players = set()
    for row in rows('PlayerStatistics.csv'):
        if row['gameId'] not in all_games:
            continue
        player_id = row['personId']
        known_players[player_id] = (row['firstName']+' '+row['lastName']).strip()
        game_id = identity('game', row['gameId'])
        key = (game_id, player_id)
        if key in seen_players:
            observations.append({'entity': 'player', 'gameId': game_id, 'playerId': player_id, 'issue': 'duplicate_row_withheld', 'raw': row})
            continue
        seen_players.add(key)
        stat = values(row)
        comment = row.get('comment', '').strip()
        explicit_nonplayer = comment.upper().startswith(('DNP', 'DND', 'NWT', 'INACTIVE'))
        participation = 'inactive' if comment.upper().startswith('INACTIVE') else 'dnp' if explicit_nonplayer else 'played' if (stat['MIN_SECONDS'] or 0) > 0 else 'unknown'
        issues = withhold_inconsistent_fields(stat)
        if issues:
            observations.append({'entity': 'player', 'gameId': game_id, 'playerId': player_id, 'action': 'fields_withheld', 'issue': issues, 'raw': row})
        if explicit_nonplayer and any(v not in (0, None) for k,v in stat.items()):
            observations.append({'entity': 'player', 'gameId': game_id, 'playerId': player_id, 'issue': 'nonplaying_comment_conflicts_with_statistics', 'raw': row})
            continue
        if explicit_nonplayer:
            stat = dict.fromkeys(FIELDS)
        game = game_map[game_id]
        resolved_team = source_team(row, all_games[row['gameId']])
        team_id = identity('team', resolved_team)
        if team_id not in (game['homeTeamId'], game['awayTeamId']):
            observations.append({'entity': 'player', 'gameId': game_id, 'playerId': player_id, 'issue': 'team_reference_mismatch', 'raw': row})
            continue
        data['playerStats'].append({'gameId': game_id, 'teamId': team_id, 'playerId': identity('player', player_id),
                                    'participation': participation, 'starter': True if row.get('startingPosition', '').strip() else None,
                                    'starterPosition': starting_position(row),
                                    'reason': comment or ('Participation not confirmed by source minutes' if participation == 'unknown' else None),
                                    'values': stat, 'sourceId': source_id})
        if not row['playerteamId']:
            observations.append({'entity': 'player', 'gameId': game_id, 'playerId': player_id, 'action': 'team_id_resolved',
                                 'issue': 'missing_provider_team_id', 'teamId': team_id, 'evidence': 'Exact home flag and contemporaneous city/name match to source game ledger.'})
    used_players = {s['playerId'] for s in data['playerStats']}
    bios = {r['personId']: r for r in rows('Players.csv') if identity('player', r['personId']) in used_players}
    for player_id, name in known_players.items():
        if identity('player', player_id) not in used_players:
            continue
        ko, aliases = PLAYER_NAMES_KO.get(player_id, ('', []))
        data['players'].append({'id': identity('player', player_id), 'name': name, 'nameKo': ko, 'aliases': aliases, 'bio': bios.get(player_id, {})})
    seen_teams = set()
    for row in rows('TeamStatistics.csv'):
        if row['gameId'] not in all_games:
            continue
        game_id, team_id = identity('game', row['gameId']), identity('team', row['teamId'])
        stat = values(row, team=True)
        for correction in corrections:
            if correction['entityType']=='teamGameStat' and correction['gameId']==game_id and correction['entityId']==team_id:
                if stat[correction['field']] != correction['previous']:
                    raise ValueError('Source changed; re-review the versioned team correction.')
                stat[correction['field']] = correction['replacement']
        field_issues = withhold_inconsistent_fields(stat)
        if field_issues:
            observations.append({'entity': 'team', 'gameId': game_id, 'teamId': team_id, 'action': 'fields_withheld', 'issue': field_issues, 'raw': row})
        issues = []
        game = game_map[game_id]
        if team_id not in (game['homeTeamId'], game['awayTeamId']):
            issues.append('team_reference_mismatch')
        if stat['PTS'] != (game['homeScore'] if team_id == game['homeTeamId'] else game['awayScore']):
            issues.append('score_disagrees_with_game_ledger')
        if (game_id, team_id) in seen_teams:
            issues.append('duplicate_team_row')
        if issues:
            observations.append({'entity': 'team', 'gameId': game_id, 'teamId': team_id, 'issue': issues, 'raw': row})
            continue
        seen_teams.add((game_id, team_id))
        data['teamStats'].append({'gameId': game_id, 'teamId': team_id, 'values': stat,
                                  'teamRebounds': number(row['reboundsTeam']), 'teamTurnovers': number(row['turnoversTeam']), 'sourceId': source_id})
    # A whole game side with zero +/- contradicts its nonzero final margin. Preserve
    # these upstream zeros in raw artifacts, but do not publish them as measured 0.
    sides = defaultdict(list)
    for row in data['playerStats']:
        if row['participation'] == 'played':
            sides[(row['gameId'],row['teamId'])].append(row)
    for (game_id, team_id), group in sides.items():
        if group and all(r['values']['PLUS_MINUS'] == 0 for r in group):
            for row in group:
                row['values']['PLUS_MINUS'] = None
            observations.append({'entity': 'game_side', 'gameId': game_id, 'teamId': team_id, 'action': 'fields_withheld',
                                 'issue': 'all_zero_player_plus_minus_in_non_tied_final', 'rows': len(group)})
    all_sides = defaultdict(list)
    for row in data['playerStats']:
        if row['participation'] in ('played', 'unknown'):
            all_sides[(row['gameId'], row['teamId'])].append(row)
    score_audit = []
    for team in data['teamStats']:
        group = all_sides[(team['gameId'], team['teamId'])]
        known_sum = sum(r['values']['PTS'] or 0 for r in group)
        if known_sum != team['values']['PTS']:
            note = {'entity': 'game_side', 'gameId': team['gameId'], 'teamId': team['teamId'],
                    'action': 'audit_only', 'issue': 'player_points_sum_differs_from_team',
                    'knownPlayerPoints': known_sum, 'teamPoints': team['values']['PTS'],
                    'missingPlayerPoints': sum(r['values']['PTS'] is None for r in group),
                    'unknownParticipationRows': sum(r['participation']=='unknown' for r in group)}
            score_audit.append(note)
            observations.append(note)
    advanced_counts = attach_advanced(data, all_games)
    game_groups = defaultdict(list)
    player_groups, team_groups = defaultdict(list), defaultdict(list)
    for game in data['games']:
        game_groups[(game['season'], game['competition'])].append(game)
    for name, target in [('playerStats', player_groups), ('teamStats', team_groups)]:
        for row in data[name]:
            game = game_map[row['gameId']]
            target[(game['season'], game['competition'])].append(row)
    season_report = []
    for season in range(1980, max(g['season'] for g in data['games'])+1):
        for competition in ('regular', 'playoffs'):
            scope = (season, competition)
            gs, ps, ts = game_groups[scope], player_groups[scope], team_groups[scope]
            evidence = f'Kaggle version {version} source game ledger; not independently reconciled against NBA season totals. DNP roster completeness unverified.'
            for name, group, expected in [('games', gs, len(gs)), ('playerStats', ps, None), ('teamStats', ts, 2*len(gs))]:
                data['coverage'].append({'season': season, 'competition': competition, 'dataset': name, 'field': 'all',
                                          'expected': expected, 'observed': len(group), 'status': 'partial' if group else 'unverified', 'evidence': evidence})
                if name != 'games':
                    for metric in FIELDS:
                        data['coverage'].append({'season': season, 'competition': competition, 'dataset': name, 'field': metric,
                                                  'expected': None, 'observed': sum(r['values'][metric] is not None for r in group),
                                                  'status': 'partial' if group else 'unverified', 'evidence': evidence})
            season_report.append({'season': season, 'competition': competition, 'games': len(gs), 'player_rows': len(ps),
                                   'team_rows': len(ts), 'missing_team_rows': len(gs)*2-len(ts),
                                   'games_without_player_stats': sum(not any(r['gameId']==g['id'] for r in ps) for g in gs)})
    for name in ('teams', 'players', 'games'):
        data[name].sort(key=lambda x:x['id'])
    for name in ('playerStats', 'teamStats'):
        data[name].sort(key=lambda x:(x['gameId'], x.get('playerId',x['teamId'])))
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n'
    with outputs['dataset.json'].open('x') as handle:
        handle.write(payload)
    with outputs['observations.json'].open('x') as handle:
        handle.write(json.dumps(observations, ensure_ascii=False, indent=2)+'\n')
    lineup_sides = defaultdict(list)
    for row in data['playerStats']:
        lineup_sides[(row['gameId'], row['teamId'])].append(row)
    starter_counts = Counter(sum(row['starter'] is True for row in group) for group in lineup_sides.values())
    report = {'source': data['sources'][0], 'artifacts': manifests,
              'counts': {name: len(data[name]) for name in ('games','players','teams','playerStats','teamStats')},
              'datasetBytes': len(payload.encode()), 'datasetSha256': hashlib.sha256(payload.encode()).hexdigest(),
              'seasons': season_report, 'excludedCompetitionCounts': dict(excluded),
              'quarantinedRows': sum('action' not in o for o in observations),
              'fieldCorrections': sum(o.get('action')=='fields_withheld' for o in observations),
              'resolvedTeamIds': sum(o.get('action')=='team_id_resolved' for o in observations),
              'advancedRows': advanced_counts, 'evidencedCorrections': len(corrections),
              'scoreReconciliationIssues': score_audit,
              'unknownNeutralGames': sum(g['neutral'] is None for g in data['games']),
              'lineups': {
                  'sourceField': 'PlayerStatistics.csv:startingPosition',
                  'positionCounts': dict(Counter(row['starterPosition'] or 'unknown' for row in data['playerStats'])),
                  'starterCountByTeamGame': dict(sorted(starter_counts.items())),
                  'teamsWithFiveStarters': starter_counts[5],
                  'teamsWithoutFiveStarters': len(lineup_sides) - starter_counts[5],
                  'evidence': 'Game-specific source field preserved verbatim when G/F/C. A team with other than five source starters cannot support a confirmed Starter/Bench classification; profile positions are not substituted.'},
              'participation': dict(Counter(s['participation'] for s in data['playerStats'])),
              'limitations': ['No independent full-season reconciliation yet.', 'Source tipoff timezone is ambiguous; UTC tipoffs not invented.',
                             'Neutral-site status is unknown unless explicitly evidenced.', 'Missing source DNP rows are not synthesized.',
                             'Player totals are DAL appearances; opponents are retained for DAL game box scores.']}
    with outputs['report.json'].open('x') as handle:
        handle.write(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k: report[k] for k in ('counts','datasetBytes','quarantinedRows','unknownNeutralGames','participation')}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=OUT,
                        help='New snapshot directory; existing outputs are never overwritten.')
    main(parser.parse_args().output_dir)

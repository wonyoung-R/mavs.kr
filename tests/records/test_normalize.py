import importlib.util
from pathlib import Path
import unittest
import tempfile

script = Path(__file__).resolve().parents[2] / 'scripts/records/normalize.py'
spec = importlib.util.spec_from_file_location('normalize', script)
normalize = importlib.util.module_from_spec(spec)
spec.loader.exec_module(normalize)


class NormalizeTests(unittest.TestCase):
    def test_season_uses_game_identifier_not_calendar_year(self):
        self.assertEqual(normalize.season_year('41900101'), 2019)
        self.assertEqual(normalize.season_year('28000010'), 1980)
        self.assertEqual(normalize.season_year('20000010'), 2000)

    def test_minutes_and_missing_fields_preserve_zero(self):
        row = {'numMinutes': '39.166666666666664', 'points': '0'}
        value = normalize.values(row)
        self.assertEqual(value['MIN_SECONDS'], 2350)
        self.assertEqual(value['PTS'], 0)
        self.assertIsNone(value['REB'])

    def test_contradictory_rebound_components_are_unknown(self):
        value = dict.fromkeys(normalize.FIELDS)
        value.update(OREB=0, DREB=0, REB=7, PTS=12)
        self.assertEqual(normalize.withhold_inconsistent_fields(value), ['rebound_components_disagree'])
        self.assertIsNone(value['OREB'])
        self.assertIsNone(value['DREB'])
        self.assertEqual(value['REB'], 7)
        self.assertEqual(value['PTS'], 12)

    def test_missing_team_id_requires_exact_ledger_join(self):
        row = {'playerteamId': '', 'home': '1', 'playerteamCity': 'Dallas', 'playerteamName': 'Mavericks'}
        game = {'hometeamCity': 'Dallas', 'hometeamName': 'Mavericks', 'hometeamId': '1610612742'}
        self.assertEqual(normalize.source_team(row, game), '1610612742')
        self.assertEqual(normalize.source_team({**row, 'playerteamName': 'Unknown'}, game), '')

    def test_invalid_shooting_counts_are_not_guessed(self):
        value = dict.fromkeys(normalize.FIELDS)
        value.update(FGM=6, FGA=5, PTS=12)
        normalize.withhold_inconsistent_fields(value)
        self.assertIsNone(value['FGM'])
        self.assertIsNone(value['FGA'])
        self.assertEqual(value['PTS'], 12)

    def test_starting_position_is_game_specific_and_not_inferred(self):
        for position in ('G', 'F', 'C'):
            self.assertEqual(normalize.starting_position({'startingPosition': position}), position)
        self.assertIsNone(normalize.starting_position({'startingPosition': '', 'guard': '1'}))
        self.assertIsNone(normalize.starting_position({'startingPosition': 'PG'}))
        self.assertIsNone(normalize.starting_position({}))

    def test_output_snapshot_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            paths = normalize.output_paths(target)
            self.assertEqual(paths['dataset.json'], target / 'dataset.json')
            paths['dataset.json'].write_text('existing release')
            with self.assertRaises(FileExistsError):
                normalize.output_paths(target)
            self.assertEqual(paths['dataset.json'].read_text(), 'existing release')


if __name__ == '__main__':
    unittest.main()

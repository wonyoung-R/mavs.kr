import importlib.util
from pathlib import Path
import unittest
import os
from unittest.mock import patch

script = Path(__file__).resolve().parents[2] / 'scripts/migration/records-transfer-audit.py'
spec = importlib.util.spec_from_file_location('records_audit', script)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditSafetyTest(unittest.TestCase):
    def sample(self):
        group = {'release_id': 'r_old', 'rows': 2, 'checksum': 'same'}
        release = {'id': 'r_old', 'counts': {'games': 2}}
        source = {'tables': [{'name': 'games_storage', 'releases': [dict(group)]}],
                  'releases': [dict(release), {'id': 'r_new'}], 'current_release': [{'release_id': 'r_new'}]}
        target = {'tables': [{'name': 'games', 'releases': [dict(group)]}],
                  'releases': [dict(release)], 'current_release': [{'release_id': 'r_old'}]}
        return source, target

    def test_matching_history_allows_only_additive_plan(self):
        source, target = self.sample()
        result = audit.compare(source, target)
        self.assertTrue(result['safe_to_plan_additive_upgrade'])
        self.assertEqual([r['id'] for r in result['missing_releases']], ['r_new'])
        self.assertEqual(result['source_current'], source['current_release'])

    def test_different_history_blocks_transfer(self):
        source, target = self.sample()
        target['tables'][0]['releases'][0]['checksum'] = 'different'
        self.assertFalse(audit.compare(source, target)['safe_to_plan_additive_upgrade'])

    def test_target_only_release_is_not_discarded(self):
        source, target = self.sample()
        target['releases'].append({'id': 'target_only'})
        self.assertFalse(audit.compare(source, target)['safe_to_plan_additive_upgrade'])

    def test_target_only_table_blocks_transfer(self):
        source, target = self.sample()
        target['tables'].append({'name': 'unrecognized_records_table'})
        self.assertFalse(audit.compare(source, target)['safe_to_plan_additive_upgrade'])

    def test_connection_ref_mismatch_fails_before_network(self):
        with self.assertRaisesRegex(RuntimeError, 'reference mismatch'):
            audit.connection('postgresql://postgres.wrong:fixture@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres', audit.TARGET)

    def test_connection_is_readonly_and_password_not_in_options(self):
        env = audit.connection('postgresql://postgres.nycoldtrqbkevvgoajlq:fixture@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres', audit.TARGET)
        self.assertIn('default_transaction_read_only=on', env['PGOPTIONS'])
        self.assertEqual(env['PGSSLMODE'], 'require')
        self.assertNotIn('fixture', env['PGOPTIONS'])

    def test_inherited_connection_overrides_are_removed(self):
        with patch.dict(os.environ, {'PGHOSTADDR': '192.0.2.1', 'PGSERVICE': 'wrong', 'PGOPTIONS': '-c search_path=wrong'}):
            env = audit.connection('postgresql://postgres:fixture@db.nycoldtrqbkevvgoajlq.supabase.co:5432/postgres', audit.TARGET)
        self.assertNotIn('PGHOSTADDR', env)
        self.assertNotIn('PGSERVICE', env)
        self.assertEqual(env['PGHOST'], 'db.nycoldtrqbkevvgoajlq.supabase.co')
        self.assertIn('default_transaction_read_only=on', env['PGOPTIONS'])

    def test_non_postgres_or_untrusted_host_is_rejected(self):
        for url in ['https://postgres:fixture@db.nycoldtrqbkevvgoajlq.supabase.co', 'postgresql://postgres:fixture@nycoldtrqbkevvgoajlq']:
            with self.assertRaises(RuntimeError):
                audit.connection(url, audit.TARGET)


if __name__ == '__main__':
    unittest.main()

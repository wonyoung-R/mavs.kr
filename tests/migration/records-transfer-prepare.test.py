import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

path = Path(__file__).resolve().parents[2] / 'scripts/migration/records-transfer-prepare.py'
spec = importlib.util.spec_from_file_location('records_prepare', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fixtures():
    old_names = ['releases','current_release',*module.STORAGE]
    new_names = ['releases','current_release','release_layers','source_responses','sync_runs','sync_leases',*(name+'_storage' for name in module.STORAGE)]
    def columns(names):
        return [{'table':name,'name':'id','type':'text','notnull':True} for name in names]
    source = {'project':module.SOURCE,'tables':[{'name':name,'rows':0 if name=='sync_leases' else 1} for name in new_names],
              'catalog':{'functions':None,'columns':columns(new_names),'relations':[{'name':name,'kind':'r'} for name in new_names]}}
    target = {'project':module.TARGET,'tables':[{'name':name,'rows':1,'checksum':'a'*32} for name in old_names],
              'catalog':{'columns':columns(old_names)}}
    comparison = {'safe_to_plan_additive_upgrade':True,'issues':[],'historical_comparisons':[{'match':True}]}
    return source,target,comparison


class PrepareTest(unittest.TestCase):
    def test_all_data_preconditions_accept_only_expected_legacy_upgrade(self):
        module.validate_inputs(*fixtures())

    def test_wrong_project_drift_and_active_collector_are_rejected(self):
        for mutation in ['project','history','lease','new_table','column','function']:
            source,target,comparison = fixtures()
            if mutation=='project':target['project']='another-project'
            elif mutation=='history':comparison['historical_comparisons'][0]['match']=False
            elif mutation=='lease':next(t for t in source['tables'] if t['name']=='sync_leases')['rows']=1
            elif mutation=='new_table':target['tables'].append({'name':'unexpected'})
            elif mutation=='column':next(c for c in source['catalog']['columns'] if c['table']=='sources_storage')['type']='integer'
            elif mutation=='function':source['catalog']['functions']=[{'name':'unexpected'}]
            with self.subTest(mutation=mutation),self.assertRaises(RuntimeError):
                module.validate_inputs(source,target,comparison)

    def test_missing_comparison_or_reported_issue_cannot_be_overridden(self):
        for value in [{},{'safe_to_plan_additive_upgrade':True,'issues':['conflict']}, {'safe_to_plan_additive_upgrade':True,'issues':[],'historical_comparisons':[]}]:
            source,target,_ = fixtures()
            with self.assertRaises(RuntimeError):module.validate_inputs(source,target,value)

    def test_local_connection_discards_hostaddr_and_service_overrides(self):
        with patch.dict(os.environ,{'PGHOSTADDR':'203.0.113.2','PGSERVICE':'remote','PGPASSFILE':'/private/remote-pass'}):
            env = module.local_environment({'port':55432,'user':'local','password':'not-printed'},'local_rehearsal')
        self.assertEqual(env['PGHOST'],'127.0.0.1')
        self.assertEqual(env['PGDATABASE'],'local_rehearsal')
        self.assertNotIn('PGHOSTADDR',env)
        self.assertNotIn('PGSERVICE',env)
        self.assertNotIn('PGPASSFILE',env)
        with self.assertRaises(RuntimeError):module.local_environment({'port':5432,'user':'local','password':'x'})

    def test_guard_locks_then_checks_every_historical_digest(self):
        _,target,_ = fixtures()
        sql = module.guards_sql(target)
        self.assertTrue(sql.startswith('BEGIN;'))
        self.assertIn('IN ACCESS EXCLUSIVE MODE',sql)
        self.assertEqual(sql.count('Target snapshot drift:'),len(target['tables']))
        self.assertIn('Target already upgraded; refuse reapply',sql)
        self.assertNotIn('DROP ',sql)
        self.assertNotIn('TRUNCATE ',sql)

    def test_permissions_revoke_browser_access_and_limit_writer_to_records(self):
        source,_,_ = fixtures()
        sql = module.permissions_sql(source)
        self.assertIn('REVOKE ALL ON SCHEMA records FROM PUBLIC, anon, authenticated, service_role',sql)
        self.assertIn('ALTER DEFAULT PRIVILEGES IN SCHEMA records REVOKE ALL ON TABLES',sql)
        self.assertIn('GRANT mavs_public_reader TO mavs_records_reader',sql)
        self.assertIn('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA records TO mavs_records_writer',sql)
        self.assertNotIn('BYPASSRLS',sql)
        self.assertNotIn('public.',sql)
        self.assertIn('WITH CHECK (true)',sql)

    def test_identifiers_and_literals_cannot_inject_extra_statements(self):
        self.assertEqual(module.ident('sync_runs'),'"sync_runs"')
        self.assertEqual(module.literal("r_'quoted"),"'r_''quoted'")
        for value in ['x;DROP TABLE records.games','x.y','../x','']:
            with self.assertRaises(RuntimeError):module.ident(value)
        with self.assertRaises(RuntimeError):module.literal('nul\x00byte')

    def test_additive_index_plan_preserves_tuned_index_and_rejects_name_conflicts(self):
        original = {'table':'games_storage','definition':'CREATE INDEX games_scope ON records.games_storage USING btree (release_id, season)'}
        tuned = {'table':'player_game_stats_storage','definition':'CREATE INDEX records_player_team_catalog_idx ON records.player_game_stats_storage USING btree (release_id, team_id, player_id)'}
        self.assertEqual(module.missing_indexes([original,tuned],[original]),[tuned['definition']+';'])
        conflict = {'table':'games_storage','definition':'CREATE INDEX games_scope ON records.games_storage USING btree (season)'}
        with self.assertRaises(RuntimeError):module.missing_indexes([original],[conflict])
        with self.assertRaises(RuntimeError):module.missing_indexes([original],[original,tuned])


if __name__=='__main__':unittest.main()

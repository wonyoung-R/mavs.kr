#!/usr/bin/env python3
"""Build and rehearse an additive records transfer using local backups only.

Only loopback PostgreSQL is reachable through this script. No remote credentials
are loaded, no database is dropped, and the resulting SQL never deletes data.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PG = Path('/opt/homebrew/opt/postgresql@17/bin')
SOURCE = 'ztlqbnmfppcndprmenti'
TARGET = 'nycoldtrqbkevvgoajlq'
STORAGE = ['sources', 'source_artifacts', 'teams', 'players', 'games', 'player_game_stats', 'team_game_stats', 'coverage']
ROLES = ['mavs_public_reader', 'mavs_records_reader', 'mavs_records_writer']


def ident(value):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*', value):
        raise RuntimeError('Unexpected SQL identifier')
    return '"' + value + '"'


def literal(value):
    if not isinstance(value, str) or '\x00' in value:
        raise RuntimeError('Unexpected SQL literal')
    return "'" + value.replace("'", "''") + "'"


def local_environment(config, database='postgres'):
    # Ignore inherited PGHOST/connection URLs; this task can only use the local server.
    if config['port'] != 55432:
        raise RuntimeError('Expected isolated local PostgreSQL port 55432')
    clean = {key:value for key,value in os.environ.items() if not key.startswith('PG')}
    return dict(clean, PGHOST='127.0.0.1', PGPORT='55432', PGUSER=config['user'],
                PGPASSWORD=config['password'], PGDATABASE=database, PGSSLMODE='disable',
                PGCONNECT_TIMEOUT='5', PGOPTIONS='-c timezone=UTC -c datestyle=ISO,YMD -c intervalstyle=postgres -c bytea_output=hex -c extra_float_digits=3 -c work_mem=256MB -c max_parallel_workers_per_gather=0 -c statement_timeout=180000')


def run(binary, args, env, log, text=None):
    with log.open('ab') as handle:
        result = subprocess.run([str(PG / binary), *args], input=text.encode() if text is not None else None,
                                env=env, stdout=subprocess.PIPE, stderr=handle, timeout=300)
    if result.returncode:
        raise RuntimeError(f'{binary} failed; inspect private rehearsal log')
    return result.stdout.decode()


def query(env, sql, log):
    output = run('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], env, log)
    return json.loads(output)


def execute(env, sql, log):
    run('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1'], env, log, sql)


def digest(env, name, log):
    schema, table = name.split('.')
    return query(env, f'''SELECT json_build_object('rows',count(*),'checksum',md5(coalesce(string_agg(h,'' ORDER BY h COLLATE "C"),''))) FROM (SELECT md5(to_jsonb(t)::text) h FROM {ident(schema)}.{ident(table)} t) q;''', log)


def verify_archive(directory, manifest):
    archive = directory / 'records.dump'
    if archive.stat().st_size != manifest['dump']['bytes'] or hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['dump']['sha256']:
        raise RuntimeError('Backup archive checksum mismatch')
    if archive.open('rb').read(5) != b'PGDMP':
        raise RuntimeError('Backup is not a PostgreSQL custom archive')
    return archive


def validate_inputs(source, target, comparison):
    if source['project'] != SOURCE or target['project'] != TARGET or not comparison.get('safe_to_plan_additive_upgrade') or comparison.get('issues'):
        raise RuntimeError('Historical comparison did not pass')
    if not comparison.get('historical_comparisons') or not all(item['match'] for item in comparison['historical_comparisons']):
        raise RuntimeError('Shared historical data must match exactly')
    source_tables = {item['name']:item for item in source['tables']}
    if source_tables['sync_leases']['rows'] != 0:
        raise RuntimeError('Source has a collection lease; prepare a quiescent snapshot')
    expected = {'releases', 'current_release', *STORAGE}
    if {item['name'] for item in target['tables']} != expected:
        raise RuntimeError('Target is not the expected legacy records schema')
    expected_source = {'releases', 'current_release', 'release_layers', 'source_responses', 'sync_runs', 'sync_leases', *(name+'_storage' for name in STORAGE)}
    if set(source_tables) != expected_source:
        raise RuntimeError('Unexpected source tables require a new review')
    if source['catalog'].get('functions'):
        raise RuntimeError('Source functions require an explicit transfer implementation')
    for name in STORAGE:
        source_columns = [(c['name'],c['type'],c['notnull']) for c in source['catalog']['columns'] if c['table'] == name+'_storage']
        target_columns = [(c['name'],c['type'],c['notnull']) for c in target['catalog']['columns'] if c['table'] == name]
        if source_columns != target_columns:
            raise RuntimeError('Historical column definitions differ: '+name)


def copy_into_packet(source_env, table, where, packet, directory, columns, log):
    file = directory / (table + '.copy')
    names = ','.join(ident(column) for column in columns)
    with file.open('xb') as output, log.open('ab') as errors:
        result = subprocess.run([str(PG / 'psql'), '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
                                 f'COPY (SELECT {names} FROM records.{ident(table)} {where}) TO STDOUT;'],
                                env=source_env, stdout=output, stderr=errors, timeout=180)
    if result.returncode:
        raise RuntimeError('Local COPY export failed')
    packet.write(f'COPY records.{ident(table)} ({names}) FROM STDIN;\n'.encode())
    with file.open('rb') as data:
        shutil.copyfileobj(data, packet)
    packet.write(b'\\.\n')


def guards_sql(target):
    locks = ','.join('records.'+ident(item['name']) for item in target['tables'])
    parts = ['BEGIN;', "SET LOCAL lock_timeout='5s';", "SET LOCAL statement_timeout='180s';", "SET LOCAL timezone='UTC';", "SET LOCAL datestyle='ISO,YMD';", "SET LOCAL bytea_output='hex';", 'SELECT pg_advisory_xact_lock(937226541);', f'LOCK TABLE {locks} IN ACCESS EXCLUSIVE MODE;']
    parts.append("DO $guard$ BEGIN IF to_regclass('records.release_layers') IS NOT NULL THEN RAISE EXCEPTION 'Target already upgraded; refuse reapply'; END IF; END $guard$;")
    for item in target['tables']:
        name = ident(item['name'])
        parts.append(f'''DO $guard$ DECLARE n bigint; h text; BEGIN
          SELECT count(*),md5(coalesce(string_agg(x.h,'' ORDER BY x.h COLLATE "C"),'')) INTO n,h
          FROM (SELECT md5(to_jsonb(t)::text) h FROM ONLY records.{name} t) x;
          IF n <> {int(item['rows'])} OR h <> {literal(item['checksum'])} THEN
            RAISE EXCEPTION 'Target snapshot drift: {item['name']}'; END IF;
        END $guard$;''')
    return '\n'.join(parts)+'\n'


def permissions_sql(source):
    parts = [
        'REVOKE ALL ON SCHEMA records FROM PUBLIC, anon, authenticated, service_role;',
        'REVOKE ALL ON ALL TABLES IN SCHEMA records FROM PUBLIC, anon, authenticated, service_role;',
        'REVOKE ALL ON ALL SEQUENCES IN SCHEMA records FROM PUBLIC, anon, authenticated, service_role;',
        'ALTER DEFAULT PRIVILEGES IN SCHEMA records REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;',
        'ALTER DEFAULT PRIVILEGES IN SCHEMA records REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;',
        'GRANT USAGE ON SCHEMA records TO mavs_public_reader, mavs_records_reader, mavs_records_writer;',
        'GRANT mavs_public_reader TO mavs_records_reader;',
        'GRANT SELECT ON ALL TABLES IN SCHEMA records TO mavs_public_reader, mavs_records_reader;',
        'GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA records TO mavs_records_writer;',
        'GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA records TO mavs_records_writer;',
    ]
    for relation in source['catalog']['relations']:
        if relation['kind'] != 'r':
            continue
        name = ident(relation['name'])
        parts.append(f'ALTER TABLE records.{name} ENABLE ROW LEVEL SECURITY;')
        for policy, role, command, check in [
            ('mavs_public_read','mavs_public_reader','SELECT',''),
            ('mavs_records_writer_all','mavs_records_writer','ALL',' WITH CHECK (true)'),
        ]:
            parts.append(f'''DO $policy$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='records' AND tablename={literal(relation['name'])} AND policyname={literal(policy)}) THEN
              CREATE POLICY {ident(policy)} ON records.{name} FOR {command} TO {ident(role)} USING (true){check};
            END IF; END $policy$;''')
    return '\n'.join(parts)+'\n'


def indexes_query():
    return "SELECT coalesce(json_agg(json_build_object('table',tablename,'definition',indexdef) ORDER BY indexname),'[]'::json) FROM pg_indexes WHERE schemaname='records';"


def constraints_query():
    return "SELECT coalesce(json_agg(json_build_object('table',c.relname,'name',x.conname,'definition',pg_get_constraintdef(x.oid)) ORDER BY c.relname,x.conname),'[]'::json) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='records';"


def final_assertions_sql(source):
    # Validate metadata and exposure inside the same transaction, before publication commits.
    blocks = []
    for key,sql in [('indexes',indexes_query()),('constraints',constraints_query())]:
        expected = literal(json.dumps(source['catalog'][key],ensure_ascii=False))
        blocks.append(f'''DO $verify$ DECLARE actual jsonb; BEGIN SELECT result::jsonb INTO actual FROM ({sql.rstrip(';')}) q(result);
          IF actual <> {expected}::jsonb THEN RAISE EXCEPTION 'Transferred {key} differ from source'; END IF;
        END $verify$;''')
    blocks.append('''DO $exposure$ DECLARE role_name text; item record; BEGIN
      FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
        IF has_schema_privilege(role_name,'records','USAGE') THEN RAISE EXCEPTION 'Unexpected browser schema access'; END IF;
        FOR item IN SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='records' AND c.relkind IN ('r','v') LOOP
          IF has_table_privilege(role_name,item.oid,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Unexpected browser table access'; END IF;
        END LOOP;
      END LOOP;
    END $exposure$;''')
    return '\n'.join(blocks)+'\n'


def missing_indexes(source, upgraded):
    def named(items):
        result = {}
        for item in items:
            match = re.match(r'CREATE (?:UNIQUE )?INDEX ([a-z_0-9]+) ON records\.[a-z_0-9]+ USING ',item['definition'])
            if not match:
                raise RuntimeError('Unexpected index definition; manual review required')
            result[match.group(1)] = item
        return result
    expected, actual = named(source),named(upgraded)
    if set(actual) - set(expected) or any(expected[name] != item for name,item in actual.items()):
        raise RuntimeError('Existing target index differs from source after additive upgrade')
    return [item['definition']+';' for name,item in expected.items() if name not in actual]


def make_packet(source_env, target_env, source, target, output, log):
    source_columns = {item['name']:[c['name'] for c in source['catalog']['columns'] if c['table'] == item['name']] for item in source['tables']}
    ids = [item['id'] for item in target['releases']]
    joined = ','.join(literal(value) for value in ids)
    layers = query(source_env, f'SELECT coalesce(json_agg(t ORDER BY published_release_id),\'[]\'::json) FROM records.release_layers t WHERE published_release_id IN ({joined});', log)
    if sorted(layers,key=lambda x:x['published_release_id']) != sorted([{'published_release_id':value,'storage_release_id':value,'priority':0,'season':None} for value in ids],key=lambda x:x['published_release_id']):
        raise RuntimeError('Historical logical layers differ from the expected self layers')
    sequence = query(source_env, 'SELECT json_build_object(\'last_value\',last_value,\'is_called\',is_called) FROM records.sync_runs_id_seq;', log)
    upgrade = (ROOT/'scripts/records/sql/003_release_layers.sql').read_text()+'\n'+(ROOT/'scripts/records/sql/004_sync_lease.sql').read_text()
    # Derive the additional index set from a rollback-only local DDL rehearsal.
    upgraded_indexes = query(target_env,'BEGIN;\n'+upgrade+'\n'+indexes_query()+'\nROLLBACK;',log)
    additions = missing_indexes(source['catalog']['indexes'],upgraded_indexes)
    packet_path = output / 'apply.sql'
    with packet_path.open('xb') as packet:
        packet.write(guards_sql(target).encode())
        packet.write((ROOT/'scripts/records/sql/003_release_layers.sql').read_bytes()+b'\n')
        packet.write((ROOT/'scripts/records/sql/004_sync_lease.sql').read_bytes()+b'\n')
        copy_into_packet(source_env,'releases',f'WHERE id NOT IN ({joined})',packet,output,source_columns['releases'],log)
        for name in STORAGE:
            table = name+'_storage'
            copy_into_packet(source_env,table,f'WHERE release_id NOT IN ({joined})',packet,output,source_columns[table],log)
        copy_into_packet(source_env,'release_layers',f'WHERE published_release_id NOT IN ({joined})',packet,output,source_columns['release_layers'],log)
        for table in ['source_responses','sync_runs']:
            copy_into_packet(source_env,table,'',packet,output,source_columns[table],log)
        packet.write(('\n'.join(additions)+'\n').encode())
        packet.write(f"SELECT setval('records.sync_runs_id_seq',{int(sequence['last_value'])},{str(sequence['is_called']).lower()});\n".encode())
        packet.write(permissions_sql(source).encode())
        current = source['current_release']
        if len(current) != 1 or current[0]['singleton'] is not True:
            raise RuntimeError('Source public pointer must have one singleton row')
        packet.write(f"UPDATE records.current_release SET release_id={literal(current[0]['release_id'])},published_at={literal(current[0]['published_at'])}::timestamptz WHERE singleton=true;\n".encode())
        packet.write(final_assertions_sql(source).encode())
        packet.write(b'COMMIT;\n')
    return packet_path, sequence


def expected_denied(env, sql, log):
    with log.open('ab') as errors:
        result = subprocess.run([str(PG/'psql'),'-X','-q','-v','ON_ERROR_STOP=1','-c',sql],env=env,stdout=subprocess.DEVNULL,stderr=errors,timeout=30)
    return result.returncode != 0


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('snapshot',type=Path)
    args = parser.parse_args()
    snapshot = args.snapshot.resolve()
    if not snapshot.is_relative_to((ROOT/'data/migrations').resolve()):
        raise RuntimeError('Only this project private backup directory is allowed')
    source = json.loads((snapshot/SOURCE/'manifest.json').read_text())
    target = json.loads((snapshot/TARGET/'manifest.json').read_text())
    comparison = json.loads((snapshot/'comparison.json').read_text())
    validate_inputs(source,target,comparison)
    archives = {SOURCE:verify_archive(snapshot/SOURCE,source),TARGET:verify_archive(snapshot/TARGET,target)}
    config = json.loads((ROOT/'data/migrations/local-validation/connection.json').read_text())
    output = snapshot/('rehearsal-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+secrets.token_hex(2))
    output.mkdir(mode=0o700)
    log = output/'local.stderr.log'
    admin = local_environment(config)
    # Placeholders are confined to the existing isolated local cluster, never LOGIN.
    for role in ['anon','authenticated','service_role',*ROLES]:
        execute(admin,f"DO $role$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname={literal(role)}) THEN CREATE ROLE {ident(role)} NOLOGIN; END IF; END $role$;",log)
    prefix = 'mavs_xfer_'+datetime.now(timezone.utc).strftime('%m%d%H%M%S')+'_'+secrets.token_hex(2)
    databases = {SOURCE:prefix+'_source',TARGET:prefix+'_target'}
    for ref,name in databases.items():
        run('createdb',['--template=template0',name],admin,log)
        env = local_environment(config,name)
        run('pg_restore',['--no-owner','--no-acl','--exit-on-error','--single-transaction','--dbname',name,str(archives[ref])],env,log)
        print(json.dumps({'local_restored':ref,'database':name}),flush=True)
    senv = local_environment(config,databases[SOURCE])
    tenv = local_environment(config,databases[TARGET])
    execute(tenv,"CREATE TABLE public.migration_guard(id integer PRIMARY KEY,body text NOT NULL); INSERT INTO public.migration_guard VALUES (1,'Public application data must not change'),(2,'기존 회원·게시글 데이터 보존');",log)
    before_public = digest(tenv,'public.migration_guard',log)
    packet,sequence = make_packet(senv,tenv,source,target,output,log)
    run('psql',['-X','-q','-v','ON_ERROR_STOP=1','-f',str(packet)],tenv,log)
    tables = []
    for table in source['tables']:
        actual = digest(tenv,'records.'+table['name'],log)
        expected = {key:table[key] for key in ['rows','checksum']}
        if actual != expected:
            raise RuntimeError('Physical table does not match source snapshot: '+table['name'])
        tables.append({'name':table['name'],**actual,'match':True})
    views = []
    for name in STORAGE:
        a = digest(senv,'records.'+name,log)
        b = digest(tenv,'records.'+name,log)
        if a != b:
            raise RuntimeError('Logical/pinned view differs from source: '+name)
        views.append({'name':name,**b,'match':True})
    after_sequence = query(tenv,"SELECT json_build_object('last_value',last_value,'is_called',is_called) FROM records.sync_runs_id_seq;",log)
    final_indexes = query(tenv,indexes_query(),log)
    if missing_indexes(source['catalog']['indexes'],final_indexes):
        raise RuntimeError('A source index was not transferred')
    constraints = query(tenv,constraints_query(),log)
    if constraints != source['catalog']['constraints']:
        raise RuntimeError('Constraint definitions differ from source')
    if sequence != after_sequence or digest(tenv,'public.migration_guard',log) != before_public:
        raise RuntimeError('Sequence or public sentinel changed unexpectedly')
    reader = query(tenv,"SET ROLE mavs_records_reader; SELECT json_build_object('games',count(*)) FROM records.games WHERE release_id=(SELECT release_id FROM records.current_release); RESET ROLE;",log)
    if reader['games'] != next(r['counts']['games'] for r in source['releases'] if r['id']==source['current_release'][0]['release_id']):
        raise RuntimeError('Reader cannot see the current logical release')
    reader_denied = expected_denied(tenv,'BEGIN; SET LOCAL ROLE mavs_records_reader; UPDATE records.current_release SET published_at=published_at WHERE false; ROLLBACK;',log)
    writer_public_denied = expected_denied(tenv,'SET ROLE mavs_records_writer; SELECT * FROM public.migration_guard;',log)
    execute(tenv,"BEGIN; SET LOCAL ROLE mavs_records_writer; INSERT INTO records.sync_leases VALUES ('local_rehearsal_only',now()); ROLLBACK;",log)
    anon = query(tenv,"SELECT json_build_object('anon',has_schema_privilege('anon','records','USAGE'),'authenticated',has_schema_privilege('authenticated','records','USAGE'),'service_role',has_schema_privilege('service_role','records','USAGE'));",log)
    if not reader_denied or not writer_public_denied or any(anon.values()):
        raise RuntimeError('A permission boundary failed')
    report = {'status':'rehearsal_passed','source':SOURCE,'target':TARGET,'local_databases':databases,
              'apply_sql':'apply.sql','apply_sha256':hashlib.sha256(packet.read_bytes()).hexdigest(),'apply_bytes':packet.stat().st_size,
              'tables':tables,'views':views,'sequence':sequence,'public_sentinel_unchanged':True,
              'indexes_match':True,'index_count':len(final_indexes),'constraints_match':True,'constraint_count':len(constraints),
              'live_public_hash_recheck_required':True,'reader_current_games':reader['games'],'reader_write_denied':reader_denied,
              'writer_public_read_denied':writer_public_denied,'writer_lease_insert_rollback_passed':True,'anonymous_records_schema_access':anon,
              'source_current_release':source['current_release'],'remote_database_changes':False}
    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'output':str(output.relative_to(ROOT)),'physical_tables':len(tables),'logical_views':len(views),'packet_bytes':report['apply_bytes'],'reader_current_games':reader['games']}),flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Local rehearsal stopped: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__),flush=True)
        raise SystemExit(1)

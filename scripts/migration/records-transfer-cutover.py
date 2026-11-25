#!/usr/bin/env python3
"""Explicit records-only database cutover; no public/Auth/Storage writes or deploys.
Requires a passing local rehearsal and exact snapshot hashes. Secrets never enter argv.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
from urllib.parse import urlparse, urlencode, quote

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('audit', ROOT / 'scripts/migration/records-transfer-audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
PG = audit.PG


def private_json(path, data):
    # State records intentionally update after each completed phase.
    fd = os.open(path, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as handle:
        json.dump(data, handle, indent=2)


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def write_env(url, ref):
    env = audit.connection(url, ref)
    for key in ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE']:
        env.pop(key, None)
    env['PGOPTIONS'] = '-c default_transaction_read_only=off -c statement_timeout=180000 -c lock_timeout=8000 -c timezone=UTC -c datestyle=ISO,YMD -c intervalstyle=postgres -c bytea_output=hex -c extra_float_digits=3'
    return env


def sql(env, text, log):
    result = subprocess.run([str(PG / 'psql'), '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'],
                            input=text, env=env, capture_output=True, text=True, timeout=240)
    log.write_text(result.stdout + result.stderr)
    os.chmod(log, 0o600)
    if result.returncode:
        raise RuntimeError('Database command failed; see private phase log')
    return result.stdout


def scalar(env, query, log):
    return json.loads(sql(env, query, log))


def digest_query(table):
    if not re.fullmatch(r'[a-zA-Z_]+', table):
        raise RuntimeError('Unexpected table identifier')
    return f'''SELECT json_build_object('rows',count(*),'checksum',md5(coalesce(string_agg(h,'' ORDER BY h COLLATE "C"),''))) FROM (SELECT md5(to_jsonb(t)::text) h FROM ONLY records."{table}" t) q;'''


def resume_source(env, manifest, folder):
    lines = ['BEGIN;', 'ALTER ROLE mavs_records_writer LOGIN;']
    for relation in manifest['catalog']['relations']:
        matching = [acl.split('=',1)[1].split('/',1)[0] for acl in relation.get('acl') or [] if acl.startswith('mavs_records_writer=')]
        if not matching:
            continue
        letters = matching[0]
        if relation['kind'] in ('r','v'):
            permissions = [name for letter,name in [('a','INSERT'),('w','UPDATE'),('d','DELETE')] if letter in letters]
            if permissions:
                lines.append('GRANT '+','.join(permissions)+' ON TABLE records."'+relation['name']+'" TO mavs_records_writer;')
        elif relation['kind'] == 'S' and 'U' in letters:
            lines.append('GRANT USAGE ON SEQUENCE records."'+relation['name']+'" TO mavs_records_writer;')
    lines.append('COMMIT;')
    sql(env, '\n'.join(lines), folder / 'source-writer-resume.log')


def credentials(target_url, folder):
    path = folder / 'target-records-credentials.json'
    if path.exists():
        return json.loads(path.read_text())
    parsed = urlparse(target_url)
    values = {'project_ref':audit.TARGET}
    for role, key in [('mavs_records_reader','reader'),('mavs_records_writer','writer')]:
        password = secrets.token_urlsafe(36)
        values[key+'_password'] = password
        query = urlencode({'pgbouncer':'true','connection_limit':'2','pool_timeout':'20','connect_timeout':'20','sslmode':'require'})
        values[key+'_url'] = f'postgresql://{quote(role+"."+audit.TARGET,safe="")}:{quote(password,safe="")}@{parsed.hostname}:6543/postgres?{query}'
        values[key+'_session_url'] = f'postgresql://{quote(role+"."+audit.TARGET,safe="")}:{quote(password,safe="")}@{parsed.hostname}:5432/postgres?sslmode=require'
    private_json(path, values)
    return values


def role_sql(values):
    return '''
DO $roles$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('mavs_public_reader','mavs_records_reader','mavs_records_writer')) THEN
    RAISE EXCEPTION 'Target role collision; refusing to change existing role';
  END IF;
END $roles$;
CREATE ROLE mavs_public_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE mavs_records_reader LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 10 PASSWORD %s;
CREATE ROLE mavs_records_writer LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 6 PASSWORD %s;
GRANT mavs_public_reader TO mavs_records_reader;
ALTER ROLE mavs_records_reader SET default_transaction_read_only = on;
''' % (literal(values['reader_password']), literal(values['writer_password']))


def compare_live(env, manifest, folder, label):
    for table in manifest['tables']:
        actual = scalar(env, digest_query(table['name']), folder / (label+'-'+table['name']+'.log'))
        if actual != {'rows':table['rows'],'checksum':table['checksum']}:
            raise RuntimeError(label+' contents differ from rehearsed snapshot: '+table['name'])
    return True


def schema_guard(env, manifest, folder, label):
    query = """SELECT json_build_object(
      'columns',(SELECT json_agg(json_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'identity',a.attidentity,'position',a.attnum)) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='records' AND c.relkind IN ('r','v') AND a.attnum>0 AND NOT a.attisdropped),
      'constraints',(SELECT json_agg(json_build_object('table',c.relname,'name',x.conname,'definition',pg_get_constraintdef(x.oid))) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='records'),
      'indexes',(SELECT json_agg(json_build_object('table',tablename,'definition',indexdef)) FROM pg_indexes WHERE schemaname='records'),
      'views',(SELECT json_agg(json_build_object('name',c.relname,'definition',pg_get_viewdef(c.oid,true))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='records' AND c.relkind='v'),
      'policies',(SELECT json_agg(json_build_object('table',tablename,'name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check)) FROM pg_policies WHERE schemaname='records'));
    """
    actual = scalar(env,query,folder/(label+'-schema-preflight.log'))
    def normalized(value):
        if isinstance(value,list):
            return sorted((normalized(item) for item in value),key=lambda item:json.dumps(item,sort_keys=True))
        if isinstance(value,dict):
            return {key:normalized(item) for key,item in value.items()}
        return value
    for key,value in actual.items():
        if normalized(value) != normalized(manifest['catalog'][key]):
            raise RuntimeError(label+' schema changed since rehearsal: '+key)


def transaction_postconditions(manifest):
    statements = ['DO $postconditions$ DECLARE n bigint; h text; BEGIN']
    for table in manifest['tables']:
        name = table['name']
        if not re.fullmatch(r'[a-z_]+',name):
            raise RuntimeError('Unexpected source table')
        statements.append(f'''SELECT count(*),md5(coalesce(string_agg(q.row_hash,'' ORDER BY q.row_hash COLLATE "C"),'')) INTO n,h FROM (SELECT md5(to_jsonb(t)::text) row_hash FROM ONLY records."{name}" t) q;
IF n<>{int(table['rows'])} OR h<>{literal(table['checksum'])} THEN RAISE EXCEPTION 'Postcondition failed: {name}'; END IF;''')
    statements.append('END $postconditions$;')
    return '\n'.join(statements)


def apply_database(folder, rehearsal):
    state_path = folder / 'cutover-state.json'
    if state_path.exists() and json.loads(state_path.read_text()).get('database_applied'):
        raise RuntimeError('Database migration already applied; refusing to repeat')
    source_manifest = json.loads((folder / audit.SOURCE / 'manifest.json').read_text())
    target_manifest = json.loads((folder / audit.TARGET / 'manifest.json').read_text())
    comparison = json.loads((folder / 'comparison.json').read_text())
    if not comparison['safe_to_plan_additive_upgrade']:
        raise RuntimeError('Historical comparison did not pass')
    report = json.loads((rehearsal / 'report.json').read_text())
    packet_path = rehearsal / 'apply.sql'
    packet = packet_path.read_text()
    # Validate report structure explicitly once the final rehearsal contract is supplied.
    expected_hash = report.get('packet_sha256', report.get('packetSha256', report.get('apply_sha256')))
    if not expected_hash or hashlib.sha256(packet_path.read_bytes()).hexdigest() != expected_hash:
        raise RuntimeError('Rehearsal packet hash missing or differs')
    if report.get('status') != 'rehearsal_passed':
        raise RuntimeError('Local rehearsal did not pass')
    wrapper = json.loads((rehearsal/'driver-wrapper/report.json').read_text())
    if wrapper.get('status') != 'wrapper_passed' or wrapper.get('packet_sha256') != expected_hash:
        raise RuntimeError('Actual role-creation/cutover wrapper was not rehearsed')
    if packet.count('BEGIN;') != 1 or packet.count('COMMIT;') != 1:
        raise RuntimeError('Expected exactly one atomic transaction in packet')
    recovery = ROOT / 'data/migrations/production-recovery'
    source = json.loads((recovery / 'credentials.json').read_text())
    target_url = audit.read_env(recovery / 'local-env-before-cloud.txt')['DATABASE_URL']
    source_env = write_env(source['session_database_url'], audit.SOURCE)
    target_env = write_env(target_url, audit.TARGET)
    values = credentials(target_url, folder)
    state = {'source':audit.SOURCE,'target':audit.TARGET,'source_writer_paused':False,'database_applied':False,
             'packet_sha256':expected_hash,'rehearsal':str(rehearsal.relative_to(ROOT))}
    private_json(state_path,state)
    try:
        # Lock acquisition and lease check happen before privilege changes. New collector
        # attempts are denied after commit, including connections already in the pool.
        tables = ','.join('records."'+table['name']+'"' for table in source_manifest['tables'])
        pause = 'BEGIN;\nLOCK TABLE '+tables+' IN ACCESS EXCLUSIVE MODE;\n'+'''
DO $guard$ BEGIN
 IF EXISTS (SELECT 1 FROM records.sync_leases WHERE expires_at>now()) THEN RAISE EXCEPTION 'Collector active; retry later'; END IF;
 IF EXISTS (SELECT 1 FROM pg_stat_activity WHERE usename='mavs_records_writer' AND state='active') THEN RAISE EXCEPTION 'Writer active; retry later'; END IF;
END $guard$;
ALTER ROLE mavs_records_writer NOLOGIN;
REVOKE INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA records FROM mavs_records_writer;
REVOKE USAGE ON ALL SEQUENCES IN SCHEMA records FROM mavs_records_writer;
COMMIT;'''
        sql(source_env,pause,folder / 'source-writer-pause.log')
        state['source_writer_paused'] = True
        private_json(state_path,state)
        print('Source collector paused; read service remains available.',flush=True)
        compare_live(source_env,source_manifest,folder,'source-final')
        schema_guard(source_env,source_manifest,folder,'source')
        schema_guard(target_env,target_manifest,folder,'target')
        target_preflight = scalar(target_env,"SELECT json_build_object('database_bytes',pg_database_size(current_database()),'new_roles',(SELECT count(*) FROM pg_roles WHERE rolname IN ('mavs_public_reader','mavs_records_reader','mavs_records_writer')));",folder/'target-preflight.log')
        if target_preflight['new_roles'] or target_preflight['database_bytes'] > 400*1024*1024:
            raise RuntimeError('Target role collision or storage budget unsafe')
        # Role creation, schema upgrade, delta COPY, RLS and pointer change share a transaction.
        wrapped = packet.replace('BEGIN;', 'BEGIN;\n'+role_sql(values), 1)
        wrapped = wrapped.replace('COMMIT;', transaction_postconditions(source_manifest)+'\nCOMMIT;', 1)
        sql(target_env,wrapped,folder / 'target-apply.log')
        state['database_applied'] = True
        private_json(state_path,state)
        compare_live(target_env,source_manifest,folder,'target-verified')
        for table in target_manifest['public']:
            query = digest_query(table['name']).replace('records.', 'public.')
            actual = scalar(target_env,query,folder / ('public-verified-'+table['name']+'.log'))
            if actual != {'rows':table['rows'],'checksum':table['checksum']}:
                raise RuntimeError('Public table changed since backup; inspect independently: '+table['name'])
        state['physical_hashes_match'] = True
        state['public_unchanged'] = True
        private_json(state_path,state)
        print(json.dumps({'database_applied':True,'physical_tables_match':len(source_manifest['tables']),'public_tables_unchanged':len(target_manifest['public']),'source_writer_paused':True}),flush=True)
    except BaseException:
        if state['source_writer_paused']:
            resume_source(source_env,source_manifest,folder)
            state['source_writer_paused'] = False
            private_json(state_path,state)
        raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('phase',choices=['database','resume-source'])
    parser.add_argument('--snapshot',type=Path,required=True)
    parser.add_argument('--rehearsal',type=Path)
    parser.add_argument('--apply',action='store_true')
    args = parser.parse_args()
    if not args.apply:
        raise RuntimeError('Explicit --apply required for database operations')
    folder = args.snapshot.resolve()
    if ROOT / 'data/migrations' not in folder.parents:
        raise RuntimeError('Private snapshot folder required')
    if args.phase == 'database':
        if not args.rehearsal:
            raise RuntimeError('Passing local rehearsal required')
        rehearsal = args.rehearsal.resolve()
        if folder not in rehearsal.parents:
            raise RuntimeError('Rehearsal must belong to this snapshot')
        apply_database(folder,rehearsal)
    else:
        credentials = json.loads((ROOT/'data/migrations/production-recovery/credentials.json').read_text())
        manifest = json.loads((folder/audit.SOURCE/'manifest.json').read_text())
        resume_source(write_env(credentials['session_database_url'],audit.SOURCE),manifest,folder)
        state = json.loads((folder/'cutover-state.json').read_text())
        state['source_writer_paused'] = False
        private_json(folder/'cutover-state.json',state)
        print('Original source collector permissions restored; target data retained.')


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        print('Cutover stopped safely: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__),flush=True)
        raise SystemExit(1)

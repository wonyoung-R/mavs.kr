#!/usr/bin/env python3
"""Read-only records snapshots for an explicitly identified project pair.
No database writes, environment changes, restores, or credential output.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from datetime import datetime, timezone
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parents[2]
PG = Path('/opt/homebrew/opt/postgresql@17/bin')
SOURCE = 'ztlqbnmfppcndprmenti'
TARGET = 'nycoldtrqbkevvgoajlq'


def read_env(path):
    result = {}
    for line in path.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            result[key.strip()] = value.strip().strip('\"\'')
    return result


def connection(url, expected):
    parsed = urlparse(url)
    user = unquote(parsed.username or '')
    host = parsed.hostname or ''
    if parsed.scheme not in ('postgres', 'postgresql') or not user or not parsed.password:
        raise RuntimeError('Authenticated PostgreSQL connection required')
    actual = user.rsplit('.', 1)[-1] if host.endswith('.pooler.supabase.com') else expected if host == f'db.{expected}.supabase.co' else None
    if actual != expected:
        raise RuntimeError('Project reference mismatch; no connection opened')
    clean = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    return dict(clean, PGHOST=parsed.hostname, PGPORT=str(parsed.port or 5432), PGUSER=user,
                PGPASSWORD=unquote(parsed.password or ''), PGDATABASE=parsed.path.lstrip('/') or 'postgres',
                PGSSLMODE='require', PGCONNECT_TIMEOUT='15',
                PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=120000 -c idle_in_transaction_session_timeout=300000 -c timezone=UTC -c datestyle=ISO,YMD -c intervalstyle=postgres -c bytea_output=hex -c extra_float_digits=3')


class Reader:
    def __init__(self, env, directory):
        self.log = (directory / 'psql.stderr.log').open('x')
        self.proc = subprocess.Popen([str(PG / 'psql'), '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'],
                                     env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.log, text=True, bufsize=1)

    def query(self, sql):
        # json_agg may insert newlines; collect the scalar through an explicit marker.
        marker = '__MAVS_AUDIT_RESULT_END__'
        self.proc.stdin.write(sql + '\n\\echo ' + marker + '\n')
        self.proc.stdin.flush()
        lines = []
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError('Read-only query failed; inspect private psql log')
            if line.strip() == marker:
                break
            lines.append(line)
        return json.loads(''.join(lines))

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdin.write('ROLLBACK;\n\\q\n')
            self.proc.stdin.flush()
            self.proc.wait(timeout=15)
        self.log.close()


def snapshot(url, ref, output):
    env = connection(url, ref)
    directory = output / ref
    directory.mkdir(mode=0o700)
    reader = Reader(env, directory)
    try:
        info = reader.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT json_build_object('snapshot',pg_export_snapshot(),'version',current_setting('server_version'),'read_only',current_setting('transaction_read_only'),'database_bytes',pg_database_size(current_database()));")
        assert info['read_only'] == 'on'
        catalog = reader.query("""SELECT json_build_object(
          'schema_acl',(SELECT nspacl FROM pg_namespace WHERE nspname='records'),
          'relations',(SELECT json_agg(json_build_object('name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'rls',c.relrowsecurity,'bytes',CASE WHEN c.relkind='r' THEN pg_total_relation_size(c.oid) ELSE 0 END) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='records' AND c.relkind IN ('r','v','S')),
          'columns',(SELECT json_agg(json_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'identity',a.attidentity,'position',a.attnum) ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='records' AND c.relkind IN ('r','v') AND a.attnum>0 AND NOT a.attisdropped),
          'constraints',(SELECT json_agg(json_build_object('table',c.relname,'name',x.conname,'definition',pg_get_constraintdef(x.oid)) ORDER BY c.relname,x.conname) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='records'),
          'views',(SELECT json_agg(json_build_object('name',c.relname,'definition',pg_get_viewdef(c.oid,true)) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='records' AND c.relkind='v'),
          'indexes',(SELECT json_agg(json_build_object('table',tablename,'definition',indexdef) ORDER BY indexname) FROM pg_indexes WHERE schemaname='records'),
          'roles',(SELECT json_agg(json_build_object('name',rolname,'superuser',rolsuper,'login',rolcanlogin,'bypass_rls',rolbypassrls,'config',rolconfig)) FROM pg_roles WHERE rolname LIKE 'mavs%'),
          'policies',(SELECT json_agg(json_build_object('table',tablename,'name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check)) FROM pg_policies WHERE schemaname='records'),
          'functions',(SELECT json_agg(json_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid),'acl',p.proacl)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='records'));
        """)
        manifest = {'project':ref,'captured_at':datetime.now(timezone.utc).isoformat(),'database':info,'catalog':catalog,'tables':[],'public':[]}
        for relation in catalog['relations']:
            if relation['kind'] != 'r':
                continue
            name = relation['name']
            if not re.fullmatch(r'[a-z_]+', name):
                raise RuntimeError('Unexpected relation identifier')
            stats = reader.query(f'''SELECT json_build_object('rows',count(*),'checksum',md5(coalesce(string_agg(h,'' ORDER BY h COLLATE "C"),''))) FROM (SELECT md5(to_jsonb(t)::text) h FROM ONLY records."{name}" t) q;''')
            entry = {'name':name,**stats}
            if any(c['table'] == name and c['name'] == 'release_id' for c in catalog['columns']):
                entry['releases'] = reader.query(f'''SELECT coalesce(json_agg(q ORDER BY release_id),'[]'::json) FROM (SELECT release_id,count(*) AS rows,md5(string_agg(h,'' ORDER BY h COLLATE "C")) AS checksum FROM (SELECT release_id,md5(to_jsonb(t)::text) h FROM ONLY records."{name}" t) x GROUP BY release_id) q;''')
            manifest['tables'].append(entry)
            print(json.dumps({'project':ref,'table':name,'rows':stats['rows']},ensure_ascii=False),flush=True)
        manifest['releases'] = reader.query("SELECT coalesce(json_agg(t ORDER BY id),'[]'::json) FROM records.releases t;")
        manifest['current_release'] = reader.query("SELECT coalesce(json_agg(t),'[]'::json) FROM records.current_release t;")
        # The public data isn't exported or changed. Hashes prove app tables stay untouched.
        tables = reader.query("SELECT coalesce(json_agg(c.relname ORDER BY c.relname),'[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r';")
        for name in tables:
            if not re.fullmatch(r'[A-Za-z_]+',name):
                raise RuntimeError('Unexpected public identifier')
            stats = reader.query(f'''SELECT json_build_object('rows',count(*),'checksum',md5(coalesce(string_agg(h,'' ORDER BY h COLLATE "C"),''))) FROM (SELECT md5(to_jsonb(t)::text) h FROM ONLY public."{name}" t) q;''')
            manifest['public'].append({'name':name,**stats})
        archive = directory / 'records.dump'
        with (directory / 'dump.stderr.log').open('x') as log:
            result = subprocess.run([str(PG / 'pg_dump'), '--format=custom', '--schema=records', '--no-owner', '--no-acl',
                                     '--snapshot='+info['snapshot'], '--file='+str(archive)],env=env,stderr=log,timeout=240)
        if result.returncode:
            raise RuntimeError('Read-only dump failed; inspect private log')
        manifest['dump'] = {'file':'records.dump','bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
        with (directory / 'manifest.json').open('x') as handle:
            json.dump(manifest,handle,ensure_ascii=False,indent=2)
        print(json.dumps({'project':ref,'snapshot_complete':True,'dump_bytes':manifest['dump']['bytes'],'database_bytes':info['database_bytes']}),flush=True)
        return manifest
    finally:
        reader.close()


def compare(source, target):
    issues = []
    shared = []
    s = {t['name']:t for t in source['tables']}
    old = {t['name']:t for t in target['tables']}
    source_releases = {t['id']:t for t in source['releases']}
    for release in target['releases']:
        if source_releases.get(release['id']) != release:
            issues.append({'release_metadata_differs':release['id']})
    for name, record in old.items():
        if name in ('current_release','releases'):
            continue
        other = s.get(name+'_storage') or s.get(name)
        if other is None:
            issues.append({'target_only_table':name})
            continue
        by_release = {r['release_id']:r for r in other.get('releases',[])}
        for release in record.get('releases',[]):
            match = release == by_release.get(release['release_id'])
            shared.append({'table':name,'release':release['release_id'],'rows':release['rows'],'match':match})
            if not match:
                issues.append({'table':name,'release_mismatch':release['release_id']})
    target_ids = {r['id'] for r in target['releases']}
    return {'source':SOURCE,'target':TARGET,'safe_to_plan_additive_upgrade':not issues,'issues':issues,'historical_comparisons':shared,
            'missing_releases':[r for r in source['releases'] if r['id'] not in target_ids],
            'source_current':source['current_release'],'target_current':target['current_release']}


def main():
    os.umask(0o077)
    private = ROOT / 'data/migrations/production-recovery'
    credentials = json.loads((private / 'credentials.json').read_text())
    if credentials['project_ref'] != SOURCE:
        raise RuntimeError('Unexpected source credential project')
    original = read_env(private / 'local-env-before-cloud.txt')
    output = ROOT / 'data/migrations' / ('records-consolidation-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    output.mkdir(mode=0o700)
    print('private_output='+str(output.relative_to(ROOT)),flush=True)
    source = snapshot(credentials['session_database_url'],SOURCE,output)
    target = snapshot(original['DATABASE_URL'],TARGET,output)
    result = compare(source,target)
    with (output/'comparison.json').open('x') as handle:
        json.dump(result,handle,ensure_ascii=False,indent=2)
    print(json.dumps({'audit_complete':True,'safe_to_plan_additive_upgrade':result['safe_to_plan_additive_upgrade'],'issues':result['issues'],'shared_groups':len(result['historical_comparisons']),'missing_release_ids':[r['id'] for r in result['missing_releases']]}),flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Do not echo exceptions from network libraries, which may contain credentials.
        print('Audit stopped safely: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__),flush=True)
        raise SystemExit(1)

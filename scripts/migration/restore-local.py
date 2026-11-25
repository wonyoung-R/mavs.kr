#!/usr/bin/env python3
"""Restore an export into an isolated, loopback-only PostgreSQL 17 verification DB.
Never connects to the source or drops/replaces an existing database.
Secrets stay in private files/environment; commands contain no passwords.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
BIN = Path(os.environ.get('PG17_BIN', '/opt/homebrew/opt/postgresql@17/bin'))
LOCAL = ROOT / 'data/migrations/local-validation'


def private_json(path, value):
    with path.open('x', encoding='utf8') as handle:
        os.chmod(path, 0o600)
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write('\n')


def execute(command, env=None, input=None, logfile=None):
    result = subprocess.run([str(x) for x in command], input=input, text=True, capture_output=True, env=env)
    if logfile:
        with open(logfile, 'w') as handle:
            os.chmod(logfile, 0o600)
            handle.write(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError(f'{Path(command[0]).name} failed (exit {result.returncode}); inspect private migration log')
    return result.stdout


def connection(config, database=None):
    return dict(os.environ, PGHOST='127.0.0.1', PGPORT=str(config['port']), PGUSER=config['user'],
                PGPASSWORD=config['password'], PGDATABASE=database or config['database'], PGSSLMODE='disable',
                PGOPTIONS='-c timezone=UTC -c datestyle=ISO,YMD -c intervalstyle=postgres -c bytea_output=hex -c extra_float_digits=3')


def sql(config, query, database=None, logfile=None):
    return execute([BIN / 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], connection(config, database), query, logfile).strip()


def ident(value):
    return '"' + value.replace('"', '""') + '"'


def init():
    if LOCAL.exists():
        raise RuntimeError('local-validation already exists; refusing to replace it')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 55432))
    LOCAL.mkdir(parents=True, mode=0o700)
    os.chmod(LOCAL, 0o700)
    config = {'port': 55432, 'user': 'mavs_migration', 'password': secrets.token_urlsafe(36), 'database': 'mavs_validation'}
    private_json(LOCAL / 'connection.json', config)
    pw = LOCAL / 'init-password'
    with pw.open('x') as handle:
        os.chmod(pw, 0o600)
        handle.write(config['password'] + '\n')
    execute([BIN / 'initdb', '-D', LOCAL / 'cluster', '-U', config['user'], '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', '--encoding=UTF8', '--locale=C', f'--pwfile={pw}'], logfile=LOCAL / 'init.log')
    sockdir = tempfile.mkdtemp(prefix='mavs-pg17-')
    with (LOCAL / 'cluster/postgresql.conf').open('a') as handle:
        handle.write(f"\n# Isolated MAVS migration verification instance\nlisten_addresses = '127.0.0.1'\nport = 55432\nunix_socket_directories = '{sockdir}'\nmax_connections = 20\nshared_buffers = '128MB'\n")
    execute([BIN / 'pg_ctl', '-D', LOCAL / 'cluster', '-l', LOCAL / 'server.log', '-w', 'start'], logfile=LOCAL / 'start.log')
    execute([BIN / 'createdb', '--template=template0', config['database']], connection(config, 'postgres'), logfile=LOCAL / 'createdb.log')
    print('Isolated PostgreSQL 17 initialized on 127.0.0.1:55432; existing 5432 untouched.')


def verify(export):
    config = json.loads((LOCAL / 'connection.json').read_text())
    manifest = json.loads((export / 'manifest.json').read_text())
    report = {'tables': [], 'files': [], 'ok': True, 'export': str(export), 'dumpSha256': manifest['dump']['sha256']}
    for table in manifest['tables']:
        name = f"{ident(table['schema'])}.{ident(table['name'])}"
        query = f'''SELECT json_build_object('rows',count(*)::text,'checksum',md5(COALESCE(string_agg(row_hash, '' ORDER BY row_hash COLLATE "C"), ''))) FROM (SELECT md5(to_jsonb(source_row)::text) AS row_hash FROM ONLY {name} AS source_row) AS hashed_rows;'''
        actual = json.loads(sql(config, query))
        ok = actual['rows'] == str(table['rows']) and actual['checksum'] == table['checksum']
        report['tables'].append({'schema': table['schema'], 'name': table['name'], 'rows': actual['rows'], 'match': ok})
        report['ok'] &= ok
    for item in manifest['files']:
        path = (export / item['path']).resolve()
        if not path.is_relative_to(export.resolve()):
            raise RuntimeError('Unsafe file path in manifest')
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        ok = path.stat().st_size == item['bytes'] and actual == item['sha256']
        report['files'].append({'key': item['key'], 'match': ok})
        report['ok'] &= ok
    private_json(LOCAL / ('verification-' + secrets.token_hex(4) + '.json'), report)
    print(json.dumps({'ok': report['ok'], 'tables': len(report['tables']), 'files': len(report['files'])}))
    if not report['ok']:
        raise RuntimeError('Restoration verification failed')


def restore(export):
    config = json.loads((LOCAL / 'connection.json').read_text())
    manifest = json.loads((export / 'manifest.json').read_text())
    if manifest.get('status') != 'complete':
        raise RuntimeError('Only a complete export may be restored')
    archive = export / manifest['dump']['path']
    if hashlib.sha256(archive.read_bytes()).hexdigest() != manifest['dump']['sha256']:
        raise RuntimeError('Archive checksum mismatch')
    if sql(config, "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')") != '0':
        raise RuntimeError('Target database is not empty; refusing to replace it')
    vault = next(row for row in manifest['tables'] if row['schema'] == 'vault' and row['name'] == 'secrets')
    if vault['rows'] != '0':
        raise RuntimeError('Nonempty Vault requires the compatible Supabase Vault extension; no portable substitution allowed')
    roles = ['anon','authenticated','service_role','authenticator','postgres','supabase_admin','supabase_auth_admin',
             'supabase_storage_admin','supabase_realtime_admin','supabase_read_only_user','dashboard_user','pgbouncer']
    setup = '\n'.join(f'CREATE ROLE {ident(role)} NOLOGIN;' for role in roles)
    setup += '''
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION pg_stat_statements WITH SCHEMA extensions;
CREATE SCHEMA vault;
-- Vault is empty in this export. Preserve its table shape for verification;
-- its encryption service/defaults remain in the original complete archive.
CREATE TABLE vault.secrets (
 id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
 name text, description text NOT NULL DEFAULT '', secret text NOT NULL,
 key_id uuid, nonce bytea, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
'''
    sql(config, setup, logfile=LOCAL / 'restore-setup.log')
    toc = execute([BIN / 'pg_restore', '--list', archive])
    skipped, selected = [], []
    for line in toc.splitlines():
        skip = (' EXTENSION ' in line or ' EVENT TRIGGER ' in line or
                ' SCHEMA - extensions ' in line or ' SCHEMA - vault ' in line)
        if skip:
            skipped.append(line)
            selected.append('; portable verification: ' + line)
        else:
            selected.append(line)
    toc_path = LOCAL / 'portable-toc.list'
    with toc_path.open('x') as handle:
        os.chmod(toc_path, 0o600)
        handle.write('\n'.join(selected) + '\n')
    private_json(LOCAL / 'restore-exclusions.json', {
        'sourceArchiveUnmodified': True, 'skippedArchiveEntries': skipped,
        'notes': ['Local PostgreSQL extensions recreated without source ACL/owners.',
                  'Unused vector and empty Vault extension services are not installed.',
                  'Empty vault.secrets preserves columns; nonce generator requires original extension.',
                  'Supabase-managed event triggers are not enabled on standalone PostgreSQL.']})
    execute([BIN / 'pg_restore', '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction',
             '--use-list', toc_path, '--dbname', config['database'], archive], connection(config), logfile=LOCAL / 'restore.log')
    sql(config, (ROOT / 'ruby/db/local_read_indexes.sql').read_text(), logfile=LOCAL / 'local-index.log')
    sql(config, 'ANALYZE;', logfile=LOCAL / 'local-analyze.log')
    print('Archive restored into isolated local validation database; source untouched.')


def configure_reader(export):
    config = json.loads((LOCAL / 'connection.json').read_text())
    env_path = ROOT / 'ruby/.env.local'
    if env_path.exists():
        raise RuntimeError('Ruby environment file already exists; refusing to overwrite it')
    if not any(json.loads(path.read_text()).get('ok') and json.loads(path.read_text()).get('export') == str(export)
               for path in LOCAL.glob('verification-*.json')):
        raise RuntimeError('A successful verification for this export is required before configuring Ruby')
    reader = 'mavs_public_reader'
    password = secrets.token_urlsafe(36)
    # All SQL travels through stdin, including the newly generated local password.
    setup = f'''CREATE ROLE {ident(reader)} LOGIN PASSWORD '{password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE {ident(reader)} SET default_transaction_read_only = on;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE {ident(config['database'])} TO {ident(reader)};
GRANT USAGE ON SCHEMA public, records TO {ident(reader)};
GRANT SELECT ON ALL TABLES IN SCHEMA records TO {ident(reader)};
GRANT SELECT ON public."News", public."Post", public."Comment" TO {ident(reader)};
GRANT SELECT (id,name,username) ON public."User" TO {ident(reader)};
'''
    schemas = json.loads(sql(config, "SELECT json_agg(nspname) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'"))
    for schema in schemas:
        setup += f'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA {ident(schema)} FROM PUBLIC;\n'
    setup += f'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA records TO {ident(reader)};\n'
    tables = json.loads(sql(config, "SELECT json_agg(tablename) FROM pg_tables WHERE schemaname='records' AND rowsecurity")) or []
    for table in tables:
        setup += f'CREATE POLICY mavs_public_read ON records.{ident(table)} FOR SELECT TO {ident(reader)} USING (true);\n'
    sql(config, setup, logfile=LOCAL / 'reader-setup.log')
    url = f"postgresql://{reader}:{quote(password,safe='')}@127.0.0.1:{config['port']}/{config['database']}?sslmode=disable"
    with env_path.open('x') as handle:
        os.chmod(env_path, 0o600)
        handle.write('# Isolated local validation copy; not a production cutover.\n')
        handle.write(f'DATABASE_URL="{url}"\nMIGRATED_MEDIA_ROOT="{export}"\n')
    print('Ruby configured with a SELECT-only local account and verified media directory.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init', 'restore', 'verify', 'configure-reader'])
    parser.add_argument('--export', type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        if args.action == 'init':
            init()
        elif args.export:
            {'restore': restore, 'verify': verify, 'configure-reader': configure_reader}[args.action](args.export.resolve())
        else:
            parser.error('--export required')
    except (RuntimeError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)

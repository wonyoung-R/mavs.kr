#!/usr/bin/env python3
"""Rehearse the actual role-creation/cutover wrapper in a fresh loopback cluster."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import hashlib

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('cutover',ROOT/'scripts/migration/records-transfer-cutover.py')
cutover=importlib.util.module_from_spec(spec);spec.loader.exec_module(cutover)
PG=cutover.PG


def run(args,env=None,query=None,log=None):
    p=subprocess.run([str(arg) for arg in args],env=env,input=query,text=True,capture_output=True,timeout=240)
    if log: log.write_text(p.stdout+p.stderr)
    if p.returncode: raise RuntimeError('Local wrapper check failed; inspect private log')
    return p.stdout


def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser();parser.add_argument('rehearsal',type=Path);args=parser.parse_args()
    rehearsal=args.rehearsal.resolve();snapshot=rehearsal.parent
    if ROOT/'data/migrations' not in rehearsal.parents:raise RuntimeError('Private rehearsal required')
    report=json.loads((rehearsal/'report.json').read_text())
    packet=(rehearsal/'apply.sql').read_text()
    if report['status']!='rehearsal_passed' or hashlib.sha256(packet.encode()).hexdigest()!=report['apply_sha256']:raise RuntimeError('Packet mismatch')
    folder=rehearsal/'driver-wrapper'
    folder.mkdir(mode=0o700)
    with socket.socket() as probe:probe.bind(('127.0.0.1',55433))
    password=secrets.token_urlsafe(36);pw=folder/'password';pw.write_text(password+'\n')
    run([PG/'initdb','-D',folder/'cluster','-U','postgres','--auth-local=scram-sha-256','--auth-host=scram-sha-256','--encoding=UTF8','--locale=C','--pwfile='+str(pw)],log=folder/'init.log')
    run([PG/'pg_ctl','-D',folder/'cluster','-l',folder/'server.log','-o','-h 127.0.0.1 -p 55433 -k /tmp','-w','start'],log=folder/'start.log')
    env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
    env.update(PGHOST='127.0.0.1',PGPORT='55433',PGUSER='postgres',PGPASSWORD=password,PGDATABASE='postgres',PGSSLMODE='disable',PGCONNECT_TIMEOUT='5',PGOPTIONS='-c statement_timeout=180000 -c timezone=UTC -c datestyle=ISO,YMD -c intervalstyle=postgres -c bytea_output=hex -c extra_float_digits=3')
    try:
        run([PG/'createdb','wrapper_target'],env,log=folder/'createdb.log');env['PGDATABASE']='wrapper_target'
        psql=[PG/'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1']
        run(psql,env,"CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN;CREATE TABLE public.migration_private_guard(secret text);INSERT INTO public.migration_private_guard VALUES('synthetic');",folder/'seed.log')
        run([PG/'pg_restore','--no-owner','--no-acl','--single-transaction','--exit-on-error','--dbname=wrapper_target',snapshot/cutover.audit.TARGET/'records.dump'],env,log=folder/'restore.log')
        values={'reader_password':secrets.token_urlsafe(36),'writer_password':secrets.token_urlsafe(36)}
        manifest=json.loads((snapshot/cutover.audit.SOURCE/'manifest.json').read_text())
        wrapped=packet.replace('BEGIN;','BEGIN;\n'+cutover.role_sql(values),1)
        wrapped=wrapped.replace('COMMIT;',cutover.transaction_postconditions(manifest)+'\nCOMMIT;',1)
        run(psql,env,wrapped,folder/'actual-wrapper-apply.log')
        reader={**env,'PGUSER':'mavs_records_reader','PGPASSWORD':values['reader_password']}
        writer={**env,'PGUSER':'mavs_records_writer','PGPASSWORD':values['writer_password']}
        reader.pop('PGOPTIONS');writer.pop('PGOPTIONS')
        result=run(psql,reader,"SELECT count(*) FROM records.games WHERE release_id=(SELECT release_id FROM records.current_release);SHOW default_transaction_read_only;",folder/'reader.log').strip().splitlines()
        if result!=['3968','on']:raise RuntimeError('Reader content or read-only default mismatch')
        p=subprocess.run([str(x) for x in psql],env=reader,input="BEGIN READ WRITE;INSERT INTO records.sync_leases VALUES('forbidden',now());ROLLBACK;",text=True,capture_output=True)
        (folder/'reader-denied.log').write_text(p.stdout+p.stderr)
        if p.returncode==0 or 'permission denied' not in p.stderr:raise RuntimeError('Reader write was not denied by ACL')
        run(psql,writer,"BEGIN;INSERT INTO records.sync_leases VALUES('wrapper-test',now());ROLLBACK;",folder/'writer-rollback.log')
        public=run(psql,writer,"SELECT has_table_privilege(current_user,'public.migration_private_guard','SELECT');",folder/'writer-public.log').strip()
        if public!='f':raise RuntimeError('Writer public isolation failed')
        denied=run(psql,env,"SELECT count(*) FROM (VALUES('anon'),('authenticated'),('service_role')) r(role) WHERE has_schema_privilege(role,'records','USAGE');",folder/'anonymous.log').strip()
        if denied!='0':raise RuntimeError('Anonymous records schema exposed')
        # An idle-in-transaction writer must prevent any freeze-side role change.
        with (folder/'idle-writer.log').open('w') as log:
            holding=subprocess.Popen([str(x) for x in psql],env=writer,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=log,text=True,bufsize=1)
            try:
                holding.stdin.write("BEGIN;INSERT INTO records.sync_leases VALUES('concurrency-test',now());SELECT 'held';\n");holding.stdin.flush()
                if holding.stdout.readline().strip()!='held':raise RuntimeError('Local writer lock fixture failed')
                tables=','.join('records."'+table['name']+'"' for table in manifest['tables'])
                pause="BEGIN;SET LOCAL lock_timeout='200ms';LOCK TABLE "+tables+" IN ACCESS EXCLUSIVE MODE;ALTER ROLE mavs_records_writer NOLOGIN;COMMIT;"
                blocked=subprocess.run([str(x) for x in psql],env=env,input=pause,text=True,capture_output=True,timeout=10)
                (folder/'freeze-race.log').write_text(blocked.stdout+blocked.stderr)
                if blocked.returncode==0 or 'lock timeout' not in blocked.stderr:raise RuntimeError('Freeze did not stop for existing writer transaction')
                login=run(psql,env,"SELECT rolcanlogin FROM pg_roles WHERE rolname='mavs_records_writer';",folder/'freeze-login-preserved.log').strip()
                if login!='t':raise RuntimeError('Failed freeze changed role state')
            finally:
                holding.stdin.write('ROLLBACK;\n\\q\n');holding.stdin.flush();holding.wait(timeout=10)
        proof={'status':'wrapper_passed','packet_sha256':report['apply_sha256'],'physical_postconditions':14,'current_games':3968,'fresh_roles_created':True,'reader_login':True,'reader_default_readonly':True,'reader_write_denied':True,'writer_login_and_rollback':True,'writer_public_denied':True,'anonymous_schema_denied':True,'idle_transaction_freeze_guard':True,'remote_changes':False}
        (folder/'report.json').write_text(json.dumps(proof,indent=2))
        print(json.dumps(proof),flush=True)
    finally:
        run([PG/'pg_ctl','-D',folder/'cluster','-m','fast','-w','stop'],log=folder/'stop.log')


if __name__=='__main__':
    try:main()
    except Exception as error:
        print('Local wrapper test stopped: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__),flush=True)
        raise SystemExit(1)

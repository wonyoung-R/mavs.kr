#!/usr/bin/env python3
"""Anonymous, bounded downloads of the public historical NBA dataset (stdlib only)."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import time
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SLUG = 'eoinamoore/historical-nba-data-and-player-box-scores'
API = 'https://www.kaggle.com/api/v1/datasets/'
FILES = ['Games.csv', 'TeamHistories.csv', 'Players.csv', 'TeamStatistics.csv', 'PlayerStatistics.csv',
         'TeamStatisticsExtended.csv', 'PlayerStatisticsExtended.csv']


class LoginRequired(RuntimeError):
    pass


def request(url):
    try:
        response = urlopen(Request(url, headers={'User-Agent': 'MavsRecords/1.0 (public historical research)'}), timeout=45)
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise LoginRequired('Authentication/access confirmation required; collection stopped.') from None
        if exc.code == 402:
            raise RuntimeError('Paid source excluded.') from None
        raise
    if any(part in urlsplit(response.url).path.lower() for part in ('login', 'signin', 'sign-in')):
        response.close()
        raise LoginRequired('Login redirect encountered; collection stopped.')
    return response


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def metadata(target):
    target.mkdir(parents=True, exist_ok=True)
    with request(API + 'view/' + SLUG) as response:
        info = json.load(response)
    with request(API + 'list/' + SLUG) as response:
        listing = json.load(response)
    previous = target / 'source-metadata.json'
    if previous.exists() and json.loads(previous.read_text()).get('currentVersionNumber') != info.get('currentVersionNumber'):
        raise RuntimeError('Dataset version changed. Preserve the old snapshot and use a new version directory before collecting.')
    save_json(target / 'source-metadata.json', info)
    save_json(target / 'source-files.json', listing)
    print(json.dumps({'license': info.get('licenseName'), 'version': info.get('currentVersionNumber'),
                      'lastUpdated': info.get('lastUpdated'),
                      'files': [{'name': f['name'], 'bytes': f['totalBytes']} for f in listing.get('datasetFiles', [])]}), flush=True)
    return info, listing


def download(target, filename, version, max_bytes):
    destination = target / filename
    if destination.exists():
        manifest = target / (filename + '.manifest.json')
        if not manifest.exists():
            raise RuntimeError('Unverified partial CSV exists; review it before retrying: ' + filename)
        saved = json.loads(manifest.read_text())
        if saved['version'] != version or saved['csv_bytes'] != destination.stat().st_size:
            raise RuntimeError('Existing CSV does not match the pinned download manifest: ' + filename)
        print(json.dumps({'file': filename, 'status': 'already_downloaded', 'bytes': destination.stat().st_size}), flush=True)
        return
    url = API + 'download/' + SLUG + '?' + urlencode({'file_name': filename, 'dataset_version_number': version})
    temporary = target / (filename + '.download')
    digest = hashlib.sha256()
    with request(url) as response, temporary.open('wb') as output:
        if 'text/html' in response.headers.get('Content-Type', ''):
            raise LoginRequired('Unexpected HTML access page; collection stopped for review.')
        total = 0
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > max_bytes:
                raise RuntimeError('Download exceeds configured byte budget.')
            output.write(chunk)
            digest.update(chunk)
    if zipfile.is_zipfile(temporary):
        with zipfile.ZipFile(temporary) as archive:
            names = [n for n in archive.namelist() if Path(n).name == filename]
            if len(names) != 1:
                raise RuntimeError('Downloaded archive does not contain the requested file exactly once.')
            if archive.getinfo(names[0]).file_size > 2_000_000_000:
                raise RuntimeError('Uncompressed source exceeds size budget.')
            with archive.open(names[0]) as source, destination.open('xb') as output:
                shutil.copyfileobj(source, output)
    else:
        # Preserve the original download as provenance; copy only the named CSV.
        with temporary.open('rb') as source, destination.open('xb') as output:
            shutil.copyfileobj(source, output)
    csv_digest = hashlib.sha256()
    with destination.open('rb') as source:
        while chunk := source.read(1024 * 1024):
            csv_digest.update(chunk)
    save_json(target / (filename + '.manifest.json'), {
        'source_url': 'https://www.kaggle.com/datasets/' + SLUG,
        'version': version, 'file': filename, 'download_bytes': total,
        'download_sha256': digest.hexdigest(), 'csv_bytes': destination.stat().st_size,
        'csv_sha256': csv_digest.hexdigest(),
        'retrieved_at': datetime.now(timezone.utc).isoformat(),
    })
    print(json.dumps({'file': filename, 'status': 'downloaded', 'bytes': destination.stat().st_size}), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--files', nargs='*', choices=FILES, default=[])
    parser.add_argument('--max-download-mb', type=int, default=250)
    args = parser.parse_args()
    target = ROOT / 'data/records/raw/kaggle'
    info, listing = metadata(target)
    if info.get('isPrivate'):
        raise LoginRequired('Private dataset requires login; stopped.')
    if info.get('licenseName') != 'CC0: Public Domain':
        raise RuntimeError('Source license changed; review metadata before collection.')
    available = {f['name'] for f in listing.get('datasetFiles', [])}
    for filename in args.files:
        if filename not in available:
            raise RuntimeError('Requested source file is absent from public listing: ' + filename)
        download(target, filename, info['currentVersionNumber'], args.max_download_mb * 1024 * 1024)
        time.sleep(0.5)


if __name__ == '__main__':
    try:
        main()
    except LoginRequired as exc:
        print('LOGIN_REQUIRED: ' + str(exc), file=sys.stderr)
        sys.exit(3)
    except Exception as exc:
        print(type(exc).__name__ + ': ' + str(exc).split('?')[0], file=sys.stderr)
        sys.exit(1)

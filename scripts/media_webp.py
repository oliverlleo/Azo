#!/usr/bin/env python3
"""AZO direct-API backup / lossless migration / guarded rollback. No Supabase MCP.

Credentials are read from SUPABASE_ACCESS_TOKEN or a hidden prompt, never saved.
Requires Pillow >= 12.3 with WebP support. Never removes Storage objects.
"""
import argparse
import getpass
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from PIL import Image, features

PROJECT = 'jjrsbbgnqfiezhokxbqz'
BUCKET = 'azo-media'
API = 'https://api.supabase.com/v1'
ORIGIN = f'https://{PROJECT}.supabase.co'
PUBLIC = f'{ORIGIN}/storage/v1/object/public/{BUCKET}/'
Image.MAX_IMAGE_PIXELS = 24000000


def digest(data):
    return hashlib.sha256(data).hexdigest()


def save_json(path, value):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + '.tmp')
    with temporary.open('w', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def ident(value):
    return '"' + value.replace('"', '""') + '"'


def literal(value):
    # Standard-conforming strings; avoids quote or backslash interpretation.
    text = str(value)
    tag = '$azo$'
    while tag in text:
        tag = tag[:-1] + 'x$'
    return tag + text + tag


def sql_value(value, type_name):
    if value is None:
        return 'NULL'
    if type_name in ('json', 'jsonb') or isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)
    elif isinstance(value, bool):
        value = str(value).lower()
    return f'{literal(value)}::{type_name}'


def equals_sql(column, value, type_name):
    # PostgreSQL json lacks an equality operator; compare its jsonb representation.
    expression = ident(column)
    literal_value = sql_value(value, type_name)
    if type_name == 'json':
        expression += '::jsonb'
        literal_value += '::jsonb'
    return f'{expression} IS NOT DISTINCT FROM {literal_value}'


class DirectAPI:
    def __init__(self, token):
        self.token = token
        self.storage_key = None

    def request(self, url, method='GET', data=None, headers=None, raw=False):
        request = urllib.request.Request(url, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                result = response.read()
        except urllib.error.HTTPError as error:
            # Never echo credentials or provider response bodies.
            raise RuntimeError(f'API request failed: HTTP {error.code}; {method} {urllib.parse.urlsplit(url).path}') from None
        return result if raw else (json.loads(result) if result else None)

    def management(self, suffix, method='GET', payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        return self.request(f'{API}/projects/{PROJECT}{suffix}', method, data,
                            {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'})

    def verify_project(self):
        project = self.management('')
        if project.get('id') != PROJECT:
            raise RuntimeError('Wrong Supabase project. Aborting.')

    def query(self, sql, write=False):
        return self.management('/database/query', 'POST', {'query': sql, 'read_only': not write})

    def storage_headers(self):
        if not self.storage_key:
            keys = self.management('/api-keys?reveal=true')
            self.storage_key = next((key['api_key'] for key in keys if key.get('name') == 'service_role'), None)
            if not self.storage_key:
                self.storage_key = next((key['api_key'] for key in keys if key.get('type') == 'secret' and key.get('api_key')), None)
            if not self.storage_key:
                raise RuntimeError('No existing server-side Storage key available. No keys were created.')
        headers = {'apikey': self.storage_key}
        if not self.storage_key.startswith('sb_secret_'):
            headers['Authorization'] = f'Bearer {self.storage_key}'
        return headers

    def object_url(self, name, public=False):
        path = urllib.parse.quote(name, safe='/')
        return (PUBLIC if public else f'{ORIGIN}/storage/v1/object/{BUCKET}/') + path

    def download(self, name, public=False):
        return self.request(self.object_url(name, public), headers={} if public else self.storage_headers(), raw=True)

    def upload(self, name, data, mime):
        headers = {**self.storage_headers(), 'Content-Type': mime, 'x-upsert': 'false', 'cache-control': '31536000'}
        self.request(self.object_url(name), 'POST', data, headers)

    def inventory(self):
        result = []
        last_name = ''
        while True:
            rows = self.query(f"SELECT name, metadata, updated_at FROM storage.objects WHERE bucket_id={literal(BUCKET)} AND name>{literal(last_name)} ORDER BY name LIMIT 250")
            result.extend(rows)
            if len(rows) < 250:
                return result
            last_name = rows[-1]['name']

    def snapshot(self):
        columns = self.query("""SELECT c.table_name, c.column_name, c.udt_name, c.is_generated,
            pg_catalog.format_type(a.atttypid,a.atttypmod) AS type_name
            FROM information_schema.columns c
            JOIN pg_catalog.pg_namespace n ON n.nspname=c.table_schema
            JOIN pg_catalog.pg_class r ON r.relnamespace=n.oid AND r.relname=c.table_name
            JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid AND a.attname=c.column_name
            WHERE c.table_schema='public' AND r.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
            ORDER BY c.table_name,c.ordinal_position"""
        )
        # information_schema hides constraints from the Management API read-only role.
        # The catalog exposes the actual primary key without requiring write access.
        keys = self.query("""SELECT r.relname AS table_name, a.attname AS column_name,
            key.ordinality AS ordinal_position
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class r ON r.oid=c.conrelid
            JOIN pg_catalog.pg_namespace n ON n.oid=r.relnamespace
            CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS key(attnum,ordinality)
            JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid AND a.attnum=key.attnum
            WHERE n.nspname='public' AND c.contype='p'
            ORDER BY r.relname,key.ordinality""")
        tables = {}
        for column in columns:
            table = tables.setdefault(column['table_name'], {'columns': {}, 'pk': [], 'rows': []})
            table['columns'][column['column_name']] = column
        for key in keys:
            tables[key['table_name']]['pk'].append(key['column_name'])
        for name, table in tables.items():
            order = ','.join(ident(key) for key in table['pk']) or 'ctid'
            offset = 0
            while True:
                rows = self.query(f'SELECT * FROM public.{ident(name)} ORDER BY {order} LIMIT 250 OFFSET {offset}')
                table['rows'].extend(rows)
                if len(rows) < 250:
                    break
                offset += 250
        return tables


def backup(api, directory):
    if directory.exists():
        raise RuntimeError('Backup directory already exists; use a new directory.')
    directory.mkdir(mode=0o700, parents=True)
    (directory / 'originals').mkdir(mode=0o700)
    manifest = {'version': 1, 'project': PROJECT, 'bucket': BUCKET,
                'created_at': datetime.now(timezone.utc).isoformat(), 'complete': False,
                'objects': [], 'database': api.snapshot()}
    save_json(directory / 'backup.json', manifest)
    inventory = api.inventory()
    for index, item in enumerate(inventory):
        data = api.download(item['name'])
        local = f'originals/{digest(item["name"].encode())}.bin'
        (directory / local).write_bytes(data)
        manifest['objects'].append({**item, 'local': local, 'sha256': digest(data), 'size': len(data)})
        save_json(directory / 'backup.json', manifest)
        print(f'Backup {index+1}/{len(inventory)}', flush=True)
    if inventory != api.inventory() or manifest['database'] != api.snapshot():
        raise RuntimeError('Content changed during backup. No references were altered; take a fresh backup.')
    manifest['complete'] = True
    save_json(directory / 'backup.json', manifest)
    print(f'Complete backup verified: {len(inventory)} files. No server changes.')


def validate_backup(directory):
    manifest = load_json(directory / 'backup.json')
    if manifest.get('project') != PROJECT or manifest.get('bucket') != BUCKET or not manifest.get('complete'):
        raise RuntimeError('Backup is incomplete or belongs to a different project.')
    for item in manifest['objects']:
        if digest((directory / item['local']).read_bytes()) != item['sha256']:
            raise RuntimeError('Original backup integrity check failed.')
    return manifest


def lossless_webp(data):
    with Image.open(io.BytesIO(data)) as image:
        if image.format not in ('JPEG', 'PNG') or getattr(image, 'is_animated', False):
            return None, 'unsupported-or-animated'
        # 16-bit, CMYK and unusual color modes must not be silently quantized.
        if image.mode not in ('RGB', 'RGBA', 'L', 'LA', 'P', '1'):
            return None, 'unsupported-color-mode'
        if max(image.size) > 16383 or image.width * image.height > 24000000:
            return None, 'dimensions-exceed-limit'
        # WebP cannot retain PNG gamma/chromaticity chunks. Preserve the source.
        if image.format == 'PNG' and any(key in image.info for key in ('gamma', 'chromaticity')) and not image.info.get('icc_profile'):
            return None, 'color-metadata'
        rgba = image.convert('RGBA')
        metadata = {'icc_profile': image.info.get('icc_profile', b''),
                    'exif': image.info.get('exif', b''), 'xmp': image.info.get('xmp', b'')}
        output = io.BytesIO()
        rgba.save(output, format='WEBP', lossless=True, quality=100, method=6, exact=True, **metadata)
        candidate = output.getvalue()
        with Image.open(io.BytesIO(candidate)) as check:
            if check.size != rgba.size or check.convert('RGBA').tobytes() != rgba.tobytes():
                raise RuntimeError('Lossless WebP pixel verification failed.')
            for key, value in metadata.items():
                stored = check.info.get(key, b'')
                if key == 'exif':
                    # WebP may omit the six-byte Exif wrapper; TIFF payload must match.
                    value = value.removeprefix(b'Exif\x00\x00')
                    stored = stored.removeprefix(b'Exif\x00\x00')
                if value and stored != value:
                    raise RuntimeError('Color/orientation metadata verification failed.')
        if len(candidate) >= len(data):
            return None, 'not-smaller'
        return candidate, 'converted'


def replace_refs(value, mapping):
    if isinstance(value, str):
        if value in mapping:
            return mapping[value]
        # Full canonical URLs may also be embedded in HTML/text.
        for source, target in mapping.items():
            if source.startswith(ORIGIN + '/'):
                value = re.sub(re.escape(source) + r'(?=$|[?\s\"\'<>),]|&(?![A-Za-z0-9]))', lambda _: target, value)
        return value
    if isinstance(value, list):
        return [replace_refs(item, mapping) for item in value]
    if isinstance(value, dict):
        updated = {key: replace_refs(item, mapping) for key, item in value.items()}
        if updated != value:
            # Metadata belongs to this image, not unrelated original CMS path labels.
            for key in ('storagePath', 'storage_path'):
                if value.get(key) in mapping and updated.get(key, '').endswith('.webp'):
                    for content_key in ('contentType', 'content_type'):
                        if content_key in updated:
                            updated[content_key] = 'image/webp'
        return updated
    return value


def build_plan(directory):
    manifest = validate_backup(directory)
    converted = directory / 'converted'
    converted.mkdir(exist_ok=True)
    run = digest(manifest['created_at'].encode())[:12]
    plan = {'project': PROJECT, 'bucket': BUCKET, 'backup_sha256': digest((directory/'backup.json').read_bytes()),
            'files': [], 'changes': [], 'skipped': [], 'state': 'planned'}
    mapping = {}
    for item in manifest['objects']:
        if not re.search(r'\.(?:jpe?g|png)$', item['name'], re.I):
            continue
        data, reason = lossless_webp((directory / item['local']).read_bytes())
        if data is None:
            plan['skipped'].append({'name': item['name'], 'reason': reason})
            continue
        stem = item['name'].rsplit('.', 1)[0]
        target = f'{stem}-lossless-{run}-{item["sha256"][:12]}.webp'
        local = f'converted/{digest(target.encode())}.webp'
        (directory / local).write_bytes(data)
        record = {'original': item['name'], 'target': target, 'local': local, 'sha256': digest(data),
                  'original_sha256': item['sha256'], 'size': len(data), 'original_size': item['size']}
        plan['files'].append(record)
        mapping[item['name']] = target
        mapping[PUBLIC + urllib.parse.quote(item['name'], safe='/')] = PUBLIC + urllib.parse.quote(target, safe='/')
        mapping[PUBLIC + item['name']] = PUBLIC + urllib.parse.quote(target, safe='/')
    for name, table in manifest['database'].items():
        for row in table['rows']:
            transformed = replace_refs(row, mapping)
            # Asset row metadata must describe converted file. Keep path (CMS lookup key) untouched.
            old_path = row.get('storage_path')
            file_record = next((entry for entry in plan['files'] if entry['original'] == old_path), None)
            if file_record:
                if 'content_type' in transformed:
                    transformed['content_type'] = 'image/webp'
                if 'size' in transformed:
                    transformed['size'] = file_record['size']
                if 'file_name' in transformed:
                    transformed['file_name'] = file_record['target'].split('/')[-1]
            changed = {key: {'before': row[key], 'after': value, 'type': table['columns'][key]['type_name']}
                       for key, value in transformed.items() if value != row[key]}
            if not changed:
                continue
            if not table['pk'] or any(key in table['pk'] or table['columns'][key]['is_generated'] != 'NEVER' for key in changed):
                raise RuntimeError('A referenced column cannot be updated safely; no server changes made.')
            plan['changes'].append({'table': name,
                                    'key': {key: {'value': row[key], 'type': table['columns'][key]['type_name']} for key in table['pk']},
                                    'columns': changed})
    save_json(directory / 'plan.json', plan)
    print(f"Plan: {len(plan['files'])} smaller lossless files; {len(plan['changes'])} changed rows; {len(plan['skipped'])} kept original.")
    print(f"Saved bytes: {sum(entry['original_size']-entry['size'] for entry in plan['files'])}. Nothing uploaded yet.")
    return plan


def guarded_sql(changes, reverse=False):
    statements = []
    for change in changes:
        assignments = []
        expected = []
        target_checks = []
        for name, entry in change['columns'].items():
            before, after = (entry['after'], entry['before']) if reverse else (entry['before'], entry['after'])
            assignments.append(f'{ident(name)}={sql_value(after,entry["type"])}')
            expected.append(equals_sql(name,before,entry['type']))
            target_checks.append(equals_sql(name,after,entry['type']))
        keys = ' AND '.join(f'{ident(key)} IS NOT DISTINCT FROM {sql_value(entry["value"],entry["type"])}' for key, entry in change['key'].items())
        table = 'public.' + ident(change['table'])
        statements.append(f'''IF NOT EXISTS (SELECT 1 FROM {table} WHERE {keys} AND {' AND '.join(target_checks)}) THEN
            UPDATE {table} SET {','.join(assignments)} WHERE {keys} AND {' AND '.join(expected)};
            GET DIAGNOSTICS affected = ROW_COUNT;
            IF affected <> 1 THEN RAISE EXCEPTION 'Media reference conflict; transaction rolled back'; END IF;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM {table} WHERE {keys} AND {' AND '.join(target_checks)}) THEN
            RAISE EXCEPTION 'Media reference verification failed; transaction rolled back';
          END IF;''')
    # Stable locks block concurrent changes during guard/update. No partial commits.
    tables = sorted({change['table'] for change in changes})
    locks = ('LOCK TABLE ' + ','.join('public.'+ident(name) for name in tables) + ' IN SHARE ROW EXCLUSIVE MODE;') if tables else ''
    body = ' DECLARE affected integer; BEGIN\n' + '\n'.join(statements) + '\nEND; '
    tag = '$migration$'
    while tag in body:
        tag = tag[:-1] + 'x$'
    return 'BEGIN; SET LOCAL lock_timeout=\'5s\'; SET LOCAL statement_timeout=\'60s\';\n' + locks + '\nDO ' + tag + body + tag + '; COMMIT;'


def verify_rows(api, plan, reverse=False):
    for change in plan['changes']:
        keys = ' AND '.join(f'{ident(key)} IS NOT DISTINCT FROM {sql_value(entry["value"],entry["type"])}' for key, entry in change['key'].items())
        rows = api.query(f'SELECT * FROM public.{ident(change["table"])} WHERE {keys}')
        if len(rows) != 1 or any(rows[0][key] != entry['before' if reverse else 'after'] for key, entry in change['columns'].items()):
            raise RuntimeError('Database verification failed; retain backup and inspect before retrying.')


def apply(api, directory):
    validate_backup(directory)
    plan = load_json(directory / 'plan.json')
    if plan.get('project') != PROJECT or plan.get('backup_sha256') != digest((directory/'backup.json').read_bytes()):
        raise RuntimeError('Plan does not match verified backup.')
    if plan.get('state') == 'rolled-back':
        raise RuntimeError('Run was rolled back; take a new backup before applying again.')
    # Persist rollback intent BEFORE any remote mutation (also survives lost responses).
    plan['state'] = 'applying'
    save_json(directory / 'plan.json', plan)
    for index, entry in enumerate(plan['files'], 1):
        if digest(api.download(entry['original'])) != entry['original_sha256']:
            raise RuntimeError('Original file changed since backup. No reference swap attempted.')
        data = (directory / entry['local']).read_bytes()
        if digest(data) != entry['sha256']:
            raise RuntimeError('Converted file integrity failure.')
        try:
            existing = api.download(entry['target'])
        except RuntimeError as error:
            if 'HTTP 404' not in str(error) and 'HTTP 400' not in str(error):
                raise
            existing = None
        if existing is None:
            api.upload(entry['target'], data, 'image/webp')
        elif digest(existing) != entry['sha256']:
            raise RuntimeError('Target path conflict. No files overwritten.')
        if digest(api.download(entry['target'], public=True)) != entry['sha256']:
            raise RuntimeError('Public WebP verification failed. No reference swap attempted.')
        print(f'Uploaded and publicly verified {index}/{len(plan["files"])}', flush=True)
    api.query(guarded_sql(plan['changes']), write=True)
    verify_rows(api, plan)
    plan['state'] = 'applied'
    save_json(directory / 'plan.json', plan)
    print('Migration verified. All original server files retained. Rollback is available.')


def rollback(api, directory):
    manifest = validate_backup(directory)
    plan = load_json(directory / 'plan.json')
    if plan.get('project') != PROJECT or plan.get('backup_sha256') != digest((directory/'backup.json').read_bytes()):
        raise RuntimeError('Rollback plan does not match verified backup.')
    if plan.get('state') not in ('applying', 'applied', 'rolling-back', 'rolled-back'):
        raise RuntimeError('Migration was not applied; no rollback necessary.')
    originals = {item['name']: item for item in manifest['objects']}
    # Validate originals and, if missing, recover byte-for-byte from local backup.
    for entry in plan['files']:
        item = originals[entry['original']]
        try:
            data = api.download(item['name'])
        except RuntimeError as error:
            if 'HTTP 404' not in str(error) and 'HTTP 400' not in str(error):
                raise
            api.upload(item['name'], (directory/item['local']).read_bytes(), item.get('metadata', {}).get('mimetype', 'application/octet-stream'))
            data = api.download(item['name'])
        if digest(data) != item['sha256']:
            raise RuntimeError('Original was edited after migration; do not overwrite it automatically.')
        if digest(api.download(item['name'], public=True)) != item['sha256']:
            raise RuntimeError('Original public image could not be verified. References not restored yet.')
    plan['state'] = 'rolling-back'
    save_json(directory/'plan.json', plan)
    api.query(guarded_sql(plan['changes'], reverse=True), write=True)
    verify_rows(api, plan, reverse=True)
    plan['state'] = 'rolled-back'
    save_json(directory/'plan.json', plan)
    print('Original references restored and verified. No WebP or original files deleted.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['backup', 'plan', 'apply', 'rollback'])
    parser.add_argument('--backup-dir', type=Path, required=True)
    args = parser.parse_args()
    if not features.check('webp'):
        parser.error('Pillow must include WebP support.')
    if args.command == 'plan':
        build_plan(args.backup_dir)
        return
    token = os.environ.get('SUPABASE_ACCESS_TOKEN') or getpass.getpass('Supabase personal access token (hidden): ')
    api = DirectAPI(token)
    api.verify_project()
    {'backup': backup, 'apply': apply, 'rollback': rollback}[args.command](api, args.backup_dir)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError) as error:
        print(f'Aborted: {error}', file=sys.stderr)
        sys.exit(1)


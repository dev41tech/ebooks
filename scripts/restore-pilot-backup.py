#!/usr/bin/env python3
"""Validate and restore a Sambu export into a NEW local directory, never production."""
import argparse, json, pathlib, re, shutil, sqlite3, zipfile

TABLES = ['profiles','books','chapters','reading_progress','bookmarks','favorites','analytics_events','subscriptions','reviews','reading_sessions','notifications','media_assets','import_batches','staging_books','discovery_searches','beta_feedback']

def restore(archive, destination):
    destination = pathlib.Path(destination)
    if destination.exists():
        raise ValueError('Destino já existe; use uma pasta nova. Nenhum dado será sobrescrito.')
    with zipfile.ZipFile(archive) as z:
        entries = z.infolist()
        if len(entries)>500 or sum(i.file_size for i in entries)>270_000_000:
            raise ValueError('Arquivo excede os limites do backup do piloto.')
        if len({i.filename for i in entries})!=len(entries):
            raise ValueError('Entradas duplicadas no ZIP.')
        if z.getinfo('snapshot.json').file_size>10_000_000:
            raise ValueError('Snapshot muito grande.')
        snapshot=json.loads(z.read('snapshot.json'))
        if snapshot.get('format')!='sambu-pilot-backup-v1' or set(snapshot.get('tables',{}))!=set(TABLES):
            raise ValueError('Formato de backup desconhecido.')
        expected={'snapshot.json'}
        for asset in snapshot['assets']:
            key=asset['key']
            if not key or key.startswith('/') or '\\' in key or any(p in ('.','..','') for p in key.split('/')):
                raise ValueError('Caminho de arquivo inválido.')
            name='assets/'+key
            if name in expected or z.getinfo(name).file_size!=asset['size']:
                raise ValueError('Arquivo ausente, duplicado ou com tamanho incorreto.')
            expected.add(name)
        if expected!={i.filename for i in entries} or z.testzip() is not None:
            raise ValueError('ZIP incompleto ou corrompido.')
        for row in snapshot['schema']:
            if row['tbl_name'] not in TABLES or row['type'] not in ('table','index') or not re.match(r'^CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s',row['sql'],re.I):
                raise ValueError('Esquema inesperado.')
        destination.mkdir(parents=True)
        try:
            db=sqlite3.connect(destination/'data.sqlite')
            try:
                db.execute('PRAGMA foreign_keys=ON')
                for row in snapshot['schema']:
                    db.execute(row['sql'])
                with db:
                    for table in TABLES:
                        rows=snapshot['tables'][table]
                        allowed={r[1] for r in db.execute(f'PRAGMA table_info("{table}")')}
                        for row in rows:
                            if not set(row).issubset(allowed):
                                raise ValueError('Colunas desconhecidas.')
                            columns=','.join('"'+k.replace('"','""')+'"' for k in row)
                            placeholders=','.join('?' for _ in row)
                            db.execute(f'INSERT INTO "{table}" ({columns}) VALUES ({placeholders})',list(row.values()))
                if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or db.execute('PRAGMA foreign_key_check').fetchall():
                    raise ValueError('Falha de integridade ao restaurar.')
            finally:
                db.close()
            for asset in snapshot['assets']:
                target=destination/'assets'/asset['key']
                target.parent.mkdir(parents=True,exist_ok=True)
                with z.open('assets/'+asset['key']) as src, target.open('wb') as dst:
                    shutil.copyfileobj(src,dst,1024*1024)
            (destination/'snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False),encoding='utf-8')
            result={'tables':len(TABLES),'rows':sum(len(v) for v in snapshot['tables'].values()),'assets':len(snapshot['assets']),'integrity':'ok','productionChanged':False}
            (destination/'verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
            return result
        except Exception:
            shutil.rmtree(destination)
            raise

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('destination',help='Nova pasta local, ainda inexistente')
    args=parser.parse_args()
    print(json.dumps(restore(args.archive,args.destination)))

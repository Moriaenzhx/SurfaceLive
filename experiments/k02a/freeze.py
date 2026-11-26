"""Verify the K-01 anchors read-only. Seal once and verify against the same seal on later runs."""
import hashlib
import json
import os
import subprocess
import zipfile
from pathlib import Path

root = Path('runs/K-01')
private = Path('runs/K-02A/organizer')
private.mkdir(parents=True, exist_ok=True, mode=0o700)
sha = lambda data: hashlib.sha256(data).hexdigest()

def read(path):
    return json.loads(path.read_bytes())

files = {p.relative_to(root).as_posix(): sha(p.read_bytes())
         for p in sorted(root.rglob('*')) if p.is_file()}
rows = read(root/'verified-manifest.json')
assert {(r['scene'], r['group']) for r in rows} == {
    (s,g) for s in ('zhishi','recruiting') for g in ('A0','A-current')} and len(rows)==4
anchors = []
for row in rows:
    folder = root/row['scene']/row['group']
    rec = read(folder/'receipt.json')
    src = Path(row['source'])
    vr = read(folder/'verification/results.json')
    assert rec['run_id'] == vr['run_id'] == row['run_id']
    assert row['sourceVersion'] == vr['sourceVersion'] == sha(json.dumps(vr['files'],separators=(',',':')).encode())
    for name, digest in vr['files'].items():
        assert sha((src/name).read_bytes()) == digest
    current = row['group']=='A-current'
    if current:
        t = read(src/'design-trace.json')
        assert sha((src/'design-trace.json').read_bytes()) == rec['traceSha256']
        assert read(src/'steps/art-direction/response.json')['selectedId'] == t['artDirection']['selectedId']
        index = read(src/'design-audit.json')
        assert index['requestSha256'] == sha(rec['text'].encode())
    calls = t['invocations'] if current else rec['invocations']
    for i,call in enumerate(calls):
        op = call['operation']
        prompt = (src/'steps'/op/'prompt.md' if op!='source' else
                  (src if current else folder)/'prompt.md')
        assert sha(prompt.read_bytes()) == call['promptSha256'] == row['inputs'][i]['textSha256']
        if current:
            assert index['calls'][i]['promptSha256'] == call['promptSha256']
            assert [x['id'] for x in index['calls'][i]['present']] == row['inputs'][i]['knowledge']
    for v in vr['views']:
        for shot in [v['screenshot'],v['taskScreenshot']]:
            assert sha((folder/'verification'/shot['file']).read_bytes()) == shot['sha256']
    anchors.append({k:row[k] for k in ('scene','group','run_id','sourceVersion')})
seal = private/'freeze.json'
archive = private/'K-01-originals.zip'
if not seal.exists():
    git = subprocess.run(['git','rev-parse','--show-toplevel'],capture_output=True,text=True)
    with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED) as z:
        for name in files:
            z.write(root/name, name)
    os.chmod(archive, 0o600)
    with seal.open('x') as f:
        json.dump(dict(files=files, anchors=anchors, archiveSha256=sha(archive.read_bytes()),
                       git={'cwd':str(Path.cwd()),'exit':git.returncode,'output':(git.stdout+git.stderr).strip()}),f,indent=2)
frozen = read(seal)
assert files == frozen['files'] and anchors == frozen['anchors']
assert sha(archive.read_bytes()) == frozen['archiveSha256']
with zipfile.ZipFile(archive) as z:
    assert {n:sha(z.read(n)) for n in z.namelist()} == files
print(f'{len(anchors)} source versions, {len(files)} K-01 files verified; archive SHA-256 {frozen["archiveSha256"]}')

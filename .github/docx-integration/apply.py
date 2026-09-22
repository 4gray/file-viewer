import sys, os, pathlib, hashlib, base64, lzma, json, subprocess, bz2, difflib, shutil
ROOT = pathlib.Path.cwd()
TEMP = pathlib.Path(os.environ['RUNNER_TEMP'])
STATE = TEMP / 'docx-integration.json'

def sha(data): return hashlib.sha256(data).hexdigest()
def number(data):
    if len(data) != 8: raise ValueError('Truncated bsdiff integer')
    v = int.from_bytes(data, 'little')
    return -(v & 0x7fffffffffffffff) if v >> 63 else v

def inflate(data):
    d = bz2.BZ2Decompressor()
    out = d.decompress(data, max_length=16 * 1024 * 1024)
    assert d.eof and not d.unused_data, 'Invalid or excessive bsdiff stream'
    return out

def bsdiff(old, data):
    assert data[:8] == b'BSDIFF40'
    c, n, size = [number(data[i:i+8]) for i in (8,16,24)]
    assert 0 <= size < 2000000 and c > 0 and n > 0 and 32+c+n <= len(data)
    ctrl = inflate(data[32:32+c]); diff = inflate(data[32+c:32+c+n]); extra = inflate(data[32+c+n:])
    assert len(ctrl) % 24 == 0
    out = bytearray(); op = dp = ep = 0
    for i in range(0,len(ctrl),24):
        a,b,seek = [number(ctrl[i+j:i+j+8]) for j in (0,8,16)]
        assert a >= 0 and b >= 0 and len(out)+a+b <= size
        assert dp+a <= len(diff) and ep+b <= len(extra)
        out.extend((diff[dp+k] + (old[op+k] if 0 <= op+k < len(old) else 0)) & 255 for k in range(a))
        out.extend(extra[ep:ep+b]); op += a+seek; dp += a; ep += b
    assert len(out) == size and dp == len(diff) and ep == len(extra)
    return bytes(out)

if sys.argv[1] == 'source':
    root = ROOT / '.github/docx-integration'
    encoded = ''.join((root / f'part-{i}.txt').read_text().strip() for i in range(2))
    d = lzma.LZMADecompressor(memlimit=128*1024*1024)
    raw = d.decompress(base64.b64decode(encoded, validate=True), max_length=2*1024*1024)
    assert d.eof and not d.unused_data
    assert sha(raw) == '8e0d65950005fbb29f6eb9a60bbe3156764779de6d6c537179511e3e3c51dd45'
    obj = json.loads(raw); patch = obj['sourcePatch'].encode()
    assert sha(patch) == obj['sourceSha256']
    subprocess.run(['git','apply','--check','-'],input=patch,check=True)
    subprocess.run(['git','apply','--index','-'],input=patch,check=True)
    staged = subprocess.check_output(['git','diff','--cached','--name-only'],text=True).splitlines()
    assert len(staged) == 11 and set(staged) == set(obj['files'])
    assert all(not p.startswith('.github/') and '..' not in pathlib.PurePosixPath(p).parts for p in staged)
    STATE.write_bytes(raw)
elif sys.argv[1] == 'runtime':
    obj = json.loads(STATE.read_text()); dist = TEMP / 'verify-runtime/node_modules/@file-viewer/docx/dist'
    names = {'docx-preview.mjs':'docx-preview.mjs','docx-preview.min.mjs':'docx-preview.mjs','docx-preview.js':'docx-preview.js','docx-preview.min.js':'docx-preview.js','docx-preview.worker.js':'docx-preview.worker.js'}
    old = {name:(dist/name).read_bytes() for name in names}; new = {}
    for name,record in obj['deltas'].items():
        assert sha(old[name]) == record['base_sha256']
        new[name] = bsdiff(old[name],base64.b64decode(record['patch'],validate=True))
        assert sha(new[name]) == record['result_sha256']
    prelude = subprocess.check_output(['node','-e',"process.stdout.write(require('./.github/docx-integration/worker-dom.cjs').buildWorkerDomPrelude())"])
    new['docx-preview.worker.js'] = prelude + new['docx-preview.worker.js']
    pins = json.loads((ROOT/'patches/docx-engine-compatibility.json').read_text()); parts = []
    for name,source in names.items():
        data = new[source]; assert sha(data) == pins['sha256'][name], name
        parts.append(f'diff --git a/dist/{name} b/dist/{name}\n')
        parts.extend(difflib.unified_diff(old[name].decode().splitlines(True),data.decode().splitlines(True),fromfile=f'a/dist/{name}',tofile=f'b/dist/{name}',n=3))
        (dist/name).write_bytes(data)
    patch = ''.join(parts).encode(); assert sha(patch) == pins['patchSha256']
    (ROOT/'patches/@file-viewer__docx@0.3.32.patch').write_bytes(patch)
    shutil.copyfile(dist/'docx-preview.worker.js',ROOT/'apps/viewer-demo/public/vendor/docx/docx.worker.js')
    subprocess.run(['git','add','--','patches/@file-viewer__docx@0.3.32.patch','apps/viewer-demo/public/vendor/docx/docx.worker.js'],check=True)
    print('Five installed entries and the standard pnpm patch match the tested engine byte-for-byte.')
else:
    raise ValueError('Unknown stage')

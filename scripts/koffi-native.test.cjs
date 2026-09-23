const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { koffiNativeSpec, nativePackageInstalled, verifyKoffiNative } = require('./koffi-native.cjs');

test('selects installed Koffi version, rejects stale binaries and checks target architecture', t => {
  const nm = fs.mkdtempSync(path.join(os.tmpdir(), 'koffi-native-'));
  t.after(() => fs.rmSync(nm, { recursive: true, force: true }));
  fs.mkdirSync(path.join(nm, 'koffi'));
  fs.writeFileSync(path.join(nm, 'koffi/package.json'), JSON.stringify({ version: '3.3.0', optionalDependencies: {
    '@koromix/koffi-linux-x64': '3.3.0', '@koromix/koffi-linux-arm64': '3.3.0',
  } }));
  const spec = koffiNativeSpec(nm, 'linux', 'x64');
  assert.equal(spec.version, '3.3.0');
  assert.equal(koffiNativeSpec(nm, 'linux', 'arm64').version, '3.3.0');
  const dir = path.join(nm, spec.name);
  fs.mkdirSync(path.dirname(path.join(dir, spec.marker)), { recursive: true });
  const header = Buffer.alloc(20);
  header.write('7f454c46', 0, 'hex');
  header.writeUInt16LE(62, 18);
  fs.writeFileSync(path.join(dir, spec.marker), header);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '3.1.5' }));
  assert.equal(nativePackageInstalled(nm, spec), false);
  assert.throws(() => verifyKoffiNative(nm, 'linux', 'x64'), /missing or mismatched/);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '3.3.0' }));
  assert.equal(nativePackageInstalled(nm, spec), true);
  assert.deepEqual(verifyKoffiNative(nm, 'linux', 'x64'), spec);
  header.writeUInt16LE(183, 18);
  fs.writeFileSync(path.join(dir, spec.marker), header);
  assert.throws(() => verifyKoffiNative(nm, 'linux', 'x64'), /does not match/);
});

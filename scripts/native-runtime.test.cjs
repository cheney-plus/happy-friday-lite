const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  restoreTargetRuntimePackages,
  targetRuntimeSpecs,
  verifyTargetRuntimePackages,
} = require('./native-runtime.cjs');
const { auditNativeArtifact } = require('./native-artifact-audit.cjs');
const { _pruneNodeModules: pruneNodeModules } = require('./afterpack.cjs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function writePackage(nm, spec, contents = Buffer.from('marker')) {
  writeJson(path.join(nm, spec.name, 'package.json'), { name: spec.name, version: spec.version });
  for (const marker of spec.markers) {
    const file = path.join(nm, spec.name, marker);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-runtime-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const destination = path.join(root, 'app', 'resources', 'app', 'node_modules');
  const optional = {
    '@deepseek-ai/node-addon-system-linux-arm64': '0.1.2',
  };
  writeJson(path.join(destination, '@deepseek-ai/node-addon-system/package.json'), {
    name: '@deepseek-ai/node-addon-system', optionalDependencies: optional,
  });
  return { root, source, destination };
}

test('restores all marker files for a target runtime package', t => {
  const { source, destination } = fixture(t);
  const specs = targetRuntimeSpecs(destination, 'linux', 'arm64');
  assert.equal(specs.length, 1);
  writePackage(source, specs[0]);
  restoreTargetRuntimePackages(source, destination, 'linux', 'arm64');
  assert.doesNotThrow(() => verifyTargetRuntimePackages(destination, 'linux', 'arm64'));
});

test('recursively removes foreign platform packages nested under entry packages', t => {
  const { destination } = fixture(t);
  const foreign = path.join(destination, '@deepseek-ai/node-addon-system/node_modules/@deepseek-ai/node-addon-system-darwin-arm64');
  writeJson(path.join(foreign, 'package.json'), { name: '@deepseek-ai/node-addon-system-darwin-arm64' });
  pruneNodeModules(destination, 'linux', 'arm64', []);
  assert.equal(fs.existsSync(foreign), false);
});

test('removes the incompatible node-pty prebuild when a source build exists', t => {
  const { destination } = fixture(t);
  const pty = path.join(destination, 'node-pty');
  fs.mkdirSync(path.join(pty, 'build/Release'), { recursive: true });
  fs.mkdirSync(path.join(pty, 'prebuilds/linux-arm64'), { recursive: true });
  fs.writeFileSync(path.join(pty, 'build/Release/pty.node'), 'compatible');
  fs.writeFileSync(path.join(pty, 'prebuilds/linux-arm64/pty.node'), 'incompatible');
  pruneNodeModules(destination, 'linux', 'arm64', []);
  assert.equal(fs.existsSync(path.join(pty, 'prebuilds/linux-arm64')), false);
});

test('artifact audit rejects foreign binaries and startup GLIBC newer than Ubuntu 18.04', t => {
  const { root, source, destination } = fixture(t);
  const specs = targetRuntimeSpecs(destination, 'linux', 'arm64');
  writePackage(source, specs[0]);
  restoreTargetRuntimePackages(source, destination, 'linux', 'arm64');
  const native = path.join(destination, 'node-pty/prebuilds/linux-arm64/pty.node');
  fs.mkdirSync(path.dirname(native), { recursive: true });
  const elf = Buffer.alloc(128);
  elf.write('7f454c46', 0, 'hex');
  elf.writeUInt16LE(183, 18);
  elf.write('GLIBC_2.28\0', 32, 'ascii');
  fs.writeFileSync(native, elf, { mode: 0o755 });
  assert.throws(() => auditNativeArtifact(path.join(root, 'app'), 'arm64'), /GLIBC_2\.28/);

  fs.writeFileSync(native, Buffer.from('cffaedfe00000000000000000000000000000000', 'hex'), { mode: 0o755 });
  assert.throws(() => auditNativeArtifact(path.join(root, 'app'), 'arm64'), /mach-o binary/);
});

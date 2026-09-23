const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  restoreSharpNative,
  sharpNativePackageInstalled,
  sharpNativeSpecs,
  verifySharpNative,
} = require('./sharp-native.cjs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function elf(machine) {
  const header = Buffer.alloc(20);
  header.write('7f454c46', 0, 'hex');
  header.writeUInt16LE(machine, 18);
  return header;
}

function fixture(t, arch = 'arm64') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sharp-native-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const destination = path.join(root, 'destination');
  const runtime = `linux-${arch}`;
  const addon = `@img/sharp-${runtime}`;
  const libvips = `@img/sharp-libvips-${runtime}`;
  writeJson(path.join(source, 'sharp/package.json'), {
    name: 'sharp', version: '0.35.3', optionalDependencies: {
      [addon]: '0.35.3', [libvips]: '1.3.2',
    },
  });
  writeJson(path.join(destination, 'sharp/package.json'), {
    name: 'sharp', version: '0.35.3', optionalDependencies: {
      [addon]: '0.35.3', [libvips]: '1.3.2',
    },
  });
  writeJson(path.join(source, addon, 'package.json'), {
    name: addon, version: '0.35.3', optionalDependencies: { [libvips]: '1.3.2' },
  });
  const addonFile = path.join(source, addon, `lib/sharp-${runtime}-0.35.3.node`);
  fs.mkdirSync(path.dirname(addonFile), { recursive: true });
  fs.writeFileSync(addonFile, elf(arch === 'arm64' ? 183 : 62));
  writeJson(path.join(source, libvips, 'package.json'), {
    name: libvips, version: '1.3.2', exports: { './binary': './lib/libvips-cpp.so.8.18.3' },
  });
  const libvipsFile = path.join(source, libvips, 'lib/libvips-cpp.so.8.18.3');
  fs.mkdirSync(path.dirname(libvipsFile), { recursive: true });
  fs.writeFileSync(libvipsFile, elf(arch === 'arm64' ? 183 : 62));
  return { source, destination, addon, libvips, addonFile };
}

test('derives both Sharp Linux runtime packages from the installed sharp version', t => {
  const { source, addon, libvips } = fixture(t);
  assert.deepEqual(sharpNativeSpecs(source, 'linux', 'arm64').map(spec => spec.name), [addon, libvips]);
  for (const spec of sharpNativeSpecs(source, 'linux', 'arm64')) {
    assert.equal(sharpNativePackageInstalled(source, spec), true);
  }
});

test('rejects a missing or wrong-architecture Sharp runtime', t => {
  const { source, addonFile, libvips } = fixture(t);
  assert.doesNotThrow(() => verifySharpNative(source, 'linux', 'arm64'));
  fs.writeFileSync(addonFile, elf(62));
  assert.equal(sharpNativePackageInstalled(source, sharpNativeSpecs(source, 'linux', 'arm64')[0]), false);
  assert.throws(() => verifySharpNative(source, 'linux', 'arm64'), /not a Linux arm64 ELF/);
  fs.writeFileSync(addonFile, elf(183));
  fs.rmSync(path.join(source, libvips), { recursive: true, force: true });
  assert.throws(() => verifySharpNative(source, 'linux', 'arm64'), /native package is missing or invalid/);
});

test('restores the complete Sharp runtime into the packaged node_modules', t => {
  const { source, destination, addon, libvips } = fixture(t);
  const stats = [];
  restoreSharpNative(source, destination, 'linux', 'arm64', stats);
  assert.doesNotThrow(() => verifySharpNative(destination, 'linux', 'arm64'));
  assert.ok(fs.existsSync(path.join(destination, addon, 'package.json')));
  assert.ok(fs.existsSync(path.join(destination, libvips, 'package.json')));
  assert.equal(stats.length, 2);
});

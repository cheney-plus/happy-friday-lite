const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const nodeModules = path.resolve(process.argv[2]);
const includeLazy = process.argv.includes('--include-lazy');

async function main() {
  const pty = require(path.join(nodeModules, 'node-pty'));
  assert.ok(pty.native, 'node-pty native API did not load');
  console.log('[native-probe] Loaded node-pty');

  const koffi = require(path.join(nodeModules, 'koffi'));
  assert.ok(koffi.version, 'Koffi did not expose its version');
  console.log(`[native-probe] Loaded Koffi ${koffi.version}`);

  const sharp = require(path.join(nodeModules, 'sharp'));
  const image = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#000' } }).png().toBuffer();
  assert.ok(image.length, 'Sharp returned an empty image');
  console.log(`[native-probe] Loaded Sharp ${sharp.versions.sharp}`);

  const requireBuiltin = require(path.join(nodeModules, 'node-addon-require-builtin'));
  assert.equal(typeof requireBuiltin.requireBuiltin('node:path').join, 'function');
  console.log('[native-probe] Loaded node-addon-require-builtin');

  const systemDir = path.join(nodeModules, '@deepseek-ai', 'node-addon-system');
  const flock = await import(pathToFileURL(path.join(systemDir, 'lib', 'flock.js')));
  const temporary = path.join(os.tmpdir(), `happy-friday-flock-${process.pid}`);
  const descriptor = fs.openSync(temporary, 'w');
  try {
    await flock.tryLockExclusive(descriptor);
  } finally {
    fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
  }
  const landlock = await import(pathToFileURL(path.join(systemDir, 'lib', 'index.js')));
  fs.accessSync(landlock.launcherPath(), fs.constants.X_OK);
  console.log('[native-probe] Loaded DeepSeek system addon');

  const ripgrep = await import(pathToFileURL(path.join(nodeModules, '@vscode', 'ripgrep', 'lib', 'index.js')));
  const rg = spawnSync(ripgrep.rgPath, ['--version'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(rg.status, 0, rg.stderr || rg.stdout);
  console.log(`[native-probe] Loaded ${rg.stdout.split('\n')[0]}`);

  if (includeLazy) {
    const zvec = require(path.join(nodeModules, '@zvec', 'zvec'));
    assert.equal(typeof zvec.ZVecOpen, 'function');
    console.log('[native-probe] Loaded Zvec');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { _repairDeepseekImports: repair } = require('./afterpack.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-afterpack-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { src: path.join(root, 'node_modules'), dest: path.join(root, 'release/app/node_modules') };
}
function pkg(nm, name, code = 'export const value = 1;') {
  const dir = path.join(nm, '@deepseek-ai', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: `@deepseek-ai/${name}`, type: 'module', main: 'index.js' }));
  fs.writeFileSync(path.join(dir, 'index.js'), code);
  return dir;
}

test('repairs peers per importer even when another nested plugin can resolve them', async t => {
  const { src, dest } = fixture(t);
  const host = pkg(dest, 'dsh');
  const nested = path.join(host, 'node_modules');
  const consumer = pkg(nested, 'dsh-session-log-export', 'export { value } from "@deepseek-ai/dsh-session-persistence";');
  const other = pkg(nested, 'other');
  pkg(path.join(other, 'node_modules'), 'dsh-session-persistence');
  pkg(src, 'dsh-session-persistence');
  const stats = [];
  repair(dest, src, stats);
  assert.equal((await import(pathToFileURL(path.join(consumer, 'index.js')))).value, 1);
  assert.equal(stats.length, 1);
  repair(dest, src, stats);
  assert.equal(stats.length, 1, 'repair is idempotent');
});

test('does not resolve against build machine ancestors and follows transitive side-effect imports', async t => {
  const { src, dest } = fixture(t);
  const consumer = pkg(dest, 'consumer', 'import "@deepseek-ai/peer0";');
  for (let i = 0; i < 7; i++) pkg(src, `peer${i}`, i < 6 ? `import "@deepseek-ai/peer${i + 1}";` : '');
  const stats = [];
  repair(dest, src, stats);
  assert.equal(stats.length, 7);
  assert.ok(fs.existsSync(path.join(dest, '@deepseek-ai/peer6/package.json')));
  await import(pathToFileURL(path.join(consumer, 'index.js')));
});

test('finds source peers in nested node_modules', t => {
  const { src, dest } = fixture(t);
  const code = 'export { value } from "@deepseek-ai/peer";';
  pkg(path.join(pkg(dest, 'dsh'), 'node_modules'), 'consumer', code);
  const sourceNested = path.join(pkg(src, 'dsh'), 'node_modules');
  pkg(sourceNested, 'consumer', code);
  pkg(sourceNested, 'peer');
  repair(dest, src, []);
  assert.ok(fs.existsSync(path.join(dest, '@deepseek-ai/peer/package.json')));
});

test('fails packaging when an imported peer is unavailable in the source', t => {
  const { src, dest } = fixture(t);
  pkg(dest, 'consumer', 'import "@deepseek-ai/missing";');
  assert.throws(() => repair(dest, src, []), /Cannot restore @deepseek-ai\/missing/);
});

test('ignores browser-only exports and declaration-build artifacts', t => {
  const { src, dest } = fixture(t);
  const dir = pkg(dest, 'consumer');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: '@deepseek-ai/consumer', type: 'module',
    exports: { '.': './index.js', './client': { default: './client.js' } },
  }));
  fs.writeFileSync(path.join(dir, 'client.js'), 'import "@deepseek-ai/browser-only";');
  fs.mkdirSync(path.join(dir, 'lib/types'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib/types/client.js'), 'import "@deepseek-ai/browser-only";');
  const stats = [];
  repair(dest, src, stats);
  assert.deepEqual(stats, []);
});

test('read-only artifact verification rejects missing peers without using source ancestors', t => {
  const { src, dest } = fixture(t);
  pkg(dest, 'dsh', 'import "@deepseek-ai/peer";');
  pkg(src, 'peer');
  const { verifyDeepseekImports } = require('./afterpack.cjs');
  assert.throws(() => verifyDeepseekImports(dest), /Unresolved packaged imports/);
  assert.equal(fs.existsSync(path.join(dest, '@deepseek-ai/peer')), false);
  repair(dest, src, []);
  assert.doesNotThrow(() => verifyDeepseekImports(dest));
});

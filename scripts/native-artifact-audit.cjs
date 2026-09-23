const fs = require('node:fs');
const path = require('node:path');
const { verifyTargetRuntimePackages } = require('./native-runtime.cjs');

const ELF_MACHINE = { x64: 62, arm64: 183 };
const MACH_MAGICS = new Set(['cffaedfe', 'cefaedfe', 'feedfacf', 'feedface', 'cafebabe', 'bebafeca']);

function compareVersion(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function maximumVersion(buffer, prefix) {
  const values = [...buffer.toString('latin1').matchAll(new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([0-9]+\\.[0-9]+(?:\\.[0-9]+)?)`, 'g'))]
    .map(match => match[1]);
  values.sort(compareVersion);
  return values.at(-1) || null;
}

function binaryFormat(header) {
  if (header.length >= 20 && header.toString('hex', 0, 4) === '7f454c46') {
    return { format: 'elf', machine: header.readUInt16LE(18) };
  }
  if (header.length >= 4 && MACH_MAGICS.has(header.toString('hex', 0, 4))) return { format: 'mach-o' };
  if (header.length >= 2 && header.toString('ascii', 0, 2) === 'MZ') return { format: 'pe' };
  return null;
}

function collectNativeBinaries(root) {
  const binaries = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(filename);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = fs.statSync(filename);
      const nativeExtension = /\.(?:node|so(?:\..*)?|dylib|dll|exe)$/i.test(entry.name);
      if (!nativeExtension && !(stat.mode & 0o111)) continue;
      const descriptor = fs.openSync(filename, 'r');
      const header = Buffer.alloc(20);
      const read = fs.readSync(descriptor, header, 0, header.length, 0);
      fs.closeSync(descriptor);
      const detected = binaryFormat(header.subarray(0, read));
      if (!detected) continue;
      const item = { file: filename, ...detected };
      if (item.format === 'elf') {
        const buffer = fs.readFileSync(filename);
        item.glibc = maximumVersion(buffer, 'GLIBC_');
        item.glibcxx = maximumVersion(buffer, 'GLIBCXX_');
      }
      binaries.push(item);
    }
  }
  walk(root);
  return binaries;
}

function isStartupCritical(file) {
  return [
    `${path.sep}node-pty${path.sep}`,
    `${path.sep}@koromix${path.sep}koffi-`,
    `${path.sep}@deepseek-ai${path.sep}node-addon-system-linux-`,
    `${path.sep}node-addon-require-builtin-linux-`,
    `${path.sep}@vscode${path.sep}ripgrep-linux-`,
  ].some(fragment => file.includes(fragment));
}

function resolvePackageFrom(ownerDir, name, boundary) {
  let directory = ownerDir;
  while (directory === boundary || directory.startsWith(`${boundary}${path.sep}`)) {
    if (path.basename(directory) !== 'node_modules') {
      const candidate = path.join(directory, 'node_modules', name);
      if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    }
    directory = path.dirname(directory);
  }
  return null;
}

function targetOptionalPackages(nodeModules, platform, arch) {
  const found = [];
  const boundary = path.dirname(nodeModules);
  const matchesTarget = name => {
    const unscoped = name.includes('/') ? name.slice(name.indexOf('/') + 1) : name;
    const tokens = unscoped.split('-');
    return tokens.includes(platform)
      && tokens.includes(arch)
      && !(platform === 'linux' && unscoped.includes('linuxmusl'));
  };
  function scanModules(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('@')) {
        for (const child of fs.readdirSync(path.join(directory, entry.name), { withFileTypes: true })) {
          if (child.isDirectory()) scanPackage(path.join(directory, entry.name, child.name));
        }
      } else {
        scanPackage(path.join(directory, entry.name));
      }
    }
  }
  function scanPackage(packageDir) {
    const manifestFile = path.join(packageDir, 'package.json');
    if (!fs.existsSync(manifestFile)) return;
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    for (const [name, version] of Object.entries(manifest.optionalDependencies || {})) {
      if (!matchesTarget(name)) continue;
      found.push({ owner: manifest.name || packageDir, ownerDir: packageDir, name, version });
    }
    scanModules(path.join(packageDir, 'node_modules'));
  }
  scanModules(nodeModules);
  return found.map(spec => ({ ...spec, resolved: resolvePackageFrom(spec.ownerDir, spec.name, boundary) }));
}

function collectNodeModulesRoots(root) {
  const roots = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(directory, entry.name);
      if (entry.name === 'node_modules') {
        roots.push(child);
      } else {
        walk(child);
      }
    }
  }
  walk(root);
  return roots;
}

function auditNativeArtifact(appDir, arch, options = {}) {
  const expectedMachine = ELF_MACHINE[arch];
  if (!expectedMachine) throw new Error(`Unsupported Linux architecture: ${arch}`);
  const nodeModules = path.join(appDir, 'resources', 'app', 'node_modules');
  const startupGlibc = options.startupGlibc || '2.27';
  const specs = verifyTargetRuntimePackages(nodeModules, 'linux', arch);
  const resources = path.join(appDir, 'resources');
  const platformOptionals = collectNodeModulesRoots(resources)
    .flatMap(root => targetOptionalPackages(root, 'linux', arch));
  const binaries = collectNativeBinaries(resources);
  const failures = [];
  const warnings = [];

  for (const spec of platformOptionals) {
    if (!spec.resolved) {
      failures.push(`${spec.owner}: missing target optional package ${spec.name}@${spec.version}`);
      continue;
    }
    const resolvedManifest = JSON.parse(fs.readFileSync(path.join(spec.resolved, 'package.json'), 'utf8'));
    if (/^\d/.test(spec.version) && resolvedManifest.version !== spec.version) {
      failures.push(`${spec.owner}: expected ${spec.name}@${spec.version}, found ${resolvedManifest.version}`);
    }
  }

  for (const binary of binaries) {
    const relative = path.relative(appDir, binary.file);
    if (binary.format !== 'elf') {
      failures.push(`${relative}: ${binary.format} binary in Linux artifact`);
      continue;
    }
    if (binary.machine !== expectedMachine) {
      failures.push(`${relative}: ELF machine ${binary.machine}, expected ${expectedMachine}`);
    }
    if (binary.glibc && compareVersion(binary.glibc, startupGlibc) > 0) {
      if (isStartupCritical(binary.file)) {
        failures.push(`${relative}: requires GLIBC_${binary.glibc}, startup baseline is GLIBC_${startupGlibc}`);
      } else {
        warnings.push(`${relative}: requires GLIBC_${binary.glibc}; this lazy/optional feature is not Ubuntu 18.04 compatible`);
      }
    }
  }

  if (failures.length) throw new Error(`Native artifact audit failed:\n${failures.map(value => `- ${value}`).join('\n')}`);
  return { binaries, platformOptionals, specs, warnings };
}

module.exports = {
  auditNativeArtifact,
  binaryFormat,
  collectNativeBinaries,
  collectNodeModulesRoots,
  compareVersion,
  maximumVersion,
  targetOptionalPackages,
};

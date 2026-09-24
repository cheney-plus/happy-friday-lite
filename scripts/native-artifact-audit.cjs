const fs = require('node:fs');
const path = require('node:path');
const { verifyTargetRuntimePackages } = require('./native-runtime.cjs');

const ELF_MACHINE = { x64: 62, arm64: 183 };
const MACH_MAGICS = new Set(['cffaedfe', 'cefaedfe', 'feedfacf', 'feedface', 'cafebabe', 'bebafeca']);

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
      binaries.push({ file: filename, ...detected });
    }
  }
  walk(root);
  return binaries;
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

function auditNativeArtifact(appDir, arch) {
  const expectedMachine = ELF_MACHINE[arch];
  if (!expectedMachine) throw new Error(`Unsupported Linux architecture: ${arch}`);
  const nodeModules = path.join(appDir, 'resources', 'app', 'node_modules');
  const specs = verifyTargetRuntimePackages(nodeModules, 'linux', arch);
  const resources = path.join(appDir, 'resources');
  const platformOptionals = collectNodeModulesRoots(resources)
    .flatMap(root => targetOptionalPackages(root, 'linux', arch));
  const binaries = collectNativeBinaries(resources);
  const failures = [];

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
  }

  if (failures.length) throw new Error(`Native artifact audit failed:\n${failures.map(value => `- ${value}`).join('\n')}`);
  return { binaries, platformOptionals, specs, warnings: [] };
}

module.exports = {
  auditNativeArtifact,
  binaryFormat,
  collectNativeBinaries,
  collectNodeModulesRoots,
  targetOptionalPackages,
};

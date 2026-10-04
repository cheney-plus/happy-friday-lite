const fs = require('node:fs');
const path = require('node:path');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sharpNativeSpecs(nodeModules, platform, arch) {
  const sharp = readJson(path.join(nodeModules, 'sharp/package.json'));
  const runtime = `${platform}-${arch}`;
  const addonName = `@img/sharp-${runtime}`;
  const addonVersion = sharp.optionalDependencies?.[addonName];
  if (!addonVersion) {
    throw new Error(`sharp@${sharp.version} does not provide ${addonName}`);
  }

  const specs = [{
    name: addonName,
    version: addonVersion,
    kind: 'addon',
    marker: `lib/sharp-${runtime}-${addonVersion}.node`,
    platform,
    arch,
  }];

  const libvipsName = `@img/sharp-libvips-${runtime}`;
  const libvipsVersion = sharp.optionalDependencies?.[libvipsName];
  if (libvipsVersion) {
    specs.push({
      name: libvipsName,
      version: libvipsVersion,
      kind: 'libvips',
      platform,
      arch,
    });
  }
  return specs;
}

function exportedPath(manifest, key) {
  const value = manifest.exports?.[key];
  if (typeof value === 'string') return value;
  if (value && typeof value.default === 'string') return value.default;
  return null;
}

function sharpNativePackageFile(nodeModules, spec, packageDirName = spec.name) {
  const dir = path.join(nodeModules, packageDirName);
  const manifest = readJson(path.join(dir, 'package.json'));
  if (manifest.name !== spec.name || manifest.version !== spec.version) {
    throw new Error(`Expected ${spec.name}@${spec.version}, found ${manifest.name}@${manifest.version}`);
  }
  if (spec.kind === 'addon') return path.join(dir, spec.marker);
  const binary = exportedPath(manifest, './binary');
  if (!binary) throw new Error(`${spec.name} does not export its libvips binary`);
  return path.resolve(dir, binary);
}

function sharpNativePackageInstalled(nodeModules, spec, packageDirName = spec.name) {
  try {
    const binary = sharpNativePackageFile(nodeModules, spec, packageDirName);
    if (!fs.statSync(binary).isFile()) return false;
    if (spec.platform === 'linux') assertElfArchitecture(binary, spec.arch);
    return true;
  } catch {
    return false;
  }
}

function assertElfArchitecture(file, arch) {
  const machineByArch = { x64: 62, arm64: 183 };
  const expected = machineByArch[arch];
  if (!expected) throw new Error(`Unsupported Linux architecture for Sharp verification: ${arch}`);
  const header = fs.readFileSync(file).subarray(0, 20);
  const machine = header.length >= 20 && header.toString('hex', 0, 4) === '7f454c46'
    ? header.readUInt16LE(18)
    : null;
  if (machine !== expected) {
    throw new Error(`${file} is not a Linux ${arch} ELF binary`);
  }
}

function verifySharpNative(nodeModules, platform, arch) {
  const specs = sharpNativeSpecs(nodeModules, platform, arch);
  for (const spec of specs) {
    let binary;
    try {
      binary = sharpNativePackageFile(nodeModules, spec);
      if (!fs.statSync(binary).isFile()) throw new Error('not a file');
    } catch (error) {
      throw new Error(`Sharp requires ${spec.name}@${spec.version}; native package is missing or invalid (${error.message})`);
    }
    if (platform === 'linux') assertElfArchitecture(binary, arch);
  }

  const addonManifest = readJson(path.join(nodeModules, specs[0].name, 'package.json'));
  const libvips = specs.find(spec => spec.kind === 'libvips');
  if (libvips && addonManifest.optionalDependencies?.[libvips.name] !== libvips.version) {
    throw new Error(`${specs[0].name} does not declare matching ${libvips.name}@${libvips.version}`);
  }
  return specs;
}

function restoreSharpNative(sourceNodeModules, destinationNodeModules, platform, arch, stats = []) {
  const specs = verifySharpNative(sourceNodeModules, platform, arch);
  for (const spec of specs) {
    const source = path.join(sourceNodeModules, spec.name);
    const destination = path.join(destinationNodeModules, spec.name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.rmSync(destination, { recursive: true, force: true });
    fs.cpSync(source, destination, { recursive: true });
    stats.push(`+ ${spec.name} (restored Sharp runtime)`);
  }
  verifySharpNative(destinationNodeModules, platform, arch);
  return specs;
}

module.exports = {
  restoreSharpNative,
  sharpNativePackageInstalled,
  sharpNativeSpecs,
  verifySharpNative,
};

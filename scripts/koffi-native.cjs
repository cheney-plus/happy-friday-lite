const fs = require('node:fs');
const path = require('node:path');

function koffiNativeSpec(nodeModules, platform, arch) {
  const manifest = JSON.parse(fs.readFileSync(path.join(nodeModules, 'koffi/package.json'), 'utf8'));
  const name = `@koromix/koffi-${platform}-${arch}`;
  const version = manifest.optionalDependencies?.[name];
  if (!version || version !== manifest.version) {
    throw new Error(`Unsupported Koffi native dependency: ${name}@${version} for koffi@${manifest.version}`);
  }
  return { name, version, marker: `${platform}_${arch}/koffi.node` };
}

function nativePackageInstalled(nodeModules, { name, version, marker }) {
  try {
    const dir = path.join(nodeModules, name);
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version === version
      && fs.existsSync(path.join(dir, marker));
  } catch {
    return false;
  }
}

function verifyKoffiNative(nodeModules, platform, arch) {
  const spec = koffiNativeSpec(nodeModules, platform, arch);
  if (!nativePackageInstalled(nodeModules, spec)) {
    throw new Error(`Koffi requires ${spec.name}@${spec.version}; native package missing or mismatched. Run node scripts/prebuild-install.mjs ${platform} ${arch}`);
  }
  if (platform === 'linux') {
    const header = fs.readFileSync(path.join(nodeModules, spec.name, spec.marker)).subarray(0, 20);
    const machine = { x64: 62, arm64: 183 }[arch];
    if (!machine || header.length < 20 || header.toString('hex', 0, 4) !== '7f454c46' || header.readUInt16LE(18) !== machine) {
      throw new Error(`Koffi binary does not match linux-${arch}`);
    }
  }
  return spec;
}

module.exports = { koffiNativeSpec, nativePackageInstalled, verifyKoffiNative };

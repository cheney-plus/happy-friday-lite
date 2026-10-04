const fs = require('node:fs');
const path = require('node:path');

function readManifest(nodeModules, name) {
  const file = path.join(nodeModules, name, 'package.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function optionalSpec(nodeModules, owner, name, markers) {
  const manifest = readManifest(nodeModules, owner);
  const version = manifest?.optionalDependencies?.[name];
  if (!version) return null;
  return { owner, name, version, markers: Array.isArray(markers) ? markers : [markers] };
}

function requireBuiltinSuffix(platform, arch) {
  if (platform === 'linux') return `${platform}-${arch}-gnu`;
  if (platform === 'win32') return `${platform}-${arch}-msvc`;
  return `${platform}-${arch}`;
}

function targetRuntimeSpecs(nodeModules, platform, arch) {
  const specs = [];
  const add = spec => { if (spec) specs.push(spec); };

  add(optionalSpec(
    nodeModules,
    '@zvec/zvec',
    `@zvec/bindings-${platform}-${arch}`,
    'zvec_node_binding.node',
  ));
  add(optionalSpec(
    nodeModules,
    'koffi',
    `@koromix/koffi-${platform}-${arch}`,
    `${platform}_${arch}/koffi.node`,
  ));

  const systemName = `@deepseek-ai/node-addon-system-${platform}-${arch}`;
  const systemMarkers = platform === 'linux'
    ? ['bin/landlock-run', 'bin/glibc/system.node', 'bin/musl/system.node']
    : ['bin/system.node'];
  add(optionalSpec(nodeModules, '@deepseek-ai/node-addon-system', systemName, systemMarkers));

  const requireBuiltinPlatform = requireBuiltinSuffix(platform, arch);
  add(optionalSpec(
    nodeModules,
    'node-addon-require-builtin',
    `node-addon-require-builtin-${requireBuiltinPlatform}`,
    `prebuilt/${requireBuiltinPlatform}-napi-v9.node`,
  ));

  add(optionalSpec(
    nodeModules,
    '@vscode/ripgrep',
    `@vscode/ripgrep-${platform}-${arch}`,
    `bin/${platform === 'win32' ? 'rg.exe' : 'rg'}`,
  ));

  if (platform === 'linux') {
    const sharp = readManifest(nodeModules, 'sharp');
    if (sharp) {
      add({
        owner: 'sharp',
        name: '@img/sharp-wasm32',
        version: sharp.version,
        markers: ['index.cjs', `lib/sharp-wasm32-${sharp.version}.node.wasm`],
      });
    }
  }

  return specs;
}

function runtimePackageInstalled(nodeModules, spec, packageDirName = spec.name) {
  try {
    const dir = path.join(nodeModules, packageDirName);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return manifest.name === spec.name
      && manifest.version === spec.version
      && spec.markers.every(marker => fs.statSync(path.join(dir, marker)).isFile());
  } catch {
    return false;
  }
}

function verifyTargetRuntimePackages(nodeModules, platform, arch) {
  const specs = targetRuntimeSpecs(nodeModules, platform, arch);
  const missing = specs.filter(spec => !runtimePackageInstalled(nodeModules, spec));
  if (missing.length) {
    throw new Error(
      `Missing or invalid ${platform}-${arch} runtime packages:\n${missing.map(spec => `- ${spec.name}@${spec.version} (required by ${spec.owner})`).join('\n')}`,
    );
  }
  return specs;
}

function restoreTargetRuntimePackages(sourceNodeModules, destinationNodeModules, platform, arch, stats = []) {
  const specs = targetRuntimeSpecs(destinationNodeModules, platform, arch);
  for (const spec of specs) {
    if (!runtimePackageInstalled(sourceNodeModules, spec)) {
      throw new Error(`[native-runtime] Source is missing ${spec.name}@${spec.version}; run prebuild-install for ${platform}-${arch}`);
    }
    const source = path.join(sourceNodeModules, spec.name);
    const destination = path.join(destinationNodeModules, spec.name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.rmSync(destination, { recursive: true, force: true });
    fs.cpSync(source, destination, { recursive: true });
    stats.push(`+ ${spec.name} (restored target runtime)`);
  }
  verifyTargetRuntimePackages(destinationNodeModules, platform, arch);
  return specs;
}

module.exports = {
  readManifest,
  requireBuiltinSuffix,
  restoreTargetRuntimePackages,
  runtimePackageInstalled,
  targetRuntimeSpecs,
  verifyTargetRuntimePackages,
};

import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, copyFile, chmod, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const MACOS_LAUNCHER_SOURCE = path.join(ROOT_DIR, 'scripts', 'macos-app-launcher.swift');
const MACOS_ICON_SOURCE = path.join(ROOT_DIR, 'scripts', 'macos-app-icon.swift');
const PACKAGE_JSON = JSON.parse(await readFile(path.join(ROOT_DIR, 'package.json'), 'utf8'));
const APP_VERSION = PACKAGE_JSON.version;
const NODE_VERSION = process.versions.node;

const TARGETS = new Map([
  [
    'macos-arm64',
    {
      id: 'macos-arm64',
      platform: 'darwin',
      arch: 'arm64',
      nodeArtifact: 'darwin-arm64',
      archiveExt: 'tar.gz',
      outputName: `BookSaver-${APP_VERSION}-macos-arm64`,
      packageKind: 'macos-app'
    }
  ],
  [
    'macos-x64',
    {
      id: 'macos-x64',
      platform: 'darwin',
      arch: 'x64',
      nodeArtifact: 'darwin-x64',
      archiveExt: 'tar.gz',
      outputName: `BookSaver-${APP_VERSION}-macos-x64`,
      packageKind: 'macos-app'
    }
  ],
  [
    'windows-x64',
    {
      id: 'windows-x64',
      platform: 'win32',
      arch: 'x64',
      nodeArtifact: 'win-x64',
      archiveExt: 'zip',
      outputName: `BookSaver-${APP_VERSION}-windows-x64`,
      packageKind: 'windows-portable'
    }
  ]
]);

const APP_ENTRIES = [
  'public',
  'src',
  'scripts',
  'docs',
  'package.json',
  'README.md'
];

function parseArgs(argv) {
  const args = {
    target: process.platform === 'darwin' ? 'macos-arm64' : 'windows-x64'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part === '--target' && argv[index + 1]) {
      args.target = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

function nodeDownloadUrl(target) {
  const fileName = `node-v${NODE_VERSION}-${target.nodeArtifact}.${target.archiveExt}`;
  return {
    fileName,
    url: `https://nodejs.org/dist/v${NODE_VERSION}/${fileName}`
  };
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BookSaver packager'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url} (${response.status}).`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  await writeFile(destinationPath, body);
}

async function extractArchive(archivePath, destinationPath, archiveExt) {
  await mkdir(destinationPath, { recursive: true });

  if (archiveExt === 'tar.gz') {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', destinationPath], {
      maxBuffer: 1024 * 1024 * 20
    });
    return;
  }

  if (archiveExt === 'zip') {
    if (process.platform === 'win32') {
      await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`
        ],
        { maxBuffer: 1024 * 1024 * 20 }
      );
      return;
    }

    await execFileAsync('unzip', ['-q', archivePath, '-d', destinationPath], {
      maxBuffer: 1024 * 1024 * 20
    });
    return;
  }

  throw new Error(`Formato de archivo no soportado: ${archiveExt}`);
}

async function firstDirectory(folderPath) {
  const entries = await readdir(folderPath, { withFileTypes: true });
  const entry = entries.find((item) => item.isDirectory());

  if (!entry) {
    throw new Error(`No se pudo encontrar el runtime extraído en ${folderPath}.`);
  }

  return path.join(folderPath, entry.name);
}

async function copyAppFiles(destinationRoot) {
  await mkdir(destinationRoot, { recursive: true });

  for (const entry of APP_ENTRIES) {
    const sourcePath = path.join(ROOT_DIR, entry);
    const destinationPath = path.join(destinationRoot, entry);
    await rm(destinationPath, { recursive: true, force: true });
    await cp(sourcePath, destinationPath, {
      recursive: true,
      force: true
    });
  }
}

function windowsLauncherScript() {
  return `@echo off
cd /d "%~dp0"

if "%HOST%"=="" set HOST=127.0.0.1
if "%PORT%"=="" set PORT=5173

if not exist "%~dp0node.exe" (
  echo No se ha encontrado el runtime empaquetado de Node.js.
  pause
  exit /b 1
)

echo Abriendo BookSaver en http://%HOST%:%PORT% ...
start "" "http://%HOST%:%PORT%"
"%~dp0node.exe" src\\server.js
pause
`;
}

function infoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>es</string>
    <key>CFBundleDisplayName</key>
    <string>BookSaver</string>
    <key>CFBundleExecutable</key>
    <string>BookSaver</string>
    <key>CFBundleIdentifier</key>
    <string>com.booksaver.app</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>BookSaver</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${APP_VERSION}</string>
    <key>CFBundleVersion</key>
    <string>${APP_VERSION}</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
  </dict>
</plist>
`;
}

async function createZipArchive(sourcePath, archivePath) {
  await rm(archivePath, { force: true });

  if (process.platform === 'win32') {
    await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -LiteralPath '${sourcePath.replace(/'/g, "''")}' -DestinationPath '${archivePath.replace(/'/g, "''")}' -Force`
      ],
      { maxBuffer: 1024 * 1024 * 20 }
    );
    return;
  }

  await execFileAsync('zip', ['-qryX', archivePath, path.basename(sourcePath)], {
    cwd: path.dirname(sourcePath),
    maxBuffer: 1024 * 1024 * 20
  });
}

function targetSwiftTriple(target) {
  return target.arch === 'x64' ? 'x86_64-apple-macos13.0' : 'arm64-apple-macos13.0';
}

async function macosSdkPath() {
  const { stdout } = await execFileAsync('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], {
    maxBuffer: 1024 * 1024
  });
  return stdout.trim();
}

async function buildMacLauncherBinary(target, destinationPath) {
  const sdkPath = await macosSdkPath();
  await execFileAsync(
    'swiftc',
    [
      '-O',
      '-sdk',
      sdkPath,
      '-target',
      targetSwiftTriple(target),
      MACOS_LAUNCHER_SOURCE,
      '-o',
      destinationPath
    ],
    { maxBuffer: 1024 * 1024 * 20 }
  );
}

async function buildMacIcon(destinationPath, workingDir) {
  const png1024 = path.join(workingDir, 'AppIcon-1024.png');
  const iconsetDir = path.join(workingDir, 'AppIcon.iconset');

  await execFileAsync('swift', [MACOS_ICON_SOURCE, png1024], {
    maxBuffer: 1024 * 1024 * 20
  });

  await rm(iconsetDir, { recursive: true, force: true });
  await mkdir(iconsetDir, { recursive: true });

  const sizes = [16, 32, 128, 256, 512];
  for (const size of sizes) {
    await execFileAsync(
      'sips',
      ['-z', String(size), String(size), png1024, '--out', path.join(iconsetDir, `icon_${size}x${size}.png`)],
      { maxBuffer: 1024 * 1024 * 20 }
    );
    await execFileAsync(
      'sips',
      [
        '-z',
        String(size * 2),
        String(size * 2),
        png1024,
        '--out',
        path.join(iconsetDir, `icon_${size}x${size}@2x.png`)
      ],
      { maxBuffer: 1024 * 1024 * 20 }
    );
  }

  await execFileAsync('iconutil', ['-c', 'icns', iconsetDir, '-o', destinationPath], {
    maxBuffer: 1024 * 1024 * 20
  });
}

async function adHocSignMacApp(appBundlePath) {
  await execFileAsync('codesign', ['--force', '--deep', '--sign', '-', appBundlePath], {
    maxBuffer: 1024 * 1024 * 20
  });
}

async function prepareRuntime(target, workingDir) {
  const download = nodeDownloadUrl(target);
  const archivePath = path.join(workingDir, download.fileName);
  const extractPath = path.join(workingDir, 'runtime');

  console.log(`Descargando runtime Node.js ${NODE_VERSION} para ${target.id}...`);
  await downloadFile(download.url, archivePath);
  await extractArchive(archivePath, extractPath, target.archiveExt);
  const runtimeRoot = await firstDirectory(extractPath);

  if (target.platform === 'darwin') {
    return path.join(runtimeRoot, 'bin', 'node');
  }

  return path.join(runtimeRoot, 'node.exe');
}

async function buildMacApp(target, runtimeBinaryPath, workingDir) {
  const outputRoot = path.join(DIST_DIR, target.outputName);
  const appBundle = path.join(outputRoot, 'BookSaver.app');
  const contentsDir = path.join(appBundle, 'Contents');
  const macosDir = path.join(contentsDir, 'MacOS');
  const resourcesDir = path.join(contentsDir, 'Resources');
  const appRoot = path.join(resourcesDir, 'app');
  const iconPath = path.join(resourcesDir, 'AppIcon.icns');
  const archivePath = path.join(DIST_DIR, `${target.outputName}.zip`);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(macosDir, { recursive: true });
  await mkdir(appRoot, { recursive: true });
  await copyAppFiles(appRoot);
  await copyFile(runtimeBinaryPath, path.join(macosDir, 'node'));
  await buildMacLauncherBinary(target, path.join(macosDir, 'BookSaver'));
  await buildMacIcon(iconPath, workingDir);
  await writeFile(path.join(contentsDir, 'Info.plist'), infoPlist(), 'utf8');
  await chmod(path.join(macosDir, 'node'), 0o755);
  await chmod(path.join(macosDir, 'BookSaver'), 0o755);
  await adHocSignMacApp(appBundle);
  await createZipArchive(appBundle, archivePath);

  return {
    outputRoot,
    primaryArtifact: appBundle,
    archivePath
  };
}

async function buildWindowsPortable(target, runtimeBinaryPath) {
  const outputRoot = path.join(DIST_DIR, target.outputName);
  const portableRoot = path.join(outputRoot, 'BookSaver');
  const archivePath = path.join(DIST_DIR, `${target.outputName}.zip`);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(portableRoot, { recursive: true });
  await copyAppFiles(portableRoot);
  await copyFile(runtimeBinaryPath, path.join(portableRoot, 'node.exe'));
  await writeFile(path.join(portableRoot, 'start-booksaver.bat'), windowsLauncherScript(), 'utf8');
  await createZipArchive(portableRoot, archivePath);

  return {
    outputRoot,
    primaryArtifact: portableRoot,
    archivePath
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = TARGETS.get(args.target);

  if (!target) {
    throw new Error(`Target no soportado: ${args.target}`);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'booksaver-package-'));

  try {
    await mkdir(DIST_DIR, { recursive: true });
    const runtimeBinaryPath = await prepareRuntime(target, tempDir);
    const result =
      target.packageKind === 'macos-app'
        ? await buildMacApp(target, runtimeBinaryPath, tempDir)
        : await buildWindowsPortable(target, runtimeBinaryPath);

    console.log(`Paquete listo: ${result.primaryArtifact}`);
    console.log(`Archivo listo: ${result.archivePath}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

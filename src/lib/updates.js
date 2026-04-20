function normalizeNumericParts(version) {
  return normalizeVersionTag(version)
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

function targetAssetSuffix(platform, arch) {
  if (platform === 'darwin') {
    return arch === 'x64' ? '-macos-x64.zip' : '-macos-arm64.zip';
  }

  if (platform === 'win32') {
    return '-windows-x64.zip';
  }

  return null;
}

export function normalizeVersionTag(tag) {
  return String(tag || '').trim().replace(/^v/i, '');
}

export function compareVersions(left, right) {
  const leftParts = normalizeNumericParts(left);
  const rightParts = normalizeNumericParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

export function findReleaseAssetForPlatform(release, { platform, arch } = {}) {
  const suffix = targetAssetSuffix(platform, arch);

  if (!suffix || !Array.isArray(release?.assets)) {
    return null;
  }

  return (
    release.assets.find(
      (asset) =>
        asset?.browserDownloadUrl &&
        typeof asset.name === 'string' &&
        asset.name.toLowerCase().endsWith(suffix)
    ) || null
  );
}

export function buildUpdateInfo(currentVersion, release = null, error = null) {
  const normalizedCurrentVersion = normalizeVersionTag(currentVersion);

  if (error) {
    return {
      currentVersion: normalizedCurrentVersion,
      checkedAt: new Date().toISOString(),
      available: false,
      latestVersion: null,
      releaseUrl: null,
      zipballUrl: null,
      assets: [],
      error: error.message || String(error)
    };
  }

  if (!release?.version) {
    return {
      currentVersion: normalizedCurrentVersion,
      checkedAt: new Date().toISOString(),
      available: false,
      latestVersion: null,
      releaseUrl: null,
      zipballUrl: null,
      assets: [],
      error: null
    };
  }

  return {
    currentVersion: normalizedCurrentVersion,
    checkedAt: release.checkedAt || new Date().toISOString(),
    available: compareVersions(release.version, normalizedCurrentVersion) === 1,
    latestVersion: release.version,
    releaseName: release.name || release.tagName || release.version,
    releaseUrl: release.htmlUrl || null,
    zipballUrl: release.zipballUrl || null,
    assets: Array.isArray(release.assets) ? release.assets : [],
    publishedAt: release.publishedAt || null,
    error: null
  };
}

export async function fetchLatestRelease({
  owner,
  repo,
  fetchImpl = fetch,
  timeoutMs = 4000
} = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'BookSaver'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`GitHub devolvio ${response.status}.`);
    }

    const payload = await response.json();
    return {
      tagName: payload.tag_name,
      version: normalizeVersionTag(payload.tag_name),
      name: payload.name,
      htmlUrl: payload.html_url,
      zipballUrl: payload.zipball_url,
      assets: Array.isArray(payload.assets)
        ? payload.assets.map((asset) => ({
            name: asset.name,
            browserDownloadUrl: asset.browser_download_url,
            contentType: asset.content_type,
            size: asset.size
          }))
        : [],
      publishedAt: payload.published_at,
      checkedAt: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

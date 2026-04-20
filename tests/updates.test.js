import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildUpdateInfo,
  compareVersions,
  findReleaseAssetForPlatform,
  fetchLatestRelease,
  normalizeVersionTag
} from '../src/lib/updates.js';

test('normalizeVersionTag strips the v prefix and whitespace', () => {
  assert.equal(normalizeVersionTag(' v1.2.3 '), '1.2.3');
  assert.equal(normalizeVersionTag('1.0.0'), '1.0.0');
});

test('compareVersions compares dotted numeric versions', () => {
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.2.0', '1.1.9'), 1);
  assert.equal(compareVersions('1.0.9', '1.1.0'), -1);
  assert.equal(compareVersions('1.2', '1.2.0'), 0);
});

test('buildUpdateInfo marks newer releases as available', () => {
  const update = buildUpdateInfo('1.0.0', {
    version: '1.1.0',
    name: 'BookSaver 1.1.0',
    htmlUrl: 'https://example.com/release',
    zipballUrl: 'https://example.com/release.zip',
    assets: [
      {
        name: 'BookSaver-1.1.0-macos-arm64.zip',
        browserDownloadUrl: 'https://example.com/BookSaver-1.1.0-macos-arm64.zip'
      }
    ],
    publishedAt: '2026-04-20T10:00:00.000Z',
    checkedAt: '2026-04-20T10:01:00.000Z'
  });

  assert.equal(update.currentVersion, '1.0.0');
  assert.equal(update.available, true);
  assert.equal(update.latestVersion, '1.1.0');
  assert.equal(update.releaseName, 'BookSaver 1.1.0');
  assert.equal(update.releaseUrl, 'https://example.com/release');
  assert.equal(update.zipballUrl, 'https://example.com/release.zip');
  assert.equal(update.assets.length, 1);
});

test('findReleaseAssetForPlatform matches packaged assets by platform and arch', () => {
  const release = {
    assets: [
      {
        name: 'BookSaver-1.1.0-macos-arm64.zip',
        browserDownloadUrl: 'https://example.com/macos-arm64.zip'
      },
      {
        name: 'BookSaver-1.1.0-windows-x64.zip',
        browserDownloadUrl: 'https://example.com/windows-x64.zip'
      }
    ]
  };

  const macAsset = findReleaseAssetForPlatform(release, {
    platform: 'darwin',
    arch: 'arm64'
  });
  const windowsAsset = findReleaseAssetForPlatform(release, {
    platform: 'win32',
    arch: 'x64'
  });

  assert.equal(macAsset?.browserDownloadUrl, 'https://example.com/macos-arm64.zip');
  assert.equal(windowsAsset?.browserDownloadUrl, 'https://example.com/windows-x64.zip');
});

test('buildUpdateInfo preserves failures without pretending an update exists', () => {
  const update = buildUpdateInfo('1.0.0', null, new Error('fetch failed'));

  assert.equal(update.currentVersion, '1.0.0');
  assert.equal(update.available, false);
  assert.equal(update.latestVersion, null);
  assert.match(update.error || '', /fetch failed/);
});

test('fetchLatestRelease reads and normalizes the latest GitHub release payload', async () => {
  const calls = [];
  const release = await fetchLatestRelease({
    owner: 'juange87',
    repo: 'BookSaver',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return {
            tag_name: 'v1.2.0',
            name: 'BookSaver 1.2.0',
            html_url: 'https://example.com/v1.2.0',
            zipball_url: 'https://example.com/v1.2.0.zip',
            assets: [
              {
                name: 'BookSaver-1.2.0-windows-x64.zip',
                browser_download_url: 'https://example.com/BookSaver-1.2.0-windows-x64.zip',
                content_type: 'application/zip',
                size: 35000000
              }
            ],
            published_at: '2026-04-20T11:00:00.000Z'
          };
        }
      };
    }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/juange87/BookSaver/releases/latest');
  assert.equal(calls[0].options.headers['User-Agent'], 'BookSaver');
  assert.equal(release.version, '1.2.0');
  assert.equal(release.tagName, 'v1.2.0');
  assert.equal(release.name, 'BookSaver 1.2.0');
  assert.equal(release.htmlUrl, 'https://example.com/v1.2.0');
  assert.equal(release.zipballUrl, 'https://example.com/v1.2.0.zip');
  assert.equal(release.assets.length, 1);
  assert.equal(release.assets[0].browserDownloadUrl, 'https://example.com/BookSaver-1.2.0-windows-x64.zip');
});

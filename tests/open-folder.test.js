import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fileOpenCommand, folderOpenCommand } from '../src/lib/open-folder.js';

test('folderOpenCommand maps common desktop platforms', () => {
  assert.deepEqual(folderOpenCommand('darwin', '/tmp/libro'), {
    command: 'open',
    args: ['/tmp/libro']
  });
  assert.deepEqual(folderOpenCommand('win32', 'C:\\libro'), {
    command: 'explorer.exe',
    args: ['C:\\libro']
  });
  assert.deepEqual(folderOpenCommand('linux', '/tmp/libro'), {
    command: 'xdg-open',
    args: ['/tmp/libro']
  });
});

test('folderOpenCommand reports unsupported platforms clearly', () => {
  assert.equal(folderOpenCommand('plan9', '/tmp/libro'), null);
});

test('fileOpenCommand maps common desktop platforms to local file handlers', () => {
  assert.deepEqual(fileOpenCommand('darwin', '/tmp/libro.epub'), {
    command: 'open',
    args: ['/tmp/libro.epub']
  });
  assert.deepEqual(fileOpenCommand('win32', 'C:\\libro.epub'), {
    command: 'explorer.exe',
    args: ['C:\\libro.epub']
  });
  assert.deepEqual(fileOpenCommand('linux', '/tmp/libro.epub'), {
    command: 'xdg-open',
    args: ['/tmp/libro.epub']
  });
});

test('fileOpenCommand reports unsupported platforms clearly', () => {
  assert.equal(fileOpenCommand('plan9', '/tmp/libro.epub'), null);
});

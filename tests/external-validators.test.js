import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  epubcheckCommand,
  parseEpubcheckResult
} from '../src/lib/external-validators.js';

test('epubcheckCommand validates EPUB files with the local epubcheck binary', () => {
  assert.deepEqual(epubcheckCommand('/tmp/libro.epub'), {
    command: 'epubcheck',
    args: ['/tmp/libro.epub']
  });
});

test('parseEpubcheckResult summarizes successful validation output', () => {
  const result = parseEpubcheckResult({
    exitCode: 0,
    stdout: 'Validating using EPUB version 3.3 rules.\nNo errors or warnings detected.',
    stderr: ''
  });

  assert.equal(result.valid, true);
  assert.equal(result.errorCount, 0);
  assert.equal(result.warningCount, 0);
  assert.equal(result.messages.length, 0);
});

test('parseEpubcheckResult keeps EPUBCheck errors and warnings readable', () => {
  const result = parseEpubcheckResult({
    exitCode: 1,
    stdout: 'ERROR(OPF-001): libro.epub/OEBPS/content.opf(12,3): Archivo no encontrado.',
    stderr: 'WARNING(RSC-005): libro.epub/OEBPS/nav.xhtml(4,9): Referencia dudosa.'
  });

  assert.equal(result.valid, false);
  assert.equal(result.errorCount, 1);
  assert.equal(result.warningCount, 1);
  assert.deepEqual(result.messages.map((message) => message.severity), ['error', 'warning']);
});

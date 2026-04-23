import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MobileCaptureSessionManager } from '../src/lib/mobile-capture.js';

const FIXED_NOW = new Date('2026-04-23T10:30:00.000Z');

test('MobileCaptureSessionManager starts a token-protected LAN session', () => {
  const manager = new MobileCaptureSessionManager({
    addressFactory: () => '192.168.1.42',
    now: () => FIXED_NOW,
    port: 5199,
    tokenFactory: () => 'test-token'
  });

  const started = manager.start('libro-demo');
  const status = manager.status('libro-demo');

  assert.equal(started.active, true);
  assert.equal(started.projectId, 'libro-demo');
  assert.equal(started.url, 'http://192.168.1.42:5199/mobile/test-token');
  assert.equal(started.localUrl, 'http://127.0.0.1:5199/mobile/test-token');
  assert.equal(started.uploadedCount, 0);
  assert.equal(started.lastPageId, null);
  assert.equal(started.startedAt, FIXED_NOW.toISOString());
  assert.deepEqual(status, started);
  assert.equal(manager.requireActiveToken('test-token').projectId, 'libro-demo');
});

test('MobileCaptureSessionManager replaces the active session when another project starts capture', () => {
  const manager = new MobileCaptureSessionManager({
    addressFactory: () => '192.168.1.42',
    port: 5199,
    tokenFactory: () => 'shared-token'
  });

  manager.start('primer-libro');
  const next = manager.start('segundo-libro');

  assert.equal(manager.status('primer-libro').active, false);
  assert.equal(next.active, true);
  assert.equal(next.projectId, 'segundo-libro');
  assert.equal(manager.requireActiveToken('shared-token').projectId, 'segundo-libro');
});

test('MobileCaptureSessionManager records mobile uploads in the active session', () => {
  const timestamps = [
    new Date('2026-04-23T10:30:00.000Z'),
    new Date('2026-04-23T10:31:00.000Z'),
    new Date('2026-04-23T10:32:00.000Z')
  ];
  const manager = new MobileCaptureSessionManager({
    addressFactory: () => '192.168.1.42',
    now: () => timestamps.shift(),
    port: 5199,
    tokenFactory: () => 'test-token'
  });

  manager.start('libro-demo');
  manager.recordUpload({ id: 'page-0001' });
  const status = manager.recordUpload({ id: 'page-0002' });

  assert.equal(status.uploadedCount, 2);
  assert.equal(status.lastPageId, 'page-0002');
  assert.equal(status.lastUploadAt, '2026-04-23T10:32:00.000Z');
});

test('MobileCaptureSessionManager rejects inactive or unknown tokens', () => {
  const manager = new MobileCaptureSessionManager({
    addressFactory: () => '127.0.0.1',
    tokenFactory: () => 'valid-token'
  });

  manager.start('libro-demo');
  assert.throws(
    () => manager.requireActiveToken('bad-token'),
    (error) => error.statusCode === 403 && /sesion movil no valida/i.test(error.message)
  );

  manager.stop('libro-demo');
  assert.throws(
    () => manager.requireActiveToken('valid-token'),
    (error) => error.statusCode === 403 && /sesion movil no valida/i.test(error.message)
  );
});

import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';

const DEFAULT_MOBILE_HOST = '0.0.0.0';
const DEFAULT_MOBILE_PORT = 5174;

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function timestamp(now) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function safePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_MOBILE_PORT;
}

export function findLanAddress(interfaces = networkInterfaces()) {
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal && entry.address) {
        return entry.address;
      }
    }
  }

  return '127.0.0.1';
}

export class MobileCaptureSessionManager {
  constructor(options = {}) {
    this.addressFactory = options.addressFactory || (() => findLanAddress());
    this.host = options.host || DEFAULT_MOBILE_HOST;
    this.now = options.now || (() => new Date());
    this.port = safePort(options.port || process.env.MOBILE_CAPTURE_PORT);
    this.tokenFactory = options.tokenFactory || (() => randomBytes(24).toString('hex'));
    this.session = null;
  }

  start(projectId) {
    const createdAt = timestamp(this.now);
    this.session = {
      projectId: String(projectId),
      token: this.tokenFactory(),
      address: this.addressFactory(),
      startedAt: createdAt,
      updatedAt: createdAt,
      uploadedCount: 0,
      lastPageId: null,
      lastUploadAt: null
    };

    return this.clientStatus(this.session);
  }

  stop(projectId) {
    if (this.session?.projectId === String(projectId)) {
      this.session = null;
    }

    return this.emptyStatus(projectId);
  }

  status(projectId) {
    if (!this.session || this.session.projectId !== String(projectId)) {
      return this.emptyStatus(projectId);
    }

    return this.clientStatus(this.session);
  }

  requireActiveToken(token) {
    if (!this.session || this.session.token !== String(token || '')) {
      throw httpError('Sesion movil no valida o caducada.', 403);
    }

    return this.session;
  }

  recordUpload(page) {
    if (!this.session) {
      throw httpError('No hay una sesion movil activa.', 400);
    }

    const uploadedAt = timestamp(this.now);
    this.session.uploadedCount += 1;
    this.session.lastPageId = page?.id || null;
    this.session.lastUploadAt = uploadedAt;
    this.session.updatedAt = uploadedAt;
    return this.clientStatus(this.session);
  }

  emptyStatus(projectId) {
    return {
      active: false,
      projectId: String(projectId || ''),
      host: this.host,
      port: this.port,
      url: null,
      localUrl: null,
      startedAt: null,
      updatedAt: null,
      uploadedCount: 0,
      lastPageId: null,
      lastUploadAt: null
    };
  }

  clientStatus(session) {
    const tokenPath = encodeURIComponent(session.token);
    return {
      active: true,
      projectId: session.projectId,
      host: this.host,
      port: this.port,
      url: `http://${session.address}:${this.port}/mobile/${tokenPath}`,
      localUrl: `http://127.0.0.1:${this.port}/mobile/${tokenPath}`,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      uploadedCount: session.uploadedCount,
      lastPageId: session.lastPageId,
      lastUploadAt: session.lastUploadAt
    };
  }
}

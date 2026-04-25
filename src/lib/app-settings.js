import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SETTINGS_FILE = 'settings.json';
const DEFAULT_AI_OCR_MODEL = 'gpt-5.4-mini';

function now() {
  return new Date().toISOString();
}

function settingsPath(dataRootDir) {
  return path.join(dataRootDir, SETTINGS_FILE);
}

async function readSettingsFile(dataRootDir) {
  try {
    return JSON.parse(await readFile(settingsPath(dataRootDir), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function writeSettingsFile(dataRootDir, settings) {
  await mkdir(dataRootDir, { recursive: true });
  const filePath = settingsPath(dataRootDir);
  await writeFile(filePath, `${JSON.stringify(settings, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  await chmod(filePath, 0o600);
}

function normalizeModel(model) {
  const value = String(model || '').trim();
  return value || DEFAULT_AI_OCR_MODEL;
}

function normalizeApiKey(apiKey) {
  const value = typeof apiKey === 'string' ? apiKey.trim() : '';
  return value || null;
}

function maskApiKey(apiKey) {
  const value = String(apiKey || '').trim();
  if (!value) {
    return null;
  }
  if (value.length <= 8) {
    return `${value.slice(0, 2)}...`;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function publicAiOcrSettings({ apiKey, model, source }) {
  return {
    configured: Boolean(apiKey),
    source: apiKey ? source : null,
    model: normalizeModel(model),
    maskedApiKey: maskApiKey(apiKey),
    canEditKey: source !== 'env'
  };
}

export async function loadAiOcrSettings(dataRootDir, { env = process.env } = {}) {
  const settings = await readSettingsFile(dataRootDir);
  const local = settings.aiOcr || {};
  const envApiKey = normalizeApiKey(env.OPENAI_API_KEY);

  if (envApiKey) {
    return publicAiOcrSettings({
      apiKey: envApiKey,
      model: env.BOOKSAVER_AI_OCR_MODEL || local.model,
      source: 'env'
    });
  }

  return publicAiOcrSettings({
    apiKey: normalizeApiKey(local.apiKey),
    model: local.model,
    source: 'local'
  });
}

export async function readAiOcrApiKey(dataRootDir, { env = process.env } = {}) {
  const envApiKey = normalizeApiKey(env.OPENAI_API_KEY);
  if (envApiKey) {
    return envApiKey;
  }

  const settings = await readSettingsFile(dataRootDir);
  return normalizeApiKey(settings.aiOcr?.apiKey);
}

export async function saveAiOcrSettings(dataRootDir, input = {}, { env = process.env } = {}) {
  if (normalizeApiKey(env.OPENAI_API_KEY)) {
    throw Object.assign(
      new Error('La clave de OpenAI viene del entorno del servidor y no se puede cambiar desde la interfaz.'),
      { statusCode: 400 }
    );
  }

  const settings = await readSettingsFile(dataRootDir);
  const previous = settings.aiOcr || {};
  const apiKey = normalizeApiKey(input.apiKey) || normalizeApiKey(previous.apiKey);
  const model = normalizeModel(input.model || previous.model);

  settings.aiOcr = {
    apiKey,
    model,
    updatedAt: now()
  };
  await writeSettingsFile(dataRootDir, settings);

  return loadAiOcrSettings(dataRootDir, { env });
}

export async function clearAiOcrSettings(dataRootDir, { env = process.env } = {}) {
  const settings = await readSettingsFile(dataRootDir);
  if (settings.aiOcr) {
    delete settings.aiOcr;
    if (Object.keys(settings).length) {
      await writeSettingsFile(dataRootDir, settings);
    } else {
      await rm(settingsPath(dataRootDir), { force: true });
    }
  }

  return loadAiOcrSettings(dataRootDir, { env });
}

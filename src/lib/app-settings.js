import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DEFAULT_ADVANCED_OCR_PROVIDER,
  normalizeAdvancedOcrAdapter,
  publicAdvancedOcrSettings
} from './advanced-ocr.js';

const SETTINGS_FILE = 'settings.json';

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
  return String(model || '').trim();
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

function envProvider(env = process.env) {
  if (normalizeApiKey(env.OPENAI_API_KEY)) {
    return 'openai';
  }

  if (normalizeApiKey(env.BOOKSAVER_COMPATIBLE_OCR_API_KEY)) {
    return 'openai-compatible';
  }

  return null;
}

function envModel(env, provider) {
  if (provider === 'openai-compatible') {
    return env.BOOKSAVER_COMPATIBLE_OCR_MODEL;
  }
  return env.BOOKSAVER_AI_OCR_MODEL;
}

function envBaseUrl(env, provider) {
  if (provider === 'openai-compatible') {
    return env.BOOKSAVER_COMPATIBLE_OCR_BASE_URL;
  }
  return env.BOOKSAVER_AI_OCR_BASE_URL;
}

function publicAiOcrSettings({ apiKey, provider, model, baseUrl, source }) {
  const advanced = publicAdvancedOcrSettings({ provider, model, baseUrl });
  return {
    configured: Boolean(apiKey),
    source: apiKey ? source : null,
    provider: advanced.provider,
    providerLabel: advanced.label,
    model: advanced.model,
    baseUrl: advanced.baseUrl,
    maskedApiKey: maskApiKey(apiKey),
    canEditKey: source !== 'env',
    adapters: advanced.adapters
  };
}

export async function loadAiOcrSettings(dataRootDir, { env = process.env } = {}) {
  const settings = await readSettingsFile(dataRootDir);
  const local = settings.aiOcr || {};
  const providerFromEnv = envProvider(env);

  if (providerFromEnv) {
    return publicAiOcrSettings({
      apiKey:
        providerFromEnv === 'openai-compatible'
          ? normalizeApiKey(env.BOOKSAVER_COMPATIBLE_OCR_API_KEY)
          : normalizeApiKey(env.OPENAI_API_KEY),
      provider: providerFromEnv,
      model: envModel(env, providerFromEnv) || local.model,
      baseUrl: envBaseUrl(env, providerFromEnv) || local.baseUrl,
      source: 'env'
    });
  }

  const localProvider = local.provider || DEFAULT_ADVANCED_OCR_PROVIDER;
  return publicAiOcrSettings({
    apiKey: normalizeApiKey(local.apiKey),
    provider: localProvider,
    model: local.model,
    baseUrl: local.baseUrl,
    source: 'local'
  });
}

export async function readAiOcrApiKey(dataRootDir, { env = process.env, provider = null } = {}) {
  const resolvedProvider = provider || envProvider(env);
  if (resolvedProvider === 'openai-compatible') {
    const envApiKey = normalizeApiKey(env.BOOKSAVER_COMPATIBLE_OCR_API_KEY);
    if (envApiKey) {
      return envApiKey;
    }
  } else {
    const envApiKey = normalizeApiKey(env.OPENAI_API_KEY);
    if (envApiKey) {
      return envApiKey;
    }
  }

  const settings = await readSettingsFile(dataRootDir);
  return normalizeApiKey(settings.aiOcr?.apiKey);
}

export async function saveAiOcrSettings(dataRootDir, input = {}, { env = process.env } = {}) {
  const provider = normalizeAdvancedOcrAdapter(input).provider;
  const providerFromEnv = envProvider(env);
  if (providerFromEnv === provider) {
    throw Object.assign(
      new Error('La clave de OCR avanzado viene del entorno del servidor y no se puede cambiar desde la interfaz.'),
      { statusCode: 400 }
    );
  }

  const settings = await readSettingsFile(dataRootDir);
  const previous = settings.aiOcr || {};
  const apiKey = normalizeApiKey(input.apiKey) || normalizeApiKey(previous.apiKey);
  const adapter = normalizeAdvancedOcrAdapter({
    provider,
    model: normalizeModel(input.model || previous.model),
    baseUrl: input.baseUrl || previous.baseUrl
  });

  settings.aiOcr = {
    provider: adapter.provider,
    apiKey,
    model: adapter.model,
    baseUrl: adapter.baseUrl,
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

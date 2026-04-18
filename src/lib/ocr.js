import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { buildLayoutFromTsv, buildLayoutFromVision, layoutToText } from './layout.js';

const execFileAsync = promisify(execFile);
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VISION_HELPER = path.join(ROOT_DIR, 'scripts', 'vision-ocr.swift');

let languageCache;

const LANGUAGE_MAP = new Map([
  ['es', 'spa'],
  ['es-es', 'spa'],
  ['spa', 'spa'],
  ['spanish', 'spa'],
  ['en', 'eng'],
  ['en-us', 'eng'],
  ['en-gb', 'eng'],
  ['eng', 'eng'],
  ['english', 'eng']
]);

export async function listTesseractLanguages({ refresh = false } = {}) {
  if (languageCache && !refresh) {
    return languageCache;
  }

  try {
    const { stdout } = await execFileAsync('tesseract', ['--list-langs'], {
      maxBuffer: 1024 * 1024
    });
    languageCache = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('List of available languages'));
    return languageCache;
  } catch (error) {
    languageCache = [];
    return languageCache;
  }
}

export async function resolveOcrLanguage(language = 'eng') {
  const normalized = String(language || 'eng').toLowerCase();
  const preferred = LANGUAGE_MAP.get(normalized) || normalized;
  let installed = await listTesseractLanguages();

  if (!installed.includes(preferred)) {
    installed = await listTesseractLanguages({ refresh: true });
  }

  if (installed.includes(preferred)) {
    return { language: preferred, warning: null, installed };
  }

  if (installed.includes('eng')) {
    return {
      language: 'eng',
      warning: `El idioma OCR "${preferred}" no esta instalado. Se uso "eng".`,
      installed
    };
  }

  return {
    language: null,
    warning: 'Tesseract no tiene idiomas instalados disponibles.',
    installed
  };
}

function cleanTesseractWarning(stderr, fallbackWarning) {
  const lines = String(stderr || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Estimating resolution as \d+/i.test(line))
    .filter((line) => !/^Warning\. Invalid resolution/i.test(line));

  return fallbackWarning || lines.join('\n') || null;
}

function normalizeVisionLanguage(language) {
  const normalized = String(language || 'es').toLowerCase();
  if (['es', 'es-es', 'spa', 'spanish'].includes(normalized)) {
    return 'es';
  }
  if (['en', 'en-us', 'en-gb', 'eng', 'english'].includes(normalized)) {
    return 'en';
  }
  return language || 'es';
}

async function runAppleVisionOcr(imagePath, language) {
  if (process.platform !== 'darwin') {
    throw new Error('Apple Vision solo esta disponible en macOS.');
  }

  const { stdout } = await execFileAsync(
    'swift',
    [VISION_HELPER, imagePath, normalizeVisionLanguage(language)],
    {
      cwd: ROOT_DIR,
      maxBuffer: 1024 * 1024 * 20
    }
  );
  const visionResult = JSON.parse(stdout);
  const layout = buildLayoutFromVision(visionResult);
  const text = layoutToText(layout);

  if (!text) {
    throw new Error('Apple Vision no devolvio texto util.');
  }

  return {
    text,
    tsv: '',
    layout,
    language: visionResult.language || language || 'es',
    engine: 'apple-vision',
    warning: null,
    status: 'ocr-complete'
  };
}

async function runPlainTextOcr(imagePath, language) {
  const { stdout, stderr } = await execFileAsync(
    'tesseract',
    [imagePath, 'stdout', '-l', language, '--oem', '1', '--psm', '4', '--dpi', '300'],
    {
      maxBuffer: 1024 * 1024 * 20
    }
  );

  return {
    text: stdout.trim(),
    warning: cleanTesseractWarning(stderr)
  };
}

async function runTesseractOcr(imagePath, language, fallbackWarning = null) {
  const resolved = await resolveOcrLanguage(language);

  if (!resolved.language) {
    return {
      text: '',
      language: null,
      warning: resolved.warning || fallbackWarning,
      engine: 'tesseract',
      status: 'ocr-error'
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      'tesseract',
      [imagePath, 'stdout', '-l', resolved.language, '--oem', '1', '--psm', '4', '--dpi', '300', 'tsv'],
      {
        maxBuffer: 1024 * 1024 * 20
      }
    );
    const layout = buildLayoutFromTsv(stdout);
    let text = layoutToText(layout);

    if (!text) {
      const fallback = await runPlainTextOcr(imagePath, resolved.language);
      text = fallback.text;
    }

    return {
      text,
      tsv: stdout,
      layout,
      language: resolved.language,
      engine: 'tesseract',
      warning: cleanTesseractWarning(stderr, resolved.warning || fallbackWarning),
      status: 'ocr-complete'
    };
  } catch (error) {
    return {
      text: '',
      tsv: '',
      layout: null,
      language: resolved.language,
      engine: 'tesseract',
      warning: cleanTesseractWarning(error.stderr, resolved.warning || fallbackWarning) || error.message,
      status: 'ocr-error'
    };
  }
}

export async function runOcr(imagePath, language, options = {}) {
  const preferEngine = options.engine || process.env.BOOKSAVER_OCR_ENGINE || 'apple-vision';

  if (preferEngine !== 'tesseract') {
    try {
      return await runAppleVisionOcr(imagePath, language);
    } catch (error) {
      const warning = `Apple Vision no se pudo usar. Se uso Tesseract. Motivo: ${error.message}`;
      return runTesseractOcr(imagePath, language, warning);
    }
  }

  return runTesseractOcr(imagePath, language);
}

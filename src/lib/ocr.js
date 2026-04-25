import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { buildLayoutFromTsv, buildLayoutFromVision, layoutToText } from './layout.js';
import { runAiOcr } from './ai-ocr.js';
import { buildConsensusResult } from './ocr-consensus.js';
import { candidateSummary, pickBestOcrCandidate, scoreOcrResult } from './ocr-quality.js';

const execFileAsync = promisify(execFile);
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VISION_HELPER = path.join(ROOT_DIR, 'scripts', 'vision-ocr.swift');
const PREPROCESS_HELPER = path.join(ROOT_DIR, 'scripts', 'macos-ocr-preprocess.swift');
const DEFAULT_AI_OCR_MODEL = 'gpt-5.4-mini';
const OCR_MODES = new Set(['local-improved', 'consensus', 'ai-advanced', 'auto']);

let languageCache;

const PLATFORM_LABELS = new Map([
  ['darwin', 'macOS'],
  ['win32', 'Windows'],
  ['linux', 'Linux']
]);

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

export function platformLabel(platform = process.platform) {
  return PLATFORM_LABELS.get(platform) || platform;
}

export function defaultOcrEngineForPlatform(platform = process.platform) {
  return platform === 'darwin' ? 'apple-vision' : 'tesseract';
}

function ocrEngineLabel(engine) {
  if (engine === 'apple-vision') {
    return 'Apple Vision';
  }
  if (engine === 'ai-advanced') {
    return 'IA avanzada';
  }
  if (engine === 'consensus') {
    return 'Consenso local';
  }
  return 'Tesseract';
}

export function normalizeOcrMode(mode = 'local-improved') {
  return OCR_MODES.has(mode) ? mode : 'local-improved';
}

export function summarizeOcrCapabilities({
  platform = process.platform,
  tesseractLanguages = [],
  hasOpenAiApiKey = Boolean(process.env.OPENAI_API_KEY),
  aiModel = process.env.BOOKSAVER_AI_OCR_MODEL || DEFAULT_AI_OCR_MODEL
} = {}) {
  const appleVisionAvailable = platform === 'darwin';
  const tesseractAvailable = tesseractLanguages.length > 0;

  return {
    localImproved: {
      available: appleVisionAvailable || tesseractAvailable,
      localOnly: true
    },
    consensus: {
      available: appleVisionAvailable && tesseractAvailable,
      localOnly: true
    },
    aiAdvanced: {
      available: hasOpenAiApiKey,
      localOnly: false,
      model: aiModel
    }
  };
}

export function summarizeRuntimeSupport({
  platform = process.platform,
  tesseractLanguages = [],
  preferredEngine = null
} = {}) {
  const normalizedLanguages = Array.from(new Set((tesseractLanguages || []).filter(Boolean))).sort();
  const appleVisionAvailable = platform === 'darwin';
  const tesseractInstalled = normalizedLanguages.length > 0;
  const defaultEngine = defaultOcrEngineForPlatform(platform);
  const resolvedPreferredEngine = preferredEngine || defaultEngine;
  const warnings = [];

  if (!appleVisionAvailable && !tesseractInstalled) {
    warnings.push('Instala Tesseract para activar el OCR local en este sistema.');
  } else if (!appleVisionAvailable && !normalizedLanguages.includes('spa')) {
    warnings.push('Tesseract funciona, pero falta el idioma español (`spa`).');
  } else if (appleVisionAvailable && !tesseractInstalled) {
    warnings.push('Apple Vision ya cubre el OCR. Tesseract es opcional como fallback.');
  }

  let summary = `${platformLabel(platform)} listo para OCR con ${ocrEngineLabel(resolvedPreferredEngine)}.`;
  if (appleVisionAvailable && tesseractInstalled) {
    summary = 'macOS listo: Apple Vision y Tesseract disponibles.';
  } else if (appleVisionAvailable && !tesseractInstalled) {
    summary = 'macOS listo: Apple Vision disponible. Tesseract es opcional.';
  } else if (!tesseractInstalled) {
    summary = `${platformLabel(platform)} necesita Tesseract para usar OCR.`;
  }

  return {
    platform,
    platformLabel: platformLabel(platform),
    folderPickerSupported: platform === 'darwin' || platform === 'win32',
    appleVisionAvailable,
    tesseractInstalled,
    tesseractLanguages: normalizedLanguages,
    defaultEngine,
    preferredEngine: resolvedPreferredEngine,
    preferredEngineLabel: ocrEngineLabel(resolvedPreferredEngine),
    summary,
    warnings
  };
}

export async function inspectRuntimeSupport(options = {}) {
  const tesseractLanguages =
    options.tesseractLanguages || (await listTesseractLanguages({ refresh: options.refresh }));
  const support = summarizeRuntimeSupport({
    platform: options.platform || process.platform,
    preferredEngine: options.preferredEngine || process.env.BOOKSAVER_OCR_ENGINE || null,
    tesseractLanguages
  });
  return {
    ...support,
    ocrCapabilities: summarizeOcrCapabilities({
      platform: support.platform,
      tesseractLanguages: support.tesseractLanguages,
      hasOpenAiApiKey: Boolean(process.env.OPENAI_API_KEY)
    })
  };
}

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
    id: 'apple-vision:original',
    provider: 'local',
    text,
    tsv: '',
    layout,
    language: visionResult.language || language || 'es',
    engine: 'apple-vision',
    profile: 'original',
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

export function buildLocalOcrProfiles({ engine, imagePath, language }) {
  if (engine === 'apple-vision') {
    return [
      {
        id: 'apple-vision:original',
        engine: 'apple-vision',
        profile: 'original',
        imagePath,
        language
      }
    ];
  }

  return [
    {
      id: 'tesseract:psm4',
      engine: 'tesseract',
      profile: 'psm4',
      imagePath,
      language,
      args: [imagePath, 'stdout', '-l', language, '--oem', '1', '--psm', '4', '--dpi', '300', 'tsv']
    },
    {
      id: 'tesseract:psm6',
      engine: 'tesseract',
      profile: 'psm6',
      imagePath,
      language,
      args: [imagePath, 'stdout', '-l', language, '--oem', '1', '--psm', '6', '--dpi', '300', 'tsv']
    },
    {
      id: 'tesseract:psm3',
      engine: 'tesseract',
      profile: 'psm3',
      imagePath,
      language,
      args: [imagePath, 'stdout', '-l', language, '--oem', '1', '--psm', '3', '--dpi', '300', 'tsv']
    }
  ];
}

export function buildOcrImageVariants({ imagePath, outputDir = path.dirname(imagePath), platform = process.platform }) {
  const original = [{ id: 'original', imagePath, profile: 'original' }];

  if (platform !== 'darwin') {
    return original;
  }

  return [
    ...original,
    {
      id: 'contrast',
      imagePath: path.join(outputDir, 'page-contrast.jpg'),
      profile: 'contrast'
    },
    {
      id: 'sharpen',
      imagePath: path.join(outputDir, 'page-sharpen.jpg'),
      profile: 'sharpen'
    }
  ];
}

async function prepareLocalOcrVariant(sourcePath, variant) {
  if (variant.profile === 'original') {
    return variant.imagePath;
  }

  await execFileAsync('swift', [PREPROCESS_HELPER, sourcePath, variant.imagePath, variant.profile], {
    cwd: ROOT_DIR,
    maxBuffer: 1024 * 1024 * 5
  });
  return variant.imagePath;
}

async function preparedOcrVariants(imagePath, options = {}) {
  const variants = buildOcrImageVariants({
    imagePath,
    outputDir: options.outputDir,
    platform: options.platform || process.platform
  });
  const prepared = [];

  for (const variant of variants) {
    try {
      prepared.push({
        ...variant,
        imagePath: await prepareLocalOcrVariant(imagePath, variant)
      });
    } catch (error) {
      prepared.push({
        ...variant,
        imagePath,
        skipped: true,
        warning: `No se pudo preparar la variante ${variant.profile}: ${error.message}`
      });
    }
  }

  return prepared;
}

async function runTesseractProfile(profile, fallbackWarning = null) {
  try {
    const { stdout, stderr } = await execFileAsync('tesseract', profile.args, {
      maxBuffer: 1024 * 1024 * 20
    });
    const layout = buildLayoutFromTsv(stdout);
    const text = layoutToText(layout);

    return {
      id: profile.id,
      provider: 'local',
      engine: 'tesseract',
      profile: profile.profile,
      text,
      tsv: stdout,
      layout,
      language: profile.language,
      warning: cleanTesseractWarning(stderr, fallbackWarning),
      status: text ? 'ocr-complete' : 'ocr-error'
    };
  } catch (error) {
    return {
      id: profile.id,
      provider: 'local',
      engine: 'tesseract',
      profile: profile.profile,
      text: '',
      tsv: '',
      layout: null,
      language: profile.language,
      warning: cleanTesseractWarning(error.stderr, fallbackWarning) || error.message,
      status: 'ocr-error'
    };
  }
}

export function createReliableOcrResult({ mode, candidates }) {
  const best = pickBestOcrCandidate(candidates);

  if (!best) {
    return {
      text: '',
      tsv: '',
      layout: null,
      language: null,
      engine: null,
      warning: 'No se pudo obtener texto util con los motores OCR disponibles.',
      status: 'ocr-error',
      ocrStrategy: mode,
      ocrProvider: 'local',
      ocrModel: null,
      ocrConfidence: 0,
      ocrQualityScore: 0,
      ocrNeedsReview: true,
      candidates: candidates.map(candidateSummary)
    };
  }

  const quality = scoreOcrResult(best);

  return {
    text: best.text,
    tsv: best.tsv || '',
    layout: best.layout || {},
    language: best.language || null,
    engine: best.engine,
    warning: best.warning || (quality.needsReview ? 'OCR con baja confianza; revisa esta pagina.' : null),
    status: best.status || 'ocr-complete',
    ocrStrategy: mode,
    ocrProvider: best.provider || 'local',
    ocrModel: best.model || null,
    ocrConfidence: quality.confidence,
    ocrQualityScore: quality.qualityScore,
    ocrNeedsReview: quality.needsReview,
    candidates: candidates.map(candidateSummary)
  };
}

async function runTesseractOcr(imagePath, language, fallbackWarning = null, options = {}) {
  const resolved = await resolveOcrLanguage(language);

  if (!resolved.language) {
    return createReliableOcrResult({
      mode: normalizeOcrMode(options.mode),
      candidates: [
        {
          id: 'tesseract:missing-language',
          provider: 'local',
          engine: 'tesseract',
          profile: 'missing-language',
          text: '',
          tsv: '',
          layout: null,
          language: null,
          warning: resolved.warning || fallbackWarning,
          status: 'ocr-error'
        }
      ]
    });
  }

  const variants = await preparedOcrVariants(imagePath, options);
  const candidates = [];

  for (const variant of variants) {
    const profiles = buildLocalOcrProfiles({
      engine: 'tesseract',
      imagePath: variant.imagePath,
      language: resolved.language
    });
    for (const profile of profiles) {
      candidates.push(await runTesseractProfile({
        ...profile,
        id: variant.profile === 'original' ? profile.id : `${profile.id}:${variant.profile}`,
        profile: variant.profile === 'original' ? profile.profile : `${profile.profile}:${variant.profile}`
      }, resolved.warning || variant.warning || fallbackWarning));
    }
  }

  const selected = createReliableOcrResult({
    mode: normalizeOcrMode(options.mode),
    candidates
  });

  if (!selected.text && resolved.language) {
    try {
      const fallback = await runPlainTextOcr(imagePath, resolved.language);
      return createReliableOcrResult({
        mode: normalizeOcrMode(options.mode),
        candidates: [
          ...candidates,
          {
            id: 'tesseract:plain-text',
            provider: 'local',
            engine: 'tesseract',
            profile: 'plain-text',
            text: fallback.text,
            tsv: '',
            layout: {
              version: 1,
              source: 'tesseract-plain-text',
              page: {},
              textBounds: null,
              lines: [],
              blocks: fallback.text ? [{ type: 'paragraph', text: fallback.text, confidence: 50 }] : []
            },
            language: resolved.language,
            warning: fallback.warning || selected.warning,
            status: fallback.text ? 'ocr-complete' : 'ocr-error'
          }
        ]
      });
    } catch {
      return selected;
    }
  }

  return selected;
}

async function runAppleVisionCandidates(imagePath, language, options = {}) {
  const variants = await preparedOcrVariants(imagePath, options);
  const candidates = [];

  for (const variant of variants) {
    try {
      const candidate = await runAppleVisionOcr(variant.imagePath, language);
      candidates.push({
        ...candidate,
        id: variant.profile === 'original' ? 'apple-vision:original' : `apple-vision:${variant.profile}`,
        profile: variant.profile
      });
    } catch (error) {
      candidates.push({
        id: variant.profile === 'original' ? 'apple-vision:original' : `apple-vision:${variant.profile}`,
        provider: 'local',
        engine: 'apple-vision',
        profile: variant.profile,
        text: '',
        tsv: '',
        layout: null,
        language,
        warning: error.message,
        status: 'ocr-error'
      });
    }
  }

  return candidates;
}

async function runConsensusOcr(imagePath, language, options = {}) {
  const candidates = [];

  if (process.platform === 'darwin') {
    candidates.push(...(await runAppleVisionCandidates(imagePath, language, options)));
  }

  const tesseract = await runTesseractOcr(imagePath, language, null, {
    ...options,
    mode: 'local-improved'
  });
  candidates.push({
    id: 'tesseract:selected',
    provider: 'local',
    engine: tesseract.engine || 'tesseract',
    profile: 'selected',
    text: tesseract.text,
    tsv: tesseract.tsv,
    layout: tesseract.layout,
    language: tesseract.language,
    warning: tesseract.warning,
    status: tesseract.status
  });

  const complete = candidates.filter((candidate) => candidate.status === 'ocr-complete');
  if (complete.length >= 2) {
    candidates.push(buildConsensusResult(complete));
  }

  return createReliableOcrResult({
    mode: 'consensus',
    candidates
  });
}

export async function runOcr(imagePath, language, options = {}) {
  const mode = normalizeOcrMode(options.mode);
  const preferEngine =
    options.engine || process.env.BOOKSAVER_OCR_ENGINE || defaultOcrEngineForPlatform();

  if (mode === 'ai-advanced') {
    const candidate = await runAiOcr({
      imagePath,
      language,
      allowCloud: options.allowCloud === true,
      apiKey: options.openAiApiKey,
      model: options.aiModel
    });

    return createReliableOcrResult({
      mode,
      candidates: [candidate]
    });
  }

  if (mode === 'consensus') {
    return runConsensusOcr(imagePath, language, options);
  }

  if (preferEngine !== 'tesseract') {
    const visionCandidates = await runAppleVisionCandidates(imagePath, language, options);
    const bestVision = createReliableOcrResult({ mode, candidates: visionCandidates });
    if (bestVision.status === 'ocr-complete') {
      return bestVision;
    }

    const warning = bestVision.warning
      ? `Apple Vision no se pudo usar. Se uso Tesseract. Motivo: ${bestVision.warning}`
      : 'Apple Vision no se pudo usar. Se uso Tesseract.';
    return runTesseractOcr(imagePath, language, warning, { ...options, mode });
  }

  return runTesseractOcr(imagePath, language, null, { ...options, mode });
}

# OCR Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safer OCR pipeline that reduces manual corrections by improving local OCR first, using Apple Vision plus Tesseract consensus when available, and offering explicit opt-in AI OCR for difficult pages.

**Architecture:** Keep BookSaver local-first by default. Add a deterministic quality layer that can compare OCR candidates, then route each page through local multipass OCR, dual-engine consensus, or an explicit AI provider depending on user intent and runtime availability. Preserve original captures and existing editable OCR text files; new metadata records provenance and confidence without replacing source images.

**Tech Stack:** Node.js native ES modules, `node:test`, existing Node HTTP server, Apple Vision Swift helper, Tesseract CLI, optional OpenAI Responses API through server-side `fetch`.

---

## Product Boundaries

- Default behavior remains local-only. No network calls happen unless the user explicitly enables AI OCR for a single page.
- Original images remain untouched. OCR-specific derived images may be generated under each page folder and can be regenerated.
- Generated AI text is editable and stored like existing OCR text, with provenance metadata showing the provider and model.
- The UI copy stays in Spanish.
- The first implementation should not add analytics, accounts, cloud storage, or remote sync.

## Current Context

- `src/lib/ocr.js` chooses Apple Vision on macOS and Tesseract elsewhere.
- `scripts/vision-ocr.swift` returns Apple Vision lines with confidence and bounding boxes.
- `src/lib/layout.js` converts Apple Vision and Tesseract layouts into reviewable blocks.
- `src/lib/storage.js` prepares rotated/cropped page images and persists `ocr.txt`, `ocr.tsv`, `layout.json`, and page metadata.
- `src/server.js` exposes `POST /api/projects/:projectId/pages/:pageId/ocr`.
- `public/app.js` triggers single-page and batch OCR from the editor.

## External References

- OpenAI model guidance checked on 2026-04-25: latest models support text and image input through the Responses API. Start optional AI OCR with `gpt-5.4-mini` for cost/latency and allow `gpt-5.5` for maximum quality. Reference: https://developers.openai.com/api/docs/models
- OpenAI image input guidance checked on 2026-04-25: supported image formats include JPEG and PNG; `detail: "original"` is intended for dense or spatially sensitive images on `gpt-5.4` and future models. Reference: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI API key guidance checked on 2026-04-25: keep API keys server-side and load them from environment/config, never client-side browser code. Reference: https://developers.openai.com/api/reference/overview
- OpenAI data controls checked on 2026-04-25: API data is not used for training unless explicitly opted in, but abuse monitoring logs may retain content by default. Use `store: false` for Responses API calls and explain the privacy tradeoff in UI copy. Reference: https://developers.openai.com/api/docs/guides/your-data

## Planned File Structure

- Create `src/lib/ocr-quality.js`: scores OCR output, chooses the best candidate, and decides whether a page needs another pass.
- Create `src/lib/ocr-consensus.js`: aligns compatible layouts from multiple candidates and produces a consensus result.
- Create `src/lib/ai-ocr.js`: optional OpenAI Responses API adapter, disabled when `OPENAI_API_KEY` is missing or the user has not opted in.
- Create `scripts/macos-ocr-preprocess.swift`: local macOS CoreImage preprocessing for OCR-only image variants.
- Modify `src/lib/ocr.js`: expose reliable OCR orchestration, local profiles, candidate metadata, and AI handoff options.
- Modify `src/lib/storage.js`: persist OCR provenance, candidate summaries, confidence score, warnings, and review-needed state.
- Modify `src/server.js`: accept OCR mode options and expose runtime capability data.
- Modify `public/index.html`, `public/app.js`, and `public/styles.css`: add Spanish controls for local improved OCR, consensus OCR, and explicit AI OCR.
- Modify `README.md` and `docs/README.en.md`: document local-first defaults, optional AI behavior, setup, and privacy implications.
- Create tests:
  - `tests/ocr-quality.test.js`
  - `tests/ocr-consensus.test.js`
  - `tests/ai-ocr.test.js`
  - Update `tests/ocr.test.js`
  - Update `tests/storage.test.js`

## Data Model

Extend page records in `pages.json` with additive fields only:

```js
{
  ocrEngine: 'apple-vision',
  ocrLanguage: 'es',
  ocrWarning: null,
  ocrStrategy: 'local-improved',
  ocrProvider: 'local',
  ocrModel: null,
  ocrConfidence: 91.7,
  ocrQualityScore: 87,
  ocrNeedsReview: false,
  ocrCandidates: [
    {
      id: 'apple-vision:original',
      provider: 'local',
      engine: 'apple-vision',
      profile: 'original',
      confidence: 91.7,
      qualityScore: 87,
      textLength: 1842,
      warning: null
    }
  ]
}
```

Do not store duplicate full candidate text in `pages.json`. Persist only the selected text to `ocr.txt`. Candidate summaries are enough for UI and debugging.

## OCR Modes

- `local-improved`: default local mode. Runs the best available local engine with multiple profiles and chooses the strongest candidate.
- `consensus`: local-only mode. Runs Apple Vision and Tesseract when both are available, then selects or merges results.
- `ai-advanced`: network mode. Requires explicit user action, `OPENAI_API_KEY`, and per-request `allowCloud: true`.
- `auto`: later convenience mode. Runs `local-improved`, escalates to `consensus` if available, and only suggests AI without calling it.

---

### Task 1: OCR Quality Scoring

**Files:**
- Create: `src/lib/ocr-quality.js`
- Test: `tests/ocr-quality.test.js`

- [ ] **Step 1: Write failing tests for quality scoring**

Add `tests/ocr-quality.test.js`:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  candidateSummary,
  pickBestOcrCandidate,
  scoreOcrResult,
  shouldEscalateOcr
} from '../src/lib/ocr-quality.js';

function candidate(overrides = {}) {
  return {
    id: 'tesseract:psm4',
    provider: 'local',
    engine: 'tesseract',
    profile: 'psm4',
    text: 'Este es un texto de prueba con varias palabras reconocidas correctamente.',
    layout: {
      lines: [
        { text: 'Este es un texto de prueba', confidence: 91 },
        { text: 'con varias palabras reconocidas correctamente.', confidence: 88 }
      ],
      blocks: [
        {
          type: 'paragraph',
          text: 'Este es un texto de prueba con varias palabras reconocidas correctamente.',
          confidence: 89.5
        }
      ]
    },
    warning: null,
    status: 'ocr-complete',
    ...overrides
  };
}

test('scoreOcrResult rewards confidence, useful text, and normal character mix', () => {
  const strong = scoreOcrResult(candidate());
  const weak = scoreOcrResult(
    candidate({
      text: 'l | 1 0 ? ?',
      layout: {
        lines: [{ text: 'l | 1 0 ? ?', confidence: 28 }],
        blocks: [{ type: 'paragraph', text: 'l | 1 0 ? ?', confidence: 28 }]
      }
    })
  );

  assert.equal(strong.needsReview, false);
  assert.equal(weak.needsReview, true);
  assert.ok(strong.qualityScore > weak.qualityScore);
  assert.ok(strong.confidence > weak.confidence);
});

test('pickBestOcrCandidate selects the highest quality candidate', () => {
  const best = pickBestOcrCandidate([
    candidate({ id: 'tesseract:psm6', text: 'Texto corto', layout: { lines: [], blocks: [] } }),
    candidate({ id: 'apple-vision:original' })
  ]);

  assert.equal(best.id, 'apple-vision:original');
  assert.equal(best.quality.needsReview, false);
});

test('shouldEscalateOcr marks weak local results for another pass', () => {
  const result = candidate({
    text: '???',
    layout: {
      lines: [{ text: '???', confidence: 12 }],
      blocks: [{ type: 'paragraph', text: '???', confidence: 12 }]
    }
  });

  assert.equal(shouldEscalateOcr(result), true);
});

test('candidateSummary omits full text but keeps useful diagnostics', () => {
  const summary = candidateSummary(candidate({ id: 'local:test-profile' }));

  assert.deepEqual(summary, {
    id: 'local:test-profile',
    provider: 'local',
    engine: 'tesseract',
    profile: 'psm4',
    model: null,
    confidence: 89.5,
    qualityScore: summary.qualityScore,
    textLength: 66,
    warning: null
  });
  assert.equal(Object.hasOwn(summary, 'text'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
node --test tests/ocr-quality.test.js
```

Expected: fail with `Cannot find module '../src/lib/ocr-quality.js'`.

- [ ] **Step 3: Implement quality scoring**

Create `src/lib/ocr-quality.js`:

```js
function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function lineConfidence(layout) {
  const lines = (layout?.lines || []).filter((line) => Number.isFinite(Number(line.confidence)));
  if (!lines.length) {
    return 0;
  }
  return lines.reduce((sum, line) => sum + Number(line.confidence), 0) / lines.length;
}

function blockConfidence(layout) {
  const blocks = (layout?.blocks || []).filter((block) => Number.isFinite(Number(block.confidence)));
  if (!blocks.length) {
    return 0;
  }
  return blocks.reduce((sum, block) => sum + Number(block.confidence), 0) / blocks.length;
}

function usefulWordCount(text) {
  return String(text || '')
    .split(/\s+/)
    .filter((word) => /\p{L}{2,}/u.test(word)).length;
}

function suspiciousCharacterRatio(text) {
  const value = String(text || '');
  if (!value.length) {
    return 1;
  }

  const suspicious = [...value].filter((char) => /[�□|_~^={}<>\\]/u.test(char)).length;
  return suspicious / value.length;
}

function punctuationNoiseRatio(text) {
  const value = String(text || '').replace(/\s/g, '');
  if (!value.length) {
    return 1;
  }

  const punctuation = [...value].filter((char) => /[.,:;!?'"()[\]¿¡-]/u.test(char)).length;
  return punctuation / value.length;
}

export function scoreOcrResult(result = {}) {
  const text = String(result.text || '').trim();
  const confidence = round(Math.max(lineConfidence(result.layout), blockConfidence(result.layout)), 1);
  const words = usefulWordCount(text);
  const suspiciousRatio = suspiciousCharacterRatio(text);
  const punctuationRatio = punctuationNoiseRatio(text);
  const textLengthScore = Math.min(18, words * 0.7);
  const confidenceScore = Math.min(60, confidence * 0.6);
  const warningPenalty = result.warning ? 8 : 0;
  const suspiciousPenalty = Math.min(24, suspiciousRatio * 120);
  const punctuationPenalty = punctuationRatio > 0.35 ? 12 : 0;
  const emptyPenalty = text ? 0 : 60;
  const qualityScore = round(
    Math.max(0, confidenceScore + textLengthScore - warningPenalty - suspiciousPenalty - punctuationPenalty - emptyPenalty),
    1
  );
  const needsReview = qualityScore < 55 || confidence < 55 || words < 8 || suspiciousRatio > 0.05;

  return {
    confidence,
    qualityScore,
    needsReview,
    words,
    suspiciousRatio: round(suspiciousRatio, 3),
    punctuationRatio: round(punctuationRatio, 3)
  };
}

export function candidateSummary(candidate = {}) {
  const quality = candidate.quality || scoreOcrResult(candidate);

  return {
    id: candidate.id || `${candidate.engine || 'ocr'}:${candidate.profile || 'default'}`,
    provider: candidate.provider || 'local',
    engine: candidate.engine || null,
    profile: candidate.profile || null,
    model: candidate.model || null,
    confidence: quality.confidence,
    qualityScore: quality.qualityScore,
    textLength: String(candidate.text || '').length,
    warning: candidate.warning || null
  };
}

export function pickBestOcrCandidate(candidates = []) {
  const scored = candidates
    .filter((candidate) => candidate && candidate.status !== 'ocr-error')
    .map((candidate) => ({
      ...candidate,
      quality: scoreOcrResult(candidate)
    }))
    .sort((a, b) => b.quality.qualityScore - a.quality.qualityScore || b.quality.confidence - a.quality.confidence);

  if (!scored.length) {
    return null;
  }

  return scored[0];
}

export function shouldEscalateOcr(result) {
  return scoreOcrResult(result).needsReview;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```sh
node --test tests/ocr-quality.test.js
```

Expected: pass.

- [ ] **Step 5: Commit**

```sh
git add src/lib/ocr-quality.js tests/ocr-quality.test.js
git commit -m "feat: score OCR result quality"
```

---

### Task 2: Local Multipass OCR Profiles

**Files:**
- Modify: `src/lib/ocr.js`
- Test: `tests/ocr.test.js`

- [ ] **Step 1: Add failing tests for profile selection**

Append to `tests/ocr.test.js`:

```js
import { buildLocalOcrProfiles, normalizeOcrMode } from '../src/lib/ocr.js';

test('normalizeOcrMode defaults to local improved OCR', () => {
  assert.equal(normalizeOcrMode(), 'local-improved');
  assert.equal(normalizeOcrMode('consensus'), 'consensus');
  assert.equal(normalizeOcrMode('ai-advanced'), 'ai-advanced');
  assert.equal(normalizeOcrMode('unexpected'), 'local-improved');
});

test('buildLocalOcrProfiles uses multiple Tesseract page segmentation profiles', () => {
  const profiles = buildLocalOcrProfiles({
    engine: 'tesseract',
    imagePath: '/tmp/page.jpg',
    language: 'spa'
  });

  assert.deepEqual(
    profiles.map((profile) => profile.id),
    ['tesseract:psm4', 'tesseract:psm6', 'tesseract:psm3']
  );
  assert.deepEqual(profiles[0].args.slice(0, 4), ['/tmp/page.jpg', 'stdout', '-l', 'spa']);
});

test('buildLocalOcrProfiles keeps Apple Vision single-pass until image variants exist', () => {
  const profiles = buildLocalOcrProfiles({
    engine: 'apple-vision',
    imagePath: '/tmp/page.jpg',
    language: 'es'
  });

  assert.deepEqual(profiles, [
    {
      id: 'apple-vision:original',
      engine: 'apple-vision',
      profile: 'original',
      imagePath: '/tmp/page.jpg',
      language: 'es'
    }
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
node --test tests/ocr.test.js
```

Expected: fail because `buildLocalOcrProfiles` and `normalizeOcrMode` are not exported.

- [ ] **Step 3: Implement local OCR profiles**

Modify `src/lib/ocr.js`:

```js
const OCR_MODES = new Set(['local-improved', 'consensus', 'ai-advanced', 'auto']);

export function normalizeOcrMode(mode = 'local-improved') {
  return OCR_MODES.has(mode) ? mode : 'local-improved';
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
```

Then refactor `runTesseractOcr` so it can execute a profile:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```sh
node --test tests/ocr.test.js
```

Expected: pass.

- [ ] **Step 5: Commit**

```sh
git add src/lib/ocr.js tests/ocr.test.js
git commit -m "feat: add local OCR profiles"
```

---

### Task 3: Reliable Local OCR Orchestrator

**Files:**
- Modify: `src/lib/ocr.js`
- Test: `tests/ocr.test.js`

- [ ] **Step 1: Add failing tests for candidate picking**

Append to `tests/ocr.test.js`:

```js
import { createReliableOcrResult } from '../src/lib/ocr.js';

test('createReliableOcrResult returns the best candidate with summaries', () => {
  const result = createReliableOcrResult({
    mode: 'local-improved',
    candidates: [
      {
        id: 'tesseract:weak',
        provider: 'local',
        engine: 'tesseract',
        profile: 'weak',
        text: '???',
        layout: { lines: [{ text: '???', confidence: 10 }], blocks: [] },
        status: 'ocr-complete'
      },
      {
        id: 'apple-vision:original',
        provider: 'local',
        engine: 'apple-vision',
        profile: 'original',
        text: 'Texto correcto con muchas palabras reconocidas para la pagina.',
        layout: {
          lines: [{ text: 'Texto correcto con muchas palabras reconocidas para la pagina.', confidence: 94 }],
          blocks: [{ type: 'paragraph', text: 'Texto correcto con muchas palabras reconocidas para la pagina.', confidence: 94 }]
        },
        status: 'ocr-complete'
      }
    ]
  });

  assert.equal(result.engine, 'apple-vision');
  assert.equal(result.ocrStrategy, 'local-improved');
  assert.equal(result.ocrProvider, 'local');
  assert.equal(result.ocrNeedsReview, false);
  assert.equal(result.candidates.length, 2);
  assert.equal(Object.hasOwn(result.candidates[0], 'text'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
node --test tests/ocr.test.js
```

Expected: fail because `createReliableOcrResult` is not exported.

- [ ] **Step 3: Implement result assembly**

Modify imports in `src/lib/ocr.js`:

```js
import { candidateSummary, pickBestOcrCandidate, scoreOcrResult } from './ocr-quality.js';
```

Add:

```js
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
```

Refactor `runOcr` so `local-improved` uses candidates:

```js
export async function runOcr(imagePath, language, options = {}) {
  const mode = normalizeOcrMode(options.mode);
  const preferEngine =
    options.engine || process.env.BOOKSAVER_OCR_ENGINE || defaultOcrEngineForPlatform();

  if (mode === 'ai-advanced') {
    throw new Error('OCR avanzado con IA se implementa en la tarea del proveedor IA.');
  }

  if (preferEngine !== 'tesseract') {
    try {
      const candidate = await runAppleVisionOcr(imagePath, language);
      return createReliableOcrResult({
        mode,
        candidates: [{ ...candidate, id: 'apple-vision:original', provider: 'local', profile: 'original' }]
      });
    } catch (error) {
      const warning = `Apple Vision no se pudo usar. Se uso Tesseract. Motivo: ${error.message}`;
      return runTesseractOcr(imagePath, language, warning, { mode });
    }
  }

  return runTesseractOcr(imagePath, language, null, { mode });
}
```

Adjust `runTesseractOcr` to execute all profiles and call `createReliableOcrResult`.

- [ ] **Step 4: Run focused tests**

Run:

```sh
node --test tests/ocr.test.js tests/ocr-quality.test.js
```

Expected: pass.

- [ ] **Step 5: Commit**

```sh
git add src/lib/ocr.js tests/ocr.test.js
git commit -m "feat: choose best local OCR candidate"
```

---

### Task 4: macOS OCR Image Variants

**Files:**
- Create: `scripts/macos-ocr-preprocess.swift`
- Modify: `src/lib/ocr.js`
- Test: `tests/ocr.test.js`

- [ ] **Step 1: Add failing tests for preprocessing plan**

Append to `tests/ocr.test.js`:

```js
import { buildOcrImageVariants } from '../src/lib/ocr.js';

test('buildOcrImageVariants always includes the original image', () => {
  assert.deepEqual(
    buildOcrImageVariants({
      imagePath: '/tmp/page.jpg',
      platform: 'linux'
    }),
    [{ id: 'original', imagePath: '/tmp/page.jpg', profile: 'original' }]
  );
});

test('buildOcrImageVariants adds macOS derived variants for local preprocessing', () => {
  assert.deepEqual(
    buildOcrImageVariants({
      imagePath: '/tmp/page.jpg',
      outputDir: '/tmp/page-ocr',
      platform: 'darwin'
    }),
    [
      { id: 'original', imagePath: '/tmp/page.jpg', profile: 'original' },
      {
        id: 'contrast',
        imagePath: '/tmp/page-ocr/page-contrast.jpg',
        profile: 'contrast'
      },
      {
        id: 'sharpen',
        imagePath: '/tmp/page-ocr/page-sharpen.jpg',
        profile: 'sharpen'
      }
    ]
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
node --test tests/ocr.test.js
```

Expected: fail because `buildOcrImageVariants` is not exported.

- [ ] **Step 3: Add macOS preprocessing helper**

Create `scripts/macos-ocr-preprocess.swift`:

```swift
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

guard CommandLine.arguments.count == 4 else {
    fail("Uso: macos-ocr-preprocess.swift <input> <output> <profile>")
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let profile = CommandLine.arguments[3]
let context = CIContext(options: nil)

guard let image = CIImage(contentsOf: inputURL) else {
    fail("No se pudo leer la imagen.")
}

let filtered: CIImage
switch profile {
case "contrast":
    filtered = image
        .applyingFilter("CIColorControls", parameters: [
            kCIInputSaturationKey: 0,
            kCIInputContrastKey: 1.35,
            kCIInputBrightnessKey: 0.03
        ])
case "sharpen":
    filtered = image
        .applyingFilter("CIColorControls", parameters: [
            kCIInputSaturationKey: 0,
            kCIInputContrastKey: 1.2
        ])
        .applyingFilter("CISharpenLuminance", parameters: [
            kCIInputSharpnessKey: 0.6
        ])
default:
    fail("Perfil no soportado: \(profile)")
}

try FileManager.default.createDirectory(
    at: outputURL.deletingLastPathComponent(),
    withIntermediateDirectories: true
)

guard let cgImage = context.createCGImage(filtered, from: filtered.extent),
      let destination = CGImageDestinationCreateWithURL(
        outputURL as CFURL,
        UTType.jpeg.identifier as CFString,
        1,
        nil
      ) else {
    fail("No se pudo preparar la exportacion JPEG.")
}

let properties = [
    kCGImageDestinationLossyCompressionQuality: 0.94
] as CFDictionary
CGImageDestinationAddImage(destination, cgImage, properties)

if !CGImageDestinationFinalize(destination) {
    fail("No se pudo exportar la imagen.")
}
```

Use the helper from Node only on macOS and only for OCR-derived files.

- [ ] **Step 4: Add image variant builder**

Modify `src/lib/ocr.js`:

```js
const PREPROCESS_HELPER = path.join(ROOT_DIR, 'scripts', 'macos-ocr-preprocess.swift');

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
```

Integrate variants before building profiles so Tesseract and Apple Vision can compete across original and derived images.

- [ ] **Step 5: Run tests**

Run:

```sh
node --test tests/ocr.test.js
swiftc -parse scripts/macos-ocr-preprocess.swift
```

Expected: both commands pass on macOS. On Windows/Linux, the Swift parse command is skipped by CI; keep Node tests platform-neutral.

- [ ] **Step 6: Commit**

```sh
git add src/lib/ocr.js scripts/macos-ocr-preprocess.swift tests/ocr.test.js
git commit -m "feat: add local OCR image variants"
```

---

### Task 5: Persist OCR Provenance And Quality

**Files:**
- Modify: `src/lib/storage.js`
- Test: `tests/storage.test.js`

- [ ] **Step 1: Add failing storage test**

Append to `tests/storage.test.js`:

```js
test('runPageOcr persists OCR reliability metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root, {
    ocrRunner: async () => ({
      text: 'Texto fiable de la pagina.',
      tsv: '',
      layout: {
        lines: [{ text: 'Texto fiable de la pagina.', confidence: 93 }],
        blocks: [{ type: 'paragraph', text: 'Texto fiable de la pagina.', confidence: 93 }]
      },
      language: 'es',
      engine: 'apple-vision',
      warning: null,
      status: 'ocr-complete',
      ocrStrategy: 'local-improved',
      ocrProvider: 'local',
      ocrModel: null,
      ocrConfidence: 93,
      ocrQualityScore: 75,
      ocrNeedsReview: false,
      candidates: [
        {
          id: 'apple-vision:original',
          provider: 'local',
          engine: 'apple-vision',
          profile: 'original',
          model: null,
          confidence: 93,
          qualityScore: 75,
          textLength: 27,
          warning: null
        }
      ]
    })
  });

  try {
    const project = await store.createProject({
      title: 'Libro OCR',
      author: '',
      language: 'es',
      notes: ''
    });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);
    const updated = await store.runPageOcr(project.id, page.id, { mode: 'local-improved' });

    assert.equal(updated.ocrStrategy, 'local-improved');
    assert.equal(updated.ocrProvider, 'local');
    assert.equal(updated.ocrConfidence, 93);
    assert.equal(updated.ocrQualityScore, 75);
    assert.equal(updated.ocrNeedsReview, false);
    assert.equal(updated.ocrCandidates.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
node --test tests/storage.test.js
```

Expected: fail because `runPageOcr` does not accept options and does not persist new metadata.

- [ ] **Step 3: Add injectable OCR runner and metadata persistence**

Modify the storage class constructor by adding one line before `this.ensurePromise = null;`:

```js
this.ocrRunner = options.ocrRunner || runOcr;
```

Modify `runPageOcr` signature and runner call:

```js
async runPageOcr(projectId, pageId, options = {}) {
  // existing project/page validation remains unchanged
  const result = await this.ocrRunner(ocrImage.path, metadata.language, options);
  // existing file writes remain unchanged
}
```

Persist additive fields after `page.ocrWarning = result.warning;`:

```js
page.ocrStrategy = result.ocrStrategy || options.mode || 'local-improved';
page.ocrProvider = result.ocrProvider || 'local';
page.ocrModel = result.ocrModel || null;
page.ocrConfidence = Number(result.ocrConfidence || 0);
page.ocrQualityScore = Number(result.ocrQualityScore || 0);
page.ocrNeedsReview = Boolean(result.ocrNeedsReview);
page.ocrCandidates = Array.isArray(result.candidates) ? result.candidates : [];
```

- [ ] **Step 4: Run storage tests**

Run:

```sh
node --test tests/storage.test.js
```

Expected: pass.

- [ ] **Step 5: Commit**

```sh
git add src/lib/storage.js tests/storage.test.js
git commit -m "feat: persist OCR reliability metadata"
```

---

### Task 6: Dual Engine Consensus

**Files:**
- Create: `src/lib/ocr-consensus.js`
- Modify: `src/lib/ocr.js`
- Test: `tests/ocr-consensus.test.js`
- Test: `tests/ocr.test.js`

- [ ] **Step 1: Write failing consensus tests**

Create `tests/ocr-consensus.test.js`:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildConsensusResult, lineSimilarity } from '../src/lib/ocr-consensus.js';

function result(id, engine, lines) {
  return {
    id,
    provider: 'local',
    engine,
    profile: 'original',
    language: 'es',
    status: 'ocr-complete',
    text: lines.map((line) => line.text).join('\n'),
    layout: {
      lines,
      blocks: lines.map((line) => ({
        type: 'paragraph',
        text: line.text,
        confidence: line.confidence
      }))
    },
    warning: null
  };
}

test('lineSimilarity recognizes near-identical OCR lines', () => {
  assert.ok(lineSimilarity('El molino estaba quieto.', 'El molino estaba quieto') > 0.9);
  assert.ok(lineSimilarity('El molino estaba quieto.', 'zzzz xxxx') < 0.4);
});

test('buildConsensusResult chooses higher-confidence line when candidates differ slightly', () => {
  const consensus = buildConsensusResult([
    result('apple-vision:original', 'apple-vision', [
      { text: 'El molino estaba quleto.', confidence: 71, left: 0, top: 0, width: 100, height: 20 },
      { text: 'La tarde caia sobre el campo.', confidence: 88, left: 0, top: 30, width: 100, height: 20 }
    ]),
    result('tesseract:psm4', 'tesseract', [
      { text: 'El molino estaba quieto.', confidence: 92, left: 0, top: 0, width: 100, height: 20 },
      { text: 'La tarde caia sobre el campo.', confidence: 82, left: 0, top: 30, width: 100, height: 20 }
    ])
  ]);

  assert.equal(consensus.engine, 'consensus');
  assert.equal(consensus.text, 'El molino estaba quieto.\n\nLa tarde caia sobre el campo.');
  assert.equal(consensus.layout.source, 'ocr-consensus');
  assert.equal(consensus.status, 'ocr-complete');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
node --test tests/ocr-consensus.test.js
```

Expected: fail because `src/lib/ocr-consensus.js` does not exist.

- [ ] **Step 3: Implement consensus module**

Create `src/lib/ocr-consensus.js`:

```js
import { layoutToText } from './layout.js';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(value) {
  const text = normalize(value);
  if (text.length < 2) {
    return new Set(text ? [text] : []);
  }

  const pairs = new Set();
  for (let index = 0; index < text.length - 1; index += 1) {
    pairs.add(text.slice(index, index + 2));
  }
  return pairs;
}

export function lineSimilarity(a, b) {
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.size && !right.size) {
    return 1;
  }

  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function pickLine(lines) {
  return [...lines].sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0];
}

function mergeLines(candidates) {
  const base = candidates
    .flatMap((candidate) => candidate.layout?.lines || [])
    .sort((a, b) => Number(a.top || 0) - Number(b.top || 0) || Number(a.left || 0) - Number(b.left || 0));
  const groups = [];

  for (const line of base) {
    const group = groups.find((items) => items.some((item) => lineSimilarity(item.text, line.text) > 0.72));
    if (group) {
      group.push(line);
    } else {
      groups.push([line]);
    }
  }

  return groups.map(pickLine);
}

export function buildConsensusResult(candidates = []) {
  const lines = mergeLines(candidates);
  const blocks = lines
    .filter((line) => String(line.text || '').trim())
    .map((line) => ({
      type: 'paragraph',
      text: String(line.text).trim(),
      confidence: Number(line.confidence || 0)
    }));
  const layout = {
    version: 1,
    source: 'ocr-consensus',
    page: candidates.find((candidate) => candidate.layout?.page)?.layout.page || {},
    textBounds: null,
    lines,
    blocks
  };

  return {
    id: 'consensus:local',
    provider: 'local',
    engine: 'consensus',
    profile: 'apple-vision+tesseract',
    language: candidates.find((candidate) => candidate.language)?.language || null,
    text: layoutToText(layout),
    tsv: '',
    layout,
    warning: null,
    status: blocks.length ? 'ocr-complete' : 'ocr-error'
  };
}
```

- [ ] **Step 4: Integrate consensus mode in OCR orchestration**

Modify `src/lib/ocr.js`:

```js
import { buildConsensusResult } from './ocr-consensus.js';
```

Add a helper:

```js
async function runConsensusOcr(imagePath, language, options = {}) {
  const candidates = [];

  if (process.platform === 'darwin') {
    try {
      const vision = await runAppleVisionOcr(imagePath, language);
      candidates.push({ ...vision, id: 'apple-vision:original', provider: 'local', profile: 'original' });
    } catch (error) {
      candidates.push({
        id: 'apple-vision:original',
        provider: 'local',
        engine: 'apple-vision',
        profile: 'original',
        text: '',
        layout: null,
        warning: error.message,
        status: 'ocr-error'
      });
    }
  }

  const tesseract = await runTesseractOcr(imagePath, language, null, { ...options, mode: 'local-improved' });
  candidates.push({
    id: 'tesseract:selected',
    provider: 'local',
    engine: tesseract.engine,
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
```

Then route `mode === 'consensus'` to `runConsensusOcr`.

- [ ] **Step 5: Run tests**

Run:

```sh
node --test tests/ocr-consensus.test.js tests/ocr.test.js tests/ocr-quality.test.js
```

Expected: pass.

- [ ] **Step 6: Commit**

```sh
git add src/lib/ocr-consensus.js src/lib/ocr.js tests/ocr-consensus.test.js tests/ocr.test.js
git commit -m "feat: add local OCR consensus"
```

---

### Task 7: Optional OpenAI OCR Adapter

**Files:**
- Create: `src/lib/ai-ocr.js`
- Modify: `src/lib/ocr.js`
- Test: `tests/ai-ocr.test.js`
- Test: `tests/ocr.test.js`

- [ ] **Step 1: Write failing AI adapter tests**

Create `tests/ai-ocr.test.js`:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildAiOcrRequest, parseAiOcrResponse, runAiOcr } from '../src/lib/ai-ocr.js';

const tinyJpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2w==', 'base64');

test('buildAiOcrRequest uses Responses API image input and store false', () => {
  const body = buildAiOcrRequest({
    imageBase64: tinyJpeg.toString('base64'),
    mime: 'image/jpeg',
    language: 'es',
    model: 'gpt-5.4-mini'
  });

  assert.equal(body.model, 'gpt-5.4-mini');
  assert.equal(body.store, false);
  assert.equal(body.input[0].content[1].type, 'input_image');
  assert.match(body.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
  assert.equal(body.input[0].content[1].detail, 'original');
  assert.equal(body.text.format.type, 'json_schema');
});

test('parseAiOcrResponse extracts structured OCR JSON', () => {
  const parsed = parseAiOcrResponse({
    output_text: JSON.stringify({
      text: 'Texto transcrito.',
      paragraphs: ['Texto transcrito.'],
      confidence: 0.93,
      warnings: []
    })
  });

  assert.equal(parsed.text, 'Texto transcrito.');
  assert.equal(parsed.confidence, 93);
  assert.equal(parsed.warnings.length, 0);
});

test('runAiOcr refuses to call network without explicit opt-in', async () => {
  await assert.rejects(
    runAiOcr({
      imagePath: '/tmp/page.jpg',
      language: 'es',
      allowCloud: false,
      apiKey: 'test-key',
      readFile: async () => tinyJpeg,
      fetchImpl: async () => {
        throw new Error('fetch should not be called');
      }
    }),
    /activarse de forma explicita/i
  );
});

test('runAiOcr calls OpenAI when opt-in and API key are present', async () => {
  const result = await runAiOcr({
    imagePath: '/tmp/page.jpg',
    language: 'es',
    allowCloud: true,
    apiKey: 'test-key',
    readFile: async () => tinyJpeg,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.Authorization, 'Bearer test-key');
      return {
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            text: 'Texto transcrito por IA.',
            paragraphs: ['Texto transcrito por IA.'],
            confidence: 0.91,
            warnings: []
          })
        })
      };
    }
  });

  assert.equal(result.provider, 'openai');
  assert.equal(result.engine, 'ai-advanced');
  assert.equal(result.model, 'gpt-5.4-mini');
  assert.equal(result.text, 'Texto transcrito por IA.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
node --test tests/ai-ocr.test.js
```

Expected: fail because `src/lib/ai-ocr.js` does not exist.

- [ ] **Step 3: Implement AI adapter**

Create `src/lib/ai-ocr.js`:

```js
import { readFile as defaultReadFile } from 'node:fs/promises';
import path from 'node:path';

import { textToBlocks } from './layout.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_AI_OCR_MODEL = 'gpt-5.4-mini';

function mimeFromPath(filePath) {
  return path.extname(filePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
}

export function buildAiOcrRequest({ imageBase64, mime, language = 'es', model = DEFAULT_AI_OCR_MODEL }) {
  return {
    model,
    store: false,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              `Transcribe esta pagina de libro en idioma ${language}.`,
              'Devuelve solo el texto visible, sin inventar partes ilegibles.',
              'Conserva parrafos naturales y une palabras partidas por guion solo cuando sea claro.',
              'Incluye advertencias cuando haya texto borroso, cortado o dudoso.'
            ].join(' ')
          },
          {
            type: 'input_image',
            image_url: `data:${mime};base64,${imageBase64}`,
            detail: 'original'
          }
        ]
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'booksaver_ai_ocr',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string' },
            paragraphs: {
              type: 'array',
              items: { type: 'string' }
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1
            },
            warnings: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['text', 'paragraphs', 'confidence', 'warnings']
        }
      }
    }
  };
}

export function parseAiOcrResponse(payload) {
  const parsed = JSON.parse(payload.output_text || '{}');
  const paragraphs = Array.isArray(parsed.paragraphs) ? parsed.paragraphs : [];
  const text = String(parsed.text || paragraphs.join('\n\n')).trim();

  return {
    text,
    paragraphs,
    confidence: Math.round(Number(parsed.confidence || 0) * 1000) / 10,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String).filter(Boolean) : []
  };
}

export async function runAiOcr({
  imagePath,
  language,
  allowCloud,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.BOOKSAVER_AI_OCR_MODEL || DEFAULT_AI_OCR_MODEL,
  readFile = defaultReadFile,
  fetchImpl = globalThis.fetch
}) {
  if (!allowCloud) {
    throw new Error('El OCR avanzado con IA debe activarse de forma explicita para cada solicitud.');
  }
  if (!apiKey) {
    throw new Error('Configura OPENAI_API_KEY para usar OCR avanzado con IA.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Este runtime no tiene fetch disponible para llamar a OpenAI.');
  }

  const image = await readFile(imagePath);
  const body = buildAiOcrRequest({
    imageBase64: image.toString('base64'),
    mime: mimeFromPath(imagePath),
    language,
    model
  });
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`OpenAI devolvio HTTP ${response.status}.`);
  }

  const parsed = parseAiOcrResponse(await response.json());
  const blocks = parsed.paragraphs.length ? parsed.paragraphs.map((text) => ({
    type: 'paragraph',
    text,
    confidence: parsed.confidence
  })) : textToBlocks(parsed.text);

  return {
    id: `openai:${model}`,
    provider: 'openai',
    engine: 'ai-advanced',
    profile: 'vision-transcription',
    model,
    text: parsed.text,
    tsv: '',
    layout: {
      version: 1,
      source: 'openai-vision',
      page: {},
      textBounds: null,
      lines: [],
      blocks
    },
    language,
    warning: parsed.warnings.join(' ') || null,
    status: parsed.text ? 'ocr-complete' : 'ocr-error'
  };
}
```

- [ ] **Step 4: Route AI mode from OCR orchestrator**

Modify `src/lib/ocr.js`:

```js
import { runAiOcr } from './ai-ocr.js';
```

In `runOcr`, before local mode routing:

```js
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
```

- [ ] **Step 5: Run AI and OCR tests**

Run:

```sh
node --test tests/ai-ocr.test.js tests/ocr.test.js tests/ocr-quality.test.js
```

Expected: pass without making network calls.

- [ ] **Step 6: Commit**

```sh
git add src/lib/ai-ocr.js src/lib/ocr.js tests/ai-ocr.test.js tests/ocr.test.js
git commit -m "feat: add optional AI OCR adapter"
```

---

### Task 8: Backend OCR Options And Capability Reporting

**Files:**
- Modify: `src/server.js`
- Modify: `src/lib/ocr.js`
- Test: `tests/ocr.test.js`

- [ ] **Step 1: Add tests for capabilities**

Append to `tests/ocr.test.js`:

```js
import { summarizeOcrCapabilities } from '../src/lib/ocr.js';

test('summarizeOcrCapabilities keeps AI disabled without API key', () => {
  const capabilities = summarizeOcrCapabilities({
    platform: 'darwin',
    tesseractLanguages: ['spa'],
    hasOpenAiApiKey: false
  });

  assert.equal(capabilities.localImproved.available, true);
  assert.equal(capabilities.consensus.available, true);
  assert.equal(capabilities.aiAdvanced.available, false);
});

test('summarizeOcrCapabilities reports AI available only with API key', () => {
  const capabilities = summarizeOcrCapabilities({
    platform: 'darwin',
    tesseractLanguages: ['spa'],
    hasOpenAiApiKey: true
  });

  assert.equal(capabilities.aiAdvanced.available, true);
  assert.equal(capabilities.aiAdvanced.model, 'gpt-5.4-mini');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```sh
node --test tests/ocr.test.js
```

Expected: fail because `summarizeOcrCapabilities` does not exist.

- [ ] **Step 3: Implement capability summary**

Add to `src/lib/ocr.js`:

```js
export function summarizeOcrCapabilities({
  platform = process.platform,
  tesseractLanguages = [],
  hasOpenAiApiKey = Boolean(process.env.OPENAI_API_KEY),
  aiModel = process.env.BOOKSAVER_AI_OCR_MODEL || 'gpt-5.4-mini'
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
```

- [ ] **Step 4: Accept OCR options in server route**

Modify `src/server.js` route `POST /api/projects/:projectId/pages/:pageId/ocr`:

```js
if (request.method === 'POST' && parts.length === 6 && parts[5] === 'ocr') {
  const body = await readBody(request);
  sendJson(response, 200, {
    page: await store.runPageOcr(projectId, pageId, {
      mode: body.mode,
      allowCloud: body.allowCloud === true,
      aiModel: body.aiModel
    })
  });
  return;
}
```

Expose capabilities in the existing system/support endpoint by adding `ocrCapabilities` to its response. Use `inspectRuntimeSupport()` plus `summarizeOcrCapabilities()`.

- [ ] **Step 5: Run tests**

Run:

```sh
node --test tests/ocr.test.js tests/storage.test.js
```

Expected: pass.

- [ ] **Step 6: Commit**

```sh
git add src/server.js src/lib/ocr.js tests/ocr.test.js
git commit -m "feat: expose OCR mode capabilities"
```

---

### Task 9: UI Controls For OCR Modes

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`

- [ ] **Step 1: Add HTML controls in the editor header**

In `public/index.html`, near the existing `ocrButton`, add a compact mode selector:

```html
<label class="ocr-mode-control">
  Modo OCR
  <select id="ocrModeInput">
    <option value="local-improved">Local mejorado</option>
    <option value="consensus">Doble motor</option>
    <option value="ai-advanced">IA avanzada</option>
  </select>
</label>
```

Add an explicit AI confirmation dialog:

```html
<dialog id="aiOcrDialog">
  <form id="aiOcrForm" method="dialog">
    <h2>OCR avanzado con IA</h2>
    <p>
      BookSaver enviara esta pagina a OpenAI para mejorar la transcripcion.
      Usa este modo solo si aceptas que la imagen salga de tu equipo.
    </p>
    <div class="dialog-actions">
      <button id="cancelAiOcrButton" type="button" class="ghost">Cancelar</button>
      <button id="confirmAiOcrButton" type="submit">Enviar esta pagina</button>
    </div>
  </form>
</dialog>
```

- [ ] **Step 2: Wire mode state in `public/app.js`**

Add the element:

```js
ocrModeInput: document.querySelector('#ocrModeInput'),
aiOcrDialog: document.querySelector('#aiOcrDialog'),
aiOcrForm: document.querySelector('#aiOcrForm'),
cancelAiOcrButton: document.querySelector('#cancelAiOcrButton')
```

Add mode helper:

```js
function selectedOcrMode() {
  return els.ocrModeInput?.value || 'local-improved';
}

function aiOcrAvailable() {
  return Boolean(state.system?.ocrCapabilities?.aiAdvanced?.available);
}
```

Change `runOcrForPage()` request body:

```js
const mode = selectedOcrMode();
const allowCloud = mode === 'ai-advanced' ? await confirmAiOcrForPage() : false;
if (mode === 'ai-advanced' && !allowCloud) {
  showToast('OCR con IA cancelado.');
  return;
}

const { page: nextPage } = await api(
  `/api/projects/${state.project.id}/pages/${page.id}/ocr`,
  {
    method: 'POST',
    body: JSON.stringify({ mode, allowCloud })
  }
);
```

Add confirmation:

```js
function confirmAiOcrForPage() {
  if (!aiOcrAvailable()) {
    showToast('Configura OPENAI_API_KEY para usar OCR avanzado con IA.');
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      els.aiOcrForm.removeEventListener('submit', onSubmit);
      els.cancelAiOcrButton.removeEventListener('click', onCancel);
    };
    const onSubmit = (event) => {
      event.preventDefault();
      cleanup();
      els.aiOcrDialog.close();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      els.aiOcrDialog.close();
      resolve(false);
    };

    els.aiOcrForm.addEventListener('submit', onSubmit);
    els.cancelAiOcrButton.addEventListener('click', onCancel);
    els.aiOcrDialog.showModal();
  });
}
```

- [ ] **Step 3: Disable unavailable modes**

In `render()`, use system capabilities:

```js
const capabilities = state.system?.ocrCapabilities || {};
for (const option of els.ocrModeInput.options) {
  if (option.value === 'consensus') {
    option.disabled = !capabilities.consensus?.available;
  }
  if (option.value === 'ai-advanced') {
    option.disabled = !capabilities.aiAdvanced?.available;
  }
}
```

- [ ] **Step 4: Add minimal styles**

In `public/styles.css`:

```css
.ocr-mode-control {
  display: grid;
  gap: 0.25rem;
  min-width: 10rem;
}

.ocr-mode-control select {
  min-height: 2.4rem;
}
```

- [ ] **Step 5: Manual browser verification**

Run:

```sh
npm start
```

Expected:

- The editor shows `Modo OCR`.
- `Local mejorado` is selectable.
- `Doble motor` is disabled unless Apple Vision and Tesseract are available.
- `IA avanzada` is disabled unless `OPENAI_API_KEY` is configured.
- Selecting `IA avanzada` shows the explicit confirmation dialog before any request.

- [ ] **Step 6: Commit**

```sh
git add public/index.html public/app.js public/styles.css
git commit -m "feat: add OCR mode controls"
```

---

### Task 10: Batch OCR Behavior

**Files:**
- Modify: `public/app.js`
- Modify: `src/server.js`
- Test: `tests/storage.test.js`

- [ ] **Step 1: Keep batch local-only by default**

Change `runBatchOcr()` so batch requests send the selected mode only when the mode is local:

```js
const mode = selectedOcrMode();
if (mode === 'ai-advanced') {
  showToast('El OCR con IA se ejecuta pagina a pagina para confirmar cada envio.');
  return;
}
```

Request:

```js
const { page: nextPage } = await api(
  `/api/projects/${state.project.id}/pages/${candidate.id}/ocr`,
  {
    method: 'POST',
    body: JSON.stringify({ mode, allowCloud: false })
  }
);
```

- [ ] **Step 2: Add server-side guard**

In `src/server.js`, reject accidental cloud batch calls by requiring `allowCloud === true` only for direct page OCR requests. The existing route remains page-scoped, so this is mostly defensive:

```js
if (body.mode === 'ai-advanced' && body.allowCloud !== true) {
  throw Object.assign(new Error('El OCR con IA requiere confirmacion explicita.'), { statusCode: 400 });
}
```

- [ ] **Step 3: Update storage test for explicit AI guard**

Add to `tests/storage.test.js`:

```js
test('runPageOcr passes allowCloud false unless explicitly requested', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root, {
    ocrRunner: async (_imagePath, _language, options) => {
      assert.equal(options.allowCloud, false);
      return {
        text: 'Texto local.',
        tsv: '',
        layout: { lines: [], blocks: [] },
        language: 'es',
        engine: 'tesseract',
        warning: null,
        status: 'ocr-complete',
        ocrStrategy: 'local-improved',
        ocrProvider: 'local',
        ocrModel: null,
        ocrConfidence: 80,
        ocrQualityScore: 70,
        ocrNeedsReview: false,
        candidates: []
      };
    }
  });

  try {
    const project = await store.createProject({ title: 'Libro', author: '', language: 'es', notes: '' });
    const page = await store.addPage(project.id, ONE_PIXEL_PNG);

    await store.runPageOcr(project.id, page.id, { mode: 'local-improved', allowCloud: false });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 4: Run tests and manual check**

Run:

```sh
node --test tests/storage.test.js
npm start
```

Expected: tests pass and batch OCR refuses `IA avanzada` with a Spanish toast.

- [ ] **Step 5: Commit**

```sh
git add public/app.js src/server.js tests/storage.test.js
git commit -m "feat: keep batch AI OCR explicit"
```

---

### Task 11: Export Warnings And Review Signals

**Files:**
- Modify: `src/lib/storage.js`
- Modify: `public/app.js`
- Test: `tests/storage.test.js`

- [ ] **Step 1: Add export warning test**

Append to `tests/storage.test.js`:

```js
test('inspectExport warns about low-confidence OCR pages', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'booksaver-test-'));
  const store = new LibraryStore(root);

  try {
    const project = await store.createProject({ title: 'Libro', author: '', language: 'es', notes: '' });
    await store.addPage(project.id, ONE_PIXEL_PNG);
    const pages = await store.readPages(project.id);
    pages[0] = {
      ...pages[0],
      status: 'ocr-complete',
      reviewed: false,
      ocrNeedsReview: true,
      ocrQualityScore: 41,
      ocrWarning: null
    };
    await store.writePages(project.id, pages);

    const check = await store.inspectExport(project.id);

    assert.ok(check.warnings.some((warning) => warning.code === 'low-confidence-ocr'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```sh
node --test tests/storage.test.js
```

Expected: fail because `inspectExport` does not emit `low-confidence-ocr`.

- [ ] **Step 3: Add export warning**

In `src/lib/storage.js`, inside `inspectExport`, collect pages with `page.ocrNeedsReview && !page.reviewed`:

```js
const lowConfidenceOcrPages = [];

// inside page loop
if (needsOcr && !reviewed && page.ocrNeedsReview) {
  lowConfidenceOcrPages.push(page.number);
}

// after existing OCR warnings
if (lowConfidenceOcrPages.length) {
  warnings.push({
    code: 'low-confidence-ocr',
    severity: 'warning',
    count: lowConfidenceOcrPages.length,
    pages: lowConfidenceOcrPages,
    message: `${lowConfidenceOcrPages.length} ${lowConfidenceOcrPages.length === 1 ? 'pagina tiene OCR de baja confianza' : 'paginas tienen OCR de baja confianza'} (pags. ${summarizePageNumbers(lowConfidenceOcrPages)}).`
  });
}
```

Update `public/app.js` status copy so page status can show:

```js
if (page.ocrNeedsReview && !page.reviewed) {
  return `${baseStatus} - baja confianza`;
}
```

- [ ] **Step 4: Run tests**

Run:

```sh
node --test tests/storage.test.js
```

Expected: pass.

- [ ] **Step 5: Commit**

```sh
git add src/lib/storage.js public/app.js tests/storage.test.js
git commit -m "feat: warn on low-confidence OCR"
```

---

### Task 12: Documentation And Privacy Copy

**Files:**
- Modify: `README.md`
- Modify: `docs/README.en.md`

- [ ] **Step 1: Document OCR modes in Spanish README**

Add under `## OCR y formato` in `README.md`:

```md
### Modos OCR

BookSaver usa OCR local por defecto:

- **Local mejorado**: prueba perfiles locales y elige el resultado con mejor confianza.
- **Doble motor**: si Apple Vision y Tesseract estan disponibles, compara ambos y crea un resultado de consenso.
- **IA avanzada**: opcion manual para enviar una pagina a OpenAI cuando aceptas que esa imagen salga de tu equipo.

El modo IA requiere `OPENAI_API_KEY` en el entorno del servidor local. BookSaver nunca expone esa clave en el navegador y envia cada pagina solo despues de una confirmacion explicita.
```

- [ ] **Step 2: Document English README**

Add equivalent text to `docs/README.en.md`:

```md
### OCR modes

BookSaver keeps local OCR as the default:

- **Improved local**: tries local profiles and keeps the highest-confidence result.
- **Dual engine**: when Apple Vision and Tesseract are both available, compares both engines and builds a consensus result.
- **Advanced AI**: a manual option that sends one page to OpenAI only after explicit confirmation.

AI OCR requires `OPENAI_API_KEY` in the local server environment. BookSaver never exposes that key in browser code and sends a page only after the user confirms the network request.
```

- [ ] **Step 3: Run markdown grep checks**

Run:

```sh
rg -n "OPENAI_API_KEY|IA avanzada|Doble motor|Improved local" README.md docs/README.en.md
```

Expected: both READMEs include the mode descriptions.

- [ ] **Step 4: Commit**

```sh
git add README.md docs/README.en.md
git commit -m "docs: document OCR reliability modes"
```

---

### Task 13: End-To-End Verification

**Files:**
- No new files.

- [ ] **Step 1: Run automated tests**

Run:

```sh
node --test
```

Expected: all tests pass.

- [ ] **Step 2: Parse Swift helpers on macOS**

Run on macOS:

```sh
swiftc -parse scripts/vision-ocr.swift
swiftc -parse scripts/macos-ocr-preprocess.swift
```

Expected: both commands pass.

- [ ] **Step 3: Manual local OCR check**

Run:

```sh
npm start
```

Open `http://127.0.0.1:5173`, create a test book, import or capture one page, select `Local mejorado`, and run OCR.

Expected:

- OCR completes.
- The text area is populated.
- Page metadata shows local provenance.
- Export review warns only if confidence is low.

- [ ] **Step 4: Manual consensus check**

Install Tesseract with Spanish data on macOS, restart BookSaver, select `Doble motor`, and run OCR on one page.

Expected:

- The mode is enabled.
- Candidate summaries include Apple Vision and Tesseract.
- The selected result has `ocrStrategy: "consensus"` or a selected candidate from that mode.

- [ ] **Step 5: Manual AI guard check without API key**

Start BookSaver without `OPENAI_API_KEY`, select the editor.

Expected:

- `IA avanzada` is disabled.
- No network request is possible from the UI.

- [ ] **Step 6: Manual AI check with API key**

Run:

```sh
OPENAI_API_KEY="$OPENAI_API_KEY" npm start
```

Select one test page, choose `IA avanzada`, confirm the dialog, and run OCR.

Expected:

- The confirmation appears before the request.
- The page is sent once.
- The returned text is editable.
- Metadata shows `ocrProvider: "openai"` and `ocrModel`.
- Batch OCR still refuses AI mode.

---

## Rollout Notes

- Ship local improved OCR and consensus first. They preserve the local-first promise and improve quality without privacy tradeoffs.
- Keep AI OCR behind a visible manual action even after it is stable.
- Do not enable AI OCR from batch mode until there is a separate batch confirmation screen showing page count and privacy/cost implications.
- Do not store API keys in project files or browser local storage.
- Do not commit real book captures or generated EPUBs while testing.

## Self-Review

- Spec coverage: The plan covers local improved OCR, dual-engine consensus, optional AI OCR, persistence, UI, export warnings, documentation, and verification.
- Placeholder scan: The plan contains no unresolved placeholder markers or vague "add tests later" steps.
- Type consistency: The plan uses consistent names for `ocrStrategy`, `ocrProvider`, `ocrModel`, `ocrConfidence`, `ocrQualityScore`, `ocrNeedsReview`, and `ocrCandidates`.
- Scope check: The work is large but decomposed into independently commit-able tasks. Implementation can stop after local improved OCR and still leave the app usable.
- Review corrections applied: Storage test snippets use the repository's current `LibraryStore` setup and `ONE_PIXEL_PNG` fixture, the Swift helper has one consistent argument contract, and the manual AI verification command reads a key from the environment without placing a fake secret in the plan.

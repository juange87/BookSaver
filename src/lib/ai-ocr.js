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
  const blocks = parsed.paragraphs.length
    ? parsed.paragraphs.map((text) => ({
        type: 'paragraph',
        text,
        confidence: parsed.confidence
      }))
    : textToBlocks(parsed.text);

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

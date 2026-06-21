export const DEFAULT_ADVANCED_OCR_PROVIDER = 'openai';
export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const ADAPTERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-5.4-mini',
    defaultBaseUrl: OPENAI_RESPONSES_URL,
    requiresBaseUrl: false,
    requiresExplicitConfirmation: true,
    exposesApiKey: false
  },
  {
    id: 'openai-compatible',
    label: 'Compatible OpenAI',
    defaultModel: 'vision-ocr',
    defaultBaseUrl: '',
    requiresBaseUrl: true,
    requiresExplicitConfirmation: true,
    exposesApiKey: false
  }
];

function adapterById(provider) {
  return ADAPTERS.find((adapter) => adapter.id === provider) || ADAPTERS[0];
}

function cleanBaseUrl(value, fallback = '') {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

export function listAdvancedOcrAdapters() {
  return ADAPTERS.map((adapter) => ({ ...adapter }));
}

export function normalizeAdvancedOcrAdapter(input = {}) {
  const provider = String(input.provider || input.adapter || DEFAULT_ADVANCED_OCR_PROVIDER).trim();
  const adapter = adapterById(provider);
  const baseUrl = cleanBaseUrl(input.baseUrl, adapter.defaultBaseUrl);
  const model = String(input.model || adapter.defaultModel).trim() || adapter.defaultModel;

  return {
    provider: adapter.id,
    label: adapter.label,
    model,
    baseUrl,
    requiresBaseUrl: adapter.requiresBaseUrl,
    requiresExplicitConfirmation: adapter.requiresExplicitConfirmation
  };
}

export function publicAdvancedOcrSettings(input = {}) {
  const normalized = normalizeAdvancedOcrAdapter(input);
  return {
    ...normalized,
    adapters: listAdvancedOcrAdapters()
  };
}

export function buildAdvancedOcrConfirmation(input = {}) {
  const adapter = normalizeAdvancedOcrAdapter(input);
  const pageCount = Math.max(1, Math.round(Number(input.pageCount || 1)));
  const pageLabel = pageCount === 1 ? 'esta pagina' : `${pageCount} paginas`;

  return {
    requiresConfirmation: true,
    sendsImagesOffDevice: true,
    provider: adapter.provider,
    providerLabel: adapter.label,
    model: adapter.model,
    endpointLabel: adapter.baseUrl || 'Endpoint del proveedor',
    pageCount,
    privacyNote: `BookSaver enviara ${pageLabel} al proveedor OCR; la imagen sale de tu equipo.`,
    costNote:
      pageCount === 1
        ? 'Esta llamada puede tener coste segun tu proveedor, modelo y contrato.'
        : `Estas ${pageCount} llamadas pueden tener coste segun tu proveedor, modelo y contrato.`
  };
}

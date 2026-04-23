function selectElementText(element, documentRef) {
  if (!element || !documentRef?.createRange || !documentRef?.getSelection) {
    return false;
  }

  const range = documentRef.createRange();
  range.selectNodeContents(element);
  const selection = documentRef.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function copyWithExecCommand(value, documentRef) {
  if (!documentRef?.createElement || !documentRef?.body || !documentRef?.execCommand) {
    return false;
  }

  const textarea = documentRef.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';

  documentRef.body.append(textarea);
  textarea.focus();
  textarea.select();

  try {
    return Boolean(documentRef.execCommand('copy'));
  } finally {
    documentRef.body.removeChild(textarea);
  }
}

export async function copyTextWithFallback(value, options = {}) {
  const text = String(value || '');
  const navigatorRef = options.navigator || globalThis.navigator;
  const documentRef = options.document || globalThis.document;

  if (!text) {
    return { copied: false, method: null, selected: false };
  }

  try {
    if (navigatorRef?.clipboard?.writeText) {
      await navigatorRef.clipboard.writeText(text);
      return { copied: true, method: 'clipboard', selected: false };
    }
  } catch {
    // Some embedded browsers expose the Clipboard API but reject writes.
  }

  if (copyWithExecCommand(text, documentRef)) {
    return { copied: true, method: 'execCommand', selected: false };
  }

  const selected = selectElementText(options.fallbackElement, documentRef);
  return { copied: false, method: null, selected };
}

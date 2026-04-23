import assert from 'node:assert/strict';
import { test } from 'node:test';

import { copyTextWithFallback } from '../public/clipboard.js';

function createFakeDocument({ execResult = true } = {}) {
  const calls = [];
  const selection = {
    removeAllRanges() {
      calls.push(['removeAllRanges']);
    },
    addRange(range) {
      calls.push(['addRange', range]);
    }
  };

  return {
    calls,
    body: {
      append(element) {
        calls.push(['append', element.tagName]);
      },
      removeChild(element) {
        calls.push(['removeChild', element.tagName]);
      }
    },
    createElement(tagName) {
      return {
        tagName,
        style: {},
        value: '',
        setAttribute(name, value) {
          calls.push(['setAttribute', name, value]);
        },
        focus() {
          calls.push(['focus', tagName]);
        },
        select() {
          calls.push(['select', tagName]);
        }
      };
    },
    createRange() {
      const range = {
        selectedId: null,
        selectNodeContents(element) {
          range.selectedId = element.id;
          calls.push(['selectNodeContents', element.id]);
        }
      };
      return range;
    },
    execCommand(command) {
      calls.push(['execCommand', command]);
      return execResult;
    },
    getSelection() {
      return {
        removeAllRanges: selection.removeAllRanges,
        addRange(range) {
          calls.push(['addRange', range.selectedId]);
        }
      };
    }
  };
}

test('copyTextWithFallback uses the Clipboard API when available', async () => {
  const writes = [];
  const result = await copyTextWithFallback('http://example.test/mobile/token', {
    navigator: {
      clipboard: {
        async writeText(value) {
          writes.push(value);
        }
      }
    },
    document: createFakeDocument()
  });

  assert.deepEqual(writes, ['http://example.test/mobile/token']);
  assert.deepEqual(result, { copied: true, method: 'clipboard', selected: false });
});

test('copyTextWithFallback falls back to execCommand when clipboard permission fails', async () => {
  const document = createFakeDocument({ execResult: true });
  const result = await copyTextWithFallback('http://example.test/mobile/token', {
    navigator: {
      clipboard: {
        async writeText() {
          throw new Error('NotAllowedError');
        }
      }
    },
    document
  });

  assert.deepEqual(result, { copied: true, method: 'execCommand', selected: false });
  assert.deepEqual(
    document.calls.filter(([name]) => ['append', 'select', 'execCommand', 'removeChild'].includes(name)),
    [
      ['append', 'textarea'],
      ['select', 'textarea'],
      ['execCommand', 'copy'],
      ['removeChild', 'textarea']
    ]
  );
});

test('copyTextWithFallback selects the visible URL when copy is blocked', async () => {
  const document = createFakeDocument({ execResult: false });
  const fallbackElement = { id: 'mobileCaptureUrl' };
  const result = await copyTextWithFallback('http://example.test/mobile/token', {
    navigator: {
      clipboard: {
        async writeText() {
          throw new Error('NotAllowedError');
        }
      }
    },
    document,
    fallbackElement
  });

  assert.deepEqual(result, { copied: false, method: null, selected: true });
  assert.deepEqual(
    document.calls.filter(([name]) =>
      ['selectNodeContents', 'removeAllRanges', 'addRange'].includes(name)
    ),
    [
      ['selectNodeContents', 'mobileCaptureUrl'],
      ['removeAllRanges'],
      ['addRange', 'mobileCaptureUrl']
    ]
  );
});

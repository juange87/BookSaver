export function epubcheckCommand(filePath) {
  return {
    command: 'epubcheck',
    args: [filePath]
  };
}

function cleanOutputLines(stdout = '', stderr = '') {
  return `${stdout || ''}\n${stderr || ''}`
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(validating|no errors or warnings detected)/iu.test(line));
}

function severityFromLine(line) {
  if (/^(fatal|error)\b/iu.test(line)) {
    return 'error';
  }
  if (/^warning\b/iu.test(line)) {
    return 'warning';
  }
  return 'info';
}

export function parseEpubcheckResult({ exitCode = 0, stdout = '', stderr = '' } = {}) {
  const messages = cleanOutputLines(stdout, stderr).map((line) => ({
    severity: severityFromLine(line),
    message: line
  }));
  const errorCount = messages.filter((message) => message.severity === 'error').length;
  const warningCount = messages.filter((message) => message.severity === 'warning').length;

  if (exitCode !== 0 && errorCount === 0 && warningCount === 0) {
    messages.push({
      severity: 'error',
      message: 'EPUBCheck terminó con errores, pero no devolvió detalles legibles.'
    });
  }

  return {
    valid: exitCode === 0 && messages.every((message) => message.severity !== 'error'),
    exitCode,
    errorCount: messages.filter((message) => message.severity === 'error').length,
    warningCount,
    messages
  };
}

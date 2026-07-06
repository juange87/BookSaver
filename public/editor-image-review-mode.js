export function buildImageReviewModeState({ expanded = false, hasPage = false } = {}) {
  const active = Boolean(expanded && hasPage);

  return {
    expanded: active,
    workspaceClass: active ? 'large-page-mode' : '',
    buttonText: active ? 'Cerrar página grande' : 'Ver página grande',
    buttonAriaPressed: active ? 'true' : 'false',
    buttonDisabled: !hasPage
  };
}

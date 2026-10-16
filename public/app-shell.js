export const WORKSPACE_VIEWS = ['capture', 'editor', 'reading'];

export function resolveView(requestedView, { hasProject = false } = {}) {
  if (!hasProject) {
    return 'library';
  }
  return WORKSPACE_VIEWS.includes(requestedView) ? requestedView : 'library';
}

export function buildShellState({ view, project = null, busy = false, system = null } = {}) {
  const resolvedView = resolveView(view, { hasProject: Boolean(project) });
  const pageCount = project?.pages?.length || 0;

  return {
    view: resolvedView,
    topbar: resolvedView === 'library' ? 'library' : 'workspace',
    exportDisabled: !project || pageCount === 0 || Boolean(busy),
    bookStatus: project ? `${pageCount} ${pageCount === 1 ? 'página' : 'páginas'}` : 'Sin libro abierto',
    settingsAlert: Boolean(system?.update?.available)
  };
}

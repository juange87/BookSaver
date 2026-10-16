export function summarizeLibraryDashboard(projects = []) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const bookCount = safeProjects.length;
  const pageCount = safeProjects.reduce((total, project) => total + Number(project.progress?.pageCount || 0), 0);
  const reviewedTotal = safeProjects.reduce(
    (total, project) => total + Number(project.progress?.reviewedPercent || 0),
    0
  );
  const pendingProblemCount = safeProjects.reduce(
    (total, project) => total + Number(project.progress?.pendingProblemCount || 0),
    0
  );
  const readyCount = safeProjects.filter((project) => project.progress?.exportStatus === 'ready').length;
  const attentionCount = safeProjects.filter(
    (project) => project.progress?.exportStatus === 'needs-attention'
  ).length;

  return {
    bookCount,
    pageCount,
    averageReviewedPercent: bookCount ? Math.round(reviewedTotal / bookCount) : 0,
    pendingProblemCount,
    readyCount,
    attentionCount
  };
}

export function progressStatusLabel(status) {
  if (status === 'exported') {
    return 'Exportado';
  }
  if (status === 'ready') {
    return 'Listo para exportar';
  }
  if (status === 'needs-attention') {
    return 'Revisar antes de exportar';
  }
  if (status === 'empty') {
    return 'Sin páginas';
  }
  return 'En progreso';
}

export function filterLibraryProjects(projects = [], filter = 'all') {
  const safeProjects = Array.isArray(projects) ? projects : [];
  if (filter === 'capture') {
    return safeProjects.filter((project) => project.progress?.exportStatus === 'empty');
  }
  if (filter === 'review') {
    return safeProjects.filter((project) => project.progress?.exportStatus === 'needs-attention');
  }
  if (filter === 'ready') {
    return safeProjects.filter((project) => project.progress?.exportStatus === 'ready');
  }
  if (filter === 'exported') {
    return safeProjects.filter((project) => project.progress?.exportStatus === 'exported');
  }
  return safeProjects;
}

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function formatLibrarySummaryLine(summary = {}) {
  return [
    plural(Number(summary.bookCount || 0), 'libro', 'libros'),
    plural(Number(summary.pageCount || 0), 'página', 'páginas'),
    `${Number(summary.averageReviewedPercent || 0)} % revisado`,
    plural(Number(summary.pendingProblemCount || 0), 'problema', 'problemas')
  ].join(' · ');
}

export function libraryCardCover(project = {}) {
  const mode = project.cover?.mode;
  if (!project.id || !mode || mode === 'none') {
    return { url: null };
  }
  const version = project.cover.updatedAt || project.updatedAt || '';
  return {
    url: `/api/projects/${encodeURIComponent(project.id)}/cover/image?${encodeURIComponent(version)}`
  };
}

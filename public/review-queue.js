const EMPTY_REVIEW_QUEUE_MESSAGE = 'No quedan problemas pendientes en la cola de revision.';

function reviewQueueItems(queue) {
  return Array.isArray(queue?.items) ? queue.items : [];
}

export function reviewProblemStatusText(item) {
  if (!item) {
    return EMPTY_REVIEW_QUEUE_MESSAGE;
  }

  return `Siguiente problema: pagina ${item.page}. ${item.reason || 'Revisa esta pagina.'}`;
}

export function chooseNextReviewProblem(queue, currentPageId = null) {
  const items = reviewQueueItems(queue);

  if (!items.length) {
    return {
      status: 'empty',
      item: null,
      message: EMPTY_REVIEW_QUEUE_MESSAGE
    };
  }

  const currentIndex = items.findIndex((item) => item.pageId === currentPageId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
  const item = items[nextIndex];

  return {
    status: 'found',
    item,
    message: reviewProblemStatusText(item)
  };
}

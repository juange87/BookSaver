// public/ui-popover.js
const openPopovers = new Set();

export function setupPopover(trigger, panel, { onOpen } = {}) {
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  if (panel.id) {
    trigger.setAttribute('aria-controls', panel.id);
  }
  panel.hidden = true;

  const controller = {
    isOpen: () => !panel.hidden,
    open() {
      closeAllPopovers();
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      openPopovers.add(controller);
      onOpen?.();
      const firstFocusable = panel.querySelector(
        'input:not([disabled]), select:not([disabled]), button:not([disabled]), [href]'
      );
      firstFocusable?.focus();
    },
    close({ restoreFocus = true } = {}) {
      if (panel.hidden) {
        return;
      }
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      openPopovers.delete(controller);
      if (restoreFocus) {
        trigger.focus();
      }
    },
    contains: (node) => trigger.contains(node) || panel.contains(node)
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    controller.isOpen() ? controller.close() : controller.open();
  });

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // Evita que un <dialog> padre se cierre con el mismo Esc.
      event.preventDefault();
      event.stopPropagation();
      controller.close();
    }
  });

  return controller;
}

export function closeAllPopovers() {
  for (const controller of [...openPopovers]) {
    controller.close({ restoreFocus: false });
  }
}

document.addEventListener('click', (event) => {
  for (const controller of [...openPopovers]) {
    if (!controller.contains(event.target)) {
      controller.close({ restoreFocus: false });
    }
  }
});

export function openDrawer(dialogId, { section } = {}) {
  const dialog = document.getElementById(dialogId);
  if (!dialog) {
    return null;
  }
  closeAllPopovers();
  if (!dialog.open) {
    dialog.showModal();
  }
  if (section) {
    const details = document.getElementById(section);
    if (details instanceof HTMLDetailsElement) {
      details.open = true;
    }
    details?.scrollIntoView({ block: 'start' });
    return details;
  }
  return dialog;
}

export function setupDrawers(root = document) {
  for (const trigger of root.querySelectorAll('[data-open-drawer]')) {
    trigger.addEventListener('click', () => openDrawer(trigger.dataset.openDrawer));
  }
  for (const closer of root.querySelectorAll('[data-close-drawer]')) {
    closer.addEventListener('click', () => closer.closest('dialog')?.close());
  }
  for (const dialog of root.querySelectorAll('dialog.drawer')) {
    // Clic en el backdrop: el target es el propio <dialog>.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
  }
}

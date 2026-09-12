// Auto-Hide / Cinema Mode UI handler for mouse inactivity
let idleTimeout = null;

export function initIdleDetection() {
  const mainArea = document.getElementById('main-area');
  const appSection = document.getElementById('app-section');
  if (!mainArea || !appSection) return;

  function resetIdleTimer() {
    const fadeables = document.querySelectorAll('.ui-fadeable');
    fadeables.forEach(el => el.classList.remove('opacity-0', 'pointer-events-none'));
    mainArea.style.cursor = 'default';

    clearTimeout(idleTimeout);

    if (!appSection.classList.contains('hidden-section')) {
      idleTimeout = setTimeout(() => {
        let isHovering = false;
        fadeables.forEach(el => {
          if (el.matches(':hover')) isHovering = true;
        });

        if (!isHovering) {
          fadeables.forEach(el => el.classList.add('opacity-0', 'pointer-events-none'));
          mainArea.style.cursor = 'none';
        }
      }, 3000);
    }
  }

  mainArea.addEventListener('mousemove', resetIdleTimer);
  mainArea.addEventListener('click', resetIdleTimer);
  mainArea.addEventListener('mouseleave', () => {
    clearTimeout(idleTimeout);
    const fadeables = document.querySelectorAll('.ui-fadeable');
    fadeables.forEach(el => el.classList.add('opacity-0', 'pointer-events-none'));
    mainArea.style.cursor = 'default';
  });
}

// Screen & Window selection modal for FakeDC Desktop
let currentSources = [];
let selectedSourceId = null;
let currentTab = 'screens'; // 'screens' | 'windows'

export function initScreenPicker() {
  if (!window.desktopApp?.onOpenScreenPicker) return;

  const modal = document.getElementById('screen-picker-modal');
  const closeBtn = document.getElementById('screen-picker-close-btn');
  const cancelBtn = document.getElementById('screen-picker-cancel-btn');
  const confirmBtn = document.getElementById('screen-picker-confirm-btn');
  const tabScreens = document.getElementById('picker-tab-screens');
  const tabWindows = document.getElementById('picker-tab-windows');
  const grid = document.getElementById('screen-picker-grid');

  if (!modal || !closeBtn || !cancelBtn || !confirmBtn || !tabScreens || !tabWindows || !grid) return;

  function closeModal(cancelled = true) {
    modal.classList.add('hidden-section');
    if (cancelled && window.desktopApp?.cancelSource) {
      window.desktopApp.cancelSource();
    }
  }

  function renderSources() {
    grid.innerHTML = '';
    const filtered = currentSources.filter((s) =>
      currentTab === 'screens' ? s.isScreen : !s.isScreen
    );

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-2 py-10 text-center text-zinc-400 text-sm">
          Nenhuma ${currentTab === 'screens' ? 'tela' : 'janela de jogo ou app'} encontrada.
        </div>
      `;
      confirmBtn.disabled = true;
      return;
    }

    // Default selection to first item if current selection not in filtered list
    if (!filtered.some((s) => s.id === selectedSourceId)) {
      selectedSourceId = filtered[0].id;
    }
    confirmBtn.disabled = false;

    filtered.forEach((source) => {
      const isSelected = source.id === selectedSourceId;
      const card = document.createElement('div');
      card.className = `cursor-pointer rounded-xl overflow-hidden border-2 transition-all p-2 flex flex-col gap-2 bg-discord-main/60 hover:bg-discord-main ${
        isSelected
          ? 'border-discord-blurple ring-2 ring-discord-blurple/50 shadow-lg shadow-discord-blurple/20'
          : 'border-transparent hover:border-zinc-700'
      }`;

      card.innerHTML = `
        <div class="w-full aspect-video bg-black/60 rounded-lg overflow-hidden flex items-center justify-center relative">
          <img src="${source.thumbnail}" alt="${source.name}" class="w-full h-full object-contain" />
        </div>
        <div class="flex items-center gap-2 px-1">
          ${
            source.appIcon
              ? `<img src="${source.appIcon}" class="w-4 h-4 shrink-0 rounded" />`
              : `<svg class="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`
          }
          <span class="text-xs font-medium text-white truncate" title="${source.name}">${source.name}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        selectedSourceId = source.id;
        renderSources();
      });

      grid.appendChild(card);
    });
  }

  function setTab(tab) {
    currentTab = tab;
    if (tab === 'screens') {
      tabScreens.className = 'pb-3 text-sm font-semibold border-b-2 border-discord-blurple text-white transition-colors';
      tabWindows.className = 'pb-3 text-sm font-semibold border-b-2 border-transparent text-zinc-400 hover:text-zinc-200 transition-colors';
    } else {
      tabWindows.className = 'pb-3 text-sm font-semibold border-b-2 border-discord-blurple text-white transition-colors';
      tabScreens.className = 'pb-3 text-sm font-semibold border-b-2 border-transparent text-zinc-400 hover:text-zinc-200 transition-colors';
    }
    renderSources();
  }

  tabScreens.addEventListener('click', () => setTab('screens'));
  tabWindows.addEventListener('click', () => setTab('windows'));

  closeBtn.addEventListener('click', () => closeModal(true));
  cancelBtn.addEventListener('click', () => closeModal(true));

  confirmBtn.addEventListener('click', () => {
    if (selectedSourceId && window.desktopApp?.selectSource) {
      window.desktopApp.selectSource(selectedSourceId);
      closeModal(false);
    }
  });

  // Listen for Electron trigger
  window.desktopApp.onOpenScreenPicker(async () => {
    try {
      currentSources = await window.desktopApp.getSources();
      modal.classList.remove('hidden-section');
      setTab('screens');
    } catch (e) {
      console.error('Erro ao abrir seletor de telas:', e);
      closeModal(true);
    }
  });
}

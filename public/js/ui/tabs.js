import { state } from '../state.js';

export function initTabs() {
  const tabCreate = document.getElementById('tab-create');
  const tabJoin = document.getElementById('tab-join');
  const createSection = document.getElementById('create-section');
  const joinSection = document.getElementById('join-section');
  const actionBtn = document.getElementById('action-btn');

  if (!tabCreate || !tabJoin || !createSection || !joinSection || !actionBtn) return;

  tabCreate.addEventListener('click', () => {
    state.currentTab = 'create';
    tabCreate.className = 'flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 bg-zinc-600 text-white shadow';
    tabJoin.className = 'flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 text-zinc-400 hover:text-zinc-200';
    createSection.classList.remove('hidden-section');
    joinSection.classList.add('hidden-section');
    actionBtn.innerText = 'Criar Sala';
  });

  tabJoin.addEventListener('click', () => {
    state.currentTab = 'join';
    tabJoin.className = 'flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 bg-zinc-600 text-white shadow';
    tabCreate.className = 'flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 text-zinc-400 hover:text-zinc-200';
    joinSection.classList.remove('hidden-section');
    createSection.classList.add('hidden-section');
    actionBtn.innerText = 'Conectar à Sala';
  });
}

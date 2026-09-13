import { state } from './state.js';
import { encryptMessage, decryptMessage } from './crypto.js';

export function addMessage(user, msg) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const div = document.createElement('div');
  div.className = 'bg-faketz-tertiary p-3 rounded-xl text-sm break-words border border-white/5 shadow-sm';

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `<div class="flex items-baseline gap-2 mb-1"><strong class="text-white font-semibold">${user}</strong><span class="text-[10.5px] text-zinc-500 font-medium">${time}</span></div><p class="text-zinc-300 leading-relaxed">${msg}</p>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

export async function onChatMessage(data) {
  const decryptedMsg = await decryptMessage(data.message, state.chatCryptoKey);
  addMessage(data.username, decryptedMsg);
}

export function initChat() {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  if (!chatForm || !chatInput) return;

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (msg) {
      addMessage('Você', msg);

      // Encrypt message end-to-end
      const encryptedMsg = await encryptMessage(msg, state.chatCryptoKey);
      if (state.socket) {
        state.socket.emit('chat-message', encryptedMsg);
      }

      chatInput.value = '';
    }
  });
}

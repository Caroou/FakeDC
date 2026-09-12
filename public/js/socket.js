import { state } from './state.js';
import { addMessage, onChatMessage } from './chat.js';
import { createPeerConnection, handleSignal } from './webrtc/peer.js';
import { removeVideo } from './ui/mediaRenderer.js';

export function initSocketClient() {
  const socket = io('/');
  state.socket = socket;

  socket.on('user-connected', (userId, newUsername) => {
    addMessage('Sistema', `${newUsername} entrou na sala.`);
    createPeerConnection(userId, newUsername);
  });

  socket.on('user-disconnected', (userId) => {
    if (state.peers[userId]) {
      const leavingName = state.peers[userId].username || 'Um usuário';
      state.peers[userId].pc.close();
      delete state.peers[userId];
      removeVideo(userId);
      addMessage('Sistema', `${leavingName} saiu da sala.`);
    }
  });

  socket.on('chat-message', onChatMessage);

  socket.on('user-muted', (userId, isMuted) => {
    const allMuteInds = [
      document.getElementById(`mute-indicator-${userId}`),
      document.getElementById(`mute-indicator-${userId}-screen`)
    ];
    allMuteInds.forEach((el) => {
      if (el) el.style.display = isMuted ? 'flex' : 'none';
    });
  });

  socket.on('signal', handleSignal);

  return socket;
}

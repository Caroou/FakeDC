import { state } from '../state.js';

let audioContextInstance = null;
let speakingInterval = null;

export function getAudioContext() {
  if (!audioContextInstance && (window.AudioContext || window.webkitAudioContext)) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContextInstance = new AudioCtx();
  }
  return audioContextInstance;
}

export function initSpeakingDetector() {
  const audioContext = getAudioContext();
  if (!audioContext) return;

  if (speakingInterval) clearInterval(speakingInterval);

  speakingInterval = setInterval(() => {
    for (const userId in state.peers) {
      const peer = state.peers[userId];
      if (peer && peer.analyser) {
        const dataArray = new Uint8Array(peer.analyser.frequencyBinCount);
        peer.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        const mediaEl = document.getElementById(`media-${userId}`);
        if (mediaEl) {
          if (average > 10) {
            mediaEl.classList.add('ring-discord-green');
            mediaEl.classList.remove('ring-transparent');
          } else {
            mediaEl.classList.remove('ring-discord-green');
            mediaEl.classList.add('ring-transparent');
          }
        }
      }
    }
  }, 100);
}

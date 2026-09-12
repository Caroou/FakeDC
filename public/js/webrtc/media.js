import { state } from '../state.js';
import { getProfile, getScreenConstraints } from '../config.js';
import { showToast } from '../ui/toast.js';
import { addRemoteMedia } from '../ui/mediaRenderer.js';

export async function initMedia() {
  const globalMutedCheckbox = document.getElementById('global-muted-checkbox');

  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });

    if (globalMutedCheckbox && globalMutedCheckbox.checked) {
      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = false;
        state.isMicMuted = true;
        updateMicButtonUI();
      }
    }
    return false; // Joined with working microphone
  } catch (err) {
    console.warn('Microfone não encontrado ou bloqueado. Entrando como espectador.', err);
    state.localStream = null;
    state.isMicMuted = true;
    updateMicButtonUI();
    showToast('Acesso negado ao microfone. Você entrou no Modo Espectador.', 'error');
    return true; // Spectator mode
  }
}

export function updateMicButtonUI() {
  const micToggleBtn = document.getElementById('mic-toggle-btn');
  if (!micToggleBtn) return;

  if (state.isMicMuted) {
    micToggleBtn.classList.remove('bg-discord-secondary', 'hover:bg-zinc-700', 'text-white');
    micToggleBtn.classList.add('bg-discord-red', 'hover:bg-red-600', 'text-white');
    micToggleBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line></svg>';
  } else {
    micToggleBtn.classList.add('bg-discord-secondary', 'hover:bg-zinc-700', 'text-white');
    micToggleBtn.classList.remove('bg-discord-red', 'hover:bg-red-600', 'text-white');
    micToggleBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>';
  }
}

export function toggleMic() {
  if (state.localStream) {
    const audioTrack = state.localStream.getAudioTracks()[0];
    if (audioTrack) {
      state.isMicMuted = !state.isMicMuted;
      audioTrack.enabled = !state.isMicMuted;
      updateMicButtonUI();

      if (state.socket) {
        state.socket.emit('mute-status', state.isMicMuted);
      }

      const localInd = document.getElementById('mute-indicator-local-mic');
      if (localInd) localInd.style.display = state.isMicMuted ? 'flex' : 'none';
    }
  } else {
    showToast('Nenhum microfone detectado. Você está no Modo Espectador.', 'error');
  }
}

export async function toggleScreenShare() {
  if (!state.screenStream) {
    await startScreenSharing();
  } else {
    stopScreenSharing();
  }
}

export async function startScreenSharing() {
  const screenShareBtn = document.getElementById('screen-share-btn');
  const profile = getProfile(state.selectedQuality);

  try {
    state.screenStream = await navigator.mediaDevices.getDisplayMedia(
      getScreenConstraints(state.selectedQuality)
    );

    if (screenShareBtn) {
      screenShareBtn.classList.remove('text-zinc-300', 'hover:bg-zinc-600');
      screenShareBtn.classList.add('text-white', 'bg-discord-green', 'hover:bg-green-600');
    }

    const screenVideoTrack = state.screenStream.getVideoTracks()[0];
    const screenAudioTrack = state.screenStream.getAudioTracks()[0];

    for (const userId in state.peers) {
      const { pc } = state.peers[userId];

      if (screenVideoTrack) {
        const sender = pc.addTrack(screenVideoTrack, state.screenStream);

        // Configure targeted profile bitrate and strict resolution preservation
        try {
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = profile.bitrate;
          params.encodings[0].scaleResolutionDownBy = 1.0;
          params.encodings[0].maxFramerate = profile.frameRate;
          params.degradationPreference = 'balanced';
          sender.setParameters(params).catch(e => console.warn(e));
        } catch (e) {
          console.warn('Falha ao configurar bitrate para a transmissão', e);
        }

        // Prioritize hardware H.264 High Profile codec
        try {
          const transceivers = pc.getTransceivers();
          const videoTransceiver = transceivers.find(t => t.sender === sender);
          if (videoTransceiver && typeof RTCRtpReceiver !== 'undefined' && RTCRtpReceiver.getCapabilities) {
            const capabilities = RTCRtpReceiver.getCapabilities('video');
            if (capabilities && capabilities.codecs) {
              const h264Codecs = capabilities.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
              const h264High = h264Codecs.filter(c => c.sdpFmtpLine?.includes('profile-level-id=6400'));
              const h264Main = h264Codecs.filter(c => c.sdpFmtpLine?.includes('profile-level-id=4d00'));
              const h264Rest = h264Codecs.filter(c => !c.sdpFmtpLine?.includes('profile-level-id=6400') && !c.sdpFmtpLine?.includes('profile-level-id=4d00'));
              const sortedH264 = [...h264High, ...h264Main, ...h264Rest];

              const otherCodecs = capabilities.codecs.filter(c => c.mimeType.toLowerCase() !== 'video/h264');
              videoTransceiver.setCodecPreferences([...sortedH264, ...otherCodecs]);
            }
          }
        } catch (e) {
          console.warn('Falha ao tentar forçar codec H.264', e);
        }
      }

      if (screenAudioTrack) {
        pc.addTrack(screenAudioTrack, state.screenStream);
      }
    }

    if (screenVideoTrack) {
      screenVideoTrack.onended = () => stopScreenSharing();
    }

    const localPreviewStream = new MediaStream();
    if (screenVideoTrack) localPreviewStream.addTrack(screenVideoTrack);
    addRemoteMedia('local-screen', localPreviewStream, `${state.username} (Você)`);

  } catch (err) {
    console.error('Error sharing screen', err);
  }
}

export function stopScreenSharing() {
  const videoGrid = document.getElementById('video-grid');
  const screenShareBtn = document.getElementById('screen-share-btn');

  if (state.screenStream) {
    state.screenStream.getTracks().forEach(track => track.stop());

    for (const userId in state.peers) {
      const { pc } = state.peers[userId];
      const senders = pc.getSenders();

      senders.forEach(sender => {
        if (sender.track && sender.track.readyState === 'ended') {
          pc.removeTrack(sender);
        }
      });
    }

    state.screenStream = null;

    if (screenShareBtn) {
      screenShareBtn.classList.add('text-zinc-300', 'hover:bg-zinc-600');
      screenShareBtn.classList.remove('text-white', 'bg-discord-green', 'hover:bg-green-600');
    }

    const localScreen = document.getElementById('media-local-screen');
    if (localScreen) {
      if (localScreen.classList.contains('focused') && videoGrid) {
        videoGrid.classList.remove('p-0', 'gap-0', 'content-stretch', 'items-stretch');
        videoGrid.classList.add('p-4', 'gap-4', 'content-start');
        Array.from(videoGrid.children).forEach(child => {
          child.style.display = 'flex';
        });
      }
      localScreen.remove();
    }
  }
}

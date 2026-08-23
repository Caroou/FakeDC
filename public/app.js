const socket = io('/');

// Elements
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const tabCreate = document.getElementById('tab-create');
const tabJoin = document.getElementById('tab-join');
const createSection = document.getElementById('create-section');
const joinSection = document.getElementById('join-section');
const actionBtn = document.getElementById('action-btn'); // Unified button
const createRoomInput = document.getElementById('create-room-input');
const joinRoomInput = document.getElementById('join-room-input');
const usernameInput = document.getElementById('username-input');

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const videoGrid = document.getElementById('video-grid');
const screenShareBtn = document.getElementById('screen-share-btn');
const micToggleBtn = document.getElementById('mic-toggle-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const roomNameDisplay = document.getElementById('room-name-display');
const globalMutedCheckbox = document.getElementById('global-muted-checkbox');
const qualitySelector = document.getElementById('quality-selector');

let localStream;
let screenStream;
let roomId;
let username;
let isMicMuted = false;
let currentTab = 'join'; // join or create
const peers = {}; 

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// --- Toast System ---
function showToast(message, type = 'error') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  const bgColor = type === 'error' ? 'bg-discord-red' : 'bg-discord-green';
  
  toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-full opacity-0 pointer-events-auto max-w-sm`;
  
  const iconSvg = type === 'error' 
    ? '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
    : '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    
  toast.innerHTML = `${iconSvg}<span class="text-sm font-medium">${message}</span>`;
  
  container.appendChild(toast);
  
  // Trigger animation next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
    });
  });
  
  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Auto-Hide UI Logic ---
let idleTimeout;
const mainArea = document.getElementById('main-area');

function resetIdleTimer() {
  const fadeables = document.querySelectorAll('.ui-fadeable');
  fadeables.forEach(el => el.classList.remove('opacity-0', 'pointer-events-none'));
  if (mainArea) mainArea.style.cursor = 'default';
  
  clearTimeout(idleTimeout);
  
  if (!appSection.classList.contains('hidden-section')) {
    idleTimeout = setTimeout(() => {
      // Don't hide if mouse is hovering over a fadeable element (like the dock)
      let isHovering = false;
      fadeables.forEach(el => { if (el.matches(':hover')) isHovering = true; });
      
      if (!isHovering) {
        fadeables.forEach(el => el.classList.add('opacity-0', 'pointer-events-none'));
        if (mainArea) mainArea.style.cursor = 'none';
      }
    }, 3000); // 3 seconds idle
  }
}

window.addEventListener('mousemove', resetIdleTimer);
window.addEventListener('click', resetIdleTimer);
window.addEventListener('keydown', resetIdleTimer);

// --- Tabs Logic ---
tabCreate.addEventListener('click', () => {
  currentTab = 'create';
  tabCreate.className = 'flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 bg-zinc-600 text-white shadow';
  tabJoin.className = 'flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 text-zinc-400 hover:text-zinc-200';
  createSection.classList.remove('hidden-section');
  joinSection.classList.add('hidden-section');
  actionBtn.innerText = 'Criar Sala';
});

tabJoin.addEventListener('click', () => {
  currentTab = 'join';
  tabJoin.className = 'flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 bg-zinc-600 text-white shadow';
  tabCreate.className = 'flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 text-zinc-400 hover:text-zinc-200';
  joinSection.classList.remove('hidden-section');
  createSection.classList.add('hidden-section');
  actionBtn.innerText = 'Conectar à Sala';
});

async function enterRoom() {
  username = usernameInput.value.trim();
  roomId = currentTab === 'create' ? createRoomInput.value.trim() : joinRoomInput.value.trim();
  
  if (!roomId || !username) {
    showToast('Por favor, preencha o nome e a sala.', 'error');
    return;
  }

  if (currentTab === 'create') {
    socket.emit('create-room', { roomId, username }, (response) => {
      if (response.success) proceedToRoom();
      else showToast(response.message, 'error');
    });
  } else {
    socket.emit('check-room', { roomId, username }, (response) => {
      if (!response.exists) {
        showToast('Esta sala não existe. Verifique o nome ou crie uma nova.', 'error');
      } else if (!response.success) {
        showToast(response.message, 'error');
      } else {
        proceedToRoom();
      }
    });
  }
}

actionBtn.addEventListener('click', enterRoom);

async function proceedToRoom() {
  try {
    await initMedia();
    loginSection.classList.add('hidden-section');
    appSection.classList.remove('hidden-section');
    
    roomNameDisplay.innerText = `# ${roomId}`;
    showToast(`Conectado à sala ${roomId}`, 'success');
    
    addRemoteMedia('local-mic', localStream, `${username} (Você)`, isMicMuted);
    
    socket.emit('join-room', roomId, username);
    if (isMicMuted) socket.emit('mute-status', true);
    
  } catch (error) {
    console.error('Error accessing media devices.', error);
    showToast('Erro ao acessar o microfone. Verifique as permissões.', 'error');
  }
}

async function initMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
  
  if (globalMutedCheckbox && globalMutedCheckbox.checked) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = false;
      isMicMuted = true;
      updateMicButtonUI();
    }
  }
}

function updateMicButtonUI() {
  if (isMicMuted) {
    micToggleBtn.classList.remove('bg-discord-secondary', 'hover:bg-zinc-700', 'text-white');
    micToggleBtn.classList.add('bg-discord-red', 'hover:bg-red-600', 'text-white');
    micToggleBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line></svg>';
  } else {
    micToggleBtn.classList.add('bg-discord-secondary', 'hover:bg-zinc-700', 'text-white');
    micToggleBtn.classList.remove('bg-discord-red', 'hover:bg-red-600', 'text-white');
    micToggleBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>';
  }
}

// --- Socket events ---
socket.on('user-connected', (userId, newUsername) => {
  addMessage('Sistema', `${newUsername} entrou na sala.`);
  createPeerConnection(userId, newUsername);
});

socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    const leavingName = peers[userId].username || 'Um usuário';
    peers[userId].pc.close();
    delete peers[userId];
    removeVideo(userId);
    addMessage('Sistema', `${leavingName} saiu da sala.`);
  }
});

socket.on('chat-message', data => {
  addMessage(data.username, data.message);
});

socket.on('user-muted', (userId, isMuted) => {
  const allMuteInds = document.querySelectorAll(`[id^="mute-indicator-${userId}-"]`);
  allMuteInds.forEach(el => {
    el.style.display = isMuted ? 'flex' : 'none';
  });
});

// Detect who is speaking
let speakingInterval;
if (window.AudioContext || window.webkitAudioContext) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  speakingInterval = setInterval(() => {
    for (const userId in peers) {
      if (peers[userId].analyser) {
        const dataArray = new Uint8Array(peers[userId].analyser.frequencyBinCount);
        peers[userId].analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        
        const mediaElements = document.querySelectorAll(`[id^="media-${userId}-"]`);
        mediaElements.forEach(el => {
          if (average > 10) {
            el.classList.add('ring-discord-green');
            el.classList.remove('ring-transparent');
          } else {
            el.classList.remove('ring-discord-green');
            el.classList.add('ring-transparent');
          }
        });
      }
    }
  }, 100);
}


// --- WebRTC Logic ---
function createPeerConnection(userId, peerUsername) {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  const isPolite = socket.id > userId;
  
  const peerObj = { pc, isPolite, makingOffer: false, ignoreOffer: false, username: peerUsername, isMuted: false, analyser: null };
  peers[userId] = peerObj;

  pc.onnegotiationneeded = async () => {
    try {
      peerObj.makingOffer = true;
      await pc.setLocalDescription();
      socket.emit('signal', { to: userId, signal: pc.localDescription });
    } catch (err) {
      console.error(err);
    } finally {
      peerObj.makingOffer = false;
    }
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit('signal', { to: userId, signal: candidate });
  };

  pc.ontrack = ({ track, streams }) => {
    let stream = streams[0];
    if (stream) {
      const mediaId = `${userId}-${stream.id}`;
      addRemoteMedia(mediaId, stream, peerObj.username, peerObj.isMuted);
      
      // Audio level analyser for "speaking" ring
      if (track.kind === 'audio' && window.AudioContext) {
        try {
          // Check if audiocontext is running
          if (audioContext.state === 'suspended') audioContext.resume();
          
          const audioSrc = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          audioSrc.connect(analyser);
          peerObj.analyser = analyser;
        } catch (e) {
          console.warn("Could not create audio analyser", e);
        }
      }

      const updateVisibility = () => updateMediaVisibility(mediaId, stream);
      stream.addEventListener('addtrack', updateVisibility);
      stream.addEventListener('removetrack', updateVisibility);
    }
  };

  if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  if (screenStream) {
    screenStream.getTracks().forEach(track => {
      const sender = pc.addTrack(track, screenStream);
      if (track.kind === 'video') {
        try {
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          const quality = qualitySelector ? qualitySelector.value : '1080';
          params.encodings[0].maxBitrate = quality === '1080' ? 8000000 : 4000000;
          params.encodings[0].scaleResolutionDownBy = 1.0; 
          sender.setParameters(params).catch(e => console.warn(e));
        } catch (e) {
          console.warn("Failed to set bitrate for late joiner", e);
        }
        
        try {
          const transceivers = pc.getTransceivers();
          const videoTransceiver = transceivers.find(t => t.sender === sender);
          if (videoTransceiver && typeof RTCRtpReceiver !== 'undefined' && RTCRtpReceiver.getCapabilities) {
            const capabilities = RTCRtpReceiver.getCapabilities('video');
            if (capabilities && capabilities.codecs) {
              const h264Codecs = capabilities.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
              if (h264Codecs.length > 0) {
                const otherCodecs = capabilities.codecs.filter(c => c.mimeType.toLowerCase() !== 'video/h264');
                videoTransceiver.setCodecPreferences([...h264Codecs, ...otherCodecs]);
              }
            }
          }
        } catch (e) {}
      }
    });
  }
  
  return peerObj;
}

socket.on('signal', async ({ from, signal, username: signalUsername, isMuted: signalIsMuted }) => {
  let peerObj = peers[from];
  if (!peerObj) peerObj = createPeerConnection(from, signalUsername);

  const { pc, isPolite } = peerObj;
  
  peerObj.isMuted = signalIsMuted;

  try {
    if (signal.type === 'offer' || signal.type === 'answer') {
      const offerCollision = (signal.type === 'offer') && (peerObj.makingOffer || pc.signalingState !== 'stable');
      
      peerObj.ignoreOffer = !isPolite && offerCollision;
      if (peerObj.ignoreOffer) return;

      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      
      if (signal.type === 'offer') {
        await pc.setLocalDescription();
        socket.emit('signal', { to: from, signal: pc.localDescription });
      }
    } else if (signal.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      } catch (err) {
        if (!peerObj.ignoreOffer) console.error('ICE candidate error', err);
      }
    }
  } catch (err) {
    console.error(err);
  }
});

// --- Media Rendering Logic ---
function addRemoteMedia(mediaId, stream, peerUsername, isMutedInitially = false) {
  let containerEl = document.getElementById(`media-${mediaId}`);
  
  const hasVideo = stream.getVideoTracks().length > 0;
  
  if (!containerEl) {
    containerEl = document.createElement('div');
    containerEl.id = `media-${mediaId}`;
    containerEl.className = 'media-container group relative bg-discord-secondary rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer transition-all duration-300 ring-2 ring-transparent shadow-xl shrink-0 border border-white/5';
    containerEl.style.flex = '1 1 200px';
    containerEl.style.maxWidth = '100%';
    containerEl.style.aspectRatio = '16/9';
    
    containerEl.addEventListener('click', () => {
      const isFocused = containerEl.classList.contains('focused');
      document.querySelectorAll('.media-container.focused').forEach(el => {
        el.classList.remove('focused');
        el.style.flex = '1 1 200px';
        el.style.maxWidth = '100%';
        el.style.height = 'auto';
        el.classList.add('rounded-2xl');
      });
      
      if (!isFocused) {
        containerEl.classList.add('focused');
        containerEl.style.flex = '1 1 100%';
        containerEl.style.maxWidth = '100%';
        containerEl.style.height = '100%';
        containerEl.classList.remove('rounded-2xl');
        videoGrid.classList.add('p-0', 'gap-0');
        videoGrid.classList.remove('p-4', 'gap-4', 'content-start');
        videoGrid.classList.add('content-stretch', 'items-stretch');
        
        // Esconder os outros
        Array.from(videoGrid.children).forEach(child => {
          if (child !== containerEl) child.style.display = 'none';
        });
      } else {
        videoGrid.classList.remove('p-0', 'gap-0', 'content-stretch', 'items-stretch');
        videoGrid.classList.add('p-4', 'gap-4', 'content-start');
        Array.from(videoGrid.children).forEach(child => {
          child.style.display = 'flex';
        });
      }
    });
    
    const videoEl = document.createElement('video');
    videoEl.id = `video-${mediaId}`;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    videoEl.className = 'w-full h-full object-contain bg-black';
    
    if (mediaId.startsWith('local-')) {
      videoEl.muted = true;
    }
    
    videoEl.style.display = hasVideo ? 'block' : 'none';
    
    const labelEl = document.createElement('div');
    labelEl.className = 'ui-fadeable transition-opacity duration-500 absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-bold pointer-events-none z-10 shadow-sm border border-white/5';
    labelEl.innerText = hasVideo ? `${peerUsername} (Tela)` : peerUsername;
    
    const avatarEl = document.createElement('div');
    avatarEl.className = 'absolute inset-0 m-auto w-24 h-24 rounded-full bg-gradient-to-br from-discord-blurple to-discord-blurpleHover text-white text-3xl font-bold flex items-center justify-center z-0 shadow-2xl pointer-events-none border-4 border-discord-main/50';
    avatarEl.innerText = peerUsername.charAt(0).toUpperCase();
    avatarEl.style.display = hasVideo ? 'none' : 'flex';
    
    // Indicador de mudo apenas para canais de voz
    const muteInd = document.createElement('div');
    muteInd.id = `mute-indicator-${mediaId}`;
    muteInd.className = 'absolute bottom-3 right-3 bg-discord-red text-white w-8 h-8 rounded-full flex items-center justify-center z-10 shadow-lg border-2 border-discord-secondary';
    muteInd.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line></svg>';
    muteInd.style.display = (!hasVideo && isMutedInitially) ? 'flex' : 'none';
    
    // Controles de Volume (Apenas para conexões remotas)
    if (!mediaId.startsWith('local-')) {
      const overlay = document.createElement('div');
      overlay.className = 'absolute top-3 right-3 bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 shadow-xl border border-white/10 translate-y-[-5px] group-hover:translate-y-0';
      overlay.addEventListener('click', e => e.stopPropagation()); 
      
      const volSlider = document.createElement('input');
      volSlider.type = 'range';
      volSlider.min = 0; volSlider.max = 1; volSlider.step = 0.01; volSlider.value = 1;
      volSlider.title = 'Volume';
      volSlider.className = 'w-16 accent-discord-blurple cursor-pointer';
      
      const muteBtn = document.createElement('button');
      muteBtn.className = 'text-white p-1.5 rounded-lg bg-discord-red hover:bg-red-600 transition-colors shadow-sm';
      muteBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path></svg>';
      
      const fsBtn = document.createElement('button');
      fsBtn.title = 'Tela Cheia';
      fsBtn.className = 'text-white p-1.5 rounded-lg bg-zinc-600 hover:bg-zinc-500 transition-colors shadow-sm';
      fsBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>';
      
      volSlider.addEventListener('input', (e) => {
        videoEl.volume = e.target.value;
        if(videoEl.volume == 0) {
          muteBtn.classList.remove('bg-zinc-600', 'hover:bg-zinc-500');
          muteBtn.classList.add('bg-discord-red', 'hover:bg-red-600');
        } else if (videoEl.muted) {
          videoEl.muted = false;
          muteBtn.classList.add('bg-zinc-600', 'hover:bg-zinc-500');
          muteBtn.classList.remove('bg-discord-red', 'hover:bg-red-600');
        }
      });
      
      muteBtn.addEventListener('click', () => {
        videoEl.muted = !videoEl.muted;
        if (videoEl.muted) {
          muteBtn.classList.remove('bg-zinc-600', 'hover:bg-zinc-500');
          muteBtn.classList.add('bg-discord-red', 'hover:bg-red-600');
        } else {
          muteBtn.classList.add('bg-zinc-600', 'hover:bg-zinc-500');
          muteBtn.classList.remove('bg-discord-red', 'hover:bg-red-600');
          if (volSlider.value == 0) {
            volSlider.value = 0.5;
            videoEl.volume = 0.5;
          }
        }
      });
      
      fsBtn.addEventListener('click', () => {
        if (videoEl.requestFullscreen) {
          videoEl.requestFullscreen();
        } else if (videoEl.webkitRequestFullscreen) {
          videoEl.webkitRequestFullscreen();
        }
      });
      
      overlay.appendChild(volSlider);
      overlay.appendChild(muteBtn);
      overlay.appendChild(fsBtn);
      containerEl.appendChild(overlay);
    }
    
    containerEl.appendChild(videoEl);
    containerEl.appendChild(avatarEl);
    containerEl.appendChild(labelEl);
    if (!hasVideo) containerEl.appendChild(muteInd);
    videoGrid.appendChild(containerEl);
  }
  
  const videoEl = document.getElementById(`video-${mediaId}`);
  if (videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
    videoEl.play().catch(e => console.warn('Autoplay preventions:', e));
  }
}

function updateMediaVisibility(mediaId, stream) {
  const containerEl = document.getElementById(`media-${mediaId}`);
  if (containerEl) {
    const hasAnyTrack = stream.getTracks().length > 0;
    if (!hasAnyTrack) {
      if (containerEl.classList.contains('focused')) {
        // Reset grid
        videoGrid.classList.remove('p-0', 'gap-0', 'content-stretch', 'items-stretch');
        videoGrid.classList.add('p-4', 'gap-4', 'content-start');
        Array.from(videoGrid.children).forEach(child => {
          child.style.display = 'flex';
        });
      }
      containerEl.remove();
    }
  }
}

function removeVideo(userId) {
  const elements = document.querySelectorAll(`[id^="media-${userId}-"]`);
  elements.forEach(el => {
    if (el.classList.contains('focused')) {
      videoGrid.classList.remove('p-0', 'gap-0', 'content-stretch', 'items-stretch');
      videoGrid.classList.add('p-4', 'gap-4', 'content-start');
      Array.from(videoGrid.children).forEach(child => {
        child.style.display = 'flex';
      });
    }
    el.remove();
  });
}

// --- Chat Logic ---
chatForm.addEventListener('submit', e => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (msg) {
    addMessage('Você', msg);
    socket.emit('chat-message', msg);
    chatInput.value = '';
  }
});

function addMessage(user, msg) {
  const div = document.createElement('div');
  div.className = 'bg-discord-tertiary p-3 rounded-xl text-sm break-words border border-white/5 shadow-sm';
  
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  div.innerHTML = `<div class="flex items-baseline gap-2 mb-1"><strong class="text-white font-semibold">${user}</strong><span class="text-[10.5px] text-zinc-500 font-medium">${time}</span></div><p class="text-zinc-300 leading-relaxed">${msg}</p>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Controls ---
leaveRoomBtn.addEventListener('click', () => {
  if (confirm('Deseja realmente sair da sala?')) {
    window.location.reload();
  }
});

micToggleBtn.addEventListener('click', () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      isMicMuted = !isMicMuted;
      audioTrack.enabled = !isMicMuted;
      updateMicButtonUI();
      
      socket.emit('mute-status', isMicMuted);
      
      const localInd = document.getElementById('mute-indicator-local-mic');
      if (localInd) localInd.style.display = isMicMuted ? 'flex' : 'none';
    }
  }
});

screenShareBtn.addEventListener('click', async () => {
  if (!screenStream) {
    try {
      const quality = qualitySelector ? qualitySelector.value : '1080';
      const videoConstraints = quality === '1080' ? 
        { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60, max: 60 } } :
        { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 30, max: 30 } };

      screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: videoConstraints, 
        audio: true 
      });
      
      // Update UI for sharing
      screenShareBtn.classList.remove('text-zinc-300', 'hover:bg-zinc-600');
      screenShareBtn.classList.add('text-white', 'bg-discord-green', 'hover:bg-green-600');
      
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const screenAudioTrack = screenStream.getAudioTracks()[0];
      
      if (screenVideoTrack && 'contentHint' in screenVideoTrack) {
        screenVideoTrack.contentHint = 'detail'; 
      }
      
      for (const userId in peers) {
        const { pc } = peers[userId];
        
        if (screenVideoTrack) {
          const sender = pc.addTrack(screenVideoTrack, screenStream);
          
          // Force maximum bitrate (8 Mbps for 1080p, 4 Mbps for 720p)
          try {
            const params = sender.getParameters();
            if (!params.encodings) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = quality === '1080' ? 8000000 : 4000000;
            params.encodings[0].scaleResolutionDownBy = 1.0; 
            sender.setParameters(params).catch(e => console.warn(e));
          } catch (e) {
            console.warn("Failed to prepare parameters", e);
          }
          
          try {
            const transceivers = pc.getTransceivers();
            const videoTransceiver = transceivers.find(t => t.sender === sender);
            
            if (videoTransceiver && typeof RTCRtpReceiver !== 'undefined' && RTCRtpReceiver.getCapabilities) {
              const capabilities = RTCRtpReceiver.getCapabilities('video');
              if (capabilities && capabilities.codecs) {
                const h264Codecs = capabilities.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
                if (h264Codecs.length > 0) {
                  const otherCodecs = capabilities.codecs.filter(c => c.mimeType.toLowerCase() !== 'video/h264');
                  videoTransceiver.setCodecPreferences([...h264Codecs, ...otherCodecs]);
                }
              }
            }
          } catch (e) {
            console.warn('Falha ao tentar forçar codec H.264', e);
          }
        }
        
        if (screenAudioTrack) {
          pc.addTrack(screenAudioTrack, screenStream);
        }
      }
      
      if (screenVideoTrack) {
        screenVideoTrack.onended = () => stopScreenSharing();
      }
      
      const localPreviewStream = new MediaStream();
      if (screenVideoTrack) localPreviewStream.addTrack(screenVideoTrack);
      addRemoteMedia('local-screen', localPreviewStream, `${username} (Você)`);
      
    } catch (err) {
      console.error('Error sharing screen', err);
    }
  } else {
    stopScreenSharing();
  }
});

function stopScreenSharing() {
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    
    for (const userId in peers) {
      const { pc } = peers[userId];
      const senders = pc.getSenders();
      
      senders.forEach(sender => {
        if (sender.track && sender.track.readyState === 'ended') {
          pc.removeTrack(sender);
        }
      });
    }
    
    screenStream = null;
    screenShareBtn.classList.add('text-zinc-300', 'hover:bg-zinc-600');
    screenShareBtn.classList.remove('text-white', 'bg-discord-green', 'hover:bg-green-600');
    
    const localScreen = document.getElementById('media-local-screen');
    if (localScreen) {
      if (localScreen.classList.contains('focused')) {
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

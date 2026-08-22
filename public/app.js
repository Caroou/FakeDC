const socket = io('/');

// Elements
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const tabCreate = document.getElementById('tab-create');
const tabJoin = document.getElementById('tab-join');
const createSection = document.getElementById('create-section');
const joinSection = document.getElementById('join-section');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
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
const peers = {}; 

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// --- Tabs Logic ---
tabCreate.addEventListener('click', () => {
  tabCreate.classList.add('active');
  tabJoin.classList.remove('active');
  createSection.style.display = 'flex';
  joinSection.style.display = 'none';
});

tabJoin.addEventListener('click', () => {
  tabJoin.classList.add('active');
  tabCreate.classList.remove('active');
  joinSection.style.display = 'flex';
  createSection.style.display = 'none';
});

async function enterRoom(roomIdToEnter, isCreating) {
  username = usernameInput.value.trim();
  roomId = roomIdToEnter.trim();
  
  if (!roomId || !username) {
    alert('Por favor, preencha o nome e a sala.');
    return;
  }

  if (isCreating) {
    socket.emit('create-room', roomId, (response) => {
      if (response.success) proceedToRoom();
      else alert(response.message);
    });
  } else {
    socket.emit('check-room', roomId, (response) => {
      if (response.exists) proceedToRoom();
      else alert('Esta sala não existe. Verifique o nome ou crie uma nova na aba "Criar Sala".');
    });
  }
}

createBtn.addEventListener('click', () => enterRoom(createRoomInput.value, true));
joinBtn.addEventListener('click', () => enterRoom(joinRoomInput.value, false));

async function proceedToRoom() {
  try {
    await initMedia();
    loginSection.style.display = 'none';
    appSection.style.display = 'flex';
    
    roomNameDisplay.innerText = `Sala: ${roomId}`;
    
    addRemoteMedia('local-mic', localStream, `${username} (Você)`, isMicMuted);
    
    socket.emit('join-room', roomId, username);
    if (isMicMuted) socket.emit('mute-status', true);
    
  } catch (error) {
    console.error('Error accessing media devices.', error);
    alert('Erro ao acessar o microfone. Verifique as permissões de acesso e recarregue a página.');
  }
}

async function initMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
  
  if (globalMutedCheckbox && globalMutedCheckbox.checked) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = false;
      isMicMuted = true;
      micToggleBtn.textContent = 'Desmutar';
      micToggleBtn.classList.add('danger');
    }
  }
}

// --- Socket events ---
socket.on('user-connected', (userId, newUsername) => {
  addMessage('Sistema', `${newUsername} entrou na sala.`);
  createPeerConnection(userId, newUsername);
});

socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    peers[userId].pc.close();
    delete peers[userId];
    removeVideo(userId);
    addMessage('Sistema', `Um usuário saiu da sala.`);
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

// --- WebRTC Logic ---
function createPeerConnection(userId, peerUsername) {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  const isPolite = socket.id > userId;
  
  const peerObj = { pc, isPolite, makingOffer: false, ignoreOffer: false, username: peerUsername, isMuted: false };
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
      // Usar estado isMuted guardado no peerObj que veio no signal
      addRemoteMedia(mediaId, stream, peerObj.username, peerObj.isMuted);
      
      const updateVisibility = () => updateMediaVisibility(mediaId, stream);
      stream.addEventListener('addtrack', updateVisibility);
      stream.addEventListener('removetrack', updateVisibility);
    }
  };

  if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  if (screenStream) screenStream.getTracks().forEach(track => pc.addTrack(track, screenStream));
  
  return peerObj;
}

socket.on('signal', async ({ from, signal, username: signalUsername, isMuted: signalIsMuted }) => {
  let peerObj = peers[from];
  if (!peerObj) peerObj = createPeerConnection(from, signalUsername);

  const { pc, isPolite } = peerObj;
  
  // Atualiza estado mudo baseado no sinal
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
    containerEl.classList.add('media-container');
    
    containerEl.addEventListener('click', () => {
      const isFocused = containerEl.classList.contains('focused');
      document.querySelectorAll('.media-container.focused').forEach(el => el.classList.remove('focused'));
      
      if (!isFocused) {
        containerEl.classList.add('focused');
        videoGrid.classList.add('focus-mode');
      } else {
        videoGrid.classList.remove('focus-mode');
      }
    });
    
    const videoEl = document.createElement('video');
    videoEl.id = `video-${mediaId}`;
    videoEl.autoplay = true;
    videoEl.playsInline = true;
    
    if (mediaId.startsWith('local-')) {
      videoEl.muted = true;
    }
    
    videoEl.style.display = hasVideo ? 'block' : 'none';
    
    const labelEl = document.createElement('div');
    labelEl.classList.add('user-label');
    labelEl.innerText = hasVideo ? `${peerUsername} (Tela)` : peerUsername;
    
    const avatarEl = document.createElement('div');
    avatarEl.classList.add('avatar');
    avatarEl.innerText = peerUsername.charAt(0).toUpperCase();
    avatarEl.style.display = hasVideo ? 'none' : 'flex';
    
    // Indicador de mudo apenas para canais de voz
    const muteInd = document.createElement('div');
    muteInd.classList.add('mute-indicator');
    muteInd.id = `mute-indicator-${mediaId}`;
    muteInd.innerText = '🔇';
    muteInd.style.display = (!hasVideo && isMutedInitially) ? 'flex' : 'none';
    
    // Controles de Volume (Apenas para conexões remotas)
    if (!mediaId.startsWith('local-')) {
      const overlay = document.createElement('div');
      overlay.classList.add('overlay-controls');
      overlay.addEventListener('click', e => e.stopPropagation()); 
      
      const volSlider = document.createElement('input');
      volSlider.type = 'range';
      volSlider.min = 0; volSlider.max = 1; volSlider.step = 0.01; volSlider.value = 1;
      volSlider.classList.add('volume-slider');
      volSlider.title = 'Volume';
      
      const muteBtn = document.createElement('button');
      muteBtn.innerText = 'Mutar';
      muteBtn.classList.add('mute-btn-small');
      
      const fsBtn = document.createElement('button');
      fsBtn.innerText = '⛶';
      fsBtn.title = 'Tela Cheia';
      fsBtn.style.padding = '4px 6px';
      fsBtn.classList.add('mute-btn-small');
      fsBtn.style.backgroundColor = '#4f545c';
      
      volSlider.addEventListener('input', (e) => {
        videoEl.volume = e.target.value;
        if(videoEl.volume == 0) {
          muteBtn.innerText = 'Desmutar';
          muteBtn.classList.add('muted');
        } else if (videoEl.muted) {
          videoEl.muted = false;
          muteBtn.innerText = 'Mutar';
          muteBtn.classList.remove('muted');
        }
      });
      
      muteBtn.addEventListener('click', () => {
        videoEl.muted = !videoEl.muted;
        if (videoEl.muted) {
          muteBtn.innerText = 'Desmutar';
          muteBtn.classList.add('muted');
        } else {
          muteBtn.innerText = 'Mutar';
          muteBtn.classList.remove('muted');
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
        videoGrid.classList.remove('focus-mode');
      }
      containerEl.remove();
    }
  }
}

function removeVideo(userId) {
  const elements = document.querySelectorAll(`[id^="media-${userId}-"]`);
  elements.forEach(el => {
    if (el.classList.contains('focused')) {
      videoGrid.classList.remove('focus-mode');
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
  div.classList.add('message');
  
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  div.innerHTML = `<span class="msg-time">${time}</span> <strong>${user}:</strong> ${msg}`;
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
      micToggleBtn.textContent = isMicMuted ? 'Desmutar' : 'Mutar';
      micToggleBtn.classList.toggle('danger', isMicMuted);
      
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
      screenShareBtn.textContent = 'Parar Tela';
      screenShareBtn.classList.add('active');
      
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const screenAudioTrack = screenStream.getAudioTracks()[0];
      
      if (screenVideoTrack && 'contentHint' in screenVideoTrack) {
        screenVideoTrack.contentHint = 'detail'; // Força qualidade/resolução perfeita instantaneamente em detrimento de FPS no primeiro segundo
      }
      
      for (const userId in peers) {
        const { pc } = peers[userId];
        
        if (screenVideoTrack) {
          const sender = pc.addTrack(screenVideoTrack, screenStream);
          
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
          
          try {
            const params = sender.getParameters();
            if (!params.encodings) params.encodings = [{}];
            params.degradationPreference = 'balanced'; 
            sender.setParameters(params);
          } catch (e) {
            console.warn('Navegador não suporta setParameters para otimização', e);
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
    screenShareBtn.textContent = 'Compartilhar Tela';
    screenShareBtn.classList.remove('active');
    
    const localScreen = document.getElementById('media-local-screen');
    if (localScreen) {
      if (localScreen.classList.contains('focused')) videoGrid.classList.remove('focus-mode');
      localScreen.remove();
    }
  }
}

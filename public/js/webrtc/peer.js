import { state } from '../state.js';
import { ICE_SERVERS, getProfile } from '../config.js';
import { addRemoteMedia, updateMediaVisibility } from '../ui/mediaRenderer.js';
import { getAudioContext } from '../ui/speaking.js';

export function enhanceSdp(sdp, profile) {
  const kbps = Math.floor(profile.bitrate / 1000);
  const bps = profile.bitrate;
  const minKbps = profile.minBitrateKbps || Math.floor(kbps * 0.7);

  const lines = sdp.split(/\r?\n/);
  let isVideoSection = false;
  let videoPayloadTypes = [];

  // Pass 1: find m=video section and active payload types
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('m=video')) {
      isVideoSection = true;
      const parts = line.split(' ');
      videoPayloadTypes = parts.slice(3);
    } else if (line.startsWith('m=')) {
      isVideoSection = false;
    }
  }

  // Pass 2: inject bitrate bounds and Google BWE minimums
  const newLines = [];
  isVideoSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('m=video')) {
      isVideoSection = true;
      newLines.push(line);
      newLines.push(`b=AS:${kbps}`);
      newLines.push(`b=TIAS:${bps}`);
      continue;
    } else if (line.startsWith('m=')) {
      isVideoSection = false;
    }

    // Skip any existing bitrate lines
    if (isVideoSection && (line.startsWith('b=AS:') || line.startsWith('b=TIAS:'))) {
      continue;
    }

    // Inject min-bitrate and start-bitrate into video fmtp lines
    if (isVideoSection && line.startsWith('a=fmtp:')) {
      const match = line.match(/^a=fmtp:(\d+)(.*)$/);
      if (match) {
        const pt = match[1];
        const rest = match[2];
        if (videoPayloadTypes.includes(pt)) {
          if (!rest.includes('x-google-min-bitrate')) {
            newLines.push(
              `a=fmtp:${pt}${rest};x-google-min-bitrate=${minKbps};x-google-start-bitrate=${kbps};x-google-max-bitrate=${kbps}`
            );
            continue;
          }
        }
      }
    }

    newLines.push(line);
  }

  return newLines.join('\r\n') + '\r\n';
}

export function createPeerConnection(userId, peerUsername, isMuted = false) {
  const pc = new RTCPeerConnection(ICE_SERVERS);
  const isPolite = state.socket.id > userId;

  const peerObj = {
    pc,
    isPolite,
    makingOffer: false,
    ignoreOffer: false,
    username: peerUsername,
    isMuted,
    analyser: null
  };
  state.peers[userId] = peerObj;

  // Immediately render avatar tile so spectators and voice users appear in grid
  addRemoteMedia(userId, null, peerUsername, isMuted);

  pc.onnegotiationneeded = async () => {
    try {
      peerObj.makingOffer = true;
      let offer = await pc.createOffer();

      // SDP Munging to guarantee high-definition bitrate and prevent pixelation
      if (state.screenStream) {
        const profile = getProfile(state.selectedQuality);
        offer.sdp = enhanceSdp(offer.sdp, profile);
      }

      await pc.setLocalDescription(offer);
      state.socket.emit('signal', { to: userId, signal: pc.localDescription });
    } catch (err) {
      console.error('Erro na negociação WebRTC:', err);
    } finally {
      peerObj.makingOffer = false;
    }
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      state.socket.emit('signal', { to: userId, signal: candidate });
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      console.log(`[WebRTC] ICE state (${pc.iceConnectionState}) com ${peerUsername}. Tentando ICE restart...`);
      try {
        pc.restartIce();
      } catch (e) {
        console.warn('Falha ao reiniciar ICE:', e);
      }
    }
  };

  pc.ontrack = ({ track, streams, receiver }) => {
    // Low-latency playout delay optimization (prevents video frame buffer delay)
    if (receiver && 'playoutDelayHint' in receiver) {
      receiver.playoutDelayHint = 0;
    }

    const stream = streams[0];
    if (stream) {
      const isScreenShare = stream.getVideoTracks().length > 0;
      const mediaId = isScreenShare ? `${userId}-screen` : userId;
      addRemoteMedia(mediaId, stream, peerObj.username, peerObj.isMuted);

      // Audio frequency analyser for "speaking" green ring animation
      if (track.kind === 'audio') {
        const audioContext = getAudioContext();
        if (audioContext) {
          try {
            if (audioContext.state === 'suspended') {
              audioContext.resume();
            }
            const audioSrc = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            audioSrc.connect(analyser);
            peerObj.analyser = analyser;
          } catch (e) {
            console.warn('Não foi possível inicializar analyser de áudio', e);
          }
        }
      }

      const updateVisibility = () => updateMediaVisibility(mediaId, stream);
      stream.addEventListener('addtrack', updateVisibility);
      stream.addEventListener('removetrack', updateVisibility);
    }
  };

  // Add local microphone if present
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => pc.addTrack(track, state.localStream));
  }

  // Add active screen share if currently streaming
  if (state.screenStream) {
    state.screenStream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, state.screenStream);
      if (track.kind === 'video') {
        try {
          const profile = getProfile(state.selectedQuality);
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = profile.bitrate;
          params.encodings[0].scaleResolutionDownBy = 1.0;
          params.encodings[0].maxFramerate = profile.frameRate;
          params.degradationPreference = 'maintain-resolution';
          sender.setParameters(params).catch((e) => console.warn(e));
        } catch (e) {
          console.warn('Falha ao configurar bitrate para novo participante', e);
        }

        try {
          const transceivers = pc.getTransceivers();
          const videoTransceiver = transceivers.find((t) => t.sender === sender);
          if (videoTransceiver && typeof RTCRtpReceiver !== 'undefined' && RTCRtpReceiver.getCapabilities) {
            const capabilities = RTCRtpReceiver.getCapabilities('video');
            if (capabilities && capabilities.codecs) {
              const h264Codecs = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === 'video/h264');
              // Sort High Profile ahead of Baseline to unlock 8x8 DCT transform clarity
              const h264High = h264Codecs.filter((c) => c.sdpFmtpLine?.includes('profile-level-id=6400'));
              const h264Main = h264Codecs.filter((c) => c.sdpFmtpLine?.includes('profile-level-id=4d00'));
              const h264Rest = h264Codecs.filter(
                (c) =>
                  !c.sdpFmtpLine?.includes('profile-level-id=6400') &&
                  !c.sdpFmtpLine?.includes('profile-level-id=4d00')
              );
              const sortedH264 = [...h264High, ...h264Main, ...h264Rest];

              const otherCodecs = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() !== 'video/h264');
              videoTransceiver.setCodecPreferences([...sortedH264, ...otherCodecs]);
            }
          }
        } catch (e) {
          console.warn('Falha ao configurar preferências de codec H.264', e);
        }
      }
    });
  }

  return peerObj;
}

export async function handleSignal({ from, signal, username: signalUsername, isMuted: signalIsMuted }) {
  let peerObj = state.peers[from];
  if (!peerObj) {
    peerObj = createPeerConnection(from, signalUsername, signalIsMuted);
  }

  const { pc, isPolite } = peerObj;
  peerObj.isMuted = signalIsMuted;

  try {
    if (signal.type === 'offer' || signal.type === 'answer') {
      const offerCollision = signal.type === 'offer' && (peerObj.makingOffer || pc.signalingState !== 'stable');
      peerObj.ignoreOffer = !isPolite && offerCollision;
      if (peerObj.ignoreOffer) return;

      await pc.setRemoteDescription(new RTCSessionDescription(signal));

      if (signal.type === 'offer') {
        let answer = await pc.createAnswer();
        if (state.screenStream) {
          const profile = getProfile(state.selectedQuality);
          answer.sdp = enhanceSdp(answer.sdp, profile);
        }
        await pc.setLocalDescription(answer);
        state.socket.emit('signal', { to: from, signal: pc.localDescription });
      }
    } else if (signal.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      } catch (err) {
        if (!peerObj.ignoreOffer) {
          console.error('ICE candidate error', err);
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar sinal WebRTC:', err);
  }
}

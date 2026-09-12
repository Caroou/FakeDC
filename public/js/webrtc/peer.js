import { state } from '../state.js';
import { ICE_SERVERS, getProfile } from '../config.js';
import { addRemoteMedia, updateMediaVisibility } from '../ui/mediaRenderer.js';
import { getAudioContext } from '../ui/speaking.js';

export function applyBitrateToSdp(sdp, profile) {
  if (!sdp) return sdp;
  const kbps = Math.floor(profile.bitrate / 1000);
  const minKbps = profile.minBitrateKbps || Math.floor(kbps * 0.5);
  const startKbps = profile.startBitrateKbps || Math.floor(kbps * 0.75);

  let result = sdp;

  // 1. Force b=AS cleanly under m=video
  if (result.includes('b=AS:')) {
    result = result.replace(/b=AS:\d+/g, `b=AS:${kbps}`);
  } else {
    result = result.replace(/(m=video[^\r\n]*(?:\r?\n))/g, (match, line) => `${line}b=AS:${kbps}\r\n`);
  }

  // 2. Inject Google BWE minimum, start, and max bitrates into video fmtp lines (eliminates slow-start pixelation)
  const googleBwe = `x-google-min-bitrate=${minKbps};x-google-start-bitrate=${startKbps};x-google-max-bitrate=${kbps}`;

  result = result.replace(/(a=fmtp:\d+)(?!.*apt=)(.*)(\r?\n)/g, (match, prefix, rest, eol) => {
    if (rest.includes('x-google-min-bitrate')) {
      return match;
    }
    const trimmed = rest.trim();
    const separator = (trimmed === '' || trimmed.endsWith(';')) ? '' : ';';
    return `${prefix}${rest}${separator}${googleBwe}${eol}`;
  });

  return result;
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

      // SDP Munging to guarantee high bitrate and instant crisp quality
      if (state.screenStream) {
        const profile = getProfile(state.selectedQuality);
        offer.sdp = applyBitrateToSdp(offer.sdp, profile);
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

  pc.ontrack = ({ track, streams }) => {

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
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = profile.bitrate;
          if (profile.frameRate < 60) {
            params.encodings[0].maxFramerate = profile.frameRate;
          } else {
            delete params.encodings[0].maxFramerate;
          }
          params.encodings[0].scaleResolutionDownBy = 1.0;
          params.degradationPreference = 'maintain-framerate';
          sender.setParameters(params).catch((e) => console.warn(e));
        } catch (e) {
          console.warn('Falha ao configurar bitrate para novo participante', e);
        }

        // Prioritize fast hardware gaming codecs (H.264, VP9, VP8)
        try {
          const transceivers = pc.getTransceivers();
          const videoTransceiver = transceivers.find((t) => t.sender === sender);
          if (videoTransceiver && typeof RTCRtpReceiver !== 'undefined' && RTCRtpReceiver.getCapabilities) {
            const capabilities = RTCRtpReceiver.getCapabilities('video');
            if (capabilities && capabilities.codecs) {
              const fastCodecs = capabilities.codecs.filter((c) =>
                ['video/h264', 'video/vp9', 'video/vp8'].includes(c.mimeType.toLowerCase())
              );
              const otherCodecs = capabilities.codecs.filter((c) =>
                !['video/h264', 'video/vp9', 'video/vp8'].includes(c.mimeType.toLowerCase())
              );
              if (fastCodecs.length > 0) {
                videoTransceiver.setCodecPreferences([...fastCodecs, ...otherCodecs]);
              }
            }
          }
        } catch (e) {
          console.warn('Falha ao configurar preferências de codecs de alta velocidade', e);
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
        if (state.screenStream || answer.sdp.includes('m=video')) {
          const profile = getProfile(state.selectedQuality);
          answer.sdp = applyBitrateToSdp(answer.sdp, profile);
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

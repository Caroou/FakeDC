export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export const SCREEN_SHARE_CONSTRAINTS = {
  video: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 60, max: 60 }
  },
  audio: true
};

export const MAX_VIDEO_BITRATE = 8000000; // 8 Mbps for high quality 1080p60

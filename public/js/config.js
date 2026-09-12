export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Check if running inside the native Desktop Application
export const isDesktopApp = () =>
  typeof window !== 'undefined' && Boolean(window.desktopApp?.isDesktop);

// Quality profiles for low lag, smooth motion and custom resolutions/FPS
export const QUALITY_PROFILES = {
  '720p30': {
    id: '720p30',
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrate: 2500000, // 2.5 Mbps (ultra light, zero lag)
    sdpBitrate: 'b=AS:2500',
    label: '720p 30 FPS'
  },
  '720p60': {
    id: '720p60',
    width: 1280,
    height: 720,
    frameRate: 60,
    bitrate: 4500000, // 4.5 Mbps (fluid motion, low bandwidth)
    sdpBitrate: 'b=AS:4500',
    label: '720p 60 FPS'
  },
  '1080p30': {
    id: '1080p30',
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrate: 5000000, // 5.0 Mbps (crisp resolution, moderate bandwidth)
    sdpBitrate: 'b=AS:5000',
    label: '1080p 30 FPS'
  },
  '1080p60': {
    id: '1080p60',
    width: 1920,
    height: 1080,
    frameRate: 60,
    bitrate: 8000000, // 8.0 Mbps (high definition gaming)
    sdpBitrate: 'b=AS:8000',
    label: '1080p 60 FPS'
  }
};

export const getProfile = (qualityId = '1080p60') =>
  QUALITY_PROFILES[qualityId] || QUALITY_PROFILES['1080p60'];

export const getScreenConstraints = (qualityId = '1080p60') => {
  const profile = getProfile(qualityId);
  return {
    video: {
      width: { ideal: profile.width },
      height: { ideal: profile.height },
      frameRate: { ideal: profile.frameRate, max: profile.frameRate }
    },
    audio: true
  };
};

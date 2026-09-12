export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Check if running inside the native Desktop Application
export const isDesktopApp = () =>
  typeof window !== 'undefined' && Boolean(window.desktopApp?.isDesktop);

// Quality profiles tuned for crisp gaming clarity without blur or lag
export const QUALITY_PROFILES = {
  '720p30': {
    id: '720p30',
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrate: 3000000, // 3.0 Mbps
    minBitrateKbps: 2000,
    label: '720p 30 FPS'
  },
  '720p60': {
    id: '720p60',
    width: 1280,
    height: 720,
    frameRate: 60,
    bitrate: 6000000, // 6.0 Mbps
    minBitrateKbps: 4000,
    label: '720p 60 FPS'
  },
  '1080p30': {
    id: '1080p30',
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrate: 6500000, // 6.5 Mbps
    minBitrateKbps: 4500,
    label: '1080p 30 FPS'
  },
  '1080p60': {
    id: '1080p60',
    width: 1920,
    height: 1080,
    frameRate: 60,
    bitrate: 10000000, // 10.0 Mbps (Discord Nitro benchmark for sharp 1080p60 motion)
    minBitrateKbps: 7000,
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

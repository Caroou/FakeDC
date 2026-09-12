export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Check if running inside the native Desktop Application
export const isDesktopApp = () =>
  typeof window !== 'undefined' && Boolean(window.desktopApp?.isDesktop);

// Quality profiles tuned for crisp clarity and smooth motion in fast-paced games
export const QUALITY_PROFILES = {
  '720p30': {
    id: '720p30',
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrate: 4500000, // 4.5 Mbps
    startBitrateKbps: 3500,
    minBitrateKbps: 2500,
    label: '720p 30 FPS'
  },
  '720p60': {
    id: '720p60',
    width: 1280,
    height: 720,
    frameRate: 60,
    bitrate: 6500000, // 6.5 Mbps (Discord Nitro 720p60)
    startBitrateKbps: 5000,
    minBitrateKbps: 3500,
    label: '720p 60 FPS'
  },
  '1080p30': {
    id: '1080p30',
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrate: 7000000, // 7.0 Mbps
    startBitrateKbps: 5500,
    minBitrateKbps: 4000,
    label: '1080p 30 FPS'
  },
  '1080p60': {
    id: '1080p60',
    width: 1920,
    height: 1080,
    frameRate: 60,
    bitrate: 10000000, // 10.0 Mbps (Discord Nitro 1080p60 benchmark)
    startBitrateKbps: 7500,
    minBitrateKbps: 5000,
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

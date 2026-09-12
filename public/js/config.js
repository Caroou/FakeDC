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

// Check if running inside the native Desktop Application
export const isDesktopApp = () =>
  typeof window !== 'undefined' && Boolean(window.desktopApp?.isDesktop);

// 18 Mbps in Desktop for ultra-fast motion games, 8 Mbps in standard browser
export const getTargetVideoBitrate = () => (isDesktopApp() ? 18000000 : 8000000);

export const getTargetSdpBitrate = () => (isDesktopApp() ? 'b=AS:18000' : 'b=AS:8000');

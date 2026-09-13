// Centralized state container for the Faketz application
export const state = {
  socket: null,
  roomId: '',
  username: '',
  localStream: null,
  screenStream: null,
  isMicMuted: false,
  currentTab: 'join',
  chatCryptoKey: null,
  isConnecting: false,
  selectedQuality: '1080p60',
  peers: {} // userId -> { pc, isPolite, makingOffer, ignoreOffer, username, isMuted, analyser }
};

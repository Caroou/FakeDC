// Centralized state container for the FakeDC application
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
  peers: {} // userId -> { pc, isPolite, makingOffer, ignoreOffer, username, isMuted, analyser }
};

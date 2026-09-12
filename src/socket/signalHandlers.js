const RoomManager = require('../state/roomManager');

function registerSignalHandlers(io, socket) {
  // Mute status synchronization
  socket.on('mute-status', (isMuted) => {
    RoomManager.updateUserMute(socket.id, isMuted);
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-muted', socket.id, isMuted);
    }
  });

  // WebRTC P2P Signaling relay (offer/answer/candidate)
  socket.on('signal', (data) => {
    if (!data || !data.to) return;

    const user = RoomManager.getUser(socket.id);
    io.to(data.to).emit('signal', {
      from: socket.id,
      signal: data.signal,
      username: user ? user.username : 'Desconhecido',
      isMuted: user ? user.isMuted : false
    });
  });
}

module.exports = registerSignalHandlers;

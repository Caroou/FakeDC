function registerChatHandlers(io, socket) {
  socket.on('chat-message', (message) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('chat-message', {
        message,
        username: socket.username,
        userId: socket.id
      });
    }
  });
}

module.exports = registerChatHandlers;

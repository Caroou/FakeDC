const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// Mantém registro das salas e dos usuários ativos
const activeRooms = new Set();
const users = {}; // socket.id -> { username, roomId }

io.on('connection', socket => {
  
  socket.on('check-room', (data, callback) => {
    // Para retrocompatibilidade caso cliente envie string (versões antigas em cache)
    const roomId = typeof data === 'string' ? data : data.roomId;
    const username = data.username;
    
    if (!activeRooms.has(roomId)) {
      callback({ exists: false });
      return;
    }
    
    if (username) {
      const isTaken = Object.values(users).some(u => u.roomId === roomId && u.username.toLowerCase() === username.toLowerCase());
      if (isTaken) {
        callback({ exists: true, success: false, message: 'Este nome de usuário já está em uso na sala.' });
        return;
      }
    }
    callback({ exists: true, success: true });
  });
  
  socket.on('create-room', (data, callback) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    if (activeRooms.has(roomId)) {
      callback({ success: false, message: 'Sala já existe. Escolha outro nome.' });
    } else {
      activeRooms.add(roomId);
      callback({ success: true });
    }
  });

  socket.on('join-room', (roomId, username) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;
    users[socket.id] = { username, roomId, isMuted: false };
    activeRooms.add(roomId); 
    
    // Avisa os outros usuários na sala
    socket.to(roomId).emit('user-connected', socket.id, username);
  });

  socket.on('mute-status', (isMuted) => {
    if (users[socket.id]) {
      users[socket.id].isMuted = isMuted;
    }
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-muted', socket.id, isMuted);
    }
  });

  socket.on('disconnect', () => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
      delete users[socket.id];
      
      // Limpa a sala se estiver vazia
      const room = io.sockets.adapter.rooms.get(socket.roomId);
      if (!room || room.size === 0) {
        activeRooms.delete(socket.roomId);
      }
    }
  });

  // Chat message
  socket.on('chat-message', (message) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('chat-message', {
        message: message,
        username: socket.username,
        userId: socket.id
      });
    }
  });

  // WebRTC Signaling
  socket.on('signal', (data) => {
    io.to(data.to).emit('signal', {
      from: socket.id,
      signal: data.signal,
      username: users[socket.id] ? users[socket.id].username : 'Desconhecido',
      isMuted: users[socket.id] ? users[socket.id].isMuted : false
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

// In-memory state for rooms and active connected users
const activeRooms = new Map(); // roomId -> { pin: string }
const users = {}; // socket.id -> { username, roomId, isMuted }

const RoomManager = {
  hasRoom(roomId) {
    return activeRooms.has(roomId);
  },

  getRoom(roomId) {
    return activeRooms.get(roomId);
  },

  createRoom(roomId, pin = '') {
    if (activeRooms.has(roomId)) {
      return false;
    }
    activeRooms.set(roomId, { pin });
    return true;
  },

  deleteRoom(roomId) {
    return activeRooms.delete(roomId);
  },

  ensureRoom(roomId, pin = '') {
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, { pin });
    }
  },

  getUser(socketId) {
    return users[socketId];
  },

  setUser(socketId, userData) {
    users[socketId] = userData;
  },

  updateUserMute(socketId, isMuted) {
    if (users[socketId]) {
      users[socketId].isMuted = isMuted;
    }
  },

  removeUser(socketId) {
    const user = users[socketId];
    delete users[socketId];
    return user;
  },

  isUsernameTaken(roomId, username) {
    if (!username) return false;
    const lowerUsername = username.toLowerCase();
    return Object.values(users).some(
      u => u.roomId === roomId && u.username.toLowerCase() === lowerUsername
    );
  },

  cleanupRoomIfEmpty(io, roomId) {
    if (!roomId) return;
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || room.size === 0) {
      activeRooms.delete(roomId);
    }
  }
};

module.exports = RoomManager;

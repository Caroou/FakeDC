const registerRoomHandlers = require('./roomHandlers');
const registerChatHandlers = require('./chatHandlers');
const registerSignalHandlers = require('./signalHandlers');

function initSocketServer(io) {
  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerSignalHandlers(io, socket);
  });
}

module.exports = initSocketServer;

const { app, BrowserWindow, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const expressApp = require('../src/app');
const config = require('../src/config');
const initSocketServer = require('../src/socket');

// === Performance & GPU Flags for High-Motion 60 FPS Game Streaming ===
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('force-high-performance-gpu');
app.commandLine.appendSwitch(
  'enable-features',
  'WebRtc-H264WithOpenH264FFmpeg,WebRtcHardwareVideoEncoding,WebRtcHardwareVideoDecoding,WebRtc-Bwe-Receiver-LimitWithHeadroom'
);
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
app.commandLine.appendSwitch('webrtc-max-cpu-consumption-percentage', '100');

let mainWindow = null;
let embeddedServer = null;

function startEmbeddedServer() {
  return new Promise((resolve) => {
    embeddedServer = http.createServer(expressApp);
    const io = new Server(embeddedServer);
    initSocketServer(io);

    embeddedServer.listen(config.PORT, () => {
      console.log(`[FakeDC Desktop] Servidor integrado ativo na porta ${config.PORT}`);
      resolve();
    });

    embeddedServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[FakeDC Desktop] Servidor externo já detectado na porta ${config.PORT}`);
        resolve();
      } else {
        console.error('[FakeDC Desktop] Erro no servidor:', err);
        resolve();
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 960,
    minHeight: 600,
    title: 'FakeDC - Desktop Gaming Edition',
    backgroundColor: '#1e1f22',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Handle display media requests (screen / window capture)
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      // Default to primary screen or first available source with audio loopback
      const primary = sources.find(s => s.id.startsWith('screen:0')) || sources[0];
      callback({ video: primary, audio: 'loopback' });
    } catch (e) {
      console.error('[Desktop] Erro ao capturar fontes de tela:', e);
      callback({});
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL(`http://localhost:${config.PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handler to list desktop sources if requested
ipcMain.handle('get-sources', async () => {
  return await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 }
  });
});

app.whenReady().then(async () => {
  await startEmbeddedServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

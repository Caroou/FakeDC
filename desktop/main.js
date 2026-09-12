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
let pendingMediaCallback = null;

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
    pendingMediaCallback = callback;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('open-screen-picker');
    } else {
      callback({});
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadURL(`http://localhost:${config.PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (pendingMediaCallback) {
      pendingMediaCallback({});
      pendingMediaCallback = null;
    }
  });
}

// IPC handler to list desktop sources with high-res thumbnails
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 360, height: 200 },
      fetchWindowIcons: true
    });

    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      isScreen: s.id.startsWith('screen:')
    }));
  } catch (err) {
    console.error('[FakeDC Desktop] Erro ao obter fontes:', err);
    return [];
  }
});

// User selected a specific screen or window from the modal
ipcMain.handle('select-source', async (event, sourceId) => {
  if (pendingMediaCallback) {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      const chosenSource = sources.find((s) => s.id === sourceId) || sources[0];
      pendingMediaCallback({ video: chosenSource, audio: 'loopback' });
    } catch (err) {
      console.error('[FakeDC Desktop] Erro ao selecionar fonte:', err);
      pendingMediaCallback({});
    } finally {
      pendingMediaCallback = null;
    }
  }
});

// User cancelled screen selection
ipcMain.handle('cancel-source', () => {
  if (pendingMediaCallback) {
    pendingMediaCallback({});
    pendingMediaCallback = null;
  }
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

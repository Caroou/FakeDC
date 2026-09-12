import { state } from '../state.js';

let statsInterval = null;
const prevStats = new Map(); // key -> { timestamp, frames, bytes }

export function initStreamStats() {
  if (statsInterval) return;

  statsInterval = setInterval(async () => {
    if (!state.roomId) return;

    for (const userId in state.peers) {
      const peer = state.peers[userId];
      if (!peer || !peer.pc || peer.pc.connectionState !== 'connected') continue;

      try {
        const stats = await peer.pc.getStats();
        let fps = 0;
        let bitrateMbps = 0;
        let width = 0;
        let height = 0;
        let codec = 'H264';

        stats.forEach((report) => {
          if (report.type === 'codec' && report.mimeType && report.mimeType.startsWith('video/')) {
            codec = report.mimeType.split('/')[1].toUpperCase();
          }

          // Outbound stats (streamer side)
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            const key = `out-${userId}`;
            const prev = prevStats.get(key) || {
              timestamp: report.timestamp,
              frames: report.framesSent || 0,
              bytes: report.bytesSent || 0
            };

            const dt = (report.timestamp - prev.timestamp) / 1000;
            if (dt >= 0.8) {
              const dFrames = (report.framesSent || 0) - prev.frames;
              const dBytes = (report.bytesSent || 0) - prev.bytes;
              fps = Math.max(0, Math.round(dFrames / dt));
              bitrateMbps = Math.max(0, (dBytes * 8) / (dt * 1000000)).toFixed(1);
              width = report.frameWidth || (state.screenStream?.getVideoTracks()[0]?.getSettings().width) || 0;
              height = report.frameHeight || (state.screenStream?.getVideoTracks()[0]?.getSettings().height) || 0;

              prevStats.set(key, {
                timestamp: report.timestamp,
                frames: report.framesSent || 0,
                bytes: report.bytesSent || 0
              });

              updateStatsBadge('local-screen', fps, bitrateMbps, width, height, codec);
            }
          }

          // Inbound stats (viewer side)
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            const key = `in-${userId}`;
            const currentFrames = report.framesDecoded || report.framesReceived || 0;
            const prev = prevStats.get(key) || {
              timestamp: report.timestamp,
              frames: currentFrames,
              bytes: report.bytesReceived || 0
            };

            const dt = (report.timestamp - prev.timestamp) / 1000;
            if (dt >= 0.8) {
              const dFrames = currentFrames - prev.frames;
              const dBytes = (report.bytesReceived || 0) - prev.bytes;
              fps = Math.max(0, Math.round(dFrames / dt));
              bitrateMbps = Math.max(0, (dBytes * 8) / (dt * 1000000)).toFixed(1);
              width = report.frameWidth || 0;
              height = report.frameHeight || 0;

              prevStats.set(key, {
                timestamp: report.timestamp,
                frames: currentFrames,
                bytes: report.bytesReceived || 0
              });

              updateStatsBadge(`${userId}-screen`, fps, bitrateMbps, width, height, codec);
            }
          }
        });
      } catch (err) {
        // Ignore stats errors during peer renegotiation
      }
    }
  }, 1000);
}

function updateStatsBadge(mediaId, fps, bitrateMbps, width, height, codec) {
  const container = document.getElementById(`media-${mediaId}`);
  if (!container) return;

  let badge = document.getElementById(`stats-badge-${mediaId}`);
  if (!badge) {
    badge = document.createElement('div');
    badge.id = `stats-badge-${mediaId}`;
    badge.className =
      'ui-fadeable absolute top-3 left-3 bg-black/75 backdrop-blur-md font-mono text-[11px] px-2.5 py-1 rounded-lg z-20 shadow-md border border-white/10 flex items-center gap-2 pointer-events-none transition-opacity duration-300';
    container.appendChild(badge);
  }

  const fpsColor = fps >= 45 ? 'text-emerald-400' : fps >= 25 ? 'text-amber-400' : 'text-rose-400';
  const dotColor = fps >= 45 ? 'bg-emerald-400 animate-pulse' : fps >= 25 ? 'bg-amber-400' : 'bg-rose-400';
  const resStr = width && height ? `${width}p` : '';

  badge.innerHTML = `
    <span class="inline-block w-1.5 h-1.5 rounded-full ${dotColor}"></span>
    <span class="font-bold ${fpsColor}">${fps} FPS</span>
    ${bitrateMbps > 0 ? `<span class="text-zinc-500">|</span> <span class="text-zinc-200">${bitrateMbps} Mb/s</span>` : ''}
    ${resStr ? `<span class="text-zinc-500">|</span> <span class="text-zinc-300">${height || width}p</span>` : ''}
    <span class="text-zinc-400 uppercase font-semibold text-[10px]">${codec}</span>
  `;
}

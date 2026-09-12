import { state } from '../state.js';

let statsInterval = null;
const prevStats = new Map(); // key -> { timestamp, frames, bytes }

export function initStreamStats() {
  if (statsInterval) return;

  statsInterval = setInterval(async () => {
    if (!state.roomId) return;

    for (const userId in state.peers) {
      const peer = state.peers[userId];
      if (!peer || !peer.pc) continue;

      const connState = peer.pc.connectionState;
      const iceState = peer.pc.iceConnectionState;
      if (connState !== 'connected' && iceState !== 'connected' && iceState !== 'completed') {
        continue;
      }

      try {
        const stats = await peer.pc.getStats();
        let codec = 'H264';

        // Detect active video codec
        stats.forEach((report) => {
          if (report.type === 'codec' && report.mimeType && report.mimeType.startsWith('video/')) {
            codec = report.mimeType.split('/')[1].toUpperCase();
          }
        });

        stats.forEach((report) => {
          // Outbound stats (streamer side)
          if (report.type === 'outbound-rtp' && report.kind === 'video') {
            const key = `out-${userId}`;
            const currentFrames = report.framesSent || 0;
            const currentBytes = report.bytesSent || 0;
            const prev = prevStats.get(key);

            if (!prev) {
              prevStats.set(key, {
                timestamp: report.timestamp,
                frames: currentFrames,
                bytes: currentBytes
              });
              const fps = report.framesPerSecond ? Math.round(report.framesPerSecond) : 60;
              const width = report.frameWidth || (state.screenStream?.getVideoTracks()[0]?.getSettings().width) || 0;
              const height = report.frameHeight || (state.screenStream?.getVideoTracks()[0]?.getSettings().height) || 0;
              updateStatsBadge('local-screen', fps, '0.0', width, height, codec);
              return;
            }

            const dt = (report.timestamp - prev.timestamp) / 1000;
            if (dt >= 0.7) {
              const dFrames = currentFrames - prev.frames;
              const dBytes = currentBytes - prev.bytes;
              const calculatedFps = Math.max(0, Math.round(dFrames / dt));
              const fps = (report.framesPerSecond && report.framesPerSecond > 0)
                ? Math.round(report.framesPerSecond)
                : calculatedFps;
              const bitrateMbps = Math.max(0, (dBytes * 8) / (dt * 1000000)).toFixed(1);
              const width = report.frameWidth || (state.screenStream?.getVideoTracks()[0]?.getSettings().width) || 0;
              const height = report.frameHeight || (state.screenStream?.getVideoTracks()[0]?.getSettings().height) || 0;

              prevStats.set(key, {
                timestamp: report.timestamp,
                frames: currentFrames,
                bytes: currentBytes
              });

              updateStatsBadge('local-screen', fps, bitrateMbps, width, height, codec);
            }
          }

          // Inbound stats (viewer side)
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            const key = `in-${userId}`;
            const currentFrames = report.framesDecoded || report.framesReceived || 0;
            const currentBytes = report.bytesReceived || 0;
            const prev = prevStats.get(key);

            if (!prev) {
              prevStats.set(key, {
                timestamp: report.timestamp,
                frames: currentFrames,
                bytes: currentBytes
              });
              const fps = report.framesPerSecond ? Math.round(report.framesPerSecond) : 0;
              updateStatsBadge(`${userId}-screen`, fps, '0.0', report.frameWidth || 0, report.frameHeight || 0, codec);
              return;
            }

            const dt = (report.timestamp - prev.timestamp) / 1000;
            if (dt >= 0.7) {
              const dFrames = currentFrames - prev.frames;
              const dBytes = currentBytes - prev.bytes;
              const calculatedFps = Math.max(0, Math.round(dFrames / dt));
              const fps = (report.framesPerSecond && report.framesPerSecond > 0)
                ? Math.round(report.framesPerSecond)
                : calculatedFps;
              const bitrateMbps = Math.max(0, (dBytes * 8) / (dt * 1000000)).toFixed(1);
              const width = report.frameWidth || 0;
              const height = report.frameHeight || 0;

              prevStats.set(key, {
                timestamp: report.timestamp,
                frames: currentFrames,
                bytes: currentBytes
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
      'absolute top-3 left-3 bg-black/80 backdrop-blur-md font-mono text-[11px] px-2.5 py-1 rounded-lg z-30 shadow-lg border border-white/15 flex items-center gap-2 pointer-events-none select-none';
    container.appendChild(badge);
  }

  const fpsColor = fps >= 45 ? 'text-emerald-400' : fps >= 25 ? 'text-amber-400' : 'text-rose-400';
  const dotColor = fps >= 45 ? 'bg-emerald-400 animate-pulse' : fps >= 25 ? 'bg-amber-400' : 'bg-rose-400';
  const resStr = width && height ? `${height || width}p` : '';

  badge.innerHTML = `
    <span class="inline-block w-1.5 h-1.5 rounded-full ${dotColor}"></span>
    <span class="font-bold ${fpsColor}">${fps} FPS</span>
    ${bitrateMbps > 0 ? `<span class="text-zinc-500">|</span> <span class="text-zinc-200">${bitrateMbps} Mb/s</span>` : ''}
    ${resStr ? `<span class="text-zinc-500">|</span> <span class="text-zinc-300">${resStr}</span>` : ''}
    <span class="text-zinc-400 uppercase font-semibold text-[10px]">${codec}</span>
  `;
}

// Builds the ffmpeg command-line for each job. Everything writes to stdout (pipe:1),
// video-only (-an), as raw H.264 so the browser's jMuxer can play RTSP and P2P alike.

// -flush_packets 1 pushes each packet out right away (low latency, no buffering up).
const videoOut = (transcode) =>
  transcode
    ? ['-flush_packets', '1', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-f', 'h264']
    : ['-flush_packets', '1', '-c:v', 'copy', '-f', 'h264'];

export const rtspStreamArgs = (url, { transcode = false } = {}) => [
  '-hide_banner', '-loglevel', 'error',
  '-rtsp_transport', 'tcp',
  '-fflags', '+genpts',
  '-i', url,
  '-an',
  ...videoOut(transcode),
  'pipe:1',
];

export const p2pStreamArgs = ({ transcode = false } = {}) => [
  '-hide_banner', '-loglevel', 'error',
  '-fflags', '+genpts',
  '-f', 'h264', '-i', 'pipe:0',
  '-an',
  ...videoOut(transcode),
  'pipe:1',
];

export const snapshotArgs = (url) => [
  '-hide_banner', '-loglevel', 'error',
  '-rtsp_transport', 'tcp',
  '-i', url,
  '-frames:v', '1',
  '-f', 'mjpeg',
  'pipe:1',
];

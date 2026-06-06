// Pure builders for ffmpeg argument vectors. Keeping these pure means the tricky
// part (the exact flags) is unit-tested without spawning ffmpeg.
// All builders write to stdout (pipe:1), video-only (-an), output = raw H.264
// Annex-B so the browser's jMuxer can consume both RTSP and P2P identically.

// -flush_packets 1 makes ffmpeg flush the muxer after every packet → low latency,
// and prevents the output from sitting buffered when input arrives in bursts.
const VIDEO_OUT = (transcode) =>
  transcode
    ? ['-flush_packets', '1', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-f', 'h264']
    : ['-flush_packets', '1', '-c:v', 'copy', '-f', 'h264'];

export function rtspStreamArgs(url, { transcode = false } = {}) {
  return [
    '-hide_banner', '-loglevel', 'error',
    '-rtsp_transport', 'tcp',
    '-fflags', '+genpts',
    '-i', url,
    '-an',
    ...VIDEO_OUT(transcode),
    'pipe:1',
  ];
}

export function p2pStreamArgs({ transcode = false } = {}) {
  return [
    '-hide_banner', '-loglevel', 'error',
    '-fflags', '+genpts',
    '-f', 'h264', '-i', 'pipe:0',
    '-an',
    ...VIDEO_OUT(transcode),
    'pipe:1',
  ];
}

export function snapshotArgs(url) {
  return [
    '-hide_banner', '-loglevel', 'error',
    '-rtsp_transport', 'tcp',
    '-i', url,
    '-frames:v', '1',
    '-f', 'mjpeg',
    'pipe:1',
  ];
}

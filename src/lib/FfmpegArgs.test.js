import assert from 'node:assert/strict';
import { test } from 'node:test';
import { p2pStreamArgs, rtspStreamArgs } from './FfmpegArgs.js';

test('rtspStreamArgs streams the rtsp URL over TCP, video-only, to stdout', () => {
  const args = rtspStreamArgs('rtsp://cam/live0');
  assert.deepEqual(args.slice(-1), ['pipe:1']); // always writes to stdout
  assert.ok(args.includes('-an')); // video only
  assert.equal(args[args.indexOf('-rtsp_transport') + 1], 'tcp');
  assert.equal(args[args.indexOf('-i') + 1], 'rtsp://cam/live0');
});

test('rtspStreamArgs copies H.264 by default and transcodes only when asked', () => {
  assert.ok(rtspStreamArgs('rtsp://x').includes('copy'));
  assert.ok(!rtspStreamArgs('rtsp://x').includes('libx264'));

  const transcoded = rtspStreamArgs('rtsp://x', { transcode: true });
  assert.ok(transcoded.includes('libx264'));
  assert.ok(transcoded.includes('zerolatency'));
  assert.ok(!transcoded.includes('copy'));
});

test('p2pStreamArgs reads raw H.264 from stdin (pipe:0) and writes to stdout', () => {
  const args = p2pStreamArgs();
  assert.equal(args[args.indexOf('-i') + 1], 'pipe:0');
  assert.equal(args[args.indexOf('-f') + 1], 'h264');
  assert.deepEqual(args.slice(-1), ['pipe:1']);
  assert.ok(args.includes('-an'));
});

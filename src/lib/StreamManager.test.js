import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { StreamManager } from './StreamManager.js';

// A stand-in for an RtspSource/P2pSource: records start/stop calls and lets the test
// push 'chunk'/'status'/'error' events.
class FakeSource extends EventEmitter {
  constructor() {
    super();
    this.started = 0;
    this.stopped = 0;
    this.isRunning = false;
  }
  start() {
    this.started += 1;
    this.isRunning = true;
  }
  stop() {
    this.stopped += 1;
    this.isRunning = false;
  }
}

// Controllable timers matching StreamManager's {setTimer, clearTimer} contract.
const makeTimers = () => {
  const scheduled = [];
  return {
    timers: {
      setTimer: (fn) => {
        const handle = { fn, cleared: false };
        scheduled.push(handle);
        return handle;
      },
      clearTimer: (handle) => {
        if (handle) {
          handle.cleared = true;
        }
      },
    },
    fireAll: () => {
      for (const h of scheduled) {
        if (!h.cleared) {
          h.fn();
        }
      }
    },
  };
};

const setup = (camera) => {
  const sources = [];
  const createSource = () => {
    const s = new FakeSource();
    sources.push(s);
    return s;
  };
  const { timers, fireAll } = makeTimers();
  const mgr = new StreamManager({ createSource, autoStopMs: 1000, timers });
  return { mgr, sources, fireAll, camera };
};

test('first viewer creates and starts the source exactly once; a second viewer reuses it', () => {
  const { mgr, sources } = setup();
  const camera = { id: 'cam1', battery: false };

  mgr.addViewer(camera, 'v1');
  assert.equal(sources.length, 1, 'source created once');
  assert.equal(sources[0].started, 1, 'source started once');

  mgr.addViewer(camera, 'v2');
  assert.equal(sources.length, 1, 'no second source created');
  assert.equal(sources[0].started, 1, 'source not started again');
});

test('source is torn down only when the last viewer leaves', () => {
  const { mgr, sources } = setup();
  const camera = { id: 'cam1', battery: false };
  mgr.addViewer(camera, 'v1');
  mgr.addViewer(camera, 'v2');

  mgr.removeViewer('cam1', 'v1');
  assert.equal(sources[0].stopped, 0, 'still has a viewer → not stopped');

  mgr.removeViewer('cam1', 'v2');
  assert.equal(sources[0].stopped, 1, 'last viewer left → stopped');
});

test('a battery camera arms autoStop: firing it tears down and emits "autostopped"', () => {
  const { mgr, sources, fireAll } = setup();
  const camera = { id: 'solo', battery: true };
  const events = [];
  mgr.on('autostopped', (id) => events.push(id));

  mgr.addViewer(camera, 'v1');
  fireAll();

  assert.equal(sources[0].stopped, 1, 'autoStop stopped the source');
  assert.deepEqual(events, ['solo'], 'autostopped emitted with camera id');
});

test('a non-battery camera does not arm autoStop', () => {
  const { mgr, sources, fireAll } = setup();
  const camera = { id: 'cam1', battery: false };
  mgr.addViewer(camera, 'v1');
  fireAll();
  assert.equal(sources[0].stopped, 0, 'no autoStop for a wired camera');
});

test('liveStatus reflects viewers and bytes received from the source', () => {
  const { mgr, sources } = setup();
  const camera = { id: 'cam1', battery: false };
  mgr.addViewer(camera, 'v1');

  sources[0].emit('chunk', Buffer.alloc(10));
  sources[0].emit('chunk', Buffer.alloc(5));

  const status = mgr.liveStatus('cam1');
  assert.equal(status.active, true);
  assert.equal(status.viewers, 1);
  assert.equal(status.bytes, 15);
});

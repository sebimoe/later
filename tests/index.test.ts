import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { LaterSpec } from '../dist';
import { later, timeout } from '../dist';
import { LaterPromiseState } from '../dist';

const specs: LaterSpec[] = [
  { type: 'timeout', duration: 100 },
  { type: 'idle', duration: 100 },
  { type: 'animationFrame' },
  { type: 'immediate' },
  { type: 'microtask' },
  { type: 'now' },
  'animationFrame',
  'immediate',
  'microtask',
  'now'
];

const calls = {
  'later.timeout(1, fn)': fn => later.timeout(1, fn),
  'later.idle(1, fn)': fn => later.idle(1, fn),
  'later.animationFrame(fn)': fn => later.animationFrame(fn),
  'later.immediate(fn)': fn => later.immediate(fn),
  'later.microtask(fn)': fn => later.microtask(fn),
  'later.now(fn)': fn => later.now(fn),
  ...Object.fromEntries(specs.map(spec => [`later(${JSON.stringify(spec)}, fn)`, fn => later(spec, fn)])),
} as Record<string, (fn: any) => any>;

for(let spec of specs) {
  const type = typeof spec === "string" ? spec : spec.type;

  test(`spec '${type}' (${typeof spec}) - executes correctly`, async () => {
    let started = false;
    const promise = later(spec, () => started = true);

    if(type === "now") {
      assert.is(started, true, "Callback should already execute");
      assert.is(promise.state, LaterPromiseState.Completed, "State should be 'completed' at creation of now");
      return;
    }else{
      assert.is(started, false, "Callback should not execute yet");
      assert.is(promise.state, LaterPromiseState.Scheduled, "State should be 'scheduled' at creation");
    }

    if(type === "idle") {
      await new Promise(r => setTimeout(r, 150));
      assert.is(promise.state, LaterPromiseState.Completed);
      return;
    }

    await Promise.resolve();

    if(type === "microtask") {
      assert.is(promise.state, LaterPromiseState.Completed, "State should be 'completed' in microtask queue");
      assert.is(started, true, "Callback should already execute");
      return;
    }else{
      assert.is(promise.state, LaterPromiseState.Scheduled, "State should be 'scheduled' in microtask queue");
      assert.is(started, false, "Callback should not execute yet");
    }
    
    await new Promise(r => setImmediate(r))

    if(type === "immediate") {
      assert.is(promise.state, LaterPromiseState.Completed, "State should be 'completed' after immediate");
      assert.is(started, true, "Callback should already execute");
      return;
    }else{
      assert.is(promise.state, LaterPromiseState.Scheduled, "State should be 'scheduled' after immediate");
      assert.is(started, false, "Callback should not execute yet");
    }

    await Promise.resolve();

    assert.is(promise.state, LaterPromiseState.Scheduled, "State should be 'scheduled'");
    assert.is(started, false, "Callback should not execute yet");
    
    await new Promise(r => setTimeout(r, 20));

    if(type === "animationFrame") {
      assert.is(promise.state, LaterPromiseState.Completed, "State should be 'completed' after about 20ms");
      assert.is(started, true, "Callback should already execute");
      return;
    }else{
      assert.is(promise.state, LaterPromiseState.Scheduled, "State should be 'scheduled' after about 20ms");
      assert.is(started, false, "Callback should not execute yet");
    }
    
    await new Promise(r => setTimeout(r, 130));

    // timeout
    assert.is(promise.state, LaterPromiseState.Completed, "State should be 'completed' after about 150ms");
    assert.is(started, true, "Callback should already execute");
  });
}

for(let [name, fn] of Object.entries(calls)) {
  test(`${name} - correct return value`, async () => {
    const retNoCallback = fn(undefined);
    assert.instance(retNoCallback, Promise, "Should return Promise instance");
    assert.is(await retNoCallback, undefined, "Returned promise should resolve to undefined");

    assert.is(await fn(() => "test"), "test", "Returned promise should resolve to value");

    assert.is(await fn(async () => Promise.resolve("test")), "test", "Returned promise should resolve to value (double promise)");
  });
}

test('readme examples don\'t throw', async () => {
  {
    later.timeout(1000, () => {});

    later({ type: 'timeout', duration: 10 }, () => {})
    
    const x = await timeout(10);
    const y = await timeout(10, () => 100);
  }

  {
    await later.timeout(50);

    // Callback can return a value
    const value = await later.idle(50, async () => {
        const calculated = await Promise.resolve(8008135); // do some work
        return calculated;
    });
  }

  {
    const promise = later.timeout(100, () => console.log('Task complete!'));
    later.timeout(5, () => promise.start()); // Start the task early, skipping the timeout delay
  }

  {
    const promise = later.timeout(100, () => console.log('Task complete!'));
    later.timeout(5, () => promise.cancel());  // Cancels the task before it starts
    // callback will not run, and the promise will resolve with the value passed to cancel()
  }
});

test.run();

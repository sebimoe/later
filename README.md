# `later-p` (`later`) [github](https://github.com/sebimoe/later-p), [npm](https://www.npmjs.com/package/later-p)

A simple to use and small but versatile scheduling library for JavaScript, compatible with both Node.js and browser, providing multiple ways to defer tasks. 

Ideal for both developers and library authors looking to integrate flexible delay mechanisms into their tools.

## Features
- Supports multiple scheduling strategies (timeout, microtask, animation frame, etc.).
- Enhanced promises with state tracking (Scheduled, Started, Cancelled, Completed).
- Methods to control execution (start early, cancel, reject) programmatically.
- Works across both browser and Node.js environments with appropriate fallbacks.

## Installation

```bash
npm install later-p
```

## Usage Summary
Later provides several delay methods that optionally take a callback and return an enhanced promise evaluating to callback return value. 

These promises can be controlled through `.start()` (to start early, bypassing the wait), `.cancel()`, and `.reject()`. 

### Available Methods

| Method           | Function Used                 | Fallback (if unavailable)  |
|------------------|-------------------------------|----------------------------|
| `timeout` (ms)   | `setTimeout`                  | -                          |
| `idle` (ms)      | `requestIdleCallback`         | `setTimeout(duration)`     |
| `microtask`      | `queueMicrotask`              | `Promise.resolve().then()` |
| `animationFrame` | `requestAnimationFrame`       | `setTimeout(15)`           |
| `immediate`      | `setImmediate`                | `setTimeout(0)`            |
| `now`            | Immediate synchronous call    | -                          |


### API Summary

```ts
later(spec: LaterSpec, callback?)
// LaterSpec is either a string for methods which do not take a duration, or an object:
// - { type: 'timeout', duration: 100 }
// - 'animationFrame'
// - { type: 'animationFrame' }

later.timeout(duration: number, callback?)
later.idle(duration: number, callback?)
later.microtask(callback?)
later.animationFrame(callback?)
later.immediate(callback?)
later.now(callback?)
```

All methods above return a `LaterPromise<T>` which extends the standard `Promise<T>`, and `T` is the return type of the callback provided, or `void` if no callback is provided.

The returned `LaterPromise<T>` has the following additional methods. They return a boolean of whether they have succeded - if the callback has already started to run, they will return `false` and not do anything.

- `start()`: Immediately starts the callback, skipping the delay (if not already started).
- `cancel(value: T)`: Cancels the scheduled execution and resolves the promise with the provided value.
- `reject(reason?: any)`: Rejects the promise, if it hasn't started yet.

The promise also has a `state` property which indicates whether the promise is:
 - `scheduled` - initial state
 - `started` - the wait has ended and callback has begun executing
 - `completed` - after the callback exits
 - `cancelled` - if `cancel()` has been called while promise was still in `scheduled` state.


## Examples

Different ways to call:
```ts
import { later, timeout } from 'later';

later.timeout(1000, () => console.log('Scheduled using later.timeout()'));

later({ type: 'timeout', duration: 1000 }, () => console.log('Scheduled using later()'))

timeout(1000, () => console.log('Scheduled using timeout()'));
```

Use promises:
```ts
console.log('Started!');
await later.timeout(500);
console.log('Waited 500ms!');

// Callback can return a value
const value = await later.idle(500, async () => {
    const calculated = await Promise.resolve(8008135); // do some work
    return calculated;
});

console.log('Callback returned:', value);
```

Start tasks early:
```ts
const promise = later.timeout(2000, () => console.log('Task complete!'));
later.timeout(500, () => promise.start()); // Start the task early, skipping the timeout delay
```

Cancel tasks:
```ts
const promise = later.timeout(500, () => console.log('Task complete!'));
later.timeout(200, () => promise.cancel());  // Cancels the task before it starts
// callback will not run, and the promise will resolve with the value passed to cancel()
```

Accept delay specification from the user:
```ts
async function myFunction(delay?: LaterSpec) {
    for(...) {
        await doWork();
        await later(spec ?? "now");
    }
}
```

## Types

```ts
enum LaterPromiseState {
    Scheduled = "scheduled",
    Cancelled = "cancelled",
    Started = "started",
    Completed = "completed"
}

interface LaterPromise<T> extends Promise<T> {
    start(): boolean;
    cancel(value: T): boolean;
    reject(reason?: any): boolean;
    readonly state: LaterPromiseState;
}

type LaterSpec =
    | 'timeout'
    | 'idle'
    | 'microtask'
    | 'animationFrame'
    | 'immediate'
    | 'now'
    | { type: 'timeout', duration: number }
    | { type: 'idle', duration: number }
    | { type: 'microtask' }
    | { type: 'animationFrame' }
    | { type: 'immediate' }
    | { type: 'now' };

type LaterCallback<T> = undefined | (() => T | Promise<T>);

// You can create a custom LaterPromise, you are responsible for calling start() when needed, cancelCallback gets executed when .cancel() is called and promise has not started yet.
function laterPromise<T = void>(startCallback?: LaterCallback<T>, cancelCallback?: () => void): LaterPromise<T>;

function timeout<T>(duration: number, callback?: LaterCallback<T>): LaterPromise<T>;
function idle<T>(duration: number, callback?: LaterCallback<T>): LaterPromise<T>;
function now<T>(callback?: LaterCallback<T>): LaterPromise<T>;
function immediate<T>(callback?: LaterCallback<T>): LaterPromise<T>;
function microtask<T>(callback?: LaterCallback<T>): LaterPromise<T>;
function animationFrame<T>(callback?: LaterCallback<T>): LaterPromise<T>;

// LaterMethods consists of the above 6 methods
interface Later extends LaterMethods {
    (spec: LaterSpec): LaterPromise<void>;
    <T>(spec: LaterSpec, callback: LaterCallback<T>): LaterPromise<T>;
}

const later: Later;
```

export enum LaterPromiseState {
  Scheduled = 'scheduled',
  Cancelled = 'cancelled',
  Started = 'started',
  Completed = 'completed',
};

export interface LaterPromise<T> extends Promise<T> {
  start(): boolean,
  cancel(value: T): boolean,
  reject(reason?: any): boolean,

  readonly state: LaterPromiseState;
}

type LaterSimpleSpec<Type extends string> = Type | { type: Type };
type LaterDurationSpec<Type extends string> = { type: Type, duration: number };

const laterDurationMethodNames = ['timeout', 'idle'] as const;
const laterSimpleMethodNames = ['now', 'immediate', 'microtask', 'animationFrame'] as const;
const laterDurationMethodNamesSet = new Set<string>(laterDurationMethodNames);

type LaterDurationMethodSpecs = { [K in typeof laterDurationMethodNames[number]]: LaterDurationSpec<K> }
type LaterSimpleMethodSpecs = { [K in typeof laterSimpleMethodNames[number]]: LaterSimpleSpec<K> }

type LaterMethodSpecs = LaterDurationMethodSpecs & LaterSimpleMethodSpecs;

export type LaterSpec = LaterMethodSpecs[keyof LaterMethodSpecs];

export type LaterCallback<T> = undefined | (() => T | Promise<T>);

type LaterMethods = {
  [K in keyof LaterMethodSpecs]: LaterMethodSpecs[K] extends LaterDurationSpec<string> 
    ? {
      (duration: LaterMethodSpecs[K]["duration"]): LaterPromise<void>;
      <T>(duration: LaterMethodSpecs[K]["duration"], callback: LaterCallback<T>): LaterPromise<T>;
    } : {
      <T>(): LaterPromise<void>;
      <T>(callback: LaterCallback<T>): LaterPromise<T>;
    }
};

export interface Later extends LaterMethods {
  (spec: LaterSpec): LaterPromise<void>,
  <T>(spec: LaterSpec, callback: LaterCallback<T>): LaterPromise<T>,
}

export function laterPromise<T = void>(startCallback?: LaterCallback<T>, cancelCallback?: () => void) {
  let resolve: (item: T | Promise<T>) => void;
  let reject: (reason?: any) => void;

  const laterPromise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  }) as { 
    -readonly [P in keyof LaterPromise<T>]: LaterPromise<T>[P] 
  };

  laterPromise.state = LaterPromiseState.Scheduled;

  const completed = () => laterPromise.state = LaterPromiseState.Completed;
  
  laterPromise.start = () => {
    if(laterPromise.state === LaterPromiseState.Scheduled) {
      if(!startCallback) {
        (resolve as any)();
        completed();
      }else{
        laterPromise.state = LaterPromiseState.Started;
        try {
          const ret = startCallback();
          resolve(ret);
          if(ret && typeof ret === 'object' && 'then' in ret && typeof ret.then === "function") {
            ret.then(completed, completed);
          }else{
            completed();
          }
        }catch(e) {
          reject(e);
        }
      }
      return true;
    }
    return false;
  };

  laterPromise.cancel = (returnValue: T) => {
    if(laterPromise.state === LaterPromiseState.Scheduled) {
      laterPromise.state = LaterPromiseState.Cancelled;
      resolve(returnValue);
      cancelCallback?.();
      return true;
    }
    return false;
  };
  
  laterPromise.reject = (reason?: any) => {
    if(laterPromise.state === LaterPromiseState.Scheduled) {
      laterPromise.state = LaterPromiseState.Cancelled;
      reject(reason);
      return true;
    }
    return false;
  };

  return laterPromise as LaterPromise<T>;
}

function laterMethodWrapper<T>(callback: LaterCallback<T>, setup: (start: () => void) => void | (() => void)) {
  let cancel: void | (() => void);
  const promise = laterPromise(callback, () => cancel?.());
  cancel = setup(promise.start);
  return promise;
}

export function timeout<T>(duration: number, callback?: LaterCallback<T>): LaterPromise<T> {
  return laterMethodWrapper(callback, start => {
    const id = setTimeout(start, duration);
    return () => clearTimeout(id);
  });
};

export function idle<T>(duration: number, callback?: LaterCallback<T>): LaterPromise<T> {
  if(typeof requestIdleCallback !== "function") return laterMethods.timeout(duration, callback);
  return laterMethodWrapper(callback, start => {
    const id = requestIdleCallback(start, { timeout: duration });
    return () => cancelIdleCallback(id);
  });
}

export function now<T>(callback?: LaterCallback<T>): LaterPromise<T> {
  return laterMethodWrapper(callback, start => start());
}

export function immediate<T>(callback?: LaterCallback<T>): LaterPromise<T> {
  if(typeof setImmediate !== "function") return laterMethods.timeout(0, callback);
  return laterMethodWrapper(callback, start => { setImmediate(start); });
}

export function microtask<T>(callback?: LaterCallback<T>): LaterPromise<T> {
  return laterMethodWrapper(callback, start => {
    if(typeof queueMicrotask === "function") {
      queueMicrotask(start);
    }else{
      Promise.resolve().then(start);
    }
  });
}

export function animationFrame<T>(callback?: LaterCallback<T>): LaterPromise<T> {
  if(typeof requestAnimationFrame !== "function") return laterMethods.timeout(15, callback);
  return laterMethodWrapper(callback, start => {
    const id = requestAnimationFrame(start);
    return () => cancelAnimationFrame(id);
  });
}

const laterMethods: LaterMethods = {
  timeout, idle, now, immediate, microtask, animationFrame
};

export const later = function<T>(spec: LaterSpec, callback?: LaterCallback<T>): LaterPromise<void> | LaterPromise<T> {
  const stringSpec = typeof spec === "string";
  const type = stringSpec ? spec : spec.type;

  const method = laterMethods[type];
  if(!method) {
    throw new Error(`Unknown later method '${type}'`);
  }

  if(laterDurationMethodNamesSet.has(type)) {
    if(stringSpec) {
      throw new Error(`An object containing type and duration must be specified for '${type}'`);
    }
    return (method as any)((spec as LaterDurationSpec<string>).duration, callback);
  }else{
    return (method as any)(callback);
  }
} as Later;

Object.assign(later, laterMethods);

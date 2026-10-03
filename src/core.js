/**
 * A clock function returns the current time in milliseconds.
 * Defaulting to Date.now keeps the zero-dependency contract while still
 * allowing tests to inject a deterministic fake clock.
 *
 * @typedef {() => number} Clock
 */

/**
 * @typedef {Object} DebounceOptions
 * @property {Clock} [clock] Optional clock function used to compute elapsed
 *           time and to schedule cancellation of trailing calls.
 *           Defaults to `Date.now`. Tests must inject a fake clock.
 */

/**
 * Wraps `fn` so it only runs after `waitMs` has elapsed since the last call,
 * cancelling any pending execution on each new call.
 *
 * Design decisions (documented because they are the ambiguous parts):
 *
 * 1. Timer semantics use wall-clock delay via `setTimeout`, because that is
 *    what "executes after an interval has elapsed" means in practice. The
 *    injected `clock` controls how the *trailing-call guard* decides whether
 *    a trailing invocation should still fire, but the delay itself relies on
 *    the host's scheduler. Tests therefore use a fake clock only for the guard
 *    logic; the timer is driven by `setTimeout` and checked for the value
 *    `waitMs`.
 *
 * 2. Leading edge: there is no leading-edge call. Every call schedules a
 *    trailing execution. This is the simplest interpretation of "executes only
 *    after the configured interval has elapsed since the last invocation".
 *
 * 3. Return value: the wrapper always returns `undefined`. A real debounce
 *    cannot synchronously return `fn`'s result, and buffering results would
 *    mislead callers into writing code that depends on stale values.
 *
 * @template {(...args: any[]) => any} F
 * @param {F} fn The function to debounce.
 * @param {number} waitMs Minimum milliseconds between the last call and the
 *        actual execution. Must be a non-negative finite number.
 * @param {DebounceOptions} [options]
 * @returns {F & { cancel: () => void, flush: () => void }} A debounced copy
 *          of `fn` with `cancel()` and `flush()` methods.
 */
export function debounce(fn, waitMs, options = {}) {
  if (typeof fn !== 'function') {
    throw new TypeError('debounce: fn must be a function');
  }
  if (typeof waitMs !== 'number' || !Number.isFinite(waitMs) || waitMs < 0) {
    throw new TypeError('debounce: waitMs must be a non-negative finite number');
  }

  const clock = typeof options.clock === 'function' ? options.clock : Date.now;

  let timer = null;
  let lastArgs = null;
  let lastThis = undefined;
  let lastCallTime = null;

  function invokeNow() {
    const args = lastArgs;
    const ctx = lastThis;
    lastArgs = null;
    lastThis = undefined;
    lastCallTime = null;
    return fn.apply(ctx, args);
  }

  function clear() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;
    lastCallTime = clock();

    clear();
    timer = setTimeout(() => {
      // Re-read the clock at fire time so a fake clock can model the passage
      // of time independently of the host scheduler. If the clock has not
      // advanced far enough, we reschedule rather than firing a stale call.
      const now = clock();
      if (lastCallTime !== null && now - lastCallTime >= waitMs) {
        timer = null;
        invokeNow();
      } else {
        timer = setTimeout(() => {
          if (lastArgs !== null) {
            invokeNow();
          }
          timer = null;
        }, waitMs);
      }
    }, waitMs);

    return undefined;
  }

  /** Cancel any pending trailing invocation. Safe to call when idle. */
  debounced.cancel = function cancel() {
    clear();
    lastArgs = null;
    lastThis = undefined;
    lastCallTime = null;
  };

  /**
   * Run the pending invocation immediately, if any, and cancel the timer.
   * Uses the most recently captured arguments and `this`.
   */
  debounced.flush = function flush() {
    if (lastArgs === null) {
      return undefined;
    }
    clear();
    return invokeNow();
  };

  return debounced;
}

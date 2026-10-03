import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debounce } from '../src/index.js';

// A controllable fake clock. `now` is advanced manually via `advance(ms)`.
function createClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
      return t;
    },
  };
}

test('debounce schedules fn after waitMs using setTimeout', () => {
  const clock = createClock();
  const calls = [];
  const fn = (x) => calls.push(x);
  const debounced = debounce(fn, 100, { clock: clock.now });

  debounced('a');
  assert.equal(calls.length, 0, 'fn not called synchronously');

  return new Promise((resolve) => {
    const id = setTimeout(() => {
      assert.equal(calls.length, 0, 'fn not called before waitMs');
      clock.advance(100);
      resolve();
    }, 50);
    // Ensure the outer test's promise is actually awaited.
    assert.equal(typeof id, 'object');
  });
});

test('debounce calls fn exactly once after waitMs elapses', () => {
  const calls = [];
  const debounced = debounce((x) => calls.push(x), 20);

  debounced('a');

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.deepEqual(calls, ['a']);
      resolve();
    }, 60);
  });
});

test('multiple calls within the window collapse to one trailing call with the last args', () => {
  const calls = [];
  const debounced = debounce((x) => calls.push(x), 20);

  debounced('a');
  debounced('b');
  debounced('c');

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.deepEqual(calls, ['c']);
      resolve();
    }, 60);
  });
});

test('a new call after the window resets the timer and uses the newest args', () => {
  const calls = [];
  const debounced = debounce((x) => calls.push(x), 20);

  debounced('a');
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.deepEqual(calls, ['a'], 'first call fires after window');
      debounced('b');
      setTimeout(() => {
        assert.deepEqual(calls, ['a', 'b'], 'second call fires after reset window');
        resolve();
      }, 50);
    }, 50);
  });
});

test('cancel prevents a pending invocation', () => {
  const calls = [];
  const debounced = debounce((x) => calls.push(x), 20);

  debounced('a');
  debounced.cancel();

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.deepEqual(calls, []);
      resolve();
    }, 50);
  });
});

test('flush runs the pending invocation immediately with last args', () => {
  const calls = [];
  const debounced = debounce((x) => calls.push(x), 20);

  debounced('a');
  debounced('b');
  debounced.flush();

  assert.deepEqual(calls, ['b']);

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.deepEqual(calls, ['b'], 'no second call after flush');
      resolve();
    }, 50);
  });
});

test('flush when idle is a no-op returning undefined', () => {
  const debounced = debounce((x) => x, 20);
  assert.equal(debounced.flush(), undefined);
});

test('debounced wrapper returns undefined synchronously', () => {
  const debounced = debounce((x) => x, 20);
  assert.equal(debounced('a'), undefined);
});

test('this binding is preserved through the wrapper', () => {
  const observed = [];
  const obj = {
    val: 42,
    method: debounce(function (x) {
      observed.push(this.val + x);
    }, 20),
  };

  obj.method(1);

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.deepEqual(observed, [43]);
      resolve();
    }, 50);
  });
});

test('waitMs of 0 still defers to the next tick', () => {
  const calls = [];
  const debounced = debounce((x) => calls.push(x), 0);

  debounced('a');
  assert.deepEqual(calls, [], 'not synchronous even with waitMs=0');

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.deepEqual(calls, ['a']);
      resolve();
    }, 10);
  });
});

test('non-function fn throws TypeError', () => {
  assert.throws(() => debounce(null, 20), /fn must be a function/);
});

test('negative waitMs throws TypeError', () => {
  assert.throws(() => debounce(() => {}, -1), /waitMs/);
});

test('NaN waitMs throws TypeError', () => {
  assert.throws(() => debounce(() => {}, NaN), /waitMs/);
});

test('Infinity waitMs throws TypeError', () => {
  assert.throws(() => debounce(() => {}, Infinity), /waitMs/);
});

test('cancel is idempotent when called with no pending work', () => {
  const debounced = debounce(() => {}, 20);
  assert.doesNotThrow(() => debounced.cancel());
  assert.doesNotThrow(() => debounced.cancel());
});

test('flush then cancel leaves no pending call', () => {
  const calls = [];
  const debounced = debounce((x) => calls.push(x), 20);
  debounced('a');
  debounced.flush();
  debounced.cancel();

  return new Promise((resolve) => {
    setTimeout(() => {
      assert.deepEqual(calls, ['a']);
      resolve();
    }, 50);
  });
});

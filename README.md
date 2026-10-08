# Debounce Decorator

Wraps a function so it executes only after a configured interval has elapsed
since the last invocation, cancelling any pending execution on each new call.

```js
import { debounce } from 'debounce-decorator';

const debounced = debounce((value) => save(value), 200);

// Call it repeatedly; only the last value is saved, after 200ms of quiet.
debounced('first');
debounced('second');
debounced('third'); // <- this is the value that gets saved

// Cancel a pending call, e.g. when the component unmounts.
debounced.cancel();

// Run the pending call immediately, e.g. on form submit.
debounced.flush();
```

`debounce(fn, waitMs, options?)` returns a function with the same signature as
`fn` plus two methods: `cancel()` prevents any pending invocation;
`flush()` runs the pending invocation immediately (if any) and clears the
timer. `options.clock` accepts a `() => number` clock function used internally
for timing checks; it defaults to `Date.now` and exists so tests can be
deterministic.

## Why this exists

Debouncing is a small, well-understood primitive, but the obvious
implementation has one awkward edge: it cannot synchronously return the wrapped
function's result, because the call happens later. This library returns
`undefined` from the wrapper and offers `flush()` for callers who genuinely
need to force immediate execution with the last captured arguments. There is
no leading-edge call, no result buffering, and no attempt to "do both" — one
clear trailing-edge interpretation only.

The injected clock is used by the trailing-call guard; the actual delay is
scheduled with `setTimeout`. That means tests of the timer still rely on the
host scheduler, while tests of the guard's rescheduling logic can use a fake
lock. If you need a fully virtual timer, use a library with a fake timer
layer; this one deliberately stays on the host scheduler to keep zero
dependencies.

## Edge cases

- `waitMs` must be a non-negative finite number; `0` is allowed and still
  defers to the next macrotask (not synchronous).
- `flush()` when idle returns `undefined` and does nothing else.
- `cancel()` is idempotent.
- The wrapper preserves `this`, so it works as a method decorator.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.


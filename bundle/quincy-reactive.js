define('quincy/events', function(require, module) {

var QN = require('quincy');

var UID = 0;
function uid() {
  return ++UID;
}

// Listener:
function Listener(es, fn, context) {
  this.events = es;
  this.fn = fn;
  this.context = context;
  this.count = 0;
  this.paused = false;
  this.uid = uid();
}

Listener.prototype.equals = function(listener) {
  return listener && this.uid === listener.uid;
};

Listener.prototype.pause = function() {
  this.paused = true;
  return this;
};

Listener.prototype.resume = function() {
  this.paused = false;
  return this;
};

Listener.prototype.dispose = function() {
  if (this.events) this.events.remove(this);
  this.clear();
};

Listener.prototype.clear = function() {
  this.events = this.fn = this.context = null;
};

Listener.prototype.notify = function() {
  if (this.paused || !QN.isFunction(this.fn)) return;

  this.fn.apply(this.context, arguments);
  this.count++;

  return this;
};

// Event stream
function EventStream(event) {
  this.event = event;
  this.listeners = [];
}

EventStream.prototype.forEach = function(fn, context) {
  if (!QN.isFunction(fn)) throw new TypeError('function required for stream listener');
  var listener = new Listener(this, fn, context);
  this.listeners.push(listener);

  return listener;
};

EventStream.prototype.remove = function(listener) {
  if (!listener || this !== listener.events) return this;
  var i = this.listeners.length;
  while (i--) {
    if (!this.listeners[i].equals(listener)) continue;
    this.listeners.splice(i, 1);
    break;
  }

  return this;
};

function clearListener(l) {
  l.clear();
}

EventStream.prototype.removeAll = function() {
  QN.forEach(clearListener, this.listeners);
  this.listeners = [];
};

EventStream.prototype.emit = function(e) {
  e = arguments.length > 0 ? e : QN.valueOf(this.event);
  var count = 0;
  // get copy of listeners in case any call dispose()
  var listeners = this.listeners.slice();
  var l;
  for (var i = 0, len = listeners.length; i < len; i++) {
    l = listeners[i];
    if (l.paused) continue;
    l.notify(e);
    count++;
  }

  return count;
};

EventStream.prototype.merge = function(es) {
  return EventStream.merge(this, es);
};

EventStream.prototype.collect = function(filter, map, context) {
  if (!QN.isFunction(filter) || !QN.isFunction(map)) throw new TypeError('EventStream.collect: function required');
  var collected = new EventStream();
  this.forEach(function(e) {
    if (filter.call(context, e)) collected.emit(map.call(context, e));
  });

  return collected;
};

EventStream.prototype.filter = function(p, context) {
  if (!QN.isFunction(p)) throw new TypeError('Event stream filter predicate requires a function');
  return this.collect(p, QN.identity, context);
};

EventStream.prototype.map = function(fn, context) {
  if (!QN.isFunction(fn)) throw new TypeError('Event stream map requires a function');
  return this.collect(QN.always, fn, context);
};

/*
 * Creates a new event stream consisting of the events of the event
 * stream returned by applying the function to the events of this
 * event stream. The event stream returned by the function is used
 * until the next event emitted by this event stream at which time it is
 * replaced by applying the function to the latest event.
 */
EventStream.prototype.flatMap = function(fn, context) {
  var es = new EventStream();
  var listener;
  this.forEach(function(e) {
    if (listener) listener.dispose();
    var current = fn.call(context, e);
    if (current instanceof EventStream) listener = current.forEach(function(e) {
      es.emit(e);});
  });

  return es;
};

EventStream.prototype.fold = function(fn, initial) {
  var es = new EventStream();
  var acc = initial;
  this.forEach(function(e) {
    acc = fn.call(null, acc, e);
    es.emit(acc);
  });
  return es;
};

EventStream.prototype.distinct = function(eq) {
  var es = new EventStream();
  var prev;
  if (!eq) eq = QN.eqs;
  this.forEach(function(e) {
    if (eq(prev, e)) return;
    prev = e;
    es.emit(e);
  });

  return es;
};

/*
 * Returns an event stream that only emits events that are not followed by another
 * event within the specified interval (milliseconds).
 */
EventStream.prototype.throttle = function(millis) {
  var throttled = new EventStream();
  var  event;
  var emit = function() {
    if (event !== undefined) throttled.emit(event);
    event = undefined;
  };
  var timeout = setTimeout(emit, millis);
  this.forEach(function(e) {
    clearTimeout(timeout);
    event = e;
    timeout = setTimeout(emit, millis);
  });

  return throttled;
};

EventStream.prototype.pipe = function(es) {
  if (es && !(es instanceof EventStream)) throw new TypeError('Invalid event stream for pipe');
  es = es || EventStream.create();
  this.forEach(function(e) {
    es.emit(e);
  });

  return es;
};

EventStream.prototype.broadcast = function() {
  QN.forEach(function(es) {
    if (es instanceof EventStream) this.pipe(es);
  }, arguments, this);

  return this;
};

EventStream.prototype.once = function() {
  var es = EventStream.create();
  var listener = this.forEach(function(e) {
    es.emit(e);
    listener.dispose();
  });

  return es;
};

EventStream.prototype.take = function(n) {
  var es = EventStream.create();
  var listener = this.forEach(function(e) {
    es.emit(e);
    if (listener.count > n)  listener.dispose();
  });

  return es;
};

EventStream.prototype.takeAfter = function(n) {
  var es = EventStream.create();
  var count = 0;
  this.forEach(function(e) {
    if (++count > n) es.emit(e);
  });

  return es;
};

EventStream.prototype.takeWhile = function(p, context) {
  if (!QN.isFunction(p)) throw new TypeError('Event stream takeWhile requires a function');
  var es = EventStream.create();
  var listener = this.forEach(function(e) {
    if (!p.call(context, e)) listener.dispose();
    else es.emit(e);
  });

  return es;
};

EventStream.prototype.takeUntil = function(p, context) {
  if (!QN.isFunction(p)) throw new TypeError('Event stream takeUntil requires a function');
  return this.takeWhile(QN.complement(p), context);
};

EventStream.prototype.defer = function(wait) {
  wait = wait || 100;
  var es = EventStream.create();
  this.forEach(function(e) {
    setTimeout(function() {
      es.emit(e);
    }, wait);
  });

  return es;
};

EventStream.prototype.countListeners = function() {
  return this.listeners.length;
};

EventStream.Listener = Listener;

EventStream.create = function(event) {
  return new EventStream(event);
};

// Create a set of event streams from a map:
// each map entry is in form `name: event`:
//    cancels: "cancel"
EventStream.createStreams = function(events) {
  var results = {};
  QN.forEach(function(event, name) {
    results[name] = EventStream.create(event);
  }, events);

  return results;
};

EventStream.merge = function() {
  var merged = EventStream.create();
  var fn = function(e) {
    EventStream.prototype.emit.call(merged, e);
  };
  var args = QN.isArray(arguments[0]) ? arguments[0] : arguments;
  QN.forEach(function(es) {
    if (es instanceof EventStream) es.forEach(fn);
  }, args);

  return merged;
};

function listenTo(es, fn, context) {
  if (!es instanceof EventStream) throw new TypeError('listenTo: EventStream required');
  return es.forEach(fn, context);
}

EventStream.listenTo = listenTo;

module.exports = EventStream;

});
define('quincy/signal', function(require, module) {

var QN = require('quincy');
var Events = require('quincy/events');

function Signal(value, comparator, notification) {
  this.value = value;
  this.events = new Events();
  this.comparator = comparator || QN.eqs;
  this.notification = QN.isFunction(notification) ? notification : void 0;
}

Signal.prototype.val = function() {
  if (arguments.length === 0) return QN.valueOf(this.value);
  else return this.update(arguments[0]);
};

Signal.prototype.now = function() {
  return QN.valueOf(this.value);
};

Signal.prototype.update =  function(value) {
  if (Signal.isReadonly(this)) return;
  if (!this.equals(value)) {
    this.value = value;
    this.notify();
  }
};

Signal.prototype.equals = function(value) {
  return this.comparator(this.value, value);
};

// Return a new Signal whose value is derived from applying the
// function to the value of this Signal. Change events will be raised
// when this Signal does but change event will contain the mapped value.
Signal.prototype.map = function(fn) {
  return this.collect(QN.always, fn);
};

Signal.prototype.filter = function(p) {
  return this.collect(p, QN.identity);
};

Signal.prototype.collect = function(p, fn) {
  if (!QN.isFunction(p)) throw new TypeError('Signal.collect: predicate must be a function');
  if (!QN.isFunction(fn)) fn = QN.identity;
  var value = this.now();
  var s = p(value) ? new Signal(fn(value)) : new Signal();
  Events.listenTo(this.events, function(v) {
    if (p(v)) s.update(fn(v));
  });

  return s;
};

// Return a new Signal whose initial value is fn(initial, this.now).
// Whenever the source's value changes, the signal's value changes to fn(previous, this.now)
//
Signal.prototype.fold = function(fn, initial) {
  var current = fn.call(null, initial, this.now());
  var s = new Signal(current);
  this.forEach(function(v) {
    current = fn.call(null, current, v);
    s.update(current);
  });

  return s;
};

// Return a new Signal whose initial value is this.now.
// Whenever the source's value changes, the signal's value changes to fn(previous, this.now)
//
Signal.prototype.reduce = function(fn) {
  var current = this.now();
  var s = new Signal(current);
  this.forEach(function(v) {
    current = fn.call(null, current, v);
    s.update(current);
  });

  return s;
};

Signal.prototype.unset = function() {
  this.val(undefined);
};

Signal.prototype.notify = function() {
  var e  = this.notification ? this.notification(this.now(), this) : this.now();
  this.events.emit(e);
};

Signal.prototype.forEach = function(fn, context) {
  return this.events.forEach(fn, context);
};

Signal.prototype.proxy = function() {
  if (!this._proxy) this._proxy = this.val.bind(this);

  return this._proxy;
};

Signal.prototype.zip = function(s) {
  return Signal.zip(this, s);
};

Signal.create =  function(v) {
  return new Signal(v);
};

Signal.isReadonly = function(s) {
  return QN.isFunction(s.value);
};

Signal.constant = function(value) {
  return new Signal(function() { return value; });
};

Signal.derive = function(fn) {
  var signal =  new Signal(fn);
  var observer = function() { signal.notify(); };
  QN.forEach(function(s) {
    if (s instanceof Signal) s.forEach(observer);
  }, QN.tail(arguments));

  return signal;
};

Signal.zip = function() {
  var args = QN.toArray(arguments);
  var signal = new Signal(function() {
    return QN.map(function(s) { return s.val(); }, args);
  });
  var observer = function() { signal.notify(); };
  QN.forEach(function(s) {
    if (s instanceof Signal) s.forEach(observer);
  }, args);

  return signal;
};

Signal.map = function(obj) {
  return QN.mapProps(function(v) {
    return new Signal(v);
  }, obj);
};


function ArraySignal(xs) {
  Signal.call(this, xs || []);
}

ArraySignal.prototype.constructor = QN.createObject(Signal.prototype);

QN.assign(ArraySignal.prototype,  {
  notify: function(e) {
    e.value = this.value;
    this.events.emit(e);
  },
  update: function(xs) {
    var  diff = this.diff(xs);
    if (diff.add || diff.remove) {
      this.value = xs;
      this.notify(diff);
    }
  },
  diff: function(xs) {
    var diff = {};
    var ys = this.now();

    diff.add = QN.filter(function(x) { return !QN.contains(x, ys); }, xs);
    diff.remove = QN.filter(function(x) { return !QN.contains(x, xs); }, ys);

    return diff;
  }
});
Signal.ArraySignal = ArraySignal;

Signal.fromArray = function(xs) {
  return new ArraySignal(xs || []);
};

module.exports = Signal;

});
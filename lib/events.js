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
  if (!this.events)  return;
  this.events.remove(this);
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
  if (!QN.isFunction(fn)) throw new TypeError('Event stream listener not a function');
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

EventStream.prototype.removeAll = function() {
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

var QN = require('quincy');
var Events = require('./events');

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

ArraySignal.prototype.constructor = Object.create(Signal.prototype);

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

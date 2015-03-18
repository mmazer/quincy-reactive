var expect = require('chai').expect;
var sinon = require('sinon');

describe('signal', function() {

  var Signal = require('../../lib/signal');
  var Events = require('../../lib/events');

  var always = function() { return true; };
  var add10 = function(v) { return v + 10; };
  var isEven = function(v) { return v % 2 === 0;};

  describe('constructor', function() {

    var s;

    it('should create a new Signal instance', function() {
      s = new Signal();
      expect(s).to.be.defined;
      expect(s.events).to.be.instanceof(Events);
    });

    it('should set an initial value if specified', function() {
      s = new Signal(1);
      expect(s.value).to.equal(1);

    });
  });

  describe('val', function() {

    var s;

    it('should return the current value', function() {
      s = new Signal(1);
      expect(s.val()).to.equal(1);
    });

    it('should take an argument and set the current value to it', function() {
      s = new Signal();
      s.val(1);
      expect(s.value).to.equal(1);
    });

    it('should return the computed value if the value is a function', function() {
      s = new Signal(function() { return 79; });
      expect(s.val()).to.equal(79);
    });

    it('should notify observers only when the value is changed', function() {
      s = new Signal(11);
      var spy = sinon.spy();
      s.forEach(spy);
      s.val(11);
      expect(spy.called).to.be.false;
      spy.reset();
      s.val(12);
      expect(spy.getCall(0).calledWith(12)).to.be.true;
    });

  });
  describe('notification', function() {
    it('should enable custom events in a signal', function() {
      var e = {subject: 'signal', val: ''};
      var notification = function(v) {
        e.val = v;
        return e;
      };
      var s = new Signal('', null, notification);
      var spy = sinon.spy();
      s.forEach(spy);
      s.update('something');
      expect(spy.getCall(0).calledWith(e)).to.be.true;
    });
  });

  describe('collect', function() {
    it('should apply the predicate function to the initial value', function() {
      var s = new Signal(2);
      var c = s.collect(function(v) { return v % 2 === 0;});
      expect(c.now()).to.equal(2);
    });
    it('should apply the map function to the initial value', function() {
      var s = new Signal(2);
      var c = s.collect(function() { return true;}, add10);
      expect(c.now()).to.equal(12);
    });

    it('should apply the predicate to updated values', function() {
      var s = new Signal();
      var c = s.collect(isEven);
      var spy = sinon.spy();
      c.forEach(spy);
      s.update(1);
      expect(spy.called).to.be.false;
      spy.reset();
      s.update(2);
      expect(spy.getCall(0).calledWith(2)).to.be.true;
    });

    it('should apply the map function to updated values', function() {
      var s = new Signal();
      var c = s.collect(always, add10);
      expect(c).to.be.instanceof(Signal);
      var spy = sinon.spy();
      c.forEach(spy);
      s.update(1);
      expect(spy.getCall(0).calledWith(11)).to.be.true;
    });

  });

  describe('map', function() {

    var s;

    it('should return a new Signal whose value is the mapped value of the original Signal', function() {
      s = new Signal(1);
      var m = s.map(function(x) { return x * 10; });
      expect(m).to.be.instanceof(Signal);
      s.val(2);
      expect(m.val()).to.equal(20);
    });

    it('should return a new Signal that fires events with the mapped when the original Signal does', function() {
      s = new Signal(1);
      var m = s.map(function(x) { return x * 10; });
      var spy = sinon.spy();
      m.forEach(spy);
      s.val(2);
      expect(spy.called).to.be.true;

    });

  });

  describe('reduce', function() {
    it('should return a new Signal with initial value return from the function', function() {
      var s = new Signal(0);
      var fs = s.fold(function(oldval, newval) {return oldval + newval;}, 1);
      expect(fs).to.be.defined;
      expect(fs).to.be.instanceof(Signal);
      expect(fs.now()).to.equal(1);
    });

    it('should return a new Signal that applies the function to old and new values', function() {
      var s = new Signal(0);
      var fs = s.fold(function(oldval, newval) {return oldval + newval;}, 1);
      s.update(2);
      expect(fs.now()).to.equal(3);

    });
  });
  describe('fold', function() {
    it('should return a new Signal whose inital value is the invoked Signal value', function() {
      var s = new Signal(5);
      var fs = s.reduce(function(oldval, newval) {return oldval + newval;});
      expect(fs).to.be.defined;
      expect(fs).to.be.instanceof(Signal);
      expect(fs.now()).to.equal(5);
    });

    it('should return a new Signal that applies the function to old and new values', function() {
      var s = new Signal(5);
      var fs = s.reduce(function(oldval, newval) {return oldval + newval;});
      s.update(2);
      expect(fs.now()).to.equal(7);

    });
  });
  describe('proxy', function() {
    it('should return a proxy function that returns the current signal value', function() {
      var s = new Signal(10);
      var f = s.proxy();
      expect(f()).to.equal(10);
    });

    it('should return a proxy function that updates the signal value', function() {
      var s = new Signal();
      var f = s.proxy();
      var spy = sinon.spy();
      s.forEach(spy);
      f(10);
      expect(s.now()).to.equal(10);
      expect(spy.called).to.be.true;
    });

    it('should return the cached proxy function', function() {
      var s = new Signal();
      var f = s.proxy();
      expect(f).to.be.equal(s.proxy());
    });
  });

  describe('static', function() {
    describe('zip', function() {
      it('should return a Signal that contains the values of the specified signals', function() {
        var s1 = new Signal(1);
        var s2 = new Signal(2);
        var z = Signal.zip(s1,s2);
        expect(z).to.be.instanceof(Signal);
        expect(z.now()).to.deep.equal([1,2]);
      });

      it('should return a Signal that emits a change event when the other signals change', function() {
        var s1 = new Signal(1);
        var s2 = new Signal(2);
        var z = Signal.zip(s1,s2);
        var spy = sinon.spy();
        z.forEach(spy);
        s1.update(10);
        expect(spy.getCall(0).args[0]).to.deep.equal([10,2]);
      });
    });

    describe('map', function() {
      it('should return an object with signal values', function() {
        var o = {a: 1, b:2};
        var s = Signal.map(o);
        expect(s.a).to.be.instanceof(Signal);
        expect(s.a.now()).to.equal(1);
        expect(s.b).to.be.instanceof(Signal);
        expect(s.b.now()).to.equal(2);

      });

    });
  });
});

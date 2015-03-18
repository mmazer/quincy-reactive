var expect = require('chai').expect;
var sinon = require('sinon');

describe('events', function() {

  var Events = require('../../lib/events');
  var Listener = Events.Listener;

  function always() { return true; }
  function isEven(x) { return x % 2 === 0; }
  function ident(x) { return x; }

  describe('listener', function() {

    var es;
    var spy = sinon.spy();
    var thisArg = {};

    beforeEach(function() {
      es = new Events();
      spy.reset();
    });

    describe('Listener', function() {

      it('should create a new Listener instance', function() {
        var l = new Listener(es, spy, thisArg);
        expect(l).to.be.defined;
        expect(l.count).to.equal(0);
        expect(l.events).to.equal(es);
        expect(l.fn).to.equal(spy);
        expect(l.context).to.equal(thisArg);
        expect(l.paused).to.be.false;
        expect(l.uid).to.be.above(0);
      });
    });

    describe('equals', function() {

      it('should return true for when other listener is equivalent to this listener', function() {
        var l = new Listener();
        expect(l.equals({uid: l.uid})).to.be.true;
      });
    });

    describe('pause', function() {

      var listener = new Listener();
      it('should set the listener pause state to true', function() {
        listener.pause();
        expect(listener.paused).to.be.true;
      });
    });

    describe('resume', function() {

      var listener = new Listener();

      it('should set the listener pause state to false', function() {
        listener.paused = true;
        listener.resume();
        expect(listener.paused).to.be.false;
      });
    });

    describe('notify', function() {

      var listener, spy;

      beforeEach(function() {
        spy =sinon.spy();
        listener = new Listener({}, spy);
      });

      it('should invoke the listener callback with the correct arguments', function() {
        listener.notify(1);
        expect(spy.callCount).to.equal(1);
        expect(spy.getCall(0).args).to.deep.equal([1]);
        listener.notify(true, 1, 2);
        expect(spy.callCount).to.equal(2);
        expect(spy.getCall(1).args).to.deep.equal([true, 1, 2]);
      });
    });
  });

  describe('events', function() {

    describe('Events', function() {

      it('should create a new instance of Events', function() {
        var es = new Events();
        expect(es).to.be.defined;
        expect(es.events).to.be.undefined;
        expect(es.listeners).to.deep.equal([]);
      });

      it('should have a default event when specified', function() {
        var es = new Events(1);
        expect(es.event).to.equal(1);
      });

    });

    describe('forEach', function() {

      it('should add a listener to the event stream and return the listener', function() {
        var es = new Events();
        var f = function() {};
        var l = es.forEach(f);
        expect(l).to.be.defined;
        expect(es.listeners.length).to.equal(1);
        expect(es.listeners[0]).to.equal(l);
        expect(es.listeners[0].fn).to.equal(f);
        expect(es.listeners[0].events).to.equal(es);
      });
    });

    describe('remove', function() {

      var es, listener;

      beforeEach(function() {
        es = new Events();
        listener = new Listener(function() {});
        listener.events = es;
      });

      afterEach(function() {
        es.listeners = null;
      });

      it('should remove a listener that was added by each()', function() {
        listener.uid = 1;
        es.listeners[0] = listener;
        expect(es.remove(listener));
        expect(es.listeners.length).to.equal(0);
      });

      it('should not remove a listener for another event stream', function() {
        listener.uid = 1;
        es.listeners[0] = listener;
        var removeL = new Listener({}, function(){});
        removeL.uid = listener.uid;
        expect(es.remove(removeL));
        expect(es.listeners.length).to.equal(1);
      });

      it('should not remove a listener with a different UID', function() {
        listener.uid = 1;
        es.listeners[0] = listener;
        var removeL = new Listener(listener.events, function() {});
        removeL.uid = 2;
        expect(es.remove(removeL)).to.equal(es);
        expect(es.listeners.length).to.equal(1);
      });
    });

    describe('emit', function() {

      var es, spy1, spy2, event;

      beforeEach(function() {
        es = new Events();
        spy1 = sinon.spy();
        spy2 = sinon.spy();
        event = {};
      });

      it('should apply the event argument to all the event stream listeners', function() {
        es.forEach(spy1);
        es.forEach(spy2);
        es.emit(event);
        expect(spy1.callCount).to.equal(1);
        expect(spy2.callCount).to.equal(1);
        expect(spy1.getCall(0).args).to.deep.equal([event]);
        expect(spy2.getCall(0).args).to.deep.equal([event]);
      });

      it('should return the number of listeners that received the event', function() {
        expect(es.emit(event)).to.equal(0);
        es.forEach(spy1);
        es.forEach(spy2);
        expect(es.emit(event)).to.equal(2);
      });

      it('should apply the default event if none is specified', function() {
        es.forEach(spy1);
        es.event = 'test';
        es.emit();
        expect(spy1.callCount).to.equal(1);
        expect(spy1.getCall(0).args).to.deep.equal(['test']);
      });
    });

    describe('collect', function() {

      var es;

      function add10(n) { return n + 10; }

      beforeEach(function() {
        es = new Events();
      });

      it('should return a new event stream that emits events that satisfies the predicate', function() {
        var c = es.collect(isEven, ident);
        var spy = sinon.spy();
        c.forEach(spy);
        es.emit(1);
        expect(spy.called).to.be.false;
        spy.reset();
        es.emit(2);
        expect(spy.getCall(0).calledWith(2)).to.be.true;
      });

      it('should return a new event stream that emits mapped events', function() {
        var c = es.collect(always, add10);
        var spy = sinon.spy();
        c.forEach(spy);
        es.emit(1);
        expect(spy.getCall(0).calledWith(11)).to.be.true;
        spy.reset();
        es.emit(2);
        expect(spy.getCall(0).calledWith(12)).to.be.true;
      });

      it('should return a new event stream that emits filtered and mapped events', function() {
        var c = es.collect(isEven, add10);
        var spy = sinon.spy();
        c.forEach(spy);
        es.emit(1);
        expect(spy.called).to.be.false;
        spy.reset();
        es.emit(2);
        expect(spy.getCall(0).calledWith(12)).to.be.true;
      });
    });

    describe('filter', function() {

      it('should return a new event stream that only emits events that satisfy the predicate', function() {
        var es = new Events();
        var filtered = es.filter(isEven);
        expect(filtered).to.be.defined;
        var spy = sinon.spy();
        filtered.forEach(spy);
        es.emit(1);
        expect(spy.callCount).to.equal(0);
        spy.reset();
        es.emit(2);
        expect(spy.callCount).to.equal(1);
      });

    });

    describe('map', function() {

      it('should return a new event stream that emits mapped events', function() {
        var es = new Events();
        var mapped = es.map(function(e) { return e*10; });
        expect(mapped).to.be.defined;
        var spy = sinon.spy();
        mapped.forEach(spy);
        es.emit(1);
        expect(spy.callCount).to.equal(1);
        expect(spy.getCall(0).args).to.deep.equal([10]);
      });

    });

    describe('fold', function() {
      it('should return a new event stream', function() {
        var es = new Events();
        var fs = es.fold(function() {}, 0);
        expect(fs).to.be.defined;
        expect(fs).to.be.instanceof(Events);
      });

      it('should return a new event stream that applies the function with the initial accumulator', function() {
        var es = new Events();
        var fs = es.fold(function(oldval, newval) { return oldval + newval;}, 0);
        var spy = sinon.spy();
        fs.forEach(spy);
        es.emit(1);
        expect(spy.getCall(0).calledWith(1)).to.be.true;
        spy.reset();
        es.emit(5);
        expect(spy.getCall(0).calledWith(6)).to.be.true;
      });

    });

    describe('distinct', function() {

      var es;

      beforeEach(function() {
        es = new Events();
      });

      it('should only emit an event if it is not equal to the previous event', function() {
        var distinct = es.distinct();
        var spy = sinon.spy();
        distinct.forEach(spy);
        es.emit(1);
        expect(spy.callCount).to.equal(1);
        es.emit(1);
        expect(spy.callCount).to.equal(1);
        es.emit(2);
        expect(spy.callCount).to.equal(2);
      });

      it('should use the equality predicate argument if specified', function() {
        /* jshint eqeqeq: false */
        var distinct = es.distinct(function(x,y) { return x == y;});
        var spy = sinon.spy();
        distinct.forEach(spy);
        es.emit(1);
        expect(spy.callCount).to.equal(1);
        es.emit('1');
        expect(spy.callCount).to.equal(1);
        es.emit('2');
        expect(spy.callCount).to.equal(2);
      });

    });


    describe('pipe', function() {

      var es;

      beforeEach(function() {
        es = new Events();
      });

      it('should return a new event stream that will emit events from the source event stream', function() {
        var piped = es.pipe();
        var spy = sinon.spy();
        piped.forEach(spy);
        es.emit(1);
        expect(spy.getCall(0).calledWith(1)).to.be.true;
      });

      it('should use the event stream argument as the piped stream', function() {
        var piped = new Events();
        expect(es.pipe(piped)).to.equal(piped);
        var spy = sinon.spy();
        piped.forEach(spy);
        es.emit(1);
        expect(spy.getCall(0).calledWith(1)).to.be.true;
      });

    });

    describe('broadcast', function() {

      it('should broadcast an event to the argument event streams', function() {
        var es = new Events();
        var e1 = new Events();
        var e2 = new Events();
        es.broadcast(e1, e2);
        var spy1 = sinon.spy();
        var spy2 = sinon.spy();
        e1.forEach(spy1);
        e2.forEach(spy2);
        es.emit(1);
        expect(spy1.getCall(0).calledWith(1)).to.be.true;
        expect(spy2.getCall(0).calledWith(1)).to.be.true;
      });

    });

    describe('statics', function() {

      describe('merge', function() {

        it('should merge an array of event streams', function() {
          var es = [new Events(), new Events()];
          var merged = Events.merge(es);
          var spy = sinon.spy();
          merged.forEach(spy);
          es[0].emit(0);
          expect(spy.getCall(0).calledWith(0)).to.be.true;
          spy.reset();
          es[1].emit(1);
          expect(spy.getCall(0).calledWith(1)).to.be.true;
        });

      });

      it('should merge the event stream args', function() {
        var es1 = new Events();
        var es2 = new Events();
        var merged = Events.merge(es1, es2);
        var spy = sinon.spy();
        merged.forEach(spy);
        es1.emit(0);
        expect(spy.getCall(0).calledWith(0)).to.be.true;
        spy.reset();
        es2.emit(1);
        expect(spy.getCall(0).calledWith(1)).to.be.true;
      });
    });
  });
});

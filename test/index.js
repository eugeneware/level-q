var redtape = require('redtape'),
    bytewise = require('bytewise'),
    level = require('level-test')({ keyEncoding: bytewise, valueEncoding: 'json' })
    after = require('after'),
    range = require('range'),
    uniq = require('lodash.uniq'),
    queue = require('..');

var it = redtape({
  beforeEach: function (cb) {
    var db = level('test');
    cb(null, db);
  },
  afterEach: function (db, cb) {
    db.close(cb);
  }
});

it('should be able to put and read the queue', 2, function(t, db) {
  var q = queue(db);
  var data = {
    id: 1,
    name: 'Eugene',
    value: 42
  };
  q.queue.push(data);
  q.queue.read(function (err, value) {
    t.notOk(err);
    t.deepEquals(data, value);
  });
});

it('reading should dequeue the item', 3, function(t, db) {
  var q = queue(db);
  var data = {
    id: 1,
    name: 'Eugene',
    value: 42
  };
  q.queue.push(data);
  q.queue.read(function (err, value, key) {
    t.notOk(err);
    t.deepEquals(data, value);
    get(key);
  });

  function get(key) {
    q.get(key, check);
  }

  function check(err, value) {
    t.ok(err);
  }
});

it('reading should be atomic', 1, function(t, db) {
  var q = queue(db);
  var next = after(5, dequeue);
  range(0, 5).forEach(function (i) {
    q.queue.push({
      id: i,
      name: 'Name ' + i,
      value: 42 + i
    }, next);
  });

  var results = [];
  function dequeue() {
    var next = after(5, check);
    range(0, 5).forEach(function (i) {
      q.queue.read(function (err, value, key) {
        results.push(value);
        next();
      });
    });
  }

  function prop(name) {
    return function (obj) {
      return obj[name];
    };
  }

  function check() {
    var hits = uniq(results.map(prop('id')));
    t.equal(hits.length, 5);
  }
});

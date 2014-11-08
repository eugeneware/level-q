var redtape = require('redtape'),
    bytewise = require('bytewise'),
    level = require('level'),
    after = require('after'),
    range = require('range'),
    uniq = require('lodash.uniq'),
    setImmediate = global.setImmediate || process.nextTick,
    path = require('path'),
    rimraf = require('rimraf'),
    queue = require('..');

var db, dbPath = path.join(__dirname, '..', 'data', 'testdb');
var it = redtape({
  beforeEach: function (cb) {
    rimraf.sync(dbPath);
    db = level(dbPath, { keyEncoding: bytewise, valueEncoding: 'json' });
    cb(null, db);
  },
  afterEach: function (db, cb) {
    db.close(cb);
  }
});

function prop(name) {
  return function (obj) {
    return obj[name];
  };
}

it('should be able to put and read the queue', 3, function(t) {
  var q = queue(db);
  var data = {
    id: 1,
    name: 'Eugene',
    value: 42
  };
  q.queue.push(data, read);
  function read(err) {
    t.notOk(err);
    q.queue.read(function (err, value) {
      t.notOk(err);
      t.deepEquals(data, value);
      t.end();
    });
  }
});

it('reading should dequeue the item', 4, function(t, db) {
  var q = queue(db);
  var data = {
    id: 1,
    name: 'Eugene',
    value: 42
  };
  q.queue.push(data, read);
  function read(err) {
    t.notOk(err);
    q.queue.read(function (err, value, key) {
      t.notOk(err);
      t.deepEquals(data, value);
      get(key);
    });
  }

  function get(key) {
    q.get(key, check);
  }

  function check(err, value) {
    t.ok(err);
    t.end();
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

  function check() {
    var hits = uniq(results.map(prop('id')));
    t.equal(hits.length, 5);
    t.end();
  }
});

it('reading should block until data is there', 3, function(t, db) {
  var q = queue(db);
  var data = {
    id: 1,
    name: 'Eugene',
    value: 42
  };
  q.queue.read(function (err, value) {
    t.notOk(err);
    t.deepEquals(data, value);
    t.ok(Date.now() - now >= 20);
    t.end();
  });
  var now = Date.now();
  setTimeout(function () {
    q.queue.push(data);
  }, 20);
});

it('should be able to change the prioritation strategy', 5, function(t, db) {
  var q = queue(db, prop('value'));
  var next = after(5, dequeue);
  range(0, 5).forEach(function (i) {
    q.queue.push({
      id: i,
      name: 'Name ' + i,
      value: -(42 + i)
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

  function check() {
    var last = -Infinity;
    results.forEach(function (result) {
      t.ok(result.value > last);
      last = result.value;
    });
    t.end();
  }
});

it('should be able to have complex priority keys', 10, function(t, db) {
  function pri(data) {
    return [data.priority, data.value];
  }
  var q = queue(db, pri);
  var next = after(5, dequeue);
  range(0, 5).forEach(function (i) {
    q.queue.push({
      id: i,
      priority: String.fromCharCode('A'.charCodeAt(0) + (i % 3)),
      name: 'Name ' + i,
      value: -(42 + i)
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

  function check() {
    var lastValue = -Infinity, lastPriority = '';
    results.forEach(function (result) {
      t.ok(result.priority >= lastPriority);
      t.ok(result.priority !== lastPriority || result.value > last);
      lastPriority = result.priority;
      last = result.value;
    });
    t.end();
  }
});

it('should be able to have queue dequeue restrictions', 15, function(t, db) {
  var now = Date.now();
  function release(data) {
    return Date.now() >= data.next;
  }

  var retry = 100;
  var q = queue(db, { order: prop('next'), release: release, retry: retry });
  var next = after(5, dequeue);
  var delay = 20;
  range(0, 5).forEach(function (i) {
    q.queue.push({
      id: i,
      name: 'Name ' + i,
      next: now + delay + i
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

  function check() {
    var last = 0;
    var _now = Date.now();
    results.forEach(function (result) {
      t.ok(_now >= result.next,   'delayed dequeue');
      t.ok(_now >= (now + retry), 'retry');
      t.ok(result.next > last,    'in order');
      last = result.next;
    });
    t.end();
  }
});

it('should be able to rebind after dequeueing', 1, function(t, db) {
  var q = queue(db);
  var next = after(15, dequeue);
  range(0, 15).forEach(function (i) {
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
      var readCount = 0;
      (function read() {
        q.queue.read(function (err, value, key) {
          results.push(value);
          readCount++;
          if (readCount === 3) {
            next();
          } else {
            setImmediate(read);
          }
        });
      })();
    });
  }

  function check() {
    var hits = uniq(results.map(prop('id')));
    t.equal(hits.length, 15);
    t.end();
  }
});

it('should be able to listen to a queue (async)', 1, function(t, db) {
  var q = queue(db);
  var next = after(15, dequeue);
  range(0, 15).forEach(function (i) {
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
      var readCount = 0;
      q.queue.listen(function (err, value, key, cb) {
        results.push(value);
        readCount++;
        if (readCount === 3) {
          next();
        } else {
          setImmediate(cb);
        }
      });
    });
  }

  function check() {
    var hits = uniq(results.map(prop('id')));
    t.equal(hits.length, 15);
    t.end();
  }
});

it('should be able to listen to a queue (sync)', 1, function(t, db) {
  var q = queue(db);
  var next = after(15, dequeue);
  range(0, 15).forEach(function (i) {
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
      var readCount = 0;
      q.queue.listen(function (err, value) {
        results.push(value);
        readCount++;
        if (readCount === 3) {
          next();
        }
      });
    });
  }

  function check() {
    var hits = uniq(results.map(prop('id')));
    t.equal(hits.length, 15);
    t.end();
  }
});

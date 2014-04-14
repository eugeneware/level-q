var timestamp = require('monotonic-timestamp'),
    peek = require('level-peek'),
    setImmediate = global.setImmediate || process.nextTick,
    slice = Array.prototype.slice;

module.exports = function (db, opts) {
  if (typeof db.queue === 'undefined') {
    if (typeof opts === 'function') {
      opts = {
        order: opts
      };
    }
    opts = opts || {};

    db.queue = {
      push:      push.bind(null, db),
      read:      read.bind(null, db),
      listen:    listen.bind(null, db),
      orderFn:   opts.order   || timestamp,
      releaseFn: opts.release || Boolean.bind(null, true),
      retry:     opts.retry   || 100,
      _readers:  [],
      _reading:  false
    };
  }

  return db;
}

function push(db, data, cb) {
  var key = db.queue.orderFn(data);
  if (!Array.isArray(key)) key = [key];
  // makes keys unique, as well as ordering similar keys by timestamp ASC
  key.push(timestamp());
  db.put(key, data, function () {
    cb && cb.apply(null, arguments);
    kick(db);
  });
}

function read(db, cb) {
  cb = cb || noop;
  db.queue._readers.push(cb);
  kick(db);
}

function listen(db, cb) {
  (function next() {
    read(db, function () {
      var args = slice.call(arguments);
      var doNext = setImmediate.bind(null, next);
      if (cb.length === 4) {
        args.push(doNext);
        cb.apply(null, args);
      } else {
        cb.apply(null, args);
        doNext();
      }
    });
  })();
}

function dequeue(db, cb) {
  cb = cb || noop;
  peek.first(db, { start: null, end: undefined }, function (err, key, value) {
    if (err && err.message === 'range not found') {
      // add back to queue and wait, but unblock read lock
      db.queue._reading = false;
      return db.queue._readers.push(cb);
    }
    if (err) return cb(err);
    if (!db.queue.releaseFn(value)) {
      // add back to queue and wait, but unblock read lock
      db.queue._reading = false;
      db.queue._readers.push(cb);
      // try again in retry ms
      setTimeout(function () {
        kick(db);
      }, db.queue.retry);
      return ;
    }
    db.del(key, function (err) {
      if (err) return cb(err);
      cb(null, value, key);
    });
  });
}

function kick(db) {
  if (db.queue._reading || db.queue._readers.length === 0) return;
  db.queue._reading = true;
  setImmediate(function () {
    var cb = db.queue._readers.shift();
    dequeue(db, function () {
      db.queue._reading = false;
      cb.apply(null, arguments);
      kick(db);
    });
  })
}

function noop() {
}

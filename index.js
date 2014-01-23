var timestamp = require('monotonic-timestamp'),
    peek = require('level-peek');

module.exports = function (db, orderFn) {
  if (typeof db.queue === 'undefined') {
    db.queue = {
      push: push.bind(null, db),
      read: read.bind(null, db),
      orderFn: orderFn || timestamp
    };
  }

  return db;
}

function push(db, data, cb) {
  db.put(db.queue.orderFn(data), data, cb || noop);
}

function read(db, cb) {
  cb = cb || noop;
  peek.first(db, { start: null, end: undefined }, function (err, key, value) {
    if (err) return cb(err);
    db.del(key, function (err) {
      if (err) return cb(err);
      cb(err, value, key);
    });
  });
}

function noop() {
}

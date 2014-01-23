var bytewise = require('bytewise'),
    level = require('level-test')({ keyEncoding: bytewise, valueEncoding: 'json' })
    after = require('after'),
    range = require('range'),
    queue = require('..');

var m = 10;
var p = 100;
var n = p*m;

var start = Date.now();
var db = queue(level('test'), { order: prop('next'), release: release });

function release(data) {
  return Date.now() >= data.next;
}
function prop(name) {
  return function (obj) {
    return obj[name];
  };
}

function produce() {
  range(0, n).forEach(function (i) {
    db.queue.push({
      id: i,
      name: 'Name ' + i,
      next: start + Math.floor(Math.random() * 100),
      value: 42 + i
    });
  });
}

var results = [];
function consume() {
  var next = after(m, done);
  range(0, m).forEach(function (i) {
    var count = 0;
    (function read() {
      db.queue.read(function (err, value, key) {
        if (err) throw err;
        results.push(value);
        count++;
        if (count === p) {
          next();
        } else {
          setImmediate(read);
        }
      });
    })();
  });
}

produce();
consume();

function done() {
  var elapsed = Date.now() - start;
  var ops = results.length / (elapsed / 1000);
  console.log('%d Operations in %d seconds', results.length, elapsed / 1000);
  console.log('%d Operations Per Second', Math.floor(ops));
}

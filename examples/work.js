var bytewise = require('bytewise'),
    level = require('level-test')({ keyEncoding: bytewise, valueEncoding: 'json' })
    after = require('after'),
    range = require('range'),
    crypto = require('crypto'),
    queue = require('..');

var delay = 500;
var db = queue(level('test'), { order: prop('next'), release: release });

function release(data) {
  return Date.now() >= data.next;
}
function prop(name) {
  return function (obj) {
    return obj[name];
  };
}

var start = Date.now();
db.queue.push({
  id: 1,
  name: 'Eugene',
  next: start + delay,
  log: [],
  value: 0
});

db.queue.listen(function (err, value) {
  if (err) throw err;
  value.log.push(work(value.value++));
  if (value.value < 3) {
    value.next += delay;
    db.queue.push(value);
  } else {
    console.log(value);
  }
});

function work(d) {
  var shasum = crypto.createHash('sha1');
  shasum.update(String(d));
  return shasum.digest('hex');
}

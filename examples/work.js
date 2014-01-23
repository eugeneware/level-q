var bytewise = require('bytewise'),
    level = require('level-test')({ keyEncoding: bytewise, valueEncoding: 'json' })
    after = require('after'),
    range = require('range'),
    crypto = require('crypto'),
    queue = require('..');

var delay = 500;
// create a priority queue based on time to next service
var db = queue(level('test'), { order: prop('next'), release: release });

// only allow an item to be read from queue if it's time is up
function release(data) {
  return Date.now() >= data.next;
}

function prop(name) {
  return function (obj) {
    return obj[name];
  };
}

var start = Date.now();
// add some work to the queue
db.queue.push({
  id: 1,
  name: 'Eugene',
  next: start + delay,
  log: [],
  value: 0
});

db.queue.listen(function (err, value) {
  if (err) throw err;
  // do the work
  value.log.push(work(value.value++));

  if (value.value < 3) {
    // if work is still do to, schedule it for future
    value.next += delay;
    db.queue.push(value);
  } else {
    // final value
    console.log(value);
  }
});

function work(d) {
  var shasum = crypto.createHash('sha1');
  shasum.update(String(d));
  return shasum.digest('hex');
}

var bytewise = require('bytewise'),
    level = require('level-test')({ keyEncoding: bytewise, valueEncoding: 'json' })
    after = require('after'),
    range = require('range'),
    queue = require('..');

// create a priority queue based on time to next service
var db = queue(level('test'),
  { order: orderByDeadline, release: releaseOnDeadline });

// sort queue by deadline
function orderByDeadline(data) {
  return data.deadline;
}

// only allow an item to be read from queue if it's time is up
function releaseOnDeadline(data) {
  return Date.now() >= data.deadline;
}

// add some work to the queue that will be scheduled 5 seconds in the future
db.queue.push({
  deadline: Date.now() + 5000,
  state: 'square',
  n: 2,
  squareResult: 0,
  sinResult: 0
});

// The job will ONLY be available for processing once the 5 seconds has passed
db.queue.listen(function (err, value, key, next) {
  if (err) throw err;
  switch (value.state) {
    case 'square':
      // do the work
      value.squareResult = value.n * value.n;

      // schedule then nexzt part of work 2 seconds in the future
      value.state = 'sin';
      value.deadline = Date.now() + 2000;
      db.queue.push(value, next);
      break;

    case 'sin':
      // do the work
      value.sinResult = Math.sin(value.n);

      console.log(value);
      // Should print out:
      // { deadline: 1390487269236,
      //    state: 'sin',
      //    n: 2,
      //    squareResult: 4,
      //    sinResult: 0.9092974268256817 }
      next();
      break;
  }
});

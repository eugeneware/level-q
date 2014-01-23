# level-q

Priority queuing for leveldb/levelup

[![build status](https://secure.travis-ci.org/eugeneware/level-q.png)](http://travis-ci.org/eugeneware/level-q)

## Installation

This module is installed via npm:

``` bash
$ npm install level-q
```

## Example Usage

### Basic Usage

By default adding items to a queue will be ordered first in, first out.

``` js
var queue = require('level-q'),
    level = require('level'),
    bytewise = require('bytewise');

// instantiate queue (adds a 'queue' property on the db)
var db = queue(level('/db/path', { keyEncoding: bytewise, valueEncoding: 'json' }));

// data to put in queue
var data = {
  id: 1,
  name: 'Eugene',
  value: 42
};

// add to queue
q.queue.push(data);

// read a single item from the queue, then stop listening
q.queue.read(function (err, value) {
  // value should equal data
});

// keep listening to the queue
q.queue.listen(function (err, value, key, next) {
  // do something with the value
  console.log(value);
  // ok, done processing, get the next item from the queue
  next();
});
```

### Custom Priority Queue

By providing an `order by` function you can return a key that can be used
to sort the queue. This example uses a quality of service (QOS) field
so that the higher the QOS, the earlier it will get serviced.

``` js
var queue = require('level-q'),
    level = require('level'),
    bytewise = require('bytewise');

// order the queue by the QOS field
var db = queue(level('/db/path', { keyEncoding: bytewise, valueEncoding: 'json' }),
  { order: orderByQos });

function orderByQos(data) {
  return data.QOS;
}

// data to put in queue
var data = [
  // should be serviced last
  {
    id: 1,
    QOS: 'C',
    name: 'Eugene',
    value: 42
  },
  // should be serviced first
  {
    id: 2,
    QOS: 'A',
    name: 'Eugene',
    value: 42
  },
  // should be serviced second
  {
    id: 3,
    QOS: 'B',
    name: 'Eugene',
    value: 42
  }
];

// add to queue
var count = data.length;
data.forEach(function (item) {
  db.queue.push(item, function (err) {
    if (err) throw err;
    --count || listen();
  });
});

function listen() {
  db.queue.listen(function (err, value, key, next) {
    console.log(value);
    // should print the second item, then the third item, then the first
    next();
  });
}
```

### Control when an item is able to be released from the queue

You can use the `release` option when instantiating your queue to control
when an item is able to be returned to consumers of the queue.

For example, you may wish to create a job queue, and delay jobs until to a
scheduled time in the future (eg. like a cron job);

``` js
var bytewise = require('bytewise'),
    level = require('level')
    range = require('range'),
    queue = require('level-q');

// create a priority queue based on time to next service
var db = queue(
  level('/db/path', { keyEncoding: bytewise, valueEncoding: 'json' }),
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
  state: 'square'
  n: 2,
  squareResult: 0,
  sinResult: 0
});

// The job will ONLY be available for processing once the 5 seconds has passed
db.queue.listen(function (err, value, key, next) {
  if (err) throw err;
  // do the work
  switch (value.state) {
    case 'square':
      // do the work
      value.squareResult = value.n * value.n;

      // schedule then next part of work 2 seconds in the future
      value.state = 'sin';
      value.deadline = Date.now() + 2000;
      db.queue.push(value, next);
      break;

    case 'sin':
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
```

var queue = require('..'),
    level = require('level-test')({ keyEncoding: bytewise, valueEncoding: 'json' }),
    bytewise = require('bytewise');

// instantiate queue (adds a 'queue' property on the db)
var db = queue(level('test'), { order: orderByQos });
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

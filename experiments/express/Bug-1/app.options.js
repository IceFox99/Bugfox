
var express = require('../')
  , request = require('supertest');

describe('OPTIONS', function(){
  it('should only include each method once', function(done){
    var app = express();

    app.del('/', function(){});
    app.get('/users', function(req, res){});
    app.put('/users', function(req, res){});
    app.get('/users', function(req, res){});

    request(app)
    .options('/users')
    .expect('GET,PUT')
    .expect('Allow', 'GET,PUT', done);
  })
})

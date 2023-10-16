
var express = require('../')
  , request = require('supertest');

describe('app', function(){
  describe('.param(name, fn)', function(){
    it('should call when values differ when using "next"', function(done) {
      var app = express();
      var called = 0;
      var count = 0;

      app.param('user', function(req, res, next, user) {
        called++;
        if (user === 'foo') return next('route');
        req.user = user;
        next();
      });

      app.get('/:user/bob', function(req, res, next) {
        count++;
        next();
      });
      app.get('/foo/:user', function(req, res, next) {
        count++;
        next();
      });
      app.use(function(req, res) {
        res.end([count, called, req.user].join(' '));
      });

      request(app)
      .get('/foo/bob')
      .expect('1 2 bob', done);
    })
  })
})

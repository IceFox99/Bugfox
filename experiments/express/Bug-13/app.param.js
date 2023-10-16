
var express = require('../')
  , request = require('supertest');

describe('app', function(){
  describe('.param(name, fn)', function(){
    it('should support altering req.params across routes', function(done) {
      var app = express();

      app.param('user', function(req, res, next, user) {
        req.params.user = 'loki';
        next();
      });

      app.get('/:user', function(req, res, next) {
        next('route');
      });
      app.get('/:user', function(req, res, next) {
        res.send(req.params.user);
      });

      request(app)
      .get('/bob')
      .expect('loki', done);
    })
  })
})

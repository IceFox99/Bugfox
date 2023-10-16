
var express = require('../')
  , request = require('supertest');

describe('res', function(){
  describe('when accepting text', function(){
    it('should include the redirect type', function(done){
      var app = express();

      app.use(function(req, res){
        res.redirect(301, 'http://google.com');
      });

      request(app)
      .get('/')
      .set('Accept', 'text/plain, */*')
      .expect('Content-Type', /plain/)
      .expect('Location', 'http://google.com')
      .expect(301, 'Moved Permanently. Redirecting to http://google.com', done);
    })
  })
})

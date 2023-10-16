
var express = require('../')
  , request = require('supertest');

describe('app', function(){
    describe('.param(name, fn)', function(){
        it('should defer all the param routes', function(done){
      		var app = express();

      		app.param('id', function(req, res, next, val){
      		  if (val === 'new') return next('route');
      		  return next();
      		});

      		app.all('/user/:id', function(req, res){
      		  res.send('all.id');
      		});

      		app.get('/user/:id', function(req, res){
      		  res.send('get.id');
      		});

      		app.get('/user/new', function(req, res){
      		  res.send('get.new');
      		});

      		request(app)
      		.get('/user/new')
      		.expect('get.new', done);
    })
  })
})

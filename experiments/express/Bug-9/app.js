
var assert = require('assert')
var express = require('..')
var request = require('supertest')

describe('app.mountpath', function(){
  it('should return the mounted path', function(){
    var admin = express();
    var app = express();
    var blog = express();
    var fallback = express();

    app.use('/blog', blog);
    app.use(fallback);
    blog.use('/admin', admin);
    fallback.use('/admin', admin);
    blog.use(fallback);

    admin.mountpath.should.equal('/admin');
    app.mountpath.should.equal('/');
    blog.mountpath.should.equal('/blog');
    fallback.mountpath.should.equal('/');
  })
})

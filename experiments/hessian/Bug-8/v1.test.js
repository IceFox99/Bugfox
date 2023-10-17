/**!
 * hessian.js - test/v1.test.js
 * Copyright(c) 2014
 * MIT Licensed
 *
 * Authors:
 *   dead_horse <dead_horse@qq.com> (http://deadhorse.me)
 *   fengmk2 <fengmk2@gmail.com> (http://fengmk2.github.com)
 */

'use strict';

var fs = require('fs');
var path = require('path');
var should = require('should');
var hessian = require('../');
var Encoder = hessian.Encoder;
var Decoder = hessian.Decoder;
var utils = require('../lib/utils');

var encoder = new Encoder();
var decoder = new Decoder();

var fixtureString = fs.readFileSync(path.join(__dirname, 'support', 'fixture.dat'), 'utf8');
var fixtureBytes = fs.readFileSync(path.join(__dirname, 'support', 'fixture.png'));

describe('hessian v1', function () {
  afterEach(function () {
    encoder.clean();
    decoder.clean();
  });

    describe('long', function () {
    it('should write and read long ok', function () {
      var tests = [
        ['-9223372036854775808', '<Buffer 4c 80 00 00 00 00 00 00 00>'],
        [-10000, '<Buffer 4c ff ff ff ff ff ff d8 f0>'],
        [-1, '<Buffer 4c ff ff ff ff ff ff ff ff>'],
        [0, '<Buffer 4c 00 00 00 00 00 00 00 00>'],
        [10000, '<Buffer 4c 00 00 00 00 00 00 27 10>'],
        [9007199254740991, '<Buffer 4c 00 1f ff ff ff ff ff ff>'],
        ['9007199254740992', '<Buffer 4c 00 20 00 00 00 00 00 00>'],
        ['9007199254740993', '<Buffer 4c 00 20 00 00 00 00 00 01>'],
        ['9223372036854775807', '<Buffer 4c 7f ff ff ff ff ff ff ff>'],
      ];

      tests.forEach(function (t) {
        var buf = encoder.writeLong(t[0]).get();
        buf.inspect().should.equal(t[1]);
        decoder.init(buf).readLong().should.eql(t[0]);
        encoder.clean();
        decoder.clean();
      });
    });
  });
});

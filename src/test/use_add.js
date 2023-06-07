const { Tracer } = require('../lib/Tracer');
const { FuncStack } = require('../lib/FuncStack');

const { add } = require('./add');
console.log(add(1,2));
console.log(add(2,3));
console.log(add(100,200));

console.log(global.BugfoxTracer.currentFuncStack.callee);

const { Tracer } = require('../lib/Tracer');
const { FuncStack } = require('../lib/FuncStack');

const { add, addAndDouble } = require('./add');
for (let i = 0; i < 10; ++i)
    console.log(add(i,i));

for (let i = 0; i < 10; ++i)
    console.log(addAndDouble(i,i));

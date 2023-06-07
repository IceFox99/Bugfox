// Original source code
//function add(a, b) {
//    return a + b;
//}

// Wrapped version
const { Tracer } =  require('../lib/Tracer');
const { FuncStack } = require('../lib/FuncStack');
const add = (...args) => {
    // original function
    const Bugfox_Original_add = (a, b) => {
        return a + b;
    };

    // initialize this function stack
    let BugfoxFS = new FuncStack("/home/icefox99/Bugfox/src/testadd.js#add", global.BugfoxTracer.currentFuncStack.id, this, args);
    global.BugfoxTracer.push(BugfoxFS);
    global.BugfoxTracer.move(BugfoxFS);

    // execute original function
    const result = Bugfox_Original_add(...args);

    // finish the function stack
    global.BugfoxTracer.moveTop();
    BugfoxFS.afterThis = this;
    BugfoxFS.afterArgs = args;
    BugfoxFS.returnVal = result;

    return result;
};
module.exports.add = add;

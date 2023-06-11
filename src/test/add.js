// Original source code
//function add(a, b) {
//    return a + b;
//}

// Wrapped version
const { Tracer } =  require('../lib/Tracer');

function Bugfox_Original_add(a, b) {
    return a + b;
}

function add(...args) {
    // initialize this function stack
    //let BugfoxFS = new FuncStack("/home/icefox99/Bugfox/src/add.js#add", global.BugfoxTracer.currentFuncStack.id, toJSON(this), toJSON(args));
    let BugfoxFS = Tracer.buildFuncStack("src/add.js#add");
    BugfoxFS.setBeforeStats(global.BugfoxTracer.currentFuncStack.id, this, args);
    global.BugfoxTracer.push(BugfoxFS);
    global.BugfoxTracer.move(BugfoxFS);

    // execute original function
    const result = Bugfox_Original_add(...args);

    // finish the function stack
    BugfoxFS.setAfterStats(this, args, result);
    global.BugfoxTracer.moveTop();
    //BugfoxFS.afterThis = toJSON(this);
    //BugfoxFS.afterArgs = toJSON(args);
    //BugfoxFS.returnVal = toJSON(result);

    return result;
};
module.exports.add = add;

function Bugfox_Original_addAndDouble(a, b) {
    return add(a,b) + add(a,b);
}

function addAndDouble(...args) {
    let BugfoxFS = Tracer.buildFuncStack("src/add.js#addAndDouble");
    BugfoxFS.setBeforeStats(global.BugfoxTracer.currentFuncStack.id, this, args);
    global.BugfoxTracer.push(BugfoxFS);
    global.BugfoxTracer.move(BugfoxFS);
    
    const result = Bugfox_Original_addAndDouble(...args);

    BugfoxFS.setAfterStats(this, args, result);
    global.BugfoxTracer.moveTop();

    return result;
}
module.exports.addAndDouble = addAndDouble;

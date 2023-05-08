"use strict";
const { toJSON, hash } = require('./Util');
const { FuncTrace, FuncStack } = require('./TraceData');

const genHashFuncTrace = (origFuncTrace) => {
    // stringify to JSON format and then hash on these strings
    let hashBeforeThis = hash(toJSON(origFuncTrace.beforeThis));
    let hashAfterThis = hash(toJSON(origFuncTrace.afterThis));
    let hashBeforeArgs = hash(toJSON(origFuncTrace.beforeArgs));
    let hashAfterArgs = hash(toJSON(origFuncTrace.afterArgs));
    let hashReturnVal = hash(toJSON(origFuncTrace.returnVal));

    // construct a new FuncTrace
    let hashFuncTrace = new FuncTrace(origFuncTrace.funcName, origFuncTrace.callerFuncName, hashBeforeThis, hashAfterThis, hashBeforeArgs, hashAfterArgs, hashReturnVal);
    hashFuncTrace.callee = origFuncTrace.callee;
    return hashFuncTrace;
};

module.exports.genHashFuncTrace = genHashFuncTrace;

"use strict";
const { toJSON, hash } = require('./Util');

class FuncTrace {
    constructor(funcName, callerFuncName, beforeThis, afterThis, beforeArgs, afterArgs, returnVal) {
        this.funcName = funcName;
        this.callerFuncName = callerFuncName;
        this.beforeThis = beforeThis;
        this.afterThis = afterThis;
        this.beforeArgs = beforeArgs;
        this.afterArgs = afterArgs;
        this.returnVal = returnVal;

        // data structure for directed graph
        this.caller = null;
        this.callee = [];
    }

    push(newCallee) { this.callee.push(newCallee); }
    pop() { return this.callee.pop(); }
    isDeepest() { return (this.callee.length == 0) ? true : false; }
}

class FuncStack {
    constructor() { this.funcStack = []; /* directed graph */ }
    getFuncTrace(index) { return this.funcStack[index]; }
    getLength() { return this.funcStack.length; }
}

module.exports.FuncTrace = FuncTrace;
module.exports.FuncStack = FuncStack;

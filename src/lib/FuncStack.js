"use strict";
const { toJSON, hash } = require('./util');

class FuncStack {
    constructor(funcName, callerID = undefined, beforeThis = undefined, beforeArgs = undefined) {
        this.funcName = funcName; // in the format of "filePath#funcName"
        this.index = []; // index of the whole function stacks, first element stands for whether it's in base FuncStacks
        this.caller = callerID; // string: caller's id
        this.callee = []; // array of FuncStack
        this.beforeThis = beforeThis;
        this.beforeArgs = beforeArgs; // array
        this.afterThis = undefined;
        this.afterArgs = undefined;
        this.returnVal = undefined;
        this.id = this.getID(); // string
    }

    pushCallee(funcStack) { 
        funcStack.caller = this.id;

        let newIndex = this.index.slice();
        newIndex.push(this.callee.length);
        funcStack.index = newIndex;
        
        this.callee.push(funcStack); 
    }

    getDepth() { return this.index.length; } // Entry point funcStack has depth 0
    isDeepest() { return this.callee.length == 0; }
    isTop() { return (this.caller == null) ? true : false; }

    static calculateID(funcName, callerFuncName, beforeThis, beforeArgs) {
        return [funcName, callerFuncName, hash(toJSON(beforeThis)), hash(toJSON(beforeArgs))].join(":");
    }

    getID() {
        if (this.caller == undefined)
            return this.funcName;

        return FuncStack.calculateID(this.funcName, this.caller.split(":")[0], this.beforeThis, this.beforeArgs);
    }
}
module.exports.FuncStack = FuncStack;

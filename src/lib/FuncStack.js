"use strict";
const { toJSON } = require('./util');

class FuncStack {
	constructor(funcName) {
		this.funcName = funcName; // in the format of "filePath#funcName"
		this.index = []; // index of the whole function stacks, first element stands for whether it's in base FuncStacks
		this.caller = undefined; // string: caller's funcName
		this.beforeThis = undefined; // reference
		this.beforeArgs = undefined; // json format
		this.afterThis = undefined; // reference
		this.afterArgs = undefined; // json format
		this.returnVal = undefined; // json format
		this.callee = []; // array of FuncStack
	}

	static getFuncStack(baseFuncStack, index) {
		let funcStack = baseFuncStack;
		for (let i = 0; i < index.length; i++) {
			funcStack = funcStack.callee[index[i]];
		}
		return funcStack;
	}

	setBeforeStats(caller, beforeThis, beforeArgs) {
		this.caller = caller;
		this.beforeThis = toJSON(beforeThis);
		this.beforeArgs = toJSON(beforeArgs);
	}

	setAfterStats(returnVal, afterThis, afterArgs) {
		this.afterThis = toJSON(afterThis);
		this.afterArgs = toJSON(afterArgs);
		this.returnVal = toJSON(returnVal);
	}

	pushCallee(funcStack) { 
		funcStack.caller = this.funcName;

		let newIndex = this.index.slice();
		newIndex.push(this.callee.length);
		funcStack.index = newIndex;
		
		this.callee.push(funcStack); 
	}

	getDepth() { return this.index.length; } // Entry point funcStack has depth 0
	isDeepest() { return this.callee.length === 0; }
	isTop() { return (this.caller === undefined) ? true : false; }
}
module.exports.FuncStack = FuncStack;

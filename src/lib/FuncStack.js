"use strict";
const { toJSON, hash } = require('./util');

class FuncStack {
	constructor(funcName) {
		this.funcName = funcName; // in the format of "filePath#funcName"
		this.index = []; // index of the whole function stacks, first element stands for whether it's in base FuncStacks
		this.caller = undefined; // string: caller's funcName
		this.callee = []; // array of FuncStack
		this.beforeThis = undefined; // reference
		this.beforeArgs = undefined; // json format
		this.afterThis = undefined; // reference
		this.afterArgs = undefined; // json format
		this.returnVal = undefined; // json format
		//this.id = funcName;
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
		//if ((beforeThis === global) || (beforeThis === undefined) || (beforeThis === module.exports))
		//	this.beforeThis = null;
		//else
		this.beforeThis = toJSON(beforeThis);
		this.beforeArgs = toJSON(beforeArgs);
		//this.updateID();
	}

	setAfterStats(afterThis, afterArgs, returnVal) {
		//if ((afterThis === global) || (afterThis === undefined) || (afterThis === module.exports))
		//	this.afterThis = null;
		//else
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

	//static calculateID(funcName, callerFuncName, beforeThis, beforeArgs) {
	//	return [funcName, callerFuncName, hash(toJSON(beforeThis)), hash(beforeArgs)].join(":");
	//}

	//updateID() {
	//	if (this.caller === undefined) {
	//		this.id = this.funcName;
	//		return;
	//	}

	//	this.id = FuncStack.calculateID(this.funcName, this.caller.split(":")[0], this.beforeThis, this.beforeArgs);
	//}
}
module.exports.FuncStack = FuncStack;

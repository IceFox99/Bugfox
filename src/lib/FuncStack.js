"use strict";
const { toJSON } = require('./util');

class FuncID  {
	// @filePath: src/lib/util.js
	// @funcPath: ["Func@foo", "FuncVar@funcExpr", "AnonFunc@sha256....."...]
	// @hash: SHA256
	constructor(filePath, funcPath, hash) {
		this.filePath = filePath;
		this.funcPath = funcPath;
		this.hash = hash;
	}

	static isAnon(funcPath) {
		return funcPath.split('@')[0] === "AnonFunc";
	}

	static read(id) {
		return new FuncID(id.filePath, id.funcPath, id.hash);
	}

	static compFuncID(id1, id2) {
		const lID = FuncID.read(id1);
		const rID = FuncID.read(id2);
		if (lID.filePath !== rID.filePath || lID.funcPath.length !== rID.funcPath.length)
			return 0;

		for (let i = 0; i < lID.funcPath.length; ++i) {
			if (FuncID.isAnon(lID.funcPath[i]) && FuncID.isAnon(rID.funcPath[i]))
				continue;
			if (lID.funcPath[i] !== rID.funcPath[i])
				return 0;
		}
		return 1;
	}

	toStr() {
		return this.filePath + "#" + this.funcPath.join("/") + "," + this.hash;
	}
}
module.exports.FuncID = FuncID;

class FuncStack {
	constructor(funcID) {
		this.funcID = funcID; // class of FuncID or "ENTRY_POINT"
		this.index = []; // index of the whole function stacks, first element stands for whether it's in base FuncStacks
		this.caller = '"-undefined-"'; // string: caller's funcID
		this.beforeThis = '"-undefined-"'; // reference
		this.beforeArgs = '"-undefined-"'; // json format
		this.afterThis = '"-undefined-"'; // reference
		this.afterArgs = '"-undefined-"'; // json format
		this.returnVal = '"-undefined-"'; // json format
		this.callee = []; // array of FuncStack
	}

	static getFuncStack(baseFuncStack, index) {
		let funcStack = baseFuncStack;
		for (let i = 0; i < index.length; i++) {
			funcStack = funcStack.callee[index[i]];
		}
		return funcStack;
	}

	setBeforeStats(beforeThis, beforeArgs) {
		this.beforeThis = toJSON(beforeThis);
		this.beforeArgs = toJSON(beforeArgs);
	}

	setAfterStats(returnVal, afterThis, afterArgs) {
		this.afterThis = toJSON(afterThis);
		this.afterArgs = toJSON(afterArgs);
		this.returnVal = toJSON(returnVal);
	}

	pushCallee(funcStack) { 
		if (this.funcID === "ENTRY_POINT")
			funcStack.caller = this.funcID;
		else
			funcStack.caller = FuncID.read(this.funcID).toStr();

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

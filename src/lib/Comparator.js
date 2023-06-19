"use strict";
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { Logger } = require('./util');
const { FuncStack } = require('./FuncStack');

class Comparator {
	constructor(config, result) {
		this.config = config;
		
		this.projectName = path.basename(this.config.sourceFolder);

		this.rootTracePath = path.join(this.config.generateFolder, "trace");
		this.logPath = path.join(this.rootTracePath, "log");
		this.logFilePath = path.join(this.logPath, "Bugfox.log");
		this.logger = new Logger(this.logFilePath);

		this.baseTracePath = path.join(this.rootTracePath, this.projectName + "_base");
		this.newTracePath = path.join(this.rootTracePath, this.projectName + "_new");
		this.baseTraceFile = path.join(this.baseTracePath, this.projectName + "_base.json");
		this.newTraceFile = path.join(this.newTracePath, this.projectName + "_new.json");
		this.baseTraceFuncPath = path.join(this.baseTracePath, this.projectName + "_base_func.json");
		this.newTraceFuncPath = path.join(this.newTracePath, this.projectName + "_new_func.json");

		this.traceDiffPath = path.join(this.rootTracePath, "diff");
		this.diffFilePath = path.join(this.traceDiffPath, "diffs.json");
		this.candFilePath = path.join(this.traceDiffPath, "candidates.json");
		this.fullFilePath = path.join(this.traceDiffPath, "full.log");

		this.baseFuncHash = JSON.parse(fs.readFileSync(this.baseTraceFuncPath));
		this.newFuncHash = JSON.parse(fs.readFileSync(this.newTraceFuncPath));

		this.baseFuncStack = JSON.parse(fs.readFileSync(this.baseTraceFile));
		this.newFuncStack = JSON.parse(fs.readFileSync(this.newTraceFile));

		// analyzing each comparison based on four information (called as code): 
		// 0) is code changed
		// 1) is before information changed (beforeThis, beforeArgs)
		// 2) is after informationn changed (afterThis, afterArgs, returnVal)
		// 3) is callee different (length + funcName)
		// look like { index, isCodeChanged, isBeforeChanged, isAfterChanged, isCalleeChanged }
		this.diffs = []; 
		this.candidates = [];
	}

	async logFull() {
		for (let diff of this.diffs) {
			await fsp.appendFile(this.fullFilePath, this.getCompStr(diff));
			await fsp.appendFile(this.fullFilePath, "\n\n");
		}

		for (let cand of this.candidates) {
			await fsp.appendFile(this.fullFilePath, this.getCompStr(cand));
			await fsp.appendFile(this.fullFilePath, "\n\n");
		}
	}

	getAnalysis(diff) {
		// @TBD
		return "";
	}

	getCompStr(diff) {
		const baseFS = FuncStack.getFuncStack(this.baseFuncStack, diff.index);
		const newFS = FuncStack.getFuncStack(this.newFuncStack, diff.index);
		let str = ("~".repeat(20) + "FUNCTION: " + baseFS.funcName + "~".repeat(20) + "\n");
		str += ("[ANALYSIS]\n" + this.getAnalysis(diff) + "\n");
		str += ("\n");
		str += ("[DETAILS]\n");
		str += ("index: " + JSON.stringify(diff.index) + "\n");
		str += ("caller: " + baseFS.caller + "\n");
		str += ("isCodeChanged: " + diff.isCodeChanged + "\n");
		str += ("isBeforeChanged: " + diff.isBeforeChanged + "\n");
		str += ("isAfterChanged: " + diff.isAfterChanged + "\n");
		str += ("isCalleeChanged: " + diff.isCalleeChanged + "\n\n");

		str += ("[COMPARISON]\n");
		str += ("BASE->beforeThis: " + baseFS.beforeThis + "\n");
		str += ("NEW-->beforeThis: " + newFS.beforeThis + "\n");
		str += ("BASE->beforeArgs: " + baseFS.beforeArgs + "\n");
		str += ("NEW-->beforeArgs: " + newFS.beforeArgs + "\n");
		str += ("BASE->afterThis: " + baseFS.afterThis + "\n");
		str += ("NEW-->afterThis: " + newFS.afterThis + "\n");
		str += ("BASE->afterArgs: " + baseFS.afterArgs + "\n");
		str += ("NEW-->afterArgs: " + newFS.afterArgs + "\n");
		str += ("BASE->returnVal: " + baseFS.returnVal + "\n");
		str += ("NEW-->returnVal: " + newFS.returnVal + "\n");
		str += ("~".repeat(20) + "FUNCTION: " + baseFS.funcName + "~".repeat(20));
		return str;
	}

	// return 1 if a first, 0 if a == b, -1 if b first
	compIndex(a, b) {
		let depth = Math.min(a.length, b.length);
		for (let i = 0; i < depth; ++i) {
			if (a[i] < b[i])
				return 1;
			else if (a[i] > b[i])
				return -1;
		}

		if (a.length === b.length)
			return 0;

		return ((a.length < b.length) ? 1 : -1);
	}

	getFirstDeepestIndexs(diffs) {
		if (diffs.length === 0)
			return null;

		let lastDiff, resDiffs = [], isFinished = false;

		for (const diff of diffs) {
			if (diff.index.length === 1) {
				lastDiff = diff;
				isFinished = false;
				continue;
			}

			if (isFinished)
				continue;

			if (diff.index.length <= lastDiff.index.length) {
				resDiffs.push(lastDiff);
				isFinished = true;
				lastDiff = diff;
				continue;
			}
				
			for (let i = 0; i < lastDiff.index.length; ++i) {
				if (diff.index[i] !== lastDiff.index[i]) {
					resDiffs.push(lastDiff);
					isFinished = true;
					lastDiff = diff;
					break;
				}
			}

			lastDiff = diff;
		}

		return resDiffs;
	}

	async analyze() {
		//this.logger.log(JSON.stringify(this.diffs, null, 2), "");
		//this.logger.log(JSON.stringify(this.candidates, null, 2), "");
		for (const deepDiff of this.getFirstDeepestIndexs(this.diffs)) {
			this.logger.log("[TEST " + deepDiff.index[0] + "] " + FuncStack.getFuncStack(this.baseFuncStack, [deepDiff.index[0]]).funcName, "");
			this.logger.log(this.getCompStr(deepDiff), "");
			this.logger.log("\n", "");
		}
	}

	// the number of callees must not be 0
	checkCallee(leftFS, rightFS) {
		if (leftFS.callee.length !== rightFS.callee.length)
			return false;
		
		for (let i = 0; i < leftFS.callee.length; ++i) {
			if (leftFS.callee[i].funcName !== rightFS.callee[i].funcName)
				return false;
		}
		return true;
	}

	async compFuncStack(index) {
		const baseFS = FuncStack.getFuncStack(this.baseFuncStack, index);
		const newFS = FuncStack.getFuncStack(this.newFuncStack, index);

		// is the code being updated among these commits
		const isCodeChanged = (this.baseFuncHash[baseFS.funcName] !== this.newFuncHash[newFS.funcName]);

		// is the information before the function call changed (beforeThis + beforeArgs)
		const isBeforeChanged = (baseFS.beforeThis !== newFS.beforeThis) || (baseFS.beforeArgs !== newFS.beforeArgs);

		// is the information after the function call changed (afterThis + afterArgs + returnVal)
		const isAfterChanged = (baseFS.afterThis !== newFS.afterThis) || (baseFS.afterArgs !== newFS.afterArgs) || (baseFS.returnVal !== newFS.returnVal);

		// is the callee of this function stack changed
		const isCalleeChanged = !(this.checkCallee(baseFS, newFS));

		const diff = { index, isCodeChanged, isBeforeChanged, isAfterChanged, isCalleeChanged };
		
		if (isCodeChanged) {
			if (isBeforeChanged) {
				if (isAfterChanged) {
					if (isCalleeChanged) {
						// 1111
						// completely refactor
						// mark this comparison and stop
						this.diffs.push(diff);
					}
					else {
						// 1110
						// may caused by the changed of this function
						// mark this comparison
						this.diffs.push(diff);

						// iterate their subtree recursively
						//for (let i = 0; i < baseFS.callee.length; ++i) {
						//	await this.compFuncStack([...index, i]);
						//}
					}
				}
				else {
					if (isCalleeChanged) {
						// 1101
						// weird situation
						// add to the candidates list
						this.candidates.push(diff);
					}
					else {
						// 1100
						// weird situation
						// add to the candidates list
						this.candidates.push(diff);
					}
				}
			}
			else {
				if (isAfterChanged) {
					if (isCalleeChanged) {
						// 1011
						// may caused by the changed of this function
						// mark this comparison
						this.diffs.push(diff);

						// iterate their subtree recursively until meet different function
						for (let i = 0; i < Math.min(baseFS.callee.length, newFS.callee.length); ++i) {
							const baseChild = FuncStack.getFuncStack(this.baseFuncStack, [...index, i]);
							const newChild = FuncStack.getFuncStack(this.newFuncStack, [...index, i]);
							if (baseChild.funcName !== newChild.funcName)
								return;

							await this.compFuncStack([...index, i]);
						}
					}
					else {
						// 1010
						// may caused by the changed of this function
						// mark this comparison
						this.diffs.push(diff);

						// iterate their subtree recursively
						for (let i = 0; i < baseFS.callee.length; ++i) {
							await this.compFuncStack([...index, i]);
						}
					}
				}
				else {
					if (isCalleeChanged) {
						// 1001
						// perfect refactor
						// do nothing
					}
					else {
						// 1000
						// perfect refactor
						// do nothing
					}
				}
			}
		}
		else {
			if (isBeforeChanged) {
				if (isAfterChanged) {
					if (isCalleeChanged) {
						// 0111
						// probably caused by different input
						// mark this comparison
						this.diffs.push(diff);

						// iterate their subtree recursively until meet different function
						//for (let i = 0; i < Math.min(baseFS.callee.length, newFS.callee.length); ++i) {
						//	const baseChild = FuncStack.getFuncStack(this.baseFuncStack, [...index, i]);
						//	const newChild = FuncStack.getFuncStack(this.newFuncStack, [...index, i]);
						//	if (baseChild.funcName !== newChild.funcName)
						//		return;

						//	await this.compFuncStack([...index, i]);
						//}
					}
					else {
						// 0110
						// probably caused by different input
						// mark this comparison
						this.diffs.push(diff);

						// iterate their subtreer recursively
						//for (let i = 0; i < baseFS.callee.length; ++i) {
						//	await this.compFuncStack([...index, i]);
						//}
					}
				}
				else {
					if (isCalleeChanged) {
						// 0101
						// weird situation
						// add to the candidates list
						this.candidates.push(diff);
					}
					else {
						// 0100
						// weird situation
						// add to the candidates list
						this.candidates.push(diff);
					}
				}
			}
			else {
				if (isAfterChanged) {
					if (isCalleeChanged) {
						// 0011
						// may caused by the changed of callee function's update
						// mark this comparison
						this.diffs.push(diff);

						// iterate their subtree recursively until meet different function
						for (let i = 0; i < Math.min(baseFS.callee.length, newFS.callee.length); ++i) {
							const baseChild = FuncStack.getFuncStack(this.baseFuncStack, [...index, i]);
							const newChild = FuncStack.getFuncStack(this.newFuncStack, [...index, i]);
							if (baseChild.funcName !== newChild.funcName)
								return;

							await this.compFuncStack([...index, i]);
						}
					}
					else {
						// 0010
						// may caused by the changed of callee function's update
						// mark this comparison
						this.diffs.push(diff);

						// iterate their subtree recursively
						for (let i = 0; i < baseFS.callee.length; ++i) {
							await this.compFuncStack([...index, i]);
						}
					}
				}
				else {
					if (isCalleeChanged) {
						// 0001
						// callee changed but still considered as perfect
						// do nothing
					}
					else {
						// 0000
						// executed perfectly as usual
						// do nothing
					}
				}
			}
		}
	}

	async compare() {
		this.logger.logL("START ANALYZING");
		if (!this.checkCallee(this.baseFuncStack, this.newFuncStack))
			throw new Error("[DEPTH 1] test codes being changed, please run same test module");
		
		// For each test function
		for (let i = 0; i < this.baseFuncStack.callee.length; ++i) {
			await this.compFuncStack([i]);
		}

		await fsp.writeFile(this.diffFilePath, JSON.stringify(this.diffs, null, 2));
		await fsp.writeFile(this.candFilePath, JSON.stringify(this.candidates, null, 2));
		await this.logFull();

		await this.analyze();

		this.logger.logL("END ANALYZING");

		this.logger.log("Complete log can be seen in \"" + this.logFilePath + "\"", "");
		this.logger.log("Analysis for all functions that behaved differently can be seen in \"" + this.fullFilePath + "\"", "");
	}
}
module.exports.Comparator = Comparator;

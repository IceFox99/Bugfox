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

		// analyzing each comparison based on three information: 
		// 0) is code changed
		// 1) is before information changed (beforeThis, beforeArgs)
		// 2) is after informationn changed (afterThis, afterArgs, returnVal)
		// look like { index, isCodeChanged, isBeforeChanged, isAfterChanged }
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

	// @TBD
	getAnalysis(diff) {
		if (diff.isCodeChanged) {
			if (diff.isBeforeChanged) {
				if (diff.isAfterChanged) {
					// 111
					return "Most complicated situation, probably caused by the huge refactor of this function, please check all information includes its caller, callee and arguments.\n\n" +
						"Possible reason:\n" +
						"0) this function has been updated incorrectly\n" +
						"1) received unexpected parameters from its caller\n" +
						"2) received correct parameters but behaved incorrectly\n" +
						"3) the code is incompatible with its caller or callee\n" +
						"\nPossible solutions:\n" +
						"0) check the modification of this function\n" +
						"1) check all the differences include arguments, \"this\", return value between two commits\n" +
						"2) traverse its function body with different arguments\n" +
						"3) refactor this function, its caller and callee to make them compatible";
				}
				else {
					// 110
					return "Candidate situation, which may worked correctly or not, please check this function's modification, its caller and the different arguments that passed to this function.\n\n" +
						"Possible reasons:\n" +
						"0) this function has been updated incorrectly\n" +
						"1) received unexpected parameters from its caller\n" +
						"2) received correct parameters but should have different return value or different behaviors\n" +
						"\nPossible solutions:\n" +
						"0) check the modification of this function\n" +
						"1) traverse its function body to see whether the function should have different behavior based on different arguments\n" +
						"2) refactor this function to make it compatible with it calller";
				}
			}
			else {
				if (diff.isAfterChanged) {
					// 101
					return "Probably caused by the update of this function, please check this function's modification and its callee.\n\n" +
						"Possible reasons:\n" +
						"0) this function has been updated incorrectly (highest probability)\n" +
						"1) the code is incompatible with its callee\n" +
						"\nPossible solutions:\n" + 
						"0) check the modification of this function\n" +
						"1) traverse its function body with the arguments\n" +
						"2) check its callee's contents and whether the callee have been refactored";
				}
				else {
					// 100
					// do nothing
					return "Great refactor, worked as expected, no exception found.";
				}
			}
		}
		else {
			if (diff.isBeforeChanged) {
				if (diff.isAfterChanged) {
					// 011
					return "Probably caused by the different arguments, please check its CALLER \"" + 
						FuncStack.getFuncStack(this.baseFuncStack, diff.index).caller + 
						"\" and the different arguments that passed to this function.\n\n" +
						"Possible reasons:\n" +
						"0) this function received unexpected arguments (highest probability)\n" +
						"1) the code is incompatible with its caller\n" +
						"\nPossible solutions:\n" +
						"0) check its caller and the different arguments\n" +
						"1) traverse its function body with received different arguments\n" +
						"2) refactor this function to make it compatible with its caller\n" +
						"3) check its callee's contents and whether the callee have been refactored";
				}
				else {
					// 010
					return "Candidate situation, which may worked correctly or not, please check its CALLER \"" + 
						FuncStack.getFuncStack(this.baseFuncStack, diff.index).caller + 
						"\" and the different arguments that passed to this function.\n\n" +
						"Possible reasons:\n" +
						"0) this function received unexpected arguments\n" +
						"1) received correct parameters but should have different return value or different behaviors\n" +
						"2) the code is incompatible with its callee\n" +
						"\nPossible solutions:\n" +
						"0) check its caller and the different arguments\n" +
						"1) traverse its function body to see whether the function should have different behavior based on different arguments\n" +
						"2) refactor this function to make it compatible with it calller";
				}
			}
			else {
				if (diff.isAfterChanged) {
					// 001
					return "Unknown behavior inside this function, please check its CALLEE.\n\n" + 
						"Possible reasons:\n" +
						"0) callee of this function have been refactored\n" +
						"1) program being affected by global value inside this function\n" +
						"\nPossible solutions:\n" +
						"0) refactor this function to make it compatible with its callee\n" +
						"1) check its callee's contents and compare the program path inside this function\n" +
						"2) be aware of the global variable being accessed inside this function";
				}
				else {
					// 000
					// do nothing
					return "Worked as expected, no exception found.";
				}
			}
		}
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
		str += ("isAfterChanged: " + diff.isAfterChanged + "\n\n");

		str += ("[COMPARISON]\n");
		str += ("| BASE->beforeThis: " + baseFS.beforeThis + "\n");
		str += ("| NEW-->beforeThis: " + newFS.beforeThis + "\n");
		str += ("|------------------\n");
		str += ("| BASE->beforeArgs: " + baseFS.beforeArgs + "\n");
		str += ("| NEW-->beforeArgs: " + newFS.beforeArgs + "\n");
		str += ("|-----------------\n");
		str += ("| BASE->afterThis: " + baseFS.afterThis + "\n");
		str += ("| NEW-->afterThis: " + newFS.afterThis + "\n");
		str += ("|-----------------\n");
		str += ("| BASE->afterArgs: " + baseFS.afterArgs + "\n");
		str += ("| NEW-->afterArgs: " + newFS.afterArgs + "\n");
		str += ("|-----------------\n");
		str += ("| BASE->returnVal: " + baseFS.returnVal + "\n");
		str += ("| NEW-->returnVal: " + newFS.returnVal + "\n");
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
		let lastDiff = null, resDiffs = [], isFinished = false;

		for (const diff of diffs) {
			if (diff.index.length === 1) {
				resDiffs.push(diff); // push the depth-1 diff as backup
				lastDiff = diff;
				isFinished = false;
				continue;
			}

			if (isFinished)
				continue;

			if (diff.index.length <= lastDiff.index.length) {
				resDiffs.pop(); // pop the depth-1 diff
				resDiffs.push(lastDiff);
				isFinished = true;
				lastDiff = diff;
				continue;
			}
				
			for (let i = 0; i < lastDiff.index.length; ++i) {
				if (diff.index[i] !== lastDiff.index[i]) {
					resDiffs.pop(); // pop the depth-1 diff
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
		if (this.diffs.length === 0) {
			this.logger.log("No regression found.");
			return;
		}

		for (const deepDiff of this.getFirstDeepestIndexs(this.diffs)) {
			this.logger.log("[TEST " + deepDiff.index[0] + "] " + FuncStack.getFuncStack(this.baseFuncStack, [deepDiff.index[0]]).funcName, "");
			this.logger.log(this.getCompStr(deepDiff), "");
			this.logger.log("\n", "");
		}
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

		const diff = { index, isCodeChanged, isBeforeChanged, isAfterChanged };
		
		if (isCodeChanged) {
			if (isBeforeChanged) {
				if (isAfterChanged) {
					// 111
					this.diffs.push(diff);
				}
				else {
					// 110
					this.candidates.push(diff);
				}
			}
			else {
				if (isAfterChanged) {
					// 101
					// probably caused by the change of this function
					// mark this comparison
					this.diffs.push(diff);

					for (let i = 0; i < Math.min(baseFS.callee.length, newFS.callee.length); ++i) {
						const baseChild = FuncStack.getFuncStack(this.baseFuncStack, [...index, i]);
						const newChild = FuncStack.getFuncStack(this.newFuncStack, [...index, i]);
						if (baseChild.funcName !== newChild.funcName)
							return;

						await this.compFuncStack([...index, i]);
					}
				}
				else {
					// 100
					// perfect refactor
					// do nothing
				}
			}
		}
		else {
			if (isBeforeChanged) {
				if (isAfterChanged) {
					// 011
					// probably caused by different inpu
					// mark this comparison
					this.diffs.push(diff);
				}
				else {
					// 010
					// weird situation
					this.candidates.push(diff);
				}
			}
			else {
				if (isAfterChanged) {
					// 001
					// probably caused by the change of callee function's update
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
					// 000
					// executed perfectly as usual
					// do nothing
				}
			}
		}
	}

	async compare() {
		this.logger.logL("START ANALYZING");
		
		// For each test function
		for (let i = 0; i < this.baseFuncStack.callee.length; ++i) {
			const baseFS = FuncStack.getFuncStack(this.baseFuncStack, [i]);
			const newFS = FuncStack.getFuncStack(this.newFuncStack, [i]);
			if (baseFS.funcName !== newFS.funcName) {
				this.logger.log("[DEPTH 1] Can't compare function " + baseFS.funcName + " and " + newFS.funcName + ", stop comparing remaining call graph.");
				break;
			}

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

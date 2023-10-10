"use strict";
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { Logger, jsonDiff } = require('./util');
const { FuncID, FuncStack } = require('./FuncStack');

class Comparator {
	constructor(config) {
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

		// function body of all functions
		this.baseFuncTable = JSON.parse(fs.readFileSync(this.baseTraceFuncPath));
		this.newFuncTable = JSON.parse(fs.readFileSync(this.newTraceFuncPath));

		// two call graphs
		this.baseFuncStack = JSON.parse(fs.readFileSync(this.baseTraceFile));
		this.newFuncStack = JSON.parse(fs.readFileSync(this.newTraceFile));

		// analyzing each comparison based on three information: 
		// 0) is code changed
		// 1) is before information changed (beforeThis, beforeArgs)
		// 2) is after informationn changed (afterThis, afterArgs, returnVal)
		// look like { index, isCodeChanged, isBeforeThisChanged, isBeforeArgsChanged, isAfterThisChanged, isAfterArgsChanged, isRetChanged }
		this.diffs = []; 
		this.candidates = [];
	}

	async logFull() {
		for (let diff of this.diffs) {
			await fsp.appendFile(this.fullFilePath, await this.getCompStr(diff));
			await fsp.appendFile(this.fullFilePath, "\n\n");
		}

		for (let cand of this.candidates) {
			await fsp.appendFile(this.fullFilePath, await this.getCompStr(cand));
			await fsp.appendFile(this.fullFilePath, "\n\n");
		}
	}

	// @TBD
	getAnalysis(diff) {
		const isCodeChanged = diff.isCodeChanged;
		const isBeforeChanged = diff.isBeforeThisChanged || diff.isBeforeArgsChanged;
		const isAfterChanged = diff.isAfterThisChanged || diff.isAfterArgsChanged || diff.isRetChanged;
		if (isCodeChanged) {
			if (isBeforeChanged) {
				if (isAfterChanged) {
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
				if (isAfterChanged) {
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
			if (isBeforeChanged) {
				if (isAfterChanged) {
					// 011
					return "Probably caused by the different arguments, please check its CALLER \"" + 
						FuncStack.getFuncStack(this.baseFuncStack, diff.baseIndex).caller + 
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
						FuncStack.getFuncStack(this.baseFuncStack, diff.baseIndex).caller + 
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
				if (isAfterChanged) {
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

	async getCompStr(diff) {
		const baseFS = FuncStack.getFuncStack(this.baseFuncStack, diff.baseIndex);
		const newFS = FuncStack.getFuncStack(this.newFuncStack, diff.newIndex);
		const baseID = FuncID.read(baseFS.funcID);
		const newID = FuncID.read(newFS.funcID);
		let str = ("~".repeat(20) + "FUNCTION: " + baseID.toStr() + "~".repeat(20) + "\n");
		if (!diff.isCodeChanged) {
			str += ("[CODE]\n" + this.baseFuncTable[baseID.toStr()] + "\n");
			str += "\n";
		}
		else {
			let baseFuncBody = this.baseFuncTable[baseID.toStr()];
			let newFuncBody = this.newFuncTable[newID.toStr()];
			str += ("[CODE_DIFF]\n" + await jsonDiff(baseFuncBody, newFuncBody) + "\n");
			str += "\n";
		}
		
		str += ("[DETAILS]\n");
		if (JSON.stringify(diff.baseIndex) === JSON.stringify(diff.newIndex))
			str += ("index: " + JSON.stringify(diff.baseIndex) + "\n");
		else {
			str += ("baseIndex: " + JSON.stringify(diff.baseIndex) + "\n");
			str += ("newIndex: " + JSON.stringify(diff.newIndex) + "\n");
		}
		str += ("caller: " + baseFS.caller + "\n");
		str += ("isCodeChanged: " + diff.isCodeChanged + "\n");
		str += ("isBeforeThisChanged: " + diff.isBeforeThisChanged + "\n");
		str += ("isBeforeArgsChanged: " + diff.isBeforeArgsChanged + "\n");
		str += ("isAfterThisChanged: " + diff.isAfterThisChanged + "\n");
		str += ("isAfterArgsChanged: " + diff.isAfterArgsChanged + "\n");
		str += ("isRetChanged: " + diff.isRetChanged + "\n");
		str += "\n";
		str += ("[ANALYSIS]\n" + this.getAnalysis(diff) + "\n");
		str += "\n";
		str += ("[COMPARISON]\n");
		str += ("BASE->beforeThis: " + baseFS.beforeThis + "\n");
		str += ("NEW-->beforeThis: " + newFS.beforeThis + "\n");
		if (diff.isBeforeThisChanged)
			str += ("DIFF:\n" + await jsonDiff(JSON.stringify(JSON.parse(baseFS.beforeThis), null, 2), 
				JSON.stringify(JSON.parse(newFS.beforeThis), null, 2)));
		str += ("----------------------------------\n");

		str += ("BASE->beforeArgs: " + baseFS.beforeArgs + "\n");
		str += ("NEW-->beforeArgs: " + newFS.beforeArgs + "\n");
		if (diff.isBeforeArgsChanged)
			str += ("DIFF:\n" + await jsonDiff(JSON.stringify(JSON.parse(baseFS.beforeArgs), null, 2), 
				JSON.stringify(JSON.parse(newFS.beforeArgs), null, 2)));
		str += ("----------------------------------\n");

		str += ("BASE->afterThis: " + baseFS.afterThis + "\n");
		str += ("NEW-->afterThis: " + newFS.afterThis + "\n");
		if (diff.isAfterThisChanged)
			str += ("DIFF:\n" + await jsonDiff(JSON.stringify(JSON.parse(baseFS.afterThis), null, 2), 
				JSON.stringify(JSON.parse(newFS.afterThis), null, 2)));
		str += ("----------------------------------\n");

		str += ("BASE->afterArgs: " + baseFS.afterArgs + "\n");
		str += ("NEW-->afterArgs: " + newFS.afterArgs + "\n");
		if (diff.isAfterArgsChanged)
			str += ("DIFF:\n" + await jsonDiff(JSON.stringify(JSON.parse(baseFS.afterArgs), null, 2), 
				JSON.stringify(JSON.parse(newFS.afterArgs), null, 2)));
		str += ("----------------------------------\n");

		str += ("BASE->returnVal: " + baseFS.returnVal + "\n");
		str += ("NEW-->returnVal: " + newFS.returnVal + "\n");
		if (diff.isRetChanged)
			str += ("DIFF:\n" + await jsonDiff(JSON.stringify(JSON.parse(baseFS.returnVal), null, 2), 
				JSON.stringify(JSON.parse(newFS.returnVal), null, 2)));

		str += ("~".repeat(20) + "FUNCTION: " + baseID.toStr() + "~".repeat(20));
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
			if (diff.baseIndex.length === 1) {
				resDiffs.push(diff); // push the depth-1 diff as backup
				lastDiff = diff;
				isFinished = false;
				continue;
			}

			if (isFinished)
				continue;

			if (diff.baseIndex.length <= lastDiff.baseIndex.length) {
				resDiffs.pop(); // pop the depth-1 diff
				resDiffs.push(lastDiff);
				isFinished = true;
				lastDiff = diff;
				continue;
			}
				
			for (let i = 0; i < lastDiff.baseIndex.length; ++i) {
				if (diff.baseIndex[i] !== lastDiff.baseIndex[i]) {
					resDiffs.pop(); // pop the depth-1 diff
					resDiffs.push(lastDiff);
					isFinished = true;
					lastDiff = diff;
					break;
				}
			}

			lastDiff = diff;
		}

		if (!isFinished) {
			resDiffs.pop();
			resDiffs.push(lastDiff);
		}

		return resDiffs;
	}

	async analyze() {
		if (this.diffs.length === 0) {
			this.logger.log("No regression found.");
			return;
		}

		for (const deepDiff of this.getFirstDeepestIndexs(this.diffs)) {
			this.logger.log("[TEST " + deepDiff.baseIndex[0] + " & " + deepDiff.newIndex[0] + "] " + FuncID.read(FuncStack.getFuncStack(this.baseFuncStack, [deepDiff.baseIndex[0]]).funcID).toStr(), "");
			this.logger.log(await this.getCompStr(deepDiff), "");
			this.logger.log("\n", "");
		}
	}

	async compFuncStack(baseIndex, newIndex) {
		const baseFS = FuncStack.getFuncStack(this.baseFuncStack, baseIndex);
		const newFS = FuncStack.getFuncStack(this.newFuncStack, newIndex);

		// is the code being updated among these commits
		const isCodeChanged = (baseFS.funcID.hash !== newFS.funcID.hash);

		// is the information before the function call changed (beforeThis + beforeArgs)
		const isBeforeThisChanged = (baseFS.beforeThis !== newFS.beforeThis);
		const isBeforeArgsChanged = (baseFS.beforeArgs !== newFS.beforeArgs);

		// is the information after the function call changed (afterThis + afterArgs + returnVal)
		const isAfterThisChanged = (baseFS.afterThis !== newFS.afterThis);
		const isAfterArgsChanged = (baseFS.afterArgs !== newFS.afterArgs);
		const isRetChanged = (baseFS.returnVal !== newFS.returnVal);

		const diff = { baseIndex, newIndex, isCodeChanged, isBeforeThisChanged, isBeforeArgsChanged, isAfterThisChanged, isAfterArgsChanged, isRetChanged };
		
		const isBeforeChanged = isBeforeThisChanged || isBeforeArgsChanged;
		const isAfterChanged = isAfterThisChanged || isAfterArgsChanged || isRetChanged;

		// Test Entries Mode
		if (this.config.testEntries !== undefined && this.config.testEntries.includes(FuncID.read(baseFS.funcID).toStr())) {
			this.diffs.push(diff);

			for (let i = 0; i < Math.min(baseFS.callee.length, newFS.callee.length); ++i) {
				const baseChild = FuncStack.getFuncStack(this.baseFuncStack, [...baseIndex, i]);
				const newChild = FuncStack.getFuncStack(this.newFuncStack, [...newIndex, i]);
				if (!FuncID.compFuncID(baseChild.funcID, newChild.funcID))
					return;

				await this.compFuncStack([...baseIndex, i], [...newIndex, i]);
			}
			return;
		}

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
						const baseChild = FuncStack.getFuncStack(this.baseFuncStack, [...baseIndex, i]);
						const newChild = FuncStack.getFuncStack(this.newFuncStack, [...newIndex, i]);
						if (!FuncID.compFuncID(baseChild.funcID, newChild.funcID))
							return;

						await this.compFuncStack([...baseIndex, i], [...newIndex, i]);
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
					// probably caused by different input
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
						const baseChild = FuncStack.getFuncStack(this.baseFuncStack, [...baseIndex, i]);
						const newChild = FuncStack.getFuncStack(this.newFuncStack, [...newIndex, i]);
						if (!FuncID.compFuncID(baseChild.funcID, newChild.funcID))
							return;

						await this.compFuncStack([...baseIndex, i], [...newIndex, i]);
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
		if (this.config.testEntries === undefined || this.config.testEntries.length === 0) {
			for (let i = 0; i < Math.min(this.baseFuncStack.callee.length, this.newFuncStack.callee.length); ++i) {
				const baseFS = FuncStack.getFuncStack(this.baseFuncStack, [i]);
				const newFS = FuncStack.getFuncStack(this.newFuncStack, [i]);
				if (!FuncID.compFuncID(baseFS.funcID, newFS.funcID)) {
					this.logger.log("[DEPTH 1] Can't compare function " + FuncID.read(baseFS.funcID).toStr()+ " and " + FuncID.read(newFS.funcID).toStr() + ", stop comparing remaining call graph.");
					break;
				}

				await this.compFuncStack([i], [i]);
			}
		}
		else {
			let funcIndices = {}, i = 0, count = 0, testEntries = this.config.testEntries;
			for (const entry of testEntries)
				funcIndices[entry] = {};
			// traverse the base function stack
			while (i < this.baseFuncStack.callee.length && count !== testEntries.length) {
				let funcID = FuncID.read(this.baseFuncStack.callee[i].funcID);
				let funcIDStr = funcID.toStr();
				if (testEntries.includes(funcIDStr) && funcIndices[funcIDStr].baseIndex === undefined) {
					funcIndices[funcIDStr].baseIndex = [i];
					++count;
				}

				++i;
			}
			i = 0, count = 0;
			// traverse the new function stack
			while (i < this.newFuncStack.callee.length && count !== testEntries.length) {
				let funcID = FuncID.read(this.newFuncStack.callee[i].funcID);
				let funcIDStr = funcID.toStr();
				if (testEntries.includes(funcIDStr) && funcIndices[funcIDStr].newIndex === undefined) {
					funcIndices[funcIDStr].newIndex = [i];
					++count;
				}

				++i;
			}

			for (const entry of testEntries) {
				if (funcIndices[entry].baseIndex === undefined) {
					this.logger.log(`[WARN] Can't find test entry ${entry} in base function stacks.`)
					continue;
				}
				if (funcIndices[entry].newIndex === undefined) {
					this.logger.log(`[WARN] Can't find test entry ${entry} in new function stacks.`);
					continue;
				}
				await this.compFuncStack(funcIndices[entry].baseIndex, funcIndices[entry].newIndex);
			}
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

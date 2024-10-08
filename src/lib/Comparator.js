"use strict";
const os = require('os');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { Logger, jsonDiff } = require('./util');
const { FuncID, FuncStack } = require('./FuncStack');

class Comparator {
	constructor(config) {
		this.config = config;
		
		this.projectName = path.basename(this.config.sourceFolder);

		this.rootTracePath = path.join(os.homedir(), this.config.generateFolder, "trace");
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
		this.candFilePath = path.join(this.traceDiffPath, "alternatives.json");
		this.fullFilePath = path.join(this.traceDiffPath, "full.log");
		this.reportFilePath = path.join(this.rootTracePath, "report.txt");

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
		this.diffs = []; // real differences being used in analyzing
		this.alternatives = []; // alternative candidates, won't be used
		this.counts = {}; // counts of all functions
		this.n = 4;
	}

	async logFull() {
		for (let diff of this.diffs) {
			await fsp.appendFile(this.fullFilePath, await this.getFDFStr(diff));
			await fsp.appendFile(this.fullFilePath, "\n\n");
		}

		for (let cand of this.alternatives) {
			await fsp.appendFile(this.fullFilePath, await this.getFDFStr(cand));
			await fsp.appendFile(this.fullFilePath, "\n\n");
		}
	}

	getAnalysis(diff) {
		const isCodeChanged = diff.isCodeChanged;
		const isBeforeChanged = diff.isBeforeThisChanged || diff.isBeforeArgsChanged;
		const isAfterChanged = diff.isAfterThisChanged || diff.isAfterArgsChanged || diff.isRetChanged;
		if (isCodeChanged) {
			if (isBeforeChanged) {
				if (isAfterChanged) {
					// 111
					return "Most complicated situation, probably caused by the huge refactor of this function, please check all information includes its caller, callee and arguments."; 
						// +
						// "Possible reason:\n" +
						// "0) this function has been updated incorrectly\n" +
						// "1) received unexpected parameters from its caller\n" +
						// "2) received correct parameters but behaved incorrectly\n" +
						// "3) the code is incompatible with its caller or callee\n" +
						// "\nPossible solutions:\n" +
						// "0) check the modification of this function\n" +
						// "1) check all the differences include arguments, \"this\", return value between two commits\n" +
						// "2) traverse its function body with different arguments\n" +
						// "3) refactor this function, its caller and callee to make them compatible";
				}
				else {
					// 110
					return "Candidate situation, which may worked correctly or not, please check this function's modification, its caller and the different arguments that passed to this function.";
						// +
						// "Possible reasons:\n" +
						// "0) this function has been updated incorrectly\n" +
						// "1) received unexpected parameters from its caller\n" +
						// "2) received correct parameters but should have different return value or different behaviors\n" +
						// "\nPossible solutions:\n" +
						// "0) check the modification of this function\n" +
						// "1) traverse its function body to see whether the function should have different behavior based on different arguments\n" +
						// "2) refactor this function to make it compatible with it calller";
				}
			}
			else {
				if (isAfterChanged) {
					// 101
					return "Probably caused by the update of this function, please check this function's modification and its callee.";
						// +
						// "Possible reasons:\n" +
						// "0) this function has been updated incorrectly (highest probability)\n" +
						// "1) the code is incompatible with its callee\n" +
						// "\nPossible solutions:\n" + 
						// "0) check the modification of this function\n" +
						// "1) traverse its function body with the arguments\n" +
						// "2) check its callee's contents and whether the callee have been refactored";
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
					return "Probably caused by the different arguments and context, please check its CALLER \"" + 
						FuncStack.getFuncStack(this.baseFuncStack, diff.baseIndex).caller + 
						"\" and the different arguments and context that passed to this function."
						//+
						//"Possible reasons:\n" +
						//"0) this function received unexpected arguments (highest probability)\n" +
						//"1) the code is incompatible with its caller\n" +
						//"\nPossible solutions:\n" +
						//"0) check its caller and the different arguments\n" +
						//"1) traverse its function body with received different arguments\n" +
						//"2) refactor this function to make it compatible with its caller\n" +
						//"3) check its callee's contents and whether the callee have been refactored";
				}
				else {
					// 010
					return "Candidate situation, which may worked correctly or not, please check its CALLER \"" + 
						FuncStack.getFuncStack(this.baseFuncStack, diff.baseIndex).caller + 
						"\" and the different arguments that passed to this function.";
						// +
						// "Possible reasons:\n" +
						// "0) this function received unexpected arguments\n" +
						// "1) received correct parameters but should have different return value or different behaviors\n" +
						// "2) the code is incompatible with its callee\n" +
						// "\nPossible solutions:\n" +
						// "0) check its caller and the different arguments\n" +
						// "1) traverse its function body to see whether the function should have different behavior based on different arguments\n" +
						// "2) refactor this function to make it compatible with it calller";
				}
			}
			else {
				if (isAfterChanged) {
					// 001
					return "Unknown behavior inside this function, please check its CALLEE."; 
						// + 
						// "Possible reasons:\n" +
						// "0) callee of this function have been refactored\n" +
						// "1) program being affected by global value inside this function\n" +
						// "\nPossible solutions:\n" +
						// "0) refactor this function to make it compatible with its callee\n" +
						// "1) check its callee's contents and compare the program path inside this function\n" +
						// "2) be aware of the global variable being accessed inside this function";
				}
				else {
					// 000
					// do nothing
					return "Worked as expected, no exception found.";
				}
			}
		}
	}

	async getTopnStr() {
		let str = "";
		let topn = [];
		const sortFuncs = (funca, funcb) => {
			if (funca.counts > funcb.counts) return -1;
			else if (funca.counts < funcb.counts) return 1;
			else {
				for (let i = 0; i < Math.min(funca.starting.length, funcb.starting.length); ++i) {
					if (funca.starting[i] < funcb.starting[i]) return -1;
					else if (funca.starting[i] > funcb.starting[i]) return 1;
				}
				if (funca.starting.length < funcb.starting.length) return -1;
				return 1;
			}
		};

		// Top-n strategy
		str += ("~".repeat(20) + "Top-n Strategy with n=" + this.n + "~".repeat(20) + "\n");
		
		for (const key in this.counts) {
			if (this.counts[key].starting.length > 1)
				topn.push(this.counts[key]);
		}
		topn.sort(sortFuncs);
		
		for (let i = 0; i < Math.min(this.n, topn.length); i++) {
			str += ("[" + (i + 1) + "] " + topn[i].id + " (" + topn[i].counts + " times)" + "\n");
		}

		str += ("~".repeat(20) + "Top-n Strategy with n=" + this.n + "~".repeat(20));
		return str;
	}

	async getFDFStr(diff) {
		const baseFS = FuncStack.getFuncStack(this.baseFuncStack, diff.baseIndex);
		const newFS = FuncStack.getFuncStack(this.newFuncStack, diff.newIndex);
		const baseID = FuncID.read(baseFS.funcID);
		const newID = FuncID.read(newFS.funcID);
		let str = "";
		
		// FDF strategy
		str += ("~".repeat(20) + "First Deepest Function Strategy (FDF)" + "~".repeat(20) + "\n");
		str += ("FDF FUNCTION: " + baseID.toStr() + "\n\n");
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

		str += ("~".repeat(20) + "First Deepest Function Strategy (FDF)" + "~".repeat(20));

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

	getDeepestIndexes(diffs) {
		let lastDiff = null, resDiffs = [], flag = true;
		for (const diff of diffs) {
			if (!lastDiff) {
				lastDiff = diff;
				continue;
			}

			if (diff.baseIndex.length <= lastDiff.baseIndex.length) {
				resDiffs.push(lastDiff);
				lastDiff = diff;
				continue;
			}

			for (let i = 0; i < lastDiff.baseIndex.length; ++i) {
				if (diff.baseIndex[i] !== lastDiff.baseIndex[i]) {
					flag = false;
					break;
				}
			}

			if (!flag)
				resDiffs.push(lastDiff);
			flag = true;
			lastDiff = diff;
		}

		if (lastDiff !== null)
			resDiffs.push(lastDiff);

		return resDiffs;
	}

	recordDiff(diff, isAlter = false) {
		if (!isAlter) this.diffs.push(diff);
		else this.alternatives.push(diff);
		const baseFS = FuncStack.getFuncStack(this.baseFuncStack, diff.baseIndex);
		const funcID = FuncID.read(baseFS.funcID).toStr();
		if (this.counts.hasOwnProperty(funcID)) {
			++this.counts[funcID].counts;
		}
		else {
			this.counts[funcID] = { id: funcID, counts: 1, starting: diff.baseIndex };
		}
	}

	async analyze() {
		if (this.diffs.length === 0) {
			this.logger.log("No regression found.");
			return;
		}

		let test = new Set();
		for (const deepDiff of this.getDeepestIndexes(this.diffs)) {
			// Make sure report only one function for each test
			if (!test.has(deepDiff.baseIndex[0])) {
				let title = "[TEST " + deepDiff.baseIndex[0] + " & " + deepDiff.newIndex[0] + "] " + FuncID.read(FuncStack.getFuncStack(this.baseFuncStack, [deepDiff.baseIndex[0]]).funcID).toStr();
				let fdfStr = await this.getFDFStr(deepDiff);
				this.logger.log(title, "");
				this.logger.log(fdfStr, "", "\n");
				await fsp.appendFile(this.reportFilePath, title + "\n");
				await fsp.appendFile(this.reportFilePath, fdfStr + "\n\n");
				test.add(deepDiff.baseIndex[0]);
			}
			break; // report one candidate for FDF
		}

		let topnStr = await this.getTopnStr();
		this.logger.log(topnStr, "");
		await fsp.appendFile(this.reportFilePath, topnStr);
	}

	async compFuncStack(baseIndex, newIndex) {
		const baseFS = FuncStack.getFuncStack(this.baseFuncStack, baseIndex);
		const newFS = FuncStack.getFuncStack(this.newFuncStack, newIndex);

		if (!FuncID.compFuncID(baseFS.funcID, newFS.funcID))
			return;

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
		if (this.config.testEntry !== undefined && baseIndex.length === 1) {
			this.recordDiff(diff);

			for (let i = 0; i < Math.min(baseFS.callee.length, newFS.callee.length); ++i) 
				await this.compFuncStack([...baseIndex, i], [...newIndex, i]);
			
			return;
		}

		if (isCodeChanged) {
			if (isBeforeChanged) {
				if (isAfterChanged) {
					// 111
					this.recordDiff(diff);
				}
				else {
					// 110
					this.recordDiff(diff, true);
				}
			}
			else {
				if (isAfterChanged) {
					// 101
					// probably caused by the change of this function
					// mark this comparison
					this.recordDiff(diff);
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
					this.recordDiff(diff);
				}
				else {
					// 010
					// weird situation
					this.recordDiff(diff, true);
				}
			}
			else {
				if (isAfterChanged) {
					// 001
					// probably caused by the change of callee function's update
					// mark this comparison
					this.recordDiff(diff);
				}
				else {
					// 000
					// executed perfectly as usual
					// do nothing
				}
			}
		}
		for (let i = 0; i < Math.min(baseFS.callee.length, newFS.callee.length); ++i)
			await this.compFuncStack([...baseIndex, i], [...newIndex, i]);
	}

	async compare() {
		let start = performance.now();
		this.logger.logL("START ANALYZING");

		if (this.config.testEntry === undefined) {
			// No specified test entry
			for (let i = 0; i < Math.min(this.baseFuncStack.callee.length, this.newFuncStack.callee.length); ++i) {
				const baseFS = FuncStack.getFuncStack(this.baseFuncStack, [i]);
				const newFS = FuncStack.getFuncStack(this.newFuncStack, [i]);
				if (!FuncID.compFuncID(baseFS.funcID, newFS.funcID)) {
					this.logger.log("Can't compare Depth-1 function " + FuncID.read(baseFS.funcID).toStr() 
						+ " and " + FuncID.read(newFS.funcID).toStr() + "\n");
					break;
				}

				await this.compFuncStack([i], [i]);
			}
		}
		else {
			let funcIndices = {}, testEntry = this.config.testEntry;
			for (let i = 0; i < this.baseFuncStack.callee.length; ++i) {
				let funcID = FuncID.read(this.baseFuncStack.callee[i].funcID);
				let funcIDStr = funcID.toStr();
				if (testEntry === funcIDStr) {
					funcIndices.baseIndex = i;
					break;
				}
			}
			for (let i = 0; i < this.newFuncStack.callee.length; ++i) {
				let funcID = FuncID.read(this.newFuncStack.callee[i].funcID);
				let funcIDStr = funcID.toStr();
				if (testEntry === funcIDStr) {
					funcIndices.newIndex = i;
					break;
				}
			}

			if (funcIndices.baseIndex === undefined)
				this.logger.log(`[WARN] Can't find test entry ${testEntry} in base function stacks.`);
			else if (funcIndices.newIndex === undefined)
				this.logger.log(`[WARN] Can't find test entry ${testEntry} in new function stacks.`);
			else {
				let max = Math.min(this.baseFuncStack.callee.length - funcIndices.baseIndex, 
					this.newFuncStack.callee.length - funcIndices.newIndex);
				for (let i = 0; i < max; ++i) {
					const baseFS = FuncStack.getFuncStack(this.baseFuncStack, [funcIndices.baseIndex + i]);
					const newFS = FuncStack.getFuncStack(this.newFuncStack, [funcIndices.newIndex + i]);
					if (!FuncID.compFuncID(baseFS.funcID, newFS.funcID)) {
						this.logger.log("Can't compare function " + FuncID.read(baseFS.funcID).toStr() 
							+ " and " + FuncID.read(newFS.funcID).toStr() + "\n");
						break;
					}
					await this.compFuncStack([funcIndices.baseIndex + i], [funcIndices.newIndex + i]);
				}
			}
		}
		
		await fsp.writeFile(this.diffFilePath, JSON.stringify(this.diffs, null, 2));
		await fsp.writeFile(this.candFilePath, JSON.stringify(this.alternatives, null, 2));
		await this.logFull();

		this.logger.log("Finish comparing call graphs, start analyzing: \n");

		await this.analyze();

		this.logger.logL("END ANALYZING");

		let end = performance.now();
		this.logger.log("Analyzing: " +  (end - start) + " ms");

		this.logger.log("\nComplete log can be seen in \{" + this.logFilePath + "\}", "");
		this.logger.log("Analysis for all functions that behaved differently can be seen in \{" + this.fullFilePath + "\}", "");
		this.logger.log("\n|--------------------------------", "");
		this.logger.log("| Concise analysis report from Bugfox can be seen in", "");
		this.logger.log("| " + this.reportFilePath, "");
		this.logger.log("|--------------------------------", "");
	}
}
module.exports.Comparator = Comparator;

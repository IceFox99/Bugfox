"use strict";
const fs = require('fs');
const path = require('path');
const { Logger } = require('./util');

class Comparator {
	constructor(config, result) {
		this.config = config;
		this.baseFuncStack = result[0];
		this.newFuncStack = result[1];

		this.rootTracePath = path.join(this.config.generateFolder, "trace");
		this.logPath = path.join(this.rootTracePath, "log");
		this.logger = new Logger(path.join(this.logPath, "Bugfox.log"));

		this.traceDiffPath = path.join(this.rootTracePath, "diff");
	}

	async compare() {
		if (this.baseFuncStack.callee.length !== this.newFuncStack.callee.length)
			this.logger.log("test codes being changed, might not have reasonable result", "***Bugfox: ", "***");
		
		// @TBD
	}
}
module.exports.Comparator = Comparator;

"use strict";

const crypto = require("crypto");
const fs = require('fs');
const path = require('path');

const addFuncPrefix = (str) => {
	return "Bugfox_Original_" + str; 
};
module.exports.addFuncPrefix = addFuncPrefix;

const removeEscapeCode = (string) => {
    return string.replace(/\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|K]/g, '')
		.replace(/\r/g, '');
};
module.exports.removeEscapeCode = removeEscapeCode;

class Logger {
	constructor(filePath) {
		this.filePath = filePath;
	}

	log(str, prefix = "Bugfox: ", postfix = "") {
		let newStr = prefix + str + postfix;
		console.log(newStr);
		fs.appendFileSync(this.filePath, newStr + "\n");
	}

	logL(str) {
		let newStr = "\n----------Bugfox: " + str + "----------\n";
		console.log(newStr);
		fs.appendFileSync(this.filePath, newStr + "\n");
	}

	append(str) {
		fs.appendFileSync(this.filePath, str);
	}
}
module.exports.Logger = Logger;

const formatObj = (obj, seen = new WeakSet()) => {
	if (obj === undefined)
		return "-undefined-";
	else if (typeof obj !== 'object' && typeof obj !== 'function')
		return obj;
	else if (obj === null)
		return obj;

	if (seen.has(obj))
		return '[Circular]';
	seen.add(obj);
	
	const result = Array.isArray(obj) ? [] : {};
	for (const key of Object.getOwnPropertyNames(obj)) {
		const descriptor = Object.getOwnPropertyDescriptor(obj, key);
		if (descriptor && typeof descriptor.get === 'function')
			continue;

		const value = obj[key];
		result[key] = formatObj(value, seen);
	}

	return result;
};

const toJSON = (data) => {
	const format_obj = formatObj(data);
	if (typeof data === 'function') {
		if (Object.keys(format_obj).length === 0)
			return JSON.stringify(data.toString());
		else
			return `{"-Function-":"${JSON.stringify(data.toString())}","-Attributes-":${JSON.stringify(format_obj)}}`;
	}
	return JSON.stringify(format_obj);
}
module.exports.toJSON = toJSON;

const hash = (input) => {
	if (input === undefined)
		return '-'.repeat(64);
	const _hash = crypto.createHash('sha256');
	_hash.update(input);
	return _hash.digest('hex');
};
module.exports.hash = hash;

const checkConfig = (config) => {
	if (!config.hasOwnProperty('sourceFolder'))
		throw new Error("Missing source folder path");
	if (!config.hasOwnProperty('generateFolder'))
		throw new Error("Missing generate folder path");

	if (!config.hasOwnProperty('baseIgnoreFolder'))
		throw new Error("Missing base ignore folder path");
	if (!config.hasOwnProperty('newIgnoreFolder'))
		throw new Error("Missing new Ignore folder path");

	if (!config.hasOwnProperty('baseCommitID'))
		throw new Error("Missing base commit ID");
	if (!config.hasOwnProperty('newCommitID'))
		throw new Error("Missing new commit ID");

	if (!config.hasOwnProperty('baseCommand'))
		throw new Error("Missing base command");
	if (!config.hasOwnProperty('newCommand'))
		throw new Error("Missing new command");
	if (!Array.isArray(config.baseCommand) || !Array.isArray(config.newCommand))
		throw new Error("Command must be an array");

	if (!path.isAbsolute(config.sourceFolder) || !path.isAbsolute(config.generateFolder))
		throw new Error("Project folder must be absolute path.");
	if (!Array.isArray(config.baseIgnoreFolder) || !Array.isArray(config.newIgnoreFolder))
		throw new Error("Ignore folder must be an array");
	for (const bif of config.baseIgnoreFolder) {
		if (path.isAbsolute(bif))
			throw new Error("Base ignore folder must be relative path");
	}
	for (const nif of config.newIgnoreFolder) {
		if (path.isAbsolute(nif))
			throw new Error("New ignore folder must be relative path");
	}
}
module.exports.checkConfig = checkConfig;

"use strict";

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const crypto = require("crypto");
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const addFuncPrefix = (str) => {
	return "Bugfox_Original_" + str; 
};
module.exports.addFuncPrefix = addFuncPrefix;

const removeEscapeCode = (string) => {
    return string.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
		.replace(/\r/g, '');
};
module.exports.removeEscapeCode = removeEscapeCode;

class Logger {
	constructor(filePath) {
		this.filePath = filePath;
	}

	log(str, prefix = "[Bugfox] ", postfix = "") {
		let newStr = prefix + str + postfix;
		console.log(newStr);
		fs.appendFileSync(this.filePath, newStr + "\n");
	}

	logL(str) {
		let newStr = "\n----------[Bugfox] " + str + "----------\n";
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
	seen.delete(obj);

	return result;
};

const toJSON = (data) => {
	const format_obj = formatObj(data);
	if (typeof data === 'function') {
		if (Object.keys(format_obj).length === 0)
			return JSON.stringify(data.toString());
		else
			return JSON.stringify({ "-Function-": data.toString(), "-Attributes-": format_obj });
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

	if (path.isAbsolute(config.sourceFolder) || path.isAbsolute(config.generateFolder))
		throw new Error("Project folder must be relative path to home directory");
	if (!Array.isArray(config.baseIgnoreFolder) || !Array.isArray(config.newIgnoreFolder))
		throw new Error("Ignore folder must be an array");
	for (const bif of config.baseIgnoreFolder) {
		if (path.isAbsolute(bif))
			throw new Error("Base ignore folder must be relative path to project directory");
	}
	for (const nif of config.newIgnoreFolder) {
		if (path.isAbsolute(nif))
			throw new Error("New ignore folder must be relative path to project directory");
	}
}
module.exports.checkConfig = checkConfig;

const jsonDiff = async (str1, str2) => {
	const tempPath1 = path.join(process.cwd(), ".Bugfox_temp1");
	const tempPath2 = path.join(process.cwd(), ".Bugfox_temp2");
	const tempGen = path.join(process.cwd(), ".Bugfox_diff");
	await fsp.writeFile(tempPath1, str1+"\n");
	await fsp.writeFile(tempPath2, str2+"\n");
	await fsp.writeFile(tempGen, "\n");

	await exec(`diff ${tempPath1} ${tempPath2} -U 3 | tail -n +3 > ${tempGen}`);

	const diffRes = await fsp.readFile(tempGen, 'utf8');
	await fsp.rm(tempPath1, { force: true });
	await fsp.rm(tempPath2, { force: true });
	await fsp.rm(tempGen, { force: true });
	return diffRes;
}
module.exports.jsonDiff = jsonDiff;

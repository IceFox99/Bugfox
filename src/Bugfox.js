"use strict";
const config = require('./'+process.argv[2]);
const { checkConfig } = require('./lib/util');
const { Translator } = require('./lib/Translator');
const { Launcher } = require('./lib/Launcher');
const { Comparator } = require('./lib/Comparator');

checkConfig(config);

(async () => {
	const translator = new Translator(config);
	let start = performance.now();
	await translator.transProject();
	let end = performance.now();
	console.log("Code Transformation: ", end - start, "ms");

	const launcher = new Launcher(config);
	await launcher.launch();

	const comparator = new Comparator(config);
	start = performance.now();
	await comparator.compare();
	end = performance.now();
	console.log("Analyzing: ", end - start, "ms");
})();

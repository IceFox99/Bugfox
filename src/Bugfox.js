"use strict";
const config = require('./'+process.argv[2]);
const { checkConfig } = require('./lib/util');
const { Translator } = require('./lib/Translator');
const { Launcher } = require('./lib/Launcher');
const { Comparator } = require('./lib/Comparator');

checkConfig(config);

(async () => {
	const translator = new Translator(config);
	await translator.transProject();

	const launcher = new Launcher(config);
	await launcher.launch();

	const comparator = new Comparator(config);
	await comparator.compare();
})();

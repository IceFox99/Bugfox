const config = require('./'+process.argv[2]);
const { checkConfig } = require('./lib/util');
const { Translator } = require('./lib/Translator');
const { Launcher } = require('./lib/Launcher');
const { Comparator } = require('./lib/Comparator');

checkConfig(config);

const translator = new Translator(config);
const launcher = new Launcher(config);

//(async (translator, launcher) => {
//    await translator.transProject();
//    const result = await launcher.launch();
//    const comparator = new Comparator(result);
//    await comparator.compare();
//})(translator, launcher);
(async (translator) => {
    await translator.transProject();
})(translator);

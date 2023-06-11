const config = require('./'+process.argv[2]);
const { checkConfig } = require('./lib/util');
const { Translator } = require('./lib/Translator');
const { Launcher } = require('./lib/Launcher');
const { Comparator } = require('./lib/Comparator');

checkConfig(config);

const translator = new Translator(config);
const launcher = new Launcher(config);

const launchPromise = (async (translator, launcher) => {
    await translator.transProject();
    return await launcher.launch();
})(translator, launcher);
// temporary code snippet (to be deleted)
//const launchPromise = (async (launcher) => {
//    return await launcher.launch();
//})(launcher);

launchPromise.then((result) => {
    // Compare two commits
    const comparator = new Comparator(result);
    const reason = comparator.compare(); // get the regression reason
}).catch((error) => {
    console.error(error);
});

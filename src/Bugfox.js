const config = require('./'+process.argv[2]);
const { checkConfig } = require('./lib/util');
const { Translator } = require('./lib/Translator');
const { Launcher } = require('./lib/Launcher');
const { Comparator } = require('./lib/Comparator');

checkConfig(config);

// Source code translation phase
const translator = new Translator(config);
translator.transProject(); // translate the source code 

// Launch project
//const launcher = new Launcher(config); 
//const result = launcher.launch(); // run the updated source code and trace the result

// Compare two commits
//const comparator = new Comparator(result);
//const reason = comparator.compare(); // get the regression reason

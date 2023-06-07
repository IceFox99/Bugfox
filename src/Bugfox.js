const config = require('./'+process.argv[2]);
const { Translator } = require('./lib/Translator');
const { Launcher } = require('./lib/Launcher');
const { Comparator } = require('./lib/Comparator');

const translator = new Translator(config);
translator.transProject(config); // translate the source code 

const launcher = new Launcher(config); 
const result = launcher.run(); // run the updated source code and trace the result

const comparator = new Comparator(result);
const reason = comparator.run(); // get the regression reason

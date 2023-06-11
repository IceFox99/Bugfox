const { spawn } = require('node:child_process');
const config = require('../Bugfox-config.json');

let child = spawn("node", ["use_add.js"], {
    env: { BugfoxConfig: JSON.stringify(config) }
});

child.stdout.on('data', (data) => {
    process.stdout.write(data);
});

child.stderr.on('data', (data) => {
    process.stdout.write(data);
});

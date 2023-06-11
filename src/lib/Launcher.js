"use strict";
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class Launcher {
    constructor(config) {
        this.config = config;
        this.projectName = path.basename(this.config.sourceFolder);
        this.rootProjectPath = path.join(this.config.generateFolder, "project");
        this.baseProjectPath = path.join(this.rootProjectPath, this.projectName + "_base");
        this.newProjectPath = path.join(this.rootProjectPath, this.projectName + "_new");

        this.rootTracePath = path.join(this.config.generateFolder, "trace");
        this.baseTracePath = path.join(this.rootTracePath, this.projectName + "_base");
        this.newTracePath = path.join(this.rootTracePath, this.projectName + "_new");

        this.baseTraceFile = path.join(this.baseTracePath, this.projectName + "_base.json");
        this.newTraceFile = path.join(this.newTracePath, this.projectName + "_new.json");

        this.traceDiffPath = path.join(this.rootTracePath, "diff");
    }

    async launch() {
        console.log("----------Bugfox: launch project----------");
        process.chdir(this.baseProjectPath);
        let baseProject = spawn(this.config.baseCommand.split(" ")[0], this.config.baseCommand.split(" ").slice(1), {
            env: { BugfoxConfig: JSON.stringify(this.config), isBugfoxBase: 'true' }
        });

        baseProject.stdout.on('data', (data) => {
            process.stdout.write(data);
        });

        baseProject.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        process.chdir(this.newProjectPath);
        let newProject = spawn(this.config.newCommand.split(" ")[0], this.config.newCommand.split(" ").slice(1), {
            env: { BugfoxConfig: JSON.stringify(this.config), isBugfoxBase: 'false' }
        });

        newProject.stdout.on('data', (data) => {
            process.stdout.write(data);
        });

        newProject.stderr.on('data', (data) => {
            process.stderr.write(data);
        });
        
        await Promise.all([
            new Promise((resolve) => baseProject.on('close', resolve)),
            new Promise((resolve) => newProject.on('close', resolve))
        ]);

        console.log("----------Bugfox: finish project----------\n");
        return [ JSON.parse(fs.readFileSync(this.baseTraceFile)), JSON.parse(fs.readFileSync(this.newTraceFile)) ];
    }
}
module.exports.Launcher = Launcher;

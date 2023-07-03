"use strict";
const { exec } = require('child_process');
const path = require('path');
const { Logger } = require("./util");

class Launcher {
	constructor(config) {
		this.config = config;
		this.projectName = path.basename(this.config.sourceFolder);
		this.rootProjectPath = path.join(this.config.generateFolder, "project");
		this.baseProjectPath = path.join(this.rootProjectPath, this.projectName + "_base");
		this.newProjectPath = path.join(this.rootProjectPath, this.projectName + "_new");

		this.rootTracePath = path.join(this.config.generateFolder, "trace");
		this.logPath = path.join(this.rootTracePath, "log");
		this.logger = new Logger(path.join(this.logPath, "Bugfox.log"));

		this.baseTracePath = path.join(this.rootTracePath, this.projectName + "_base");
		this.newTracePath = path.join(this.rootTracePath, this.projectName + "_new");

		this.baseTraceFile = path.join(this.baseTracePath, this.projectName + "_base.json");
		this.newTraceFile = path.join(this.newTracePath, this.projectName + "_new.json");

		this.traceDiffPath = path.join(this.rootTracePath, "diff");
	}

	async launch() {
		this.logger.logL("LAUNCH PROJECTS");

		this.logger.log("change process path to " + this.baseProjectPath);
		process.chdir(this.baseProjectPath);

		this.logger.log("***EXECUTING BASE PROJECT***");
		let baseEnv = JSON.parse(JSON.stringify(process.env));
		baseEnv.BugfoxConfig = JSON.stringify(this.config);
		baseEnv.isBugfoxBase = "true";
		let baseChildDir = this.baseProjectPath;
		for (const command of this.config.baseCommand) {
			if (command.split(" ")[0] === "cd") {
				baseChildDir = path.join(baseChildDir, command.split(" ")[1]);
				continue;
			}

			let baseProject = exec(command, {
				cwd: baseChildDir,
				env: baseEnv
			});

			baseProject.stdout.on('data', ((data) => {
				process.stdout.write(data);
				this.logger.append(data, "", "");
			}).bind(this));

			baseProject.stderr.on('data', ((data) => {
				process.stderr.write(data);
				this.logger.append(data, "", "");
			}).bind(this));

			await Promise.all([
				new Promise((resolve) => baseProject.on('close', resolve)),
			]);
		}

		this.logger.log("change process path to " + this.newProjectPath, "\nBugfox: ");
		process.chdir(this.newProjectPath);

		this.logger.log("***EXECUTING NEW PROJECT***");
		let newEnv = JSON.parse(JSON.stringify(process.env));
		newEnv.BugfoxConfig = JSON.stringify(this.config);
		newEnv.isBugfoxBase = "false";
		let newChildDir = this.newProjectPath;
		for (const command of this.config.newCommand) {
			if (command.split(" ")[0] === "cd") {
				newChildDir = path.join(newChildDir, command.split(" ")[1]);
				continue;
			}

			let newProject = exec(command, {
				cwd: newChildDir,
				env: newEnv
			});

			newProject.stdout.on('data', ((data) => {
				process.stdout.write(data);
				this.logger.append(data, "", "");
			}).bind(this));

			newProject.stderr.on('data', ((data) => {
				process.stderr.write(data);
				this.logger.append(data, "", "");
			}).bind(this));

			await Promise.all([
				new Promise((resolve) => newProject.on('close', resolve))
			]);
		}
		
		this.logger.logL("FINISH PROJECTS");
	}
}
module.exports.Launcher = Launcher;

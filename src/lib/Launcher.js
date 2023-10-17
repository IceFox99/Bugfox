"use strict";
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const fse = require('fs-extra');
const { removeEscapeCode, Logger } = require("./util");

class Launcher {
	constructor(config) {
		this.config = config;
		this.projectName = path.basename(this.config.sourceFolder);
		this.rootProjectPath = path.join(os.homedir(), this.config.generateFolder, "project");
		this.baseProjectPath = path.join(this.rootProjectPath, this.projectName + "_base");
		this.newProjectPath = path.join(this.rootProjectPath, this.projectName + "_new");
		this.runProjectPath = path.join(this.rootProjectPath, this.projectName + "_run");

		this.rootTracePath = path.join(os.homedir(), this.config.generateFolder, "trace");
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

		this.logger.log("copy base project to running enviroment");
		await fsp.rm(this.runProjectPath, { recursive: true, force: true });
		await fse.copy(this.baseProjectPath, this.runProjectPath);
		const cwd = process.cwd();

		this.logger.log("change process path to " + this.runProjectPath);
		process.chdir(this.runProjectPath);

		this.logger.log("***EXECUTING BASE PROJECT***");
		let baseEnv = JSON.parse(JSON.stringify(process.env));
		baseEnv.BugfoxConfig = JSON.stringify(this.config);
		baseEnv.isBugfoxBase = "true";
		let baseChildDir = this.runProjectPath;
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
				this.logger.append(removeEscapeCode(data), "", "");
			}).bind(this));

			baseProject.stderr.on('data', ((data) => {
				process.stderr.write(data);
				this.logger.append(removeEscapeCode(data), "", "");
			}).bind(this));

			await Promise.all([
				new Promise((resolve) => baseProject.on('close', resolve)),
			]);
		}

		this.logger.log("copy new project to running enviroment", "\n[Bugfox] ");
		await fsp.rm(this.runProjectPath, { recursive: true, force: true });
		await fse.copy(this.newProjectPath, this.runProjectPath);

		this.logger.log("change process path to " + this.runProjectPath);
		process.chdir(this.runProjectPath);

		this.logger.log("***EXECUTING NEW PROJECT***");
		let newEnv = JSON.parse(JSON.stringify(process.env));
		newEnv.BugfoxConfig = JSON.stringify(this.config);
		newEnv.isBugfoxBase = "false";
		let newChildDir = this.runProjectPath;
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
				this.logger.append(removeEscapeCode(data), "", "");
			}).bind(this));

			newProject.stderr.on('data', ((data) => {
				process.stderr.write(data);
				this.logger.append(removeEscapeCode(data), "", "");
			}).bind(this));

			await Promise.all([
				new Promise((resolve) => newProject.on('close', resolve))
			]);
		}
		
		process.chdir(cwd);
		await fsp.rm(this.runProjectPath, { recursive: true, force: true });
		this.logger.logL("FINISH PROJECTS");
	}
}
module.exports.Launcher = Launcher;

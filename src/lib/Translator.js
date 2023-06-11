"use strict";
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const fse = require('fs-extra');

const { builders } = require('ast-types');
const acorn = require('acorn');
const walk = require('estree-walker').walk;
const { generate } = require('astring');

class Translator {
    constructor(config) {
        this.config = config;
        this.projectName = path.basename(this.config.sourceFolder);
        this.rootProjectPath = path.join(this.config.generateFolder, "project");
        this.baseProjectPath = path.join(this.rootProjectPath, this.projectName + "_base");
        this.newProjectPath = path.join(this.rootProjectPath, this.projectName + "_new");
        this.rootTracePath = path.join(this.config.generateFolder, "trace");
        this.baseTracePath = path.join(this.rootTracePath, this.projectName + "_base");
        this.newTracePath = path.join(this.rootTracePath, this.projectName + "_new");
        this.traceDiffPath = path.join(this.rootTracePath, "diff");
    }

    async setUpProject() {
        console.log("----------Bugfox: start setting up project----------");
        await fsp.rm(this.config.generateFolder, { recursive: true, force: true });
        await fsp.mkdir(this.config.generateFolder, { recursive: true });

        // copy source code
        await fsp.mkdir(this.rootProjectPath, { recursive: true });
        await fsp.mkdir(this.baseTracePath, { recursive: true });
        await fsp.mkdir(this.newTracePath, { recursive: true });
        await fsp.mkdir(this.traceDiffPath, { recursive: true });

        await fse.copySync(this.config.sourceFolder, this.baseProjectPath);
        await fse.copySync(this.config.sourceFolder, this.newProjectPath);

        const currentDir = process.cwd();

        process.chdir(this.baseProjectPath);
        await execSync("git switch -d " + this.config.baseCommitID);
        process.chdir(this.newProjectPath);
        await execSync("git switch -d " + this.config.newCommitID);
        process.chdir(currentDir);
        console.log("----------Bugfox: end setting up project----------\n");
    }

    async transProject() {
        await this.setUpProject();

        // @TBD
    }
}
module.exports.Translator = Translator;

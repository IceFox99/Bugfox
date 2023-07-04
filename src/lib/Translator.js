"use strict";
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const fse = require('fs-extra');
const { addFuncPrefix, Logger, hash } = require('./util');

const acorn = require('acorn');
const { walk }= require('estree-walker');
const { generate } = require('astring');

class Translator {
	constructor(config) {
		this.config = config;
		this.tracerFilePath = path.join(__dirname, "Tracer.js");

		// add preset .git folder
		if (!this.config.baseIgnoreFolder.includes(".git"))
			this.config.baseIgnoreFolder.push(".git");
		if (!this.config.newIgnoreFolder.includes(".git"))
			this.config.newIgnoreFolder.push(".git");
		
		this.projectName = path.basename(this.config.sourceFolder);

		this.rootProjectPath = path.join(this.config.generateFolder, "project");
		this.baseProjectPath = path.join(this.rootProjectPath, this.projectName + "_base");
		this.newProjectPath = path.join(this.rootProjectPath, this.projectName + "_new");

		this.rootTracePath = path.join(this.config.generateFolder, "trace");
		this.baseTracePath = path.join(this.rootTracePath, this.projectName + "_base");
		this.newTracePath = path.join(this.rootTracePath, this.projectName + "_new");

		this.baseTraceFilePath = path.join(this.baseTracePath, this.projectName + "_base.json");
		this.baseTraceFuncPath = path.join(this.baseTracePath, this.projectName + "_base_func.json");
		this.newTraceFilePath = path.join(this.newTracePath, this.projectName + "_new.json");
		this.newTraceFuncPath = path.join(this.newTracePath, this.projectName + "_new_func.json");

		this.logPath = path.join(this.rootTracePath, "log");
		this.logger = new Logger(path.join(this.logPath, "Bugfox.log"));

		this.traceDiffPath = path.join(this.rootTracePath, "diff");

		// funcHash[fullFuncName] get the hash of function
		// node-types: FunctionDeclaration, MethodDefinition, PropertyDefinition, FunctionExpression, ArrowFunctionExpression
		this.baseFuncHash = {}; 
		this.newFuncHash = {};

		// temporary variables
		this.currentFuncPath = []; // [ Func@funcName.., Class@className.. ]
		this.insertedMethod = [];
	}

	async setUpProject() {
		let initialLog = "\n----------Bugfox: START SETTING UP PROJECTS----------\n\n";
		console.log("\n----------Bugfox: START SETTING UP PROJECTS----------\n");

		initialLog += ("Bugfox: clean folder " + this.config.generateFolder + "\n");
		console.log("Bugfox: clean folder " + this.config.generateFolder);
		await fsp.rm(this.config.generateFolder, { recursive: true, force: true });

		initialLog += ("Bugfox: create folder " + this.config.generateFolder + "\n");
		console.log("Bugfox: create folder " + this.config.generateFolder);
		await fsp.mkdir(this.config.generateFolder, { recursive: true });

		// copy source code
		initialLog += ("Bugfox: create folder " + this.rootProjectPath + "\n");
		console.log("Bugfox: create folder " + this.rootProjectPath);
		await fsp.mkdir(this.rootProjectPath, { recursive: true });

		initialLog += ("Bugfox: create folder " + this.baseTracePath + "\n");
		console.log("Bugfox: create folder " + this.baseTracePath);
		await fsp.mkdir(this.baseTracePath, { recursive: true });

		initialLog += ("Bugfox: create folder " + this.newTracePath + "\n");
		console.log("Bugfox: create folder " + this.newTracePath);
		await fsp.mkdir(this.newTracePath, { recursive: true });

		initialLog += ("Bugfox: create folder " + this.traceDiffPath + "\n");
		console.log("Bugfox: create folder " + this.traceDiffPath);
		await fsp.mkdir(this.traceDiffPath, { recursive: true });

		initialLog += ("Bugfox: create folder " + this.logPath + "\n");
		console.log("Bugfox: create folder " + this.logPath);
		fs.mkdirSync(this.logPath, { recursive: true });
		
		// After the initialization of directories, the logger could be used
		this.logger.append(initialLog);

		this.logger.log("copy folder " + this.config.sourceFolder + " to " + this.baseProjectPath);
		await fse.copy(this.config.sourceFolder, this.baseProjectPath);

		this.logger.log("copy folder " + this.config.sourceFolder + " to " + this.newProjectPath);
		await fse.copy(this.config.sourceFolder, this.newProjectPath);

		const currentDir = process.cwd();

		this.logger.log("", "");
		this.logger.log("change process path to " + this.baseProjectPath);
		process.chdir(this.baseProjectPath);

		this.logger.log("switch git commit to " + this.config.baseCommitID);
		execSync("git switch -d " + this.config.baseCommitID);

		this.logger.log("", "");
		this.logger.log("change process path to " + this.newProjectPath);
		process.chdir(this.newProjectPath);

		this.logger.log("switch git commit to " + this.config.newCommitID);
		execSync("git switch -d " + this.config.newCommitID);

		this.logger.log("", "");
		this.logger.log("change process path to " + currentDir);
		process.chdir(currentDir);
		this.logger.logL("END SETTING UP PROJECTS");
	}

	// @str: has to be an valid statement
	getSingleAST(str) {
		return acorn.parse(str, { ecmaVersion: "latest", sourceType: "module" }).body[0];
	}

	getRestElem() {
		return acorn.parse("(...args)=>{}", { ecmaVersion: "latest", sourceType: "module" }).body[0].expression.params[0];
	}

	isIgnored(filePath, isBase) {
		if (isBase) {
			const relativePath = path.relative(this.baseProjectPath, filePath);
			return this.config.baseIgnoreFolder.includes(relativePath);
		}
		else {
			const relativePath = path.relative(this.newProjectPath, filePath);
			return this.config.newIgnoreFolder.includes(relativePath);
		}
	}

	getFullFuncName(relativeFilePath) {
		return relativeFilePath + "#" + this.currentFuncPath.join('/');
	}

	// build the block statement after inserting the original function
	// @fullFuncName: src/add.js#add
	// @generatedFuncName: Bugfox_Original_add
	buildBlockStat(blockStat, fullFuncName, generatedFuncName) {
		// add the buildFuncStack statement
		blockStat.body.push(this.getSingleAST("let funcStack = _Tracer_.buildFuncStack(\'" + fullFuncName + "\');"));
		
		// add the setBeforeStats
		blockStat.body.push(this.getSingleAST("let tempThis = (((this === global) || (this === undefined) || (this === module.exports)) ? null : this);"));
		blockStat.body.push(this.getSingleAST("funcStack.setBeforeStats(global.BugfoxTracer.currentFuncStack.funcName, tempThis, args);"));

		// add the push and move
		blockStat.body.push(this.getSingleAST("global.BugfoxTracer.push(funcStack);"));
		blockStat.body.push(this.getSingleAST("global.BugfoxTracer.move(funcStack);"));

		// add the original function's call
		blockStat.body.push(this.getSingleAST("const result = " + generatedFuncName + ".bind(this)(...args);"));

		// add the setAfterStats
		blockStat.body.push(this.getSingleAST("tempThis = (((this === global) || (this === undefined) || (this === module.exports)) ? null : this);"));
		blockStat.body.push(this.getSingleAST("funcStack.setAfterStats(tempThis, args, result);"));

		// add the moveTop
		blockStat.body.push(this.getSingleAST("global.BugfoxTracer.moveTop();"));

		// add the return statement
		blockStat.body.push(acorn.parse("function f(result) { return result; }", { ecmaVersion: "latest", sourceType: "module" }).body[0].body.body[0]);
	}

	// store the function's hash values of that file
	traverseEnter(relativeFilePath, funcHash, node, parent, prop, index) {
		if (node.type === "FunctionDeclaration") { // normal function declaration
			this.currentFuncPath.push("Func@" + node.id.name);
			funcHash[this.getFullFuncName(relativeFilePath)] = hash(generate(node));
		}
		else if (node.type === "ClassDeclaration") {
			this.currentFuncPath.push("Class@" + node.id.name);
		}
		else if (node.type === "FunctionExpression") {
			if (node.id !== null) {
				this.currentFuncPath.push("Func@" + node.id.name);
				funcHash[this.getFullFuncName(relativeFilePath)] = hash(generate(node));
			}
			else if (parent.type === "VariableDeclarator") {
				this.currentFuncPath.push("FuncVar@" + parent.id.name);
				funcHash[this.getFullFuncName(relativeFilePath)] = hash(generate(node));
			}
			else if (parent.type === "AssignmentExpression") {
				this.currentFuncPath.push("FuncExpr@" + generate(parent.left));
				funcHash[this.getFullFuncName(relativeFilePath)] = hash(generate(node));
			}
		}
		else if (node.type === "ArrowFunctionExpression") {
			if (parent.type === "VariableDeclarator") {
				this.currentFuncPath.push("FuncVar@" + parent.id.name);
				funcHash[this.getFullFuncName(relativeFilePath)] = hash(generate(node));
			}
			else if (parent.type === "AssignmentExpression") {
				this.currentFuncPath.push("FuncExpr@" + generate(parent.left));
				funcHash[this.getFullFuncName(relativeFilePath)] = hash(generate(node));
			}
			// Ignore the property definition and assignment expression
		}
		else if (node.type === "MethodDefinition") {
			this.currentFuncPath.push("Method@" + node.key.name);
			funcHash[this.getFullFuncName(relativeFilePath)] = hash(generate(node));
		}
	}

	// @TBD
	// insert the Tracer statement and pop the index of function hash
	// Normally, 1) we change the input parameters to ...args, 2) add a inner function with a
	// prefixed name, 3) add bunch of Tracer statements
	traverseLeave(relativeFilePath, node, parent, prop, index) {
		if (node.type === "FunctionDeclaration") { // normal function declaration
			this.logger.log("translating " + this.getFullFuncName(relativeFilePath));
			let innerFunc = JSON.parse(JSON.stringify(node));
			
			innerFunc.id.name = addFuncPrefix(node.id.name);
			node.body = this.getSingleAST("{}");

			node.params = [ this.getRestElem() ];
			node.body.body.push(innerFunc);

			this.buildBlockStat(node.body, this.getFullFuncName(relativeFilePath), innerFunc.id.name);

			// pop the current scope
			this.currentFuncPath.pop();
		}
		else if (node.type === "ClassDeclaration") {
			for (const copyMeth of this.insertedMethod) {
				node.body.body.push(copyMeth);
			}
			this.insertedMethod = [];

			this.currentFuncPath.pop();
		}
		else if (node.type === "FunctionExpression") {
			if (node.id !== null) {
				this.logger.log("translating " + this.getFullFuncName(relativeFilePath));
				let innerFunc = JSON.parse(JSON.stringify(node));

				innerFunc.type = "FunctionDeclaration";
				innerFunc.id.name = addFuncPrefix(node.id.name);

				node.body = this.getSingleAST("{}");
				node.params = [ this.getRestElem() ];
				node.body.body.push(innerFunc);

				this.buildBlockStat(node.body, this.getFullFuncName(relativeFilePath), innerFunc.id.name);

				this.currentFuncPath.pop();
			}
			else if (parent.type === "VariableDeclarator") {
				this.logger.log("translating " + this.getFullFuncName(relativeFilePath));
				let innerFunc = JSON.parse(JSON.stringify(node));

				innerFunc.type = "FunctionDeclaration";
				innerFunc.id = JSON.parse(JSON.stringify(parent.id));
				innerFunc.id.name = addFuncPrefix(innerFunc.id.name);

				node.body = this.getSingleAST("{}");
				node.params = [ this.getRestElem() ];
				node.body.body.push(innerFunc);

				this.buildBlockStat(node.body, this.getFullFuncName(relativeFilePath), innerFunc.id.name);

				this.currentFuncPath.pop();
			}
			else if (parent.type === "AssignmentExpression") {
				this.logger.log("translating " + this.getFullFuncName(relativeFilePath));
				let innerFunc = JSON.parse(JSON.stringify(node));

				innerFunc.type = "FunctionDeclaration";
				innerFunc.id = this.getSingleAST("Bugfox_ANONYMOUS").expression;

				node.body = this.getSingleAST("{}");
				node.params = [ this.getRestElem() ];
				node.body.body.push(innerFunc);

				this.buildBlockStat(node.body, this.getFullFuncName(relativeFilePath), innerFunc.id.name);

				this.currentFuncPath.pop();
			}
		}
		else if (node.type === "ArrowFunctionExpression") {
			if (parent.type === "VariableDeclarator") {
				this.logger.log("translating " + this.getFullFuncName(relativeFilePath));

				let innerDecl = this.getSingleAST("const a = 0;");
				innerDecl.declarations[0].id.name = addFuncPrefix(parent.id.name);

				//innerDecl.declarations[0].init = parent.init;
				innerDecl.declarations[0].init = JSON.parse(JSON.stringify(node));
				parent.init.params = [ this.getRestElem() ];
				parent.init.body = this.getSingleAST("{}");

				parent.init.body.body.push(innerDecl);
				this.buildBlockStat(parent.init.body, this.getFullFuncName(relativeFilePath), innerDecl.declarations[0].id.name);

				this.currentFuncPath.pop();
			}
			else if (parent.type === "AssignmentExpression") {
				this.logger.log("translating " + this.getFullFuncName(relativeFilePath));

				let innerDecl = this.getSingleAST("const a = 0;");
				innerDecl.declarations[0].id.name = "Bugfox_ANONYMOUS";

				//innerDecl.declarations[0].init = parent.init;
				innerDecl.declarations[0].init = JSON.parse(JSON.stringify(node));
				parent.init.params = [ this.getRestElem() ];
				parent.init.body = this.getSingleAST("{}");

				parent.init.body.body.push(innerDecl);
				this.buildBlockStat(parent.init.body, this.getFullFuncName(relativeFilePath), innerDecl.declarations[0].id.name);

				this.currentFuncPath.pop();
			}
		}
		else if (node.type === "MethodDefinition") {
			this.logger.log("translating " + this.getFullFuncName(relativeFilePath));

			if (node.kind === "constructor") {
				//blockStat.body.push(this.getSingleAST("let funcStack = _Tracer_.buildFuncStack(\'" + fullFuncName + "\');"));
				let index = 0;
				node.value.body.body.splice(index++, 0, this.getSingleAST("let funcStack = _Tracer_.buildFuncStack(\'" + this.getFullFuncName(relativeFilePath) + "\');"));

				let args = "[";
				if (node.value.params.length !== 0) {
					args += generate(node.value.params[0]);
				}
				for (let i = 1; i < node.value.params.length; ++i) {
					args += ", ";
					args += generate(node.value.params[i]);
				}
				args += "]";
				
				// add the setBeforeStats
				node.value.body.body.splice(index++, 0, this.getSingleAST("funcStack.setBeforeStats(global.BugfoxTracer.currentFuncStack.funcName, null, " + args + ");"));

				// add the push and move
				node.value.body.body.splice(index++, 0, this.getSingleAST("global.BugfoxTracer.push(funcStack);"));
				node.value.body.body.splice(index++, 0, this.getSingleAST("global.BugfoxTracer.move(funcStack);"));

				// add the setAfterStats
				node.value.body.body.push(this.getSingleAST("let tempThis = (((this === global) || (this === undefined) || (this === module.exports)) ? null : this);"));
				node.value.body.body.push(this.getSingleAST("funcStack.setAfterStats(tempThis, " + args + ", null);"));

				// add the moveTop
				node.value.body.body.push(this.getSingleAST("global.BugfoxTracer.moveTop();"));
			}
			else if (node.kind === "method") {
				//let copyMeth = this.getSingleAST(generate(node));
				let copyMeth = JSON.parse(JSON.stringify(node));
				node.key.name = addFuncPrefix(node.key.name);
				
				copyMeth.value.body = this.getSingleAST("{}");
				copyMeth.value.params = [ this.getRestElem() ];
				
				this.buildBlockStat(copyMeth.value.body, this.getFullFuncName(relativeFilePath), "this." + node.key.name);
				
				this.insertedMethod.push(copyMeth);
			}

			this.currentFuncPath.pop();
		}
	}

	// add the require statment to import Tracer module at the top
	insertTracerPath(fileAST) {
		let tracerStr = "const { _Tracer_ } = require(\'" + this.tracerFilePath + "\');";
		let tracerAST = acorn.parse(tracerStr, { ecmaVersion: "latest", sourceType: "module" });
		fileAST.body.splice(0, 0, tracerAST.body[0]);
	}

	// @relativeFilePath: absolute file path
	// @funcHash: base/new FuncHash in this translator
	transAST(relativeFilePath, funcHash, fileAST) {
		this.insertTracerPath(fileAST);

		walk(fileAST, {
			enter: this.traverseEnter.bind(this, relativeFilePath, funcHash),
			leave: this.traverseLeave.bind(this, relativeFilePath)
		});
	}

	// @filePath: absolute file path
	async transFile(filePath, isBase) {
		let funcHash, relativeFilePath;
		if (isBase) {
			relativeFilePath = path.relative(this.baseProjectPath, filePath);
			funcHash = this.baseFuncHash;
		}
		else {
			relativeFilePath = path.relative(this.newProjectPath, filePath);
			funcHash = this.newFuncHash;
		}

		const file = await fsp.readFile(filePath, { encoding: 'utf8' });

		this.logger.log("FILE - [" + relativeFilePath + "]");
		let fileAST = acorn.parse(file, { ecmaVersion: "latest", sourceType: "module" });
		this.transAST(relativeFilePath, funcHash, fileAST);
		this.logger.log("", "");

		const newFile = generate(fileAST);
		await fsp.writeFile(filePath, newFile);
	}

	// translate directory recursively
	async transDir(dirPath, isBase) {
		const files = await fsp.readdir(dirPath);
		for (const item of files) {
			const itemPath = path.join(dirPath, item);
			if (!this.isIgnored(itemPath, isBase)) {
				const stat = await fsp.stat(itemPath);
				if (stat.isDirectory())
					await this.transDir(itemPath, isBase);
				else if (stat.isFile()) {
					const ext = path.extname(itemPath).toLowerCase();
					if (ext === '.js' || ext === '.mjs' || ext === '.cjs')
						await this.transFile(itemPath, isBase);
				}
			}
		}
	}

	async transProject() {
		await this.setUpProject();

		this.logger.logL("START TRANSLATING PROJECTS");

		// translate base project recursively
		this.logger.log("BASE PROJECT");
		this.logger.log("", "");
		await this.transDir(this.baseProjectPath, true);

		// translate new project recursively
		this.logger.log("NEW PROJECT");
		this.logger.log("", "");
		await this.transDir(this.newProjectPath, false);

		await fsp.writeFile(this.baseTraceFuncPath, JSON.stringify(this.baseFuncHash, null, 2));
		await fsp.writeFile(this.newTraceFuncPath, JSON.stringify(this.newFuncHash, null, 2));
		this.logger.logL("END TRANSLATING PROJECTS");
	}
}
module.exports.Translator = Translator;

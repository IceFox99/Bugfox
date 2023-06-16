"use strict";
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const fse = require('fs-extra');
const { addFuncPrefix, hash } = require('./util');

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
        this.newTraceFilePath = path.join(this.newTracePath, this.projectName + "_new.json");
        this.baseTraceFuncPath = path.join(this.baseTracePath, this.projectName + "_base_func.json");
        this.newTraceFuncPath = path.join(this.newTracePath, this.projectName + "_new_func.json");

        this.traceDiffPath = path.join(this.rootTracePath, "diff");

        // funcHash[relativeFilePath][funcName] get the hash of function
        // node-types: FunctionDeclaration, MethodDefinition, PropertyDefinition, FunctionExpression, ArrowFunctionExpression
        this.baseFuncHash = {}; 
        this.newFuncHash = {};

        // temporary variables
        this.currentFuncPath = []; // [ Func@funcName.., Class@className.. ]
		this.isSkipped = false;
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

        await fse.copy(this.config.sourceFolder, this.baseProjectPath);
        await fse.copy(this.config.sourceFolder, this.newProjectPath);

        const currentDir = process.cwd();

        process.chdir(this.baseProjectPath);
        execSync("git switch -d " + this.config.baseCommitID);
        process.chdir(this.newProjectPath);
        execSync("git switch -d " + this.config.newCommitID);
        process.chdir(currentDir);
        console.log("----------Bugfox: end setting up project----------\n");
    }

    // @str: has to be an valid statement
    getSingleAST(str) {
        return acorn.parse(str, { ecmaVersion: "latest" }).body[0];
    }

	getRestElem() {
		return acorn.parse("(...args)=>{}", { ecmaVersion: "latest" }).body[0].expression.params[0];
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

    isFuncExpr(node) {
        if (node === null || node === undefined)
            return false;
        return (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression");
    }

    // build the block statement after inserting the original function
    // @fullFuncName: src/add.js#add
    // @generatedFuncName: Bugfox_Original_add
    buildBlockStat(blockStat, fullFuncName, generatedFuncName) {
        // add the buildFuncStack statement
        blockStat.body.push(this.getSingleAST("let funcStack = _Tracer_.buildFuncStack(\'" + fullFuncName + "\');"));
        
        // add the setBeforeStats
        blockStat.body.push(this.getSingleAST("funcStack.setBeforeStats(global.BugfoxTracer.currentFuncStack.id, this, args);"));

        // add the push and move
        blockStat.body.push(this.getSingleAST("global.BugfoxTracer.push(funcStack);"));
        blockStat.body.push(this.getSingleAST("global.BugfoxTracer.move(funcStack);"));

        // add the original function's call
        blockStat.body.push(this.getSingleAST("const result = " + generatedFuncName + ".bind(this)(...args);"));

        // add the setAfterStats
        blockStat.body.push(this.getSingleAST("funcStack.setAfterStats(this, args, result);"));

        // add the moveTop
        blockStat.body.push(this.getSingleAST("global.BugfoxTracer.moveTop();"));

        // add the return statement
        blockStat.body.push(acorn.parse("function f(result) { return result; }", { ecmaVersion: "latest" }).body[0].body.body[0]);
    }

    // To be updated in future
    //enterTraverseExprArrPatt(relativeFilePath, fileFuncHash, exprNode, arrIndex) {
    //    let tempLeftNode = exprNode.left;
    //    let tempRightNode = exprNode.right;
    //    for (const i of arrIndex) {
    //        tempLeftNode = tempLeftNode.elements[i];
    //        tempRightNode = tempRightNode.elements[i];
    //    }
    //    // tempLeftNode and tempRightNode are ArrayPattern now
    //    for (let i = 0; i < tempLeftNode.elements.length; ++i) {
    //        if (tempRightNode.elements === undefined || tempRightNode.elements.length < i + 1)
    //            return; // weird code like [a,[b,c]] = [func1, funcArray];

    //        if (this.isFuncExpr(tempRightNode.elements[i])) {
    //            this.currentFuncPath.push("FuncVar@" + tempLeftNode.elements[i].name);
    //            fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(tempRightNode.elements[i]));
    //            this.currentFuncPath.pop();
    //        }
    //        else if (tempLeftNode.elements[i].type === "ArrayPattern") {
    //            arrIndex.push(i);
    //            this.enterTraverseExprArrPatt(relativeFilePath, fileFuncHash, exprNode, arrIndex);
    //            arrIndex.pop();
    //        }
    //    }
    //}

    // To be updated in future
    //enterTraverseDeclArrPatt(relativeFilePath, fileFuncHash, declNode, arrIndex) {
    //    let tempLeftNode = declNode.id;
    //    let tempRightNode = declNode.init;
    //    for (const i of arrIndex) {
    //        tempLeftNode = tempLeftNode.elements[i];
    //        tempRightNode = tempRightNode.elements[i];
    //    }
    //    // tempLeftNode and tempRightNode are ArrayPattern and ArrayExpression
    //    for (let i = 0; i < tempLeftNode.elements.length; ++i) {
    //        if (tempRightNode.elements === undefined || tempRightNode.elements.length < i + 1)
    //            return; // weird code like [a,[b,c]] = [func1, funcArray];

    //        if (this.isFuncExpr(tempRightNode.elements[i])) {
    //            this.currentFuncPath.push("FuncVar@" + tempLeftNode.elements[i].name);
    //            fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(tempRightNode.elements[i]));
    //            this.currentFuncPath.pop();
    //        }
    //        else if (tempLeftNode.elements[i].type === "ArrayPattern") {
    //            arrIndex.push(i);
    //            this.enterTraverseDeclArrPatt(relativeFilePath, fileFuncHash, exprNode, arrIndex);
    //            arrIndex.pop();
    //        }
    //    }
    //}

    // @TBD
    enterTraverseAssignExpr(relativeFilePath, fileFuncHash, exprNode) {
        if (exprNode.left.type === "Identifier") {
            if (this.isFuncExpr(exprNode.right)) {
                this.currentFuncPath.push("FuncVar@" + exprNode.left.name);
                fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(exprNode.right));
            }
        }
        else if (exprNode.left.type === "ArrayPattern") {
			this.isSkipped = true;
			// To be updated in future
            //for (let i = 0; i < exprNode.left.elements.length; ++i) {
            //    if (exprNode.right.elements === undefined || exprNode.right.elements.length < i + 1)
            //        return;

            //    if (this.isFuncExpr(exprNode.right.elements[i])) {
            //        this.currentFuncPath.push("FuncVar@" + exprNode.left.elements[i].name);
            //        fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(exprNode.right.elements[i]));
            //        this.currentFuncPath.pop();
            //    }
            //    else if (exprNode.left.elements[i].type === "ArrayPattern") {
            //        let arrIndex = [i];
            //        this.enterTraverseExprArrPatt(relativeFilePath, fileFuncHash, exprNode, arrIndex);
			//	}
            //}
        }
    }

    // @TBD
    enterTraverseVarDecl(relativeFilePath, fileFuncHash, declNode) {
        if (this.isFuncExpr(declNode.init)) {
            this.currentFuncPath.push("FuncVar@" + declNode.id.name);
            fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(declNode));
        }
        else if (declNode.id.type === "ArrayPattern") {
			this.isSkipped = true;
			// To be updated in future
            //for (let i = 0; i < declNode.id.elements.length; ++i) {
            //    if (declNode.init.elements === undefined || declNode.init.elements.length < i + 1)
            //        return;

            //    if (this.isFuncExpr(declNode.init.elements[i])) {
            //        this.currentFuncPath.push("FuncVar@" + declNode.id.elements[i].name);
            //        fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(declNode.init.elements[i]));
            //        this.currentFuncPath.pop();
            //    }
            //    else if (declNode.id.elements[i].type === "ArrayPattern") {
            //        let arrIndex = [i];
            //        this.enterTraverseDeclArrPatt(relativeFilePath, fileFuncHash, declNode, arrIndex);
            //    }
            //}
        }
    }

    // To be updated in future
    //leaveTraverseExprArrPatt(relativeFilePath, exprNode, arrIndex) {
    //    let tempLeftNode = exprNode.left;
    //    let tempRightNode = exprNode.right;
    //    for (const i of arrIndex) {
    //        tempLeftNode = tempLeftNode.elements[i];
    //        tempRightNode = tempRightNode.elements[i];
    //    }
    //    // tempLeftNode and tempRightNode are ArrayPattern now
    //    for (let i = 0; i < tempLeftNode.elements.length; ++i) {
    //        if (tempRightNode.elements === undefined || tempRightNode.elements.length < i + 1)
    //            return; // weird code like [a,[b,c]] = [func1, funcArray];

    //        if (this.isFuncExpr(tempRightNode.elements[i])) {
    //            //this.currentFuncPath.pop();
    //        }
    //        else if (tempLeftNode.elements[i].type === "ArrayPattern") {
    //            arrIndex.push(i);
    //            this.leaveTraverseExprArrPatt(relativeFilePath, exprNode, arrIndex);
    //            arrIndex.pop();
    //        }
    //    }
    //}

    // To be updated in future
    //leaveTraverseDeclArrPatt(relativeFilePath, declNode, arrIndex) {
    //    let tempLeftNode = declNode.id;
    //    let tempRightNode = declNode.init;
    //    for (const i of arrIndex) {
    //        tempLeftNode = tempLeftNode.elements[i];
    //        tempRightNode = tempRightNode.elements[i];
    //    }
    //    // tempLeftNode and tempRightNode are ArrayPattern and ArrayExpression
    //    for (let i = 0; i < tempLeftNode.elements.length; ++i) {
    //        if (tempRightNode.elements === undefined || tempRightNode.elements.length < i + 1)
    //            return; // weird code like [a,[b,c]] = [func1, funcArray];

    //        if (this.isFuncExpr(tempRightNode.elements[i])) {
    //            //this.currentFuncPath.pop();
    //        }
    //        else if (tempLeftNode.elements[i].type === "ArrayPattern") {
    //            arrIndex.push(i);
    //            this.leaveTraverseDeclArrPatt(relativeFilePath, exprNode, arrIndex);
    //            arrIndex.pop();
    //        }
    //    }
    //}

    // @TBD
    leaveTraverseAssignExpr(relativeFilePath, exprNode) {
        if (exprNode.left.type === "Identifier") {
            if (this.isFuncExpr(exprNode.right)) {
				let innerDecl = this.getSingleAST("const a = 0;");
				innerDecl.declarations[0].id.name = addFuncPrefix(exprNode.left.name);
				innerDecl.declarations[0].init = exprNode.right;
				if (exprNode.right.type === "ArrowFunctionExpression") {
					exprNode.right = acorn.parse("(...args)=>{}", { ecmaVersion: "latest" }).body[0].expression;
				}
				else if (exprNode.right.type === "FunctionExpression") {
					exprNode.right = acorn.parse("const func = function (...args) {};", { ecmaVersion: "latest" }).body[0].declarations[0].init;
				}
				exprNode.right.body.body.push(innerDecl);
				this.buildBlockStat(exprNode.right.body, this.getFullFuncName(relativeFilePath), innerDecl.declarations[0].id.name);
                this.currentFuncPath.pop();
            }
        }
        else if (exprNode.left.type === "ArrayPattern") {
			this.isSkipped = false;
			// To be updated in future
            //for (let i = 0; i < exprNode.left.elements.length; ++i) {
			//	// TBD
            //    if (exprNode.right.elements === undefined || exprNode.right.elements.length < i + 1)
            //        return;

            //    if (this.isFuncExpr(exprNode.right.elements[i])) {
            //        //this.currentFuncPath.pop();
            //    }
            //    else if (exprNode.left.elements[i].type === "ArrayPattern") {
            //        let arrIndex = [i];
            //        this.leaveTraverseExprArrPatt(relativeFilePath, exprNode, arrIndex);
            //    }
            //}
        }
    }

    // @TBD
    leaveTraverseVarDecl(relativeFilePath, declNode) {
        if (this.isFuncExpr(declNode.init)) {
			// translate this node
			let innerDecl = this.getSingleAST("const a = 0;");

			// add prefix to the function name
			innerDecl.declarations[0].id.name = addFuncPrefix(declNode.id.name);

			// move the function expression tree
			innerDecl.declarations[0].init = declNode.init;
			if (declNode.init.type === "ArrowFunctionExpression") {
				declNode.init = acorn.parse("(...args)=>{}", { ecmaVersion: "latest" }).body[0].expression;
			}
			else if (declNode.init.type === "FunctionExpression") {
				declNode.init = acorn.parse("const func = function (...args) {};", { ecmaVersion: "latest" }).body[0].declarations[0].init;
			}

			// push the prefixed function
			declNode.init.body.body.push(innerDecl);
			this.buildBlockStat(declNode.init.body, this.getFullFuncName(relativeFilePath), innerDecl.declarations[0].id.name);

			// TESTING
            this.currentFuncPath.pop();
        }
        else if (declNode.id.type === "ArrayPattern") {
			this.isSkipped = false;
			// To be updated in future
            //for (let i = 0; i < declNode.id.elements.length; ++i) {
            //    if (declNode.init.elements === undefined || declNode.init.elements.length < i + 1)
            //        return;

            //    if (this.isFuncExpr(declNode.init.elements[i])) {
            //        this.currentFuncPath.push("FuncVar@" + declNode.id.elements[i].name);
			//		
			//		// change the node

            //        this.currentFuncPath.pop();
            //    }
            //    else if (declNode.id.elements[i].type === "ArrayPattern") {
            //        let arrIndex = [i];
            //        this.leaveTraverseDeclArrPatt(relativeFilePath, declNode, arrIndex);
            //    }
            //}
        }
    }

    // store the function's hash values of that file
    traverseEnter(relativeFilePath, fileFuncHash, node, parent, prop, index) {
		if (this.isSkipped)
			return;

        if (node.type === "FunctionDeclaration") { // normal function declaration
            this.currentFuncPath.push("Func@" + node.id.name);
            fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(node));
        }
        else if (node.type === "MethodDefinition") {
            this.currentFuncPath.push("Func@" + node.key.name);
            fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(node));
        }
        else if (node.type === "PropertyDefinition" && this.isFuncExpr(node.value)) {
            this.currentFuncPath.push("FuncVar@" + node.key.name);
            fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(node));
        }
        else if (node.type === "ClassDeclaration") {
            this.currentFuncPath.push("Class@" + node.id.name);
        }
        else if (node.type === "VariableDeclarator") {
            this.enterTraverseVarDecl(relativeFilePath, fileFuncHash, node);
        }
		else if (node.type === "AssignmentExpression") {
			this.enterTraverseAssignExpr(relativeFilePath, fileFuncHash, node);
		}
    }

    // @TBD
    // insert the Tracer statement and pop the index of function hash
    // Normally, 1) we change the input parameters to ...args, 2) add a inner function with a
    // prefixed name, 3) add bunch of Tracer statements
    traverseLeave(relativeFilePath, node, parent, prop, index) {
        if (node.type === "FunctionDeclaration") { // normal function declaration
			let innerFunc = this.getSingleAST("function f() {}");
			
			// move the params and block nodes
			innerFunc.body = node.body;
			innerFunc.id.name = addFuncPrefix(node.id.name);
			node.body = this.getSingleAST("{}");
			innerFunc.params = node.params;
			node.params = [ this.getRestElem() ];
			node.body.body.push(innerFunc);

            this.buildBlockStat(node.body, this.getFullFuncName(relativeFilePath), innerFunc.id.name);

            // pop the current scope
            this.currentFuncPath.pop();
        }
        else if (node.type === "MethodDefinition") {
			let innerFunc = this.getSingleAST("function f() {}");
			
			innerFunc.body = node.value.body;
			innerFunc.id.name = addFuncPrefix(node.key.name);
			node.value.body = this.getSingleAST("{}");
			innerFunc.params = node.value.params;
			node.value.params = [ this.getRestElem() ];
			node.value.body.body.push(innerFunc);

            this.buildBlockStat(node.value.body, this.getFullFuncName(relativeFilePath), innerFunc.id.name);

            this.currentFuncPath.pop();
        }
        else if (node.type === "PropertyDefinition" && this.isFuncExpr(node.value)) {
			let innerDecl = this.getSingleAST("const a = 0;");
			innerDecl.declarations[0].id.name = addFuncPrefix(node.key.name);
			innerDecl.declarations[0].init = node.value;
			if (node.value.type === "ArrowFunctionExpression") {
				node.value = acorn.parse("(...args)=>{}", { ecmaVersion: "latest" }).body[0].expression;
			}
			else if (node.value.type === "FunctionExpression") {
				node.value = acorn.parse("const func = function (...args) {};", { ecmaVersion: "latest" }).body[0].declarations[0].init;
			}

			node.value.body.body.push(innerDecl);
			this.buildBlockStat(node.value.body, this.getFullFuncName(relativeFilePath), innerDecl.declarations[0].id.name);

            // pop the current scope
            this.currentFuncPath.pop();
        }
        else if (node.type === "ClassDeclaration") {
            this.currentFuncPath.pop();
        }
        else if (node.type === "VariableDeclarator") {
            this.leaveTraverseVarDecl(relativeFilePath, node);
        }
		else if (node.type === "AssignmentExpression") {
			this.leaveTraverseAssignExpr(relativeFilePath, node);
		}
    }

    // add the require statment to import Tracer module at the top
    insertTracerPath(fileAST) {
        let tracerStr = "const { _Tracer_ } = require(\'" + this.tracerFilePath + "\');";
        let tracerAST = acorn.parse(tracerStr, { ecmaVersion: "latest" });
        fileAST.body.splice(0, 0, tracerAST.body[0]);
    }

    // @relativeFilePath: absolute file path
    // @fileFuncHash: base/new FuncHash in this translator
    transAST(relativeFilePath, fileFuncHash, fileAST) {
        this.insertTracerPath(fileAST);

        walk(fileAST, {
            enter: this.traverseEnter.bind(this, relativeFilePath, fileFuncHash),
            leave: this.traverseLeave.bind(this, relativeFilePath)
        });
    }

    // @filePath: absolute file path
    async transFile(filePath, isBase) {
        let fileFuncHash, relativeFilePath;
        if (isBase) {
            relativeFilePath = path.relative(this.baseProjectPath, filePath);
            this.baseFuncHash[relativeFilePath] = {};
            fileFuncHash = this.baseFuncHash[relativeFilePath];
        }
        else {
            relativeFilePath = path.relative(this.newProjectPath, filePath);
            this.newFuncHash[relativeFilePath] = {};
            fileFuncHash = this.newFuncHash[relativeFilePath];
        }

        const file = await fsp.readFile(filePath, { encoding: 'utf8' });
        let fileAST = acorn.parse(file, { ecmaVersion: "latest", sourceType: "module" });

        this.transAST(relativeFilePath, fileFuncHash, fileAST);

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

        console.log("----------Bugfox: start translating project----------");
        // translate base project recursively
        await this.transDir(this.baseProjectPath, true);

        // translate new project recursively
        await this.transDir(this.newProjectPath, false);

        await fsp.writeFile(this.baseTraceFuncPath, JSON.stringify(this.baseFuncHash, null, 2));
        await fsp.writeFile(this.newTraceFuncPath, JSON.stringify(this.newFuncHash, null, 2));
        console.log("----------Bugfox: end translating project----------\n");
    }
}
module.exports.Translator = Translator;

"use strict";
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const fse = require('fs-extra');
const { hash } = require('./util');

const { builders } = require('ast-types');
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

    // @TBD
    //getCopyFuncAST(funcAST) {
    //    let copyFuncAST = {};
    //    if (funcAST.type === "VariableDeclaration") { // e.g. const a = (x) => { return x + x; };

    //    }
    //    else if (funcAST.type === "FunctionDeclaration") { // normal funtion
    //        
    //    }
    //    else if (funcAST.type === "MethodDefinition") { // method functions

    //    }
    //    else if (funcAST.type === "PropertyDefinition") { // method arrow functions

    //    }
    //    else
    //        throw new Error("Unknown function AST type!");

    //    return copyFuncAST;
    //}
    
    getSingleAST(str) {
        return acorn.parse(str, { ecmaVersion: "latest" }).body[0];
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

    // @NOT_SURE
    enterTraverseExprArrPatt(relativeFilePath, fileFuncHash, exprNode, arrIndex) {
        let tempLeftNode = exprNode.left;
        let tempRightNode = exprNode.right;
        for (const i of arrIndex) {
            tempLeftNode = tempLeftNode.elements[i];
            tempRightNode = tempRightNode.elements[i];
        }
        // tempLeftNode and tempRightNode are ArrayPattern now
        for (let i = 0; i < tempLeftNode.elements.length; ++i) {
            if (tempRightNode.elements === undefined || tempRightNode.elements.length < i + 1)
                return; // weird code like [a,[b,c]] = [func1, funcArray];

            if (this.isFuncExpr(tempRightNode.elements[i])) {
                this.currentFuncPath.push("FuncVar@" + tempLeftNode.elements[i].name);
                fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(tempRightNode.elements[i]));
                this.currentFuncPath.pop();
            }
            else if (tempLeftNode.elements[i].type === "ArrayPattern") {
                arrIndex.push(i);
                this.enterTraverseExprArrPatt(relativeFilePath, fileFuncHash, exprNode, arrIndex);
                arrIndex.pop();
            }
        }
    }

    // @NOT_SURE
    enterTraverseDeclArrPatt(relativeFilePath, fileFuncHash, declNode, arrIndex) {
        let tempLeftNode = declNode.id;
        let tempRightNode = declNode.init;
        for (const i of arrIndex) {
            tempLeftNode = tempLeftNode.elements[i];
            tempRightNode = tempRightNode.elements[i];
        }
        // tempLeftNode and tempRightNode are ArrayPattern and ArrayExpression
        for (let i = 0; i < tempLeftNode.elements.length; ++i) {
            if (tempRightNode.elements === undefined || tempRightNode.elements.length < i + 1)
                return; // weird code like [a,[b,c]] = [func1, funcArray];

            if (this.isFuncExpr(tempRightNode.elements[i])) {
                this.currentFuncPath.push("FuncVar@" + tempLeftNode.elements[i].name);
                fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(tempRightNode.elements[i]));
                this.currentFuncPath.pop();
            }
            else if (tempLeftNode.elements[i].type === "ArrayPattern") {
                arrIndex.push(i);
                this.enterTraverseDeclArrPatt(relativeFilePath, fileFuncHash, exprNode, arrIndex);
                arrIndex.pop();
            }
        }
    }

    // @NOT_SURE
    enterTraverseAssignExpr(relativeFilePath, fileFuncHash, exprNode) {
        if (exprNode.left.type === "Identifier") {
            if (this.isFuncExpr(exprNode.right)) {
                this.currentFuncPath.push("FuncVar@" + exprNode.left.name);
                fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(exprNode.right));
                this.currentFuncPath.pop();
            }
        }
        else if (exprNode.left.type === "ArrayPattern") {
            for (let i = 0; i < exprNode.left.elements.length; ++i) {
                if (exprNode.right.elements === undefined || exprNode.right.elements.length < i + 1)
                    return;

                if (this.isFuncExpr(exprNode.right.elements[i])) {
                    this.currentFuncPath.push("FuncVar@" + exprNode.left.elements[i].name);
                    fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(exprNode.right.elements[i]));
                    this.currentFuncPath.pop();
                }
                else if (exprNode.left.elements[i].type === "ArrayPattern") {
                    let arrIndex = [i];
                    this.enterTraverseExprArrPatt(relativeFilePath, fileFuncHash, exprNode, arrIndex);
                }
            }
        }
    }

    // @NOT_SURE
    enterTraverseVarDecl(relativeFilePath, fileFuncHash, declNode) {
        for (const declarator of declNode.declarations) {
            if (this.isFuncExpr(declarator.init)) {
                this.currentFuncPath.push("FuncVar@" + declarator.id.name);
                fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(declarator));
                this.currentFuncPath.pop();
            }
            else if (declarator.id.type === "ArrayPattern") {
                for (let i = 0; i < declarator.id.elements.length; ++i) {
                    if (declarator.init.elements === undefined || declarator.init.elements.length < i + 1)
                        return;

                    if (this.isFuncExpr(declarator.init.elements[i])) {
                        this.currentFuncPath.push("FuncVar@" + declarator.id.elements[i].name);
                        fileFuncHash[this.getFullFuncName(relativeFilePath)] = hash(generate(declarator.init.elements[i]));
                        this.currentFuncPath.pop();
                    }
                    else if (declarator.id.elements[i].type === "ArrayPattern") {
                        let arrIndex = [i];
                        this.enterTraverseDeclArrPatt(relativeFilePath, fileFuncHash, declarator, arrIndex);
                    }
                }
            }
        }
    }

    // @NOT_SURE
    leaveTraverseExprArrPatt(relativeFilePath, exprNode, arrIndex) {
        let tempLeftNode = exprNode.left;
        let tempRightNode = exprNode.right;
        for (const i of arrIndex) {
            tempLeftNode = tempLeftNode.elements[i];
            tempRightNode = tempRightNode.elements[i];
        }
        // tempLeftNode and tempRightNode are ArrayPattern now
        for (let i = 0; i < tempLeftNode.elements.length; ++i) {
            if (tempRightNode.elements === undefined || tempRightNode.elements.length < i + 1)
                return; // weird code like [a,[b,c]] = [func1, funcArray];

            if (this.isFuncExpr(tempRightNode.elements[i])) {
                //this.currentFuncPath.pop();
            }
            else if (tempLeftNode.elements[i].type === "ArrayPattern") {
                arrIndex.push(i);
                this.leaveTraverseExprArrPatt(relativeFilePath, exprNode, arrIndex);
                arrIndex.pop();
            }
        }
    }

    // @NOT_SURE
    leaveTraverseDeclArrPatt(relativeFilePath, declNode, arrIndex) {
        let tempLeftNode = declNode.id;
        let tempRightNode = declNode.init;
        for (const i of arrIndex) {
            tempLeftNode = tempLeftNode.elements[i];
            tempRightNode = tempRightNode.elements[i];
        }
        // tempLeftNode and tempRightNode are ArrayPattern and ArrayExpression
        for (let i = 0; i < tempLeftNode.elements.length; ++i) {
            if (tempRightNode.elements === undefined || tempRightNode.elements.length < i + 1)
                return; // weird code like [a,[b,c]] = [func1, funcArray];

            if (this.isFuncExpr(tempRightNode.elements[i])) {
                //this.currentFuncPath.pop();
            }
            else if (tempLeftNode.elements[i].type === "ArrayPattern") {
                arrIndex.push(i);
                this.leaveTraverseDeclArrPatt(relativeFilePath, exprNode, arrIndex);
                arrIndex.pop();
            }
        }
    }

    // @NOT_SURE
    leaveTraverseAssignExpr(relativeFilePath, exprNode) {
        if (exprNode.left.type === "Identifier") {
            if (this.isFuncExpr(exprNode.right)) {
                //this.currentFuncPath.pop();
            }
        }
        else if (exprNode.left.type === "ArrayPattern") {
            for (let i = 0; i < exprNode.left.elements.length; ++i) {
                if (exprNode.right.elements === undefined || exprNode.right.elements.length < i + 1)
                    return;

                if (this.isFuncExpr(exprNode.right.elements[i])) {
                    //this.currentFuncPath.pop();
                }
                else if (exprNode.left.elements[i].type === "ArrayPattern") {
                    let arrIndex = [i];
                    this.leaveTraverseExprArrPatt(relativeFilePath, exprNode, arrIndex);
                }
            }
        }
    }

    // @NOT_SURE
    leaveTraverseVarDecl(relativeFilePath, declNode) {
        for (const declarator of declNode.declarations) {
            if (this.isFuncExpr(declarator.init)) {
                //this.currentFuncPath.pop();
            }
            else if (declarator.id.type === "ArrayPattern") {
                for (let i = 0; i < declarator.id.elements.length; ++i) {
                    if (declarator.init.elements === undefined || declarator.init.elements.length < i + 1)
                        return;

                    if (this.isFuncExpr(declarator.init.elements[i])) {
                        //this.currentFuncPath.pop();
                    }
                    else if (declarator.id.elements[i].type === "ArrayPattern") {
                        let arrIndex = [i];
                        this.leaveTraverseDeclArrPatt(relativeFilePath, declarator, arrIndex);
                    }
                }
            }
        }
    }

    // store the function's hash values of that file
    traverseEnter(relativeFilePath, fileFuncHash, node, parent, prop, index) {
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
        else if (node.type === "VariableDeclaration") {
            this.enterTraverseVarDecl(relativeFilePath, fileFuncHash, node);
        }
        else if (node.type === "ExpressionStatement") {
            if (node.expression.type === "AssignmentExpression") {
                this.enterTraverseAssignExpr(relativeFilePath, fileFuncHash, node.expression);
            }
        }
    }

    // @TBD
    // insert the Tracer statement and pop the index of function hash
    traverseLeave(relativeFilePath, node, parent, prop, index) {
        if (node.type === "FunctionDeclaration") { // normal function declaration
            this.currentFuncPath.pop();
        }
        else if (node.type === "MethodDefinition") {
            this.currentFuncPath.pop();
        }
        else if (node.type === "PropertyDefinition" && this.isFuncExpr(node.value)) {
            this.currentFuncPath.pop();
        }
        else if (node.type === "ClassDeclaration") {
            this.currentFuncPath.pop();
        }
        else if (node.type === "VariableDeclaration") {
            this.leaveTraverseVarDecl(relativeFilePath, node);
        }
        else if (node.type === "ExpressionStatement") {
            if (node.expression.type === "AssignmentExpression") {
                this.leaveTraverseAssignExpr(relativeFilePath, node.expression);
            }
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

        // translate base project recursively
        await this.transDir(this.baseProjectPath, true);

        // translate new project recursively
        await this.transDir(this.newProjectPath, false);

        await fsp.writeFile(this.baseTraceFuncPath, JSON.stringify(this.baseFuncHash, null, 2));
        await fsp.writeFile(this.newTraceFuncPath, JSON.stringify(this.newFuncHash, null, 2));
    }
}
module.exports.Translator = Translator;

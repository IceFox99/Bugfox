"use strict";

const { FuncStack } = require('./FuncStack');
const { toJSON } = require('./util');
const fs = require('fs');
const path = require('path');

class Tracer {
    constructor(config, isBase) {
        this.config = config;
        this.baseFuncStack = new FuncStack("ENTRY_POINT"); 
        this.currentPath = ""; // relative path to the git root folder
        this.currentFuncStack = this.baseFuncStack; // type: FuncStack
        this.isBase = isBase;
    }

    getFuncStack(index) {
        let funcStack = this.baseFuncStack;
        for (let i = 0; i < index.length; i++) {
            funcStack = funcStack.callee[index[i]];
        }
        return funcStack;
    }

    static buildFuncStack(funcName) {
        return new FuncStack(funcName);
    }

    push(funcStack) {
        if (this.currentFuncStack == null)
            throw new Error("Tracer uninitialized!");

        this.currentFuncStack.pushCallee(funcStack); // pushCallee() will update id and index immediately
    }

    move(funcStack) { this.currentFuncStack = funcStack; }
    
    moveTop() { 
        if (this.currentFuncStack.index.length <= 0)
            throw new Error("Reach highest call stack, can't move top.");

        this.currentFuncStack = this.getFuncStack(this.currentFuncStack.index.slice(0, this.currentFuncStack.index.length - 1)); 
    }

    writeFuncStacks() {
        const callGraph = JSON.stringify(global.BugfoxTracer.baseFuncStack, null, 2);
        const projectName = path.basename(this.config.sourceFolder) + "_" + ((this.isBase) ? "base" : "new");
        const fsPath = path.join(this.config.generateFolder, "trace", projectName, projectName + ".json");
        fs.writeFileSync(fsPath, callGraph);
    }
}
module.exports._Tracer_ = Tracer;

if (global.BugfoxTracer == undefined) {
    global.BugfoxTracer = new Tracer(JSON.parse(process.env.BugfoxConfig), process.env.isBugfoxBase === 'true');
    process.on('exit', () => {
        global.BugfoxTracer.writeFuncStacks();
    });
}

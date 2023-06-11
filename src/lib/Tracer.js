"use strict";

const { FuncStack } = require('./FuncStack');
const { toJSON } = require('./util');
const fs = require('fs');

class Tracer {
    constructor(config) {
        this.config = config;
        this.baseFuncStack = new FuncStack("ENTRY_POINT"); 
        this.currentPath = ""; // relative path to the git root folder
        this.currentFuncStack = this.baseFuncStack; // type: FuncStack
    }

    //static async setUpProject(config) {
    //    await fsp.rm(config.generateFolder, { recursive: true, force: true });
    //    await fsp.mkdir(config.generateFolder, { recursive: true });
    //    // @TBD
    //}

    //run() {
    //    // @TBD
    //    //Tracer.genFolder(this.config);

    //    return [ this.baseFuncStack, this.newFuncStack ];
    //}

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

        //let topIndex = this.currentFuncStack.index.slice(0, this.currentFuncStack.index.length - 1);
        this.currentFuncStack = this.getFuncStack(this.currentFuncStack.index.slice(0, this.currentFuncStack.index.length - 1)); 
    }

    writeFuncStacks() {
        // @TBD
        const callGraph = JSON.stringify(global.BugfoxTracer.baseFuncStack, null, 2);
        fs.writeFileSync('/home/icefox99/Bugfox/src/test/test.json', callGraph);
    }
}
module.exports.Tracer = Tracer;

if (global.BugfoxTracer == undefined) {
    global.BugfoxTracer = new Tracer(JSON.parse(process.env.BugfoxConfig));
    process.on('exit', () => {
        global.BugfoxTracer.writeFuncStacks();
    });
}

"use strict";

const { checkConfig } = require('./util');
const { FuncStack } = require('./FuncStack');

class Tracer {
    constructor(config) {
        checkConfig(config);
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
            funcStack = funcStack.callee[i];
        }
        return funcStack;
    }

    push(funcStack) {
        if (this.currentFuncStack == null)
            throw new Error("Tracer uninitialized!");

        // For safety, might assigned before
        //funcStack.caller = this.currentFuncStack.id;

        // update index
        //let newIndex = this.currentFuncStack.index.slice();
        //newIndex.push(this.currentFuncStack.callee.length);
        //funcStack.index = newIndex;

        this.currentFuncStack.pushCallee(funcStack); // pushCallee() will update id and index immediately
    }

    move(funcStack) { this.currentFuncStack = funcStack; }
    
    moveTop() { 
        if (this.currentFuncStack.index.length <= 0)
            throw new Error("Reach highest call stack, can't move top.");

        let topIndex = this.currentFuncStack.index.slice(0, this.currentFuncStack.index.length - 1);
        this.currentFuncStack = this.getFuncStack(topIndex); 
    }
}
module.exports.Tracer = Tracer;

// Temporary code snippet, wont appear in real code
const config = require('../Bugfox-config.json');
process.env.BugfoxConfig = JSON.stringify(config);

if (global.BugfoxTracer == undefined)
    global.BugfoxTracer = new Tracer(JSON.parse(process.env.BugfoxConfig));

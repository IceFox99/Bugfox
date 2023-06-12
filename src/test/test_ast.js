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

(async () => {
    const source = await fsp.readFile("/home/icefox99/Bugfox/src/test/ast.js");
    let ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
    //let tracerPath = "/home/icefox99/Bugfox/src/lib/Tracer.js";
    //let insertStr = "const { _Tracer_ } = require(\'" + tracerPath + "\');";
    //let insert = acorn.parse(insertStr, { ecmaVersion: "latest" });
    //ast.body.splice(0, 0, insert.body[0]);
    //console.log(JSON.stringify(ast));
    walk(ast, {
        enter(node, parent, prop, index) {
            console.log("ENTERING:");
            console.log("node: " + JSON.stringify(node.type, null, 2));
            if (parent)
                console.log("parent: " + JSON.stringify(parent.type, null, 2));
            console.log("prop: " + JSON.stringify(prop, null, 2));
            console.log("index: " + JSON.stringify(index, null, 2));
            if (parent != undefined)
                console.log("access the parent: " + ((index === null) ? (parent[prop] == node) : (parent[prop][index] == node)));
            console.log("\n");
        },
        leave(node, parent, prop, index) {
            console.log("LEAVING:");
            console.log("node: " + JSON.stringify(node.type, null, 2));
            if (parent)
                console.log("parent: " + JSON.stringify(parent.type, null, 2));
            console.log("prop: " + JSON.stringify(prop, null, 2));
            console.log("index: " + JSON.stringify(index, null, 2));
            if (parent != undefined)
                console.log("access the parent: " + ((index === null) ? (parent[prop] == node) : (parent[prop][index] == node)));
            console.log("\n");
        }
    });
    console.log(generate(ast));
    await fsp.writeFile("/home/icefox99/Bugfox/src/test/ast.json", JSON.stringify(ast, null, 2));
})();

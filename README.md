# Bugfox

***This project is currently under active development and is not yet considered stable or production-ready.***

Bugfox is a lightweight and user-friendly tool for analyzing and identifying the causes of software regressions in JavaScript. It traces the information of most function calls, including arguments, "this" object, and return values. It then builds a complete function call graph for each program execution, allowing it to determine the true cause of a software regression.

## Table of Contents

- [Features](#Features)
- [Installation](#Installation)
- [Dependency](#Dependency)
- [Usage](#Usage)
- [Contributing](#Contributing)
- [Disclaimer](#Disclaimer)

## Features

Bugfox consists of three independent components: the translator, launcher, and comparator. Each component can be executed separately, giving you the flexibility to make custom changes throughout the different phases.

- Translator: translate your JS source code by traversing the its abstract syntax tree and inserting the tracer code under certain rules, so that all information of a function call will be recorded and constructed into a function stacks tree (known as **call graph**) at runtime.
- Launcher: launch your project with the given command in your configuration file, and write the recorded information to JSON files.
- Comparator: compare and analyze the generated call graphs of correct version and buggy version, find the most possible functions or changes that causes the software regression.

Besides, Bugfox is designed to be user-friendly, ***all you need is just a JSON file*** with the correct configurations. A simple example can be seen in the [Usage](#Usage) section below.

## Installation

```shell
$ git clone https://github.com/IceFox99/Bugfox.git
$ cd Bugfox
$ npm install
```

## Dependency

- [Git](https://git-scm.com)
- [Node.js](https://nodejs.org)
- [Diffutils](https://www.gnu.org/software/diffutils/)
- [acorn@8.8.2](https://github.com/acornjs/acorn)
- [ast-types@0.14.2](https://github.com/benjamn/ast-types)
- [astring@1.8.6](https://github.com/davidbonnet/astring)
- [estree-walker@2.0.2](https://github.com/Rich-Harris/estree-walker)
- [fs-extra@11.1.1](https://github.com/jprichardson/node-fs-extra)

## Usage

### TL;DR

Write your config JSON file (check this [example](experiments/Bugfox-example/Bugfox-config.json)) and change to `Bugfox` folder, and run

```shell
$ cd src
$ node Bugfox.js path/to/your/config.json
```

### Demo (recommended!!)

Suppose you have a project managed by git that encounters a software regression. Let's use a extremely simple project [Bugfox-example](https://github.com/IceFox99/Bugfox-example) as example and use our tool on it step-by-step. Please go through this demo by yourself and you will have a basic understanding of the tool's workflow.

First, clone that simple test project and test it:

```
$ git clone https://github.com/IceFox99/Bugfox-example.git
$ cd Bugfox-example && npm install
$ node_modules/.bin/_mocha test/math.js
```

After running the `mocha test/math.js`, you can see the unexpected fails in the test result. But it passes the same test before this commit, which means that we encountered a software regression in this commit. Then, you have to remember:

- path of this Bugfox-example
- git commit ID/tag/reference of the correct version (in this case, `5a78ba82c24b4d2d13d4a6e71e8fa37c1366171c` or simply `HEAD~`) and buggy version (in this case, `e25c4fd2b300fa58bc5775a2b5e735c9f0eb25b8` or simply `HEAD`)
- files or folders that you want to be avoided in translating phase (`node_modules`, unrelated js files, files which are uncompatible to the `acorn` parser, etc.)
- commands to run the test module

Below is the prewritten configuration JSON file, which can be found in `experiments/Bugfox-example/Bugfox-config.json`. 
Please modify the `sourceFolder` value to the path of your `Bugfox-example`, and change the `generateFolder` value to the location where all generated files, including translated source code and trace information, will be stored. 

#### Path format:
- `sourceFolder`: the location of your project (relative path to ***home directory***)
- `generateFolder`: the root location of all generated files (relative path to ***home directory***)
- `baseIgnoreFolder`: folders or files which you want to be ignored when translating codes of base commit (relative path to ***project path***)
- `newIgnoreFolder`: folders or files which you want to be ignored when translating codes of new commit (relative path to ***project path***)

<u>***Be aware that this tool will clean the `generateFolder` first if it exists, so please make sure you use a nonexistent or empty folder!!***</u>

```json
{
	"sourceFolder": "Bugfox-example",
	"generateFolder": "Bugfox-result",
	"baseIgnoreFolder": [
		"node_modules"
	],
	"newIgnoreFolder": [
		"node_modules"
	],
	"baseCommitID": "HEAD~",
	"newCommitID": "HEAD",
	"baseCommand": [
		"node_modules/.bin/_mocha test/math.js"
	],
	"newCommand": [
		"node_modules/.bin/_mocha test/math.js"
	]
}
```

Now go to the Bugfox folder and run:

```shell
$ cd path/to/your/Bugfox
$ cd src
$ node Bugfox.js ../experiments/Bugfox-example/Bugfox-config.json
```

Check the standard output and the `generateFolder` that you specify, the file structure inside that folder will looks like:

```
Bugfox-result
├── project
│   ├── Bugfox-example_base
│   │   └── ...
│   └── Bugfox-example_new
│       └── ...
└── trace
    ├── Bugfox-example_base
    │   ├── Bugfox-example_base.json
    │   └── Bugfox-example_base_func.json
    ├── Bugfox-example_new
    │   ├── Bugfox-example_new.json
    │   └── Bugfox-example_new_func.json
    ├── diff
    │   ├── candidates.json
    │   ├── diffs.json
    │   └── full.log
    └── log
        └── Bugfox.log
```

- `project/Bugfox-example_base`: translated source codes of the correct version.
- `project/Bugfox-example_new`: translated source codes of the buggy version.
- `trace/Bugfox-example_base` and `trace/Bugfox-example_new`: complete call graph and function hash values used for check if the function has been modified in this commit (both in JSON format).
- `trace/diff`: differences between these two version and complete analysis result.
- `trace/log`: complete log of the standard output in the shell

You will obtain analysis results like the following:

```
...
[TEST 3 & 3] test/math.js#AnonFunc@776f97cfcaea6562f8e95ead852030f68b97a39817fffd389320ba2cb5829f64/AnonFunc@af38b65e9268fde3f69a401cd4277b56e1b80e778e6fee38008d6b9679b48877,af38b65e9268fde3f69a401cd4277b56e1b80e778e6fee38008d6b9679b48877
~~~~~~~~~~~~~~~~~~~~FUNCTION: src/math.js#Func@add,650970d8fd9b25f9a90378c26fd3aba7dd3c73b098523469291be838880cd3e5~~~~~~~~~~~~~~~~~~~~
[CODE]
function add(a, b) {
  return a + b;
}

[DETAILS]
index: [3,0,0,0]
caller: src/math.js#FuncVar@sum,af0dce960751dd36473d6a4d5300193966952c7d7b3388254c19a78263bf8db1
isCodeChanged: false
isBeforeThisChanged: false
isBeforeArgsChanged: true
isAfterThisChanged: false
isAfterArgsChanged: true
isRetChanged: true

[ANALYSIS]
Probably caused by the different arguments, please check its CALLER "src/math.js#FuncVar@sum,af0dce960751dd36473d6a4d5300193966952c7d7b3388254c19a78263bf8db1" and the different arguments that passed to this function.

Possible reasons:
0) this function received unexpected arguments (highest probability)
1) the code is incompatible with its caller

Possible solutions:
0) check its caller and the different arguments
1) traverse its function body with received different arguments
2) refactor this function to make it compatible with its caller
3) check its callee's contents and whether the callee have been refactored

[COMPARISON]
BASE->beforeThis: null
NEW-->beforeThis: null
----------------------------------
BASE->beforeArgs: [0,1.5]
NEW-->beforeArgs: [1.5,1.5]
DIFF:
@@ -1,4 +1,4 @@
 [
-  0,
+  1.5,
   1.5
 ]
----------------------------------
BASE->afterThis: null
NEW-->afterThis: null
----------------------------------
BASE->afterArgs: [0,1.5]
NEW-->afterArgs: [1.5,1.5]
DIFF:
@@ -1,4 +1,4 @@
 [
-  0,
+  1.5,
   1.5
 ]
----------------------------------
BASE->returnVal: 1.5
NEW-->returnVal: 3
DIFF:
@@ -1 +1 @@
-1.5
+3
~~~~~~~~~~~~~~~~~~~~FUNCTION: src/math.js#Func@add,650970d8fd9b25f9a90378c26fd3aba7dd3c73b098523469291be838880cd3e5~~~~~~~~~~~~~~~~~~~~
...
```

So we follow its instruction and go check the function `sum` inside the `src/math.js`, and found out why function `add` receive unexpected arguments:

```javascript
...
const sum = (...args) => {
	let total = 0;
	for (let num of args)
		total = add(num, num); // should be add(total, num)
	return total;
};
...
```

Have fun!

**[Optional]**

You can check the translated source code to see how the tracer is inserted into the functions, or check the generated JSON file to see how the call graph is constructed, etc.

## Contributing

We greatly appreciate testing and feedback from the community to improve the functionality and reliability of this project. If you have tested this tool and encountered any issues or have suggestions for improvement, please let us know by contacting [huyuefeng99@gmail.com](mailto:huyuefeng99@gmail.com) or using *GitHub Issues*. We would also like to receive the generated trace files and the configuration files, including log files, function stack JSON files and configuration JSON files, as they can provide valuable insights into the tool's performance and effectiveness in addressing software regressions. (testing on open-source project is highly recommended, as we can reproduce the results)

However, please ensure that the generated files you share do not contain any sensitive data, such as private information or proprietary code. We prioritize user privacy and security, and we kindly request that you review the files before sharing to remove any sensitive content.

Additionally, we would love to hear your feedback on whether this tool helped you in solving software regressions. Your experiences and insights are invaluable in our ongoing efforts to enhance this project.

## Disclaimer

This project is currently open-sourced solely for testing and evaluation purposes. Redistribution or any form of commercial use without explicit permission is strictly prohibited. By accessing, using, or contributing to this project, you agree to comply with this disclaimer.

Please note that this project may contain experimental features, incomplete functionality, or potential security vulnerabilities. It is not intended for production use at this stage. 

Please be aware that there may be periods in the future where this software becomes temporarily unavailable. For example, it might be taken offline temporarily during blind reviews of associated research papers. We appreciate your understanding during such periods and apologize for any inconvenience caused.

Copyright of this project belongs to [Computing Software Group](https://github.com/csg-tokyo), The University of Tokyo. All rights reserved.

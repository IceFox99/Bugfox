# Bugfox Experiments

All ***regression bug cases*** used for experiments are extracted from [BugJS](https://github.com/BugsJS/bug-dataset) by [ISHIBE](https://csg-www.s3.ap-northeast-1.amazonaws.com/public/papers/23/master-ishibe.pdf).

## [eslint](https://github.com/eslint/eslint)

### Bug-10

- Result: ***Success***
- Regression commit: a21dd32c46f95bc232a67929c224824692f94b70
- Fixed functions: `lib/config.js#Class@Config/Method@constructor`, `lib/config/config-file.js#Func@loadObject`
- Reported functions from Bugfox: `lib/config.js#Class@Config/Method@constructor`

### Bug-134

- Result: ***Success***
- Regression commit: 5266793a563be0e4df97e4b6b5406fc2a0939550
- Fixed functions: `lib/rules/no-useless-escape.js#PropFunc@create/Func@check`
- Reported functions from Bugfox: `lib/rules/no-useless-escape.js#PropFunc@create`

### Bug-307

- Result: ***Success***
- Regression commit: 0f9727902fce753c87f45d439c521c93850d7dd8
- Fixed functions: `lib/rules/no-multi-spaces.js#PropFunc@create/PropFunc@Program`
- Reported functions from Bugfox: `lib/rules/no-multi-spaces.js#PropFunc@create/PropFunc@Program`

## [express](https://github.com/expressjs/express)

### Bug-1

- Result: ***Fail***
- Regression commit: f41d09a3cf0592b65a1359495b65d3d7cf949c50
- Fixed functions: `lib/router/index.js#FuncExpr@proto.handle/Func@next`
- Reporterd functions from Bugfox: 

### Bug-8

- Result: ***Success***
- Regression commit: cf41a8f25434bde16ee8606ce12bb699ef9de39e
- Fixed functions: `lib/application.js#FuncExpr@app.use`
- Reported functions from Bugfox: `lib/application.js#FuncExpr@app.use`

### Bug-9

- Result: ***Success***
- Regression commit: 997a558a73eb49d7f3b99ceec82c4c88bd3424a0 
- Fixed functions: `lib/application.js#FuncExpr@app.use`
- Reported functions from Bugfox: `lib/application.js#FuncExpr@app.use` (Not first deepest)

### Bug-13

- Result: ***Fail***
- Regression commit: 31b2e2d7b4774eed16a93f9a8a20a9967e91e524
- Fixed functions: `lib/router/index.js#FuncExpr@proto.process_params/Func@param`, `lib/router/index.js#FuncExpr@proto.process_params/Func@paramCallback`
- Reporterd functions from Bugfox: 

### Bug-16

- Result: ***Fail***
- Regression commit: c6e620302097838e37663e3cb23168b29f641ad0
- Fixed functions: `lib/response.js/FuncExpr@res.redirect`
- Reported functions from Bugfox:

### Bug-18

- Result: ***Success***
- Regression commit: fb2d9180569ae5bae5ba68aa79c95ed825af3899
- Fixed functions: `lib/router/index.js#FuncExpr@proto.process_params/Func@param`
- Reported functions from Bugfox: `lib/router/index.js#FuncExpr@proto.process_params` (Not first deepest)

### Bug-27

- Result: ***Success***
- Regression commit: 7f049164b7f253166b43b789475971d6dd8ec2c0
- Fixed functions: `lib/router/index.js#FuncExpr@proto.process_params/Func@param`, `lib/router/index.js#FuncExpr@proto.process_params/Func@param`, `lib/router/index.js#FuncExpr@proto.process_params/Func@paramCallback`
- Reported functions from Bugfox: `lib/router/index.js#FuncExpr@proto.process_params/Func@param` (Not first deepest)

## [hessian.js](https://github.com/node-modules/hessian.js/)

### Bug-2

- Result: ***Success***
- Regression commit: a46fbc943cc7baace06d01a395c050de0076c502
- Fixed functions: `lib/v1/decoder.js#FuncExpr@proto.readObject`
- Reported functions from Bugfox: `lib/v1/decoder.js#FuncExpr@proto.readObject`

### Bug-8

- Result: ***Success***
- Regression commit: 29f434e802623fa42b33e213dc71cb84232427b3
- Fixed functions: `lib/utils.js#FuncExpr@exports.handleLong`
- Reported functions from Bugfox: `lib/utils.js#FuncExpr@exports.handleLong`

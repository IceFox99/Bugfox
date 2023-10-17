/**
 * @fileoverview Look for useless escapes in strings and regexes
 * @author Onur Temizkan
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const rule = require("../../../lib/rules/no-useless-escape"),
    RuleTester = require("../../../lib/testers/rule-tester");

const ruleTester = new RuleTester();

ruleTester.run("no-useless-escape", rule, {
    valid:[
      {code: "var foo = String.raw`\\.`", parserOptions: {ecmaVersion: 6}},
      {code: "var foo = myFunc`\\.`", parserOptions: {ecmaVersion: 6}}
    ],
    invalid: []
});

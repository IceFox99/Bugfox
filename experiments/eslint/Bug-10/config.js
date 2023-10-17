/**
 * @fileoverview Tests for config object.
 * @author Seth McLaughlin
 */
/* eslint no-undefined: "off" */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("chai").assert,
    path = require("path"),
    fs = require("fs"),
    os = require("os"),
    Config = require("../../lib/config"),
    Linter = require("../../lib/linter"),
    environments = require("../../conf/environments"),
    sinon = require("sinon"),
    mockFs = require("mock-fs");

const DIRECTORY_CONFIG_HIERARCHY = require("../fixtures/config-hierarchy/file-structure.json");

const linter = new Linter();

require("shelljs/global");

const proxyquire = require("proxyquire").noCallThru().noPreserveCache();

/* global mkdir, rm, cp */


/**
 * Creates a stubbed Config object that will bypass normal require() to load
 * plugins by name from the objects specified.
 * @param {Object} plugins The keys are the package names, values are plugin objects.
 * @returns {Config} The stubbed instance of Config.
 * @private
 */
function createStubbedConfigWithPlugins(plugins) {

    // stub out plugins
    const StubbedPlugins = proxyquire("../../lib/config/plugins", plugins);

    // stub out config file to use stubbed plugins
    const StubbedConfigFile = proxyquire("../../lib/config/config-file", {
        "./plugins": StubbedPlugins
    });

    // stub out Config to use stub config file
    return proxyquire("../../lib/config", {
        "./config/config-file": StubbedConfigFile,
        "./config/plugins": StubbedPlugins
    });
}

/**
 * Asserts that two configs are equal. This is necessary because assert.deepEqual()
 * gets confused when properties are in different orders.
 * @param {Object} actual The config object to check.
 * @param {Object} expected What the config object should look like.
 * @returns {void}
 * @private
 */
function assertConfigsEqual(actual, expected) {
    if (actual.env && expected.env) {
        assert.deepEqual(actual.env, expected.env);
    }

    if (actual.parserOptions && expected.parserOptions) {
        assert.deepEqual(actual.parserOptions, expected.parserOptions);
    }

    if (actual.globals && expected.globals) {
        assert.deepEqual(actual.globals, expected.globals);
    }

    if (actual.rules && expected.rules) {
        assert.deepEqual(actual.rules, expected.rules);
    }

    if (actual.plugins && expected.plugins) {
        assert.deepEqual(actual.plugins, expected.plugins);
    }
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("Config", () => {

    let fixtureDir,
        sandbox;

    /**
     * Returns the path inside of the fixture directory.
     * @returns {string} The path inside the fixture directory.
     * @private
     */
    function getFixturePath() {
        const args = Array.prototype.slice.call(arguments);

        args.unshift("config-hierarchy");
        args.unshift(fixtureDir);
        return path.join.apply(path, args);
    }

    /**
     * Mocks the current CWD path
     * @param {string} fakeCWDPath - fake CWD path
     * @returns {void}
     * @private
     */
    function mockCWDResponse(fakeCWDPath) {
        sandbox.stub(process, "cwd")
            .returns(fakeCWDPath);
    }

    /**
     * Mocks the current user's home path
     * @param {string} fakeUserHomePath - fake user's home path
     * @returns {void}
     * @private
     */
    function mockOsHomedir(fakeUserHomePath) {
        sandbox.stub(os, "homedir")
            .returns(fakeUserHomePath);
    }

    // copy into clean area so as not to get "infected" by this project's .eslintrc files
    before(() => {
        fixtureDir = `${os.tmpdir()}/eslint/fixtures`;
        mkdir("-p", fixtureDir);
        cp("-r", "./tests/fixtures/config-hierarchy", fixtureDir);
    });

    beforeEach(() => {
        sandbox = sinon.sandbox.create();
    });

    afterEach(() => {
        sandbox.verifyAndRestore();
    });

    after(() => {
        rm("-r", fixtureDir);
    });

    describe("new Config()", () => {

        // https://github.com/eslint/eslint/issues/2380
        // it("should not modify baseConfig when format is specified", () => {
        //     const customBaseConfig = { foo: "bar" },
        //         configHelper = new Config({ baseConfig: customBaseConfig, format: "foo" }, linter);
        //
        //     // at one point, customBaseConfig.format would end up equal to "foo"...that's bad
        //     assert.deepEqual(customBaseConfig, { foo: "bar" });
        //     assert.equal(configHelper.options.format, "foo");
        // });

        it("should create config object when using baseConfig with extends", () => {
            const customBaseConfig = {
                extends: path.resolve(__dirname, "..", "fixtures", "config-extends", "array", ".eslintrc")
            };
            const configHelper = new Config({ baseConfig: customBaseConfig }, linter);

            assert.deepEqual(configHelper.baseConfig.env, {
                browser: false,
                es6: true,
                node: true
            });
            assert.deepEqual(configHelper.baseConfig.rules, {
                "no-empty": 1,
                "comma-dangle": 2,
                "no-console": 2
            });
        });
    });
});

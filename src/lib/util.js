"use strict";

const crypto = require("crypto");
const prune = require("../vendor/JSON.prune/JSON.prune");
const fs = require('fs');
const path = require('path');

const getFuncEntries = (value) => {
    const keys = Object.keys(value);
    const entries = {};
    keys.forEach((key) => {
        if (Object.getOwnPropertyDescriptor(value, key)?.get === undefined) {
            entries[key] = value[key];
        }
    });
    return entries;
};

const toJSON = (data) => {
    return prune(data, { replacer: function(value, defaultString, isCyclic, options) {
        if (!isCyclic && typeof value === 'function') {
            const entries = getFuncEntries(value);
            if (entries.length <= 0)
                return defaultString;
            else
                return `{"#Function":"${value.toString()}","#Attributes":${prune(entries, options)}}`;
        }
        else
            return JSON.stringify(value);
    }});
};
module.exports.toJSON = toJSON;

const hash = (input) => {
    if (input === undefined)
        return '-'.repeat(64);
    const _hash = crypto.createHash('sha256');
    _hash.update(input);
    return _hash.digest('hex');
};
module.exports.hash = hash;

const checkConfig = (config) => {
    if (!config.hasOwnProperty('sourceFolder'))
        throw new Error("Missing source folder path");
    if (!config.hasOwnProperty('generateFolder'))
        throw new Error("Missing generate folder path");

    if (!config.hasOwnProperty('baseIgnoreFolder'))
        throw new Error("Missing base ignore folder path");
    if (!config.hasOwnProperty('newIgnoreFolder'))
        throw new Error("Missing new Ignore folder path");

    if (!config.hasOwnProperty('baseCommitID'))
        throw new Error("Missing base commit ID");
    if (!config.hasOwnProperty('newCommitID'))
        throw new Error("Missing new commit ID");

    if (!config.hasOwnProperty('baseCommand'))
        throw new Error("Missing base command");
    if (!config.hasOwnProperty('newCommand'))
        throw new Error("Missing new command");

    if (!path.isAbsolute(config.sourceFolder) || !path.isAbsolute(config.generateFolder))
        throw new Error("Project folder must be absolute path.");
    if (!Array.isArray(config.baseIgnoreFolder) || !Array.isArray(config.newIgnoreFolder))
        throw new Error("Ignore folder must be an array");
    for (const bif of config.baseIgnoreFolder) {
        if (path.isAbsolute(bif))
            throw new Error("Base ignore folder must be relative path");
    }
    for (const nif of config.newIgnoreFolder) {
        if (path.isAbsolute(nif))
            throw new Error("New ignore folder must be relative path");
    }
}
module.exports.checkConfig = checkConfig;

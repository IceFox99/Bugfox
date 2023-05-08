"use strict";

const crypto = require("crypto");
const prune = require("../vendor/JSON.prune/JSON.prune");

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
                return `{"#Function":${prune(entries, options)}}`;
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

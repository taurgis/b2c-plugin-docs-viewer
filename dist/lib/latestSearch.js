"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeLatestSearch = storeLatestSearch;
exports.loadLatestSearch = loadLatestSearch;
const cache_1 = require("./cache");
const LATEST_SEARCH_KEY = "__latest__";
async function storeLatestSearch(query, results) {
    const cachePath = (0, cache_1.buildCachePath)("search", LATEST_SEARCH_KEY);
    await (0, cache_1.writeCache)(cachePath, { query, results });
}
async function loadLatestSearch() {
    const cachePath = (0, cache_1.buildCachePath)("search", LATEST_SEARCH_KEY);
    return (0, cache_1.readCache)(cachePath);
}

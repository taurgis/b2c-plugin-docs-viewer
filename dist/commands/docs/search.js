"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@oclif/core");
const helpSearch_1 = require("../../lib/helpSearch");
class DocsSearch extends core_1.Command {
    async run() {
        const { args, flags } = await this.parse(DocsSearch);
        const results = await (0, helpSearch_1.searchHelp)({
            query: args.query,
            language: flags.language,
            limit: flags.limit,
            includeNonHelp: flags.includeNonHelp,
            timeoutMs: flags.timeout,
            useCache: flags.cache,
            headed: flags.headed,
            debug: flags.debug,
        });
        if (flags.json) {
            this.log(JSON.stringify({ query: args.query, count: results.length, results }, null, 2));
            return;
        }
        const lines = results.map((item, index) => {
            if (item.title) {
                return `${index + 1}. ${item.title} - ${item.url}`;
            }
            return `${index + 1}. ${item.url}`;
        });
        this.log(lines.join("\n"));
    }
}
DocsSearch.description = "Search Salesforce Help for matching articles.";
DocsSearch.examples = [
    "b2c docs search \"b2c commerce roles\" --limit 5",
    "b2c docs search \"order management\" --language en_US",
];
DocsSearch.args = {
    query: core_1.Args.string({
        description: "Search query",
        required: true,
    }),
};
DocsSearch.flags = {
    limit: core_1.Flags.integer({
        description: "Maximum number of results (max 100)",
        default: 10,
    }),
    language: core_1.Flags.string({
        description: "Help language (default en_US)",
        default: "en_US",
    }),
    json: core_1.Flags.boolean({
        description: "Output JSON",
        default: false,
    }),
    includeNonHelp: core_1.Flags.boolean({
        description: "Include results outside help.salesforce.com",
        default: false,
    }),
    cache: core_1.Flags.boolean({
        description: "Use cached results when available",
        default: true,
        allowNo: true,
    }),
    timeout: core_1.Flags.integer({
        description: "Navigation timeout in ms",
        default: 45000,
    }),
    headed: core_1.Flags.boolean({
        description: "Run browser in headed mode",
        default: false,
    }),
    debug: core_1.Flags.boolean({
        description: "Enable debug logging",
        default: false,
    }),
};
exports.default = DocsSearch;

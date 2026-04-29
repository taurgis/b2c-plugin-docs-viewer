"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@oclif/core");
const api_1 = require("../../api");
const apiErrors_1 = require("../../apiErrors");
const errorUtils_1 = require("../../lib/errorUtils");
const searchTable_1 = require("../../lib/searchTable");
const commandFlags_1 = require("../../lib/commandFlags");
class DocsSearchHelpSite extends core_1.Command {
    async run() {
        const { args, flags } = await this.parse(DocsSearchHelpSite);
        const showStatus = !flags.json;
        try {
            if (showStatus) {
                this.log(`-> Searching Help for "${args.query}"...`);
            }
            const result = await (0, api_1.searchHelpDocs)({
                query: args.query,
                language: flags.language,
                limit: flags.limit,
                timeoutMs: flags.timeout,
                cache: flags.cache,
                headed: flags.headed,
                debug: flags.debug,
            });
            if (showStatus) {
                this.log(`-> Found ${result.count} result${result.count === 1 ? "" : "s"}.`);
            }
            if (flags.json) {
                this.log(JSON.stringify(result, null, 2));
                return;
            }
            if (result.results.length === 0) {
                this.log("No results found.");
                return;
            }
            this.log((0, searchTable_1.renderSearchResultsTable)(result.results));
        }
        catch (error) {
            this.error((0, errorUtils_1.getErrorMessage)(error), {
                code: (0, apiErrors_1.getHelpDocsErrorCode)(error),
            });
        }
    }
}
DocsSearchHelpSite.description = "Search Salesforce Help for matching Help and Developer docs pages.";
DocsSearchHelpSite.longDescription = "Queries the Salesforce Help search service and returns a boxed table of results. " +
    "Use --json for machine-readable output and --no-cache to force a fresh request.";
DocsSearchHelpSite.examples = [
    "b2c docs search-help-site \"b2c commerce roles\" --limit 5",
    "b2c docs search-help-site \"order management\" --language en_US",
    "b2c docs search-help-site \"pipelines\" --json",
    "b2c docs search-help-site \"pipelines\" --no-cache",
];
DocsSearchHelpSite.args = {
    query: core_1.Args.string({
        description: "Search query",
        required: true,
    }),
};
DocsSearchHelpSite.flags = {
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
    cache: (0, commandFlags_1.cacheFlag)(),
    timeout: (0, commandFlags_1.timeoutFlag)(),
    headed: (0, commandFlags_1.headedFlag)(),
    debug: (0, commandFlags_1.debugFlag)(),
};
exports.default = DocsSearchHelpSite;

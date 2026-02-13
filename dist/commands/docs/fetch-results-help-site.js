"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const core_1 = require("@oclif/core");
const helpSearch_1 = require("../../lib/helpSearch");
const helpScraper_1 = require("../../lib/helpScraper");
class DocsFetchResultsHelpSite extends core_1.Command {
    async run() {
        const { args, flags } = await this.parse(DocsFetchResultsHelpSite);
        const showStatus = !flags.json;
        if (showStatus) {
            this.log(`-> Searching Help for "${args.query}"...`);
        }
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
        if (showStatus) {
            this.log(`-> Found ${results.length} result${results.length === 1 ? "" : "s"}.`);
        }
        const detailed = [];
        for (const [index, item] of results.entries()) {
            if (showStatus) {
                this.log(`-> Fetching article ${index + 1}/${results.length}...`);
            }
            const detail = await (0, helpScraper_1.getHelpDetails)({
                url: item.url,
                timeoutMs: flags.timeout,
                waitMs: flags.wait,
                headed: flags.headed,
                useCache: flags.cache,
            });
            detailed.push({
                url: item.url,
                title: detail.title || item.title,
                markdown: detail.markdown,
            });
        }
        if (flags.json) {
            const output = JSON.stringify({
                query: args.query,
                count: detailed.length,
                results: detailed,
            }, null, 2) + "\n";
            if (flags.out) {
                await promises_1.default.mkdir(path_1.default.dirname(flags.out), { recursive: true });
                await promises_1.default.writeFile(flags.out, output, "utf8");
                this.log(`Saved JSON to ${flags.out}`);
                return;
            }
            this.log(output.trimEnd());
            return;
        }
        const blocks = detailed.map((item, index) => {
            const heading = item.title ? `${index + 1}. ${item.title}` : `${index + 1}. ${item.url}`;
            return `${heading}\n${item.url}\n\n${item.markdown}`.trim();
        });
        const output = blocks.join("\n\n-----\n\n");
        if (flags.out) {
            await promises_1.default.mkdir(path_1.default.dirname(flags.out), { recursive: true });
            await promises_1.default.writeFile(flags.out, output + "\n", "utf8");
            this.log(`Saved output to ${flags.out}`);
            return;
        }
        this.log(output);
    }
}
DocsFetchResultsHelpSite.description = "Search Salesforce Help and immediately fetch details.";
DocsFetchResultsHelpSite.longDescription = "Runs a search and then fetches each matching Help article. " +
    "Use --out to save results to a file and --json for structured output.";
DocsFetchResultsHelpSite.examples = [
    "b2c docs fetch-results-help-site \"b2c commerce roles\" --limit 3",
    "b2c docs fetch-results-help-site \"pipelines\" --json",
    "b2c docs fetch-results-help-site \"pipelines\" --out ./artifacts/help.md",
];
DocsFetchResultsHelpSite.args = {
    query: core_1.Args.string({
        description: "Search query",
        required: true,
    }),
};
DocsFetchResultsHelpSite.flags = {
    limit: core_1.Flags.integer({
        description: "Maximum number of results (max 100)",
        default: 5,
    }),
    language: core_1.Flags.string({
        description: "Help language (default en_US)",
        default: "en_US",
    }),
    json: core_1.Flags.boolean({
        description: "Output JSON",
        default: false,
    }),
    out: core_1.Flags.string({
        char: "o",
        description: "Write output to a file",
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
    wait: core_1.Flags.integer({
        description: "Wait time after load in ms",
        default: 2500,
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
exports.default = DocsFetchResultsHelpSite;

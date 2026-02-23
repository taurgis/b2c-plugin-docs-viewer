"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@oclif/core");
const helpSearch_1 = require("../../lib/helpSearch");
const helpScraper_1 = require("../../lib/helpScraper");
const urlPolicy_1 = require("../../lib/urlPolicy");
const errorUtils_1 = require("../../lib/errorUtils");
const fileOutput_1 = require("../../lib/fileOutput");
function buildFailureSection(failures) {
    if (failures.length === 0)
        return "";
    return [
        "",
        "-----",
        "",
        "## Failed URLs",
        ...failures.map((failure, index) => {
            const heading = `${index + 1}. ${failure.title || failure.url}`;
            return `${heading}\n${failure.url}\n${failure.error}`;
        }),
    ].join("\n\n");
}
async function mapWithConcurrency(items, concurrency, mapper) {
    const output = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            output[index] = await mapper(items[index], index);
        }
    });
    await Promise.all(workers);
    return output;
}
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
            timeoutMs: flags.timeout,
            useCache: flags.cache,
            headed: flags.headed,
            debug: flags.debug,
        });
        if (showStatus) {
            this.log(`-> Found ${results.length} result${results.length === 1 ? "" : "s"}.`);
        }
        const concurrency = Math.max(1, Math.min(flags.concurrency, 6));
        if (showStatus) {
            this.log(`-> Fetching ${results.length} article(s) with concurrency ${concurrency}...`);
        }
        const settled = await mapWithConcurrency(results, concurrency, async (item, index) => {
            if (showStatus) {
                this.log(`-> Fetching article ${index + 1}/${results.length}...`);
            }
            try {
                const validatedUrl = (0, urlPolicy_1.normalizeAndValidateDocUrl)(item.url);
                const detail = await (0, helpScraper_1.getHelpDetails)({
                    url: validatedUrl,
                    timeoutMs: flags.timeout,
                    waitMs: flags.wait,
                    headed: flags.headed,
                    useCache: flags.cache,
                    debug: flags.debug,
                });
                return {
                    ok: true,
                    item: {
                        url: validatedUrl,
                        title: detail.title || item.title,
                        markdown: detail.markdown,
                    },
                };
            }
            catch (error) {
                return {
                    ok: false,
                    item: {
                        url: item.url,
                        title: item.title,
                        error: (0, errorUtils_1.getErrorMessage)(error),
                    },
                };
            }
        });
        const detailed = [];
        const failures = [];
        for (const entry of settled) {
            if (entry.ok) {
                detailed.push(entry.item);
            }
            else {
                failures.push(entry.item);
            }
        }
        if (showStatus) {
            this.log(`-> Completed: ${detailed.length} succeeded, ${failures.length} failed.`);
        }
        if (flags.json) {
            const output = JSON.stringify({
                query: args.query,
                count: detailed.length,
                results: detailed,
                errors: failures,
            }, null, 2) + "\n";
            if (flags.out) {
                await (0, fileOutput_1.writeTextFile)(flags.out, output);
                this.log(`Saved JSON to ${flags.out}`);
            }
            else {
                this.log(output.trimEnd());
            }
            if (detailed.length === 0) {
                this.error("Failed to fetch all articles.", { code: "ALL_FETCHES_FAILED" });
            }
            return;
        }
        const blocks = detailed.map((item, index) => {
            const heading = item.title ? `${index + 1}. ${item.title}` : `${index + 1}. ${item.url}`;
            return `${heading}\n${item.url}\n\n${item.markdown}`.trim();
        });
        const output = blocks.join("\n\n-----\n\n");
        const failureSection = buildFailureSection(failures);
        const fullOutput = `${output}${failureSection}`;
        if (flags.out) {
            await (0, fileOutput_1.writeTextFile)(flags.out, fullOutput + "\n");
            this.log(`Saved output to ${flags.out}`);
            if (failures.length > 0) {
                this.warn(`Completed with ${failures.length} failed article fetch(es).`);
            }
        }
        else {
            this.log(fullOutput);
            if (failures.length > 0) {
                this.warn(`Completed with ${failures.length} failed article fetch(es).`);
            }
        }
        if (detailed.length === 0) {
            this.error("Failed to fetch all articles.", { code: "ALL_FETCHES_FAILED" });
        }
    }
}
DocsFetchResultsHelpSite.description = "Search Salesforce Help and fetch Help/Developer docs details.";
DocsFetchResultsHelpSite.longDescription = "Runs a search and then fetches each matching Help or Developer docs page. " +
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
    concurrency: core_1.Flags.integer({
        description: "Parallel article fetch workers",
        default: 2,
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

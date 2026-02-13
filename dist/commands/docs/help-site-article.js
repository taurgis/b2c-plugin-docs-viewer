"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const core_1 = require("@oclif/core");
const helpScraper_1 = require("../../lib/helpScraper");
const latestSearch_1 = require("../../lib/latestSearch");
class DocsHelpSiteArticle extends core_1.Command {
    async run() {
        const { args, flags } = await this.parse(DocsHelpSiteArticle);
        const showStatus = !flags.json;
        const rawReference = args.reference.trim();
        let targetUrl = rawReference;
        const idMatch = rawReference.match(/^#?(\d+)$/);
        if (idMatch) {
            const latest = await (0, latestSearch_1.loadLatestSearch)();
            if (!latest || latest.results.length === 0) {
                this.error("No recent search results found. Run 'b2c docs search-help-site <query>' first.");
            }
            const index = Number(idMatch[1]);
            if (!Number.isFinite(index) || index < 1 || index > latest.results.length) {
                this.error(`Result ID ${idMatch[1]} is out of range (1-${latest.results.length}).`);
            }
            const selected = latest.results[index - 1];
            targetUrl = selected.url;
            if (showStatus) {
                const label = selected.title ? ` ${selected.title}` : "";
                this.log(`-> Using result #${index}:${label}`.trimEnd());
            }
        }
        if (showStatus) {
            this.log("-> Fetching documentation page...");
        }
        if (flags.rawHtml && !flags.json && !flags.out) {
            this.error("--raw-html requires --json or --out to avoid flooding terminal output.");
        }
        const result = await (0, helpScraper_1.getHelpDetails)({
            url: targetUrl,
            timeoutMs: flags.timeout,
            waitMs: flags.wait,
            headed: flags.headed,
            useCache: flags.cache,
            includeRawHtml: flags.rawHtml,
        });
        if (flags.json) {
            const output = JSON.stringify(result, null, 2) + "\n";
            if (flags.out) {
                await promises_1.default.mkdir(path_1.default.dirname(flags.out), { recursive: true });
                await promises_1.default.writeFile(flags.out, output, "utf8");
                this.log(`Saved JSON to ${flags.out}`);
                return;
            }
            this.log(output.trimEnd());
            return;
        }
        if (flags.out) {
            await promises_1.default.mkdir(path_1.default.dirname(flags.out), { recursive: true });
            await promises_1.default.writeFile(flags.out, result.markdown + "\n", "utf8");
            this.log(`Saved markdown to ${flags.out}`);
            if (flags.rawHtml) {
                const htmlOut = `${flags.out}.raw.html`;
                await promises_1.default.writeFile(htmlOut, (result.rawHtml || "") + "\n", "utf8");
                this.log(`Saved raw HTML to ${htmlOut}`);
            }
            return;
        }
        this.log(result.markdown);
    }
}
DocsHelpSiteArticle.description = "Fetch a Salesforce Help or Developer doc page and return the details.";
DocsHelpSiteArticle.longDescription = "Accepts a full Help/Developer docs URL or a numeric ID from the latest search results. " +
    "Run 'b2c docs search-help-site <query>' first if you want to use the ID shortcut.";
DocsHelpSiteArticle.examples = [
    "b2c docs help-site-article \"https://help.salesforce.com/s/articleView?id=cc.b2c_roles_and_permissions.htm&type=5\"",
    "b2c docs help-site-article 2",
    "b2c docs help-site-article #3 --json",
    "b2c docs help-site-article 2 --json --raw-html",
    "b2c docs help-site-article 2 --out ./artifacts/article.md --raw-html",
];
DocsHelpSiteArticle.args = {
    reference: core_1.Args.string({
        description: "Help/Developer docs URL or result ID from the latest search",
        required: true,
    }),
};
DocsHelpSiteArticle.flags = {
    json: core_1.Flags.boolean({
        description: "Output JSON",
        default: false,
    }),
    rawHtml: core_1.Flags.boolean({
        description: "Include raw extracted HTML in output (JSON or sidecar file)",
        default: false,
    }),
    out: core_1.Flags.string({
        char: "o",
        description: "Write output to a file",
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
};
exports.default = DocsHelpSiteArticle;

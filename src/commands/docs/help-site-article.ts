import fs from "fs/promises";
import path from "path";
import { Args, Command, Flags } from "@oclif/core";
import { getHelpDetails } from "../../lib/helpScraper";
import { loadLatestSearch } from "../../lib/latestSearch";

export default class DocsHelpSiteArticle extends Command {
  static description = "Fetch a Salesforce Help or Developer doc page and return the details.";

  static longDescription =
    "Accepts a full Help/Developer docs URL or a numeric ID from the latest search results. " +
    "Run 'b2c docs search-help-site <query>' first if you want to use the ID shortcut.";

  static examples = [
    "b2c docs help-site-article \"https://help.salesforce.com/s/articleView?id=cc.b2c_roles_and_permissions.htm&type=5\"",
    "b2c docs help-site-article 2",
    "b2c docs help-site-article #3 --json",
    "b2c docs help-site-article 2 --json --raw-html",
    "b2c docs help-site-article 2 --out ./artifacts/article.md --raw-html",
  ];

  static args = {
    reference: Args.string({
      description: "Help/Developer docs URL or result ID from the latest search",
      required: true,
    }),
  };

  static flags = {
    json: Flags.boolean({
      description: "Output JSON",
      default: false,
    }),
    rawHtml: Flags.boolean({
      description: "Include raw extracted HTML in output (JSON or sidecar file)",
      default: false,
    }),
    out: Flags.string({
      char: "o",
      description: "Write output to a file",
    }),
    cache: Flags.boolean({
      description: "Use cached results when available",
      default: true,
      allowNo: true,
    }),
    timeout: Flags.integer({
      description: "Navigation timeout in ms",
      default: 45_000,
    }),
    wait: Flags.integer({
      description: "Wait time after load in ms",
      default: 2500,
    }),
    headed: Flags.boolean({
      description: "Run browser in headed mode",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DocsHelpSiteArticle);
    const showStatus = !flags.json;
    const rawReference = args.reference.trim();
    let targetUrl = rawReference;

    const idMatch = rawReference.match(/^#?(\d+)$/);
    if (idMatch) {
      const latest = await loadLatestSearch();
      if (!latest || latest.results.length === 0) {
        this.error(
          "No recent search results found. Run 'b2c docs search-help-site <query>' first."
        );
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

    const result = await getHelpDetails({
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
        await fs.mkdir(path.dirname(flags.out), { recursive: true });
        await fs.writeFile(flags.out, output, "utf8");
        this.log(`Saved JSON to ${flags.out}`);
        return;
      }
      this.log(output.trimEnd());
      return;
    }

    if (flags.out) {
      await fs.mkdir(path.dirname(flags.out), { recursive: true });
      await fs.writeFile(flags.out, result.markdown + "\n", "utf8");
      this.log(`Saved markdown to ${flags.out}`);

      if (flags.rawHtml) {
        const htmlOut = `${flags.out}.raw.html`;
        await fs.writeFile(htmlOut, (result.rawHtml || "") + "\n", "utf8");
        this.log(`Saved raw HTML to ${htmlOut}`);
      }

      return;
    }

    this.log(result.markdown);
  }
}

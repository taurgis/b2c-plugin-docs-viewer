import fs from "fs/promises";
import path from "path";
import { Args, Command, Flags } from "@oclif/core";
import { searchHelp } from "../../lib/helpSearch";
import { getHelpDetails } from "../../lib/helpScraper";

export default class DocsFetchResultsHelpSite extends Command {
  static description = "Search Salesforce Help and fetch Help/Developer docs details.";

  static longDescription =
    "Runs a search and then fetches each matching Help or Developer docs page. " +
    "Use --out to save results to a file and --json for structured output.";

  static examples = [
    "b2c docs fetch-results-help-site \"b2c commerce roles\" --limit 3",
    "b2c docs fetch-results-help-site \"pipelines\" --json",
    "b2c docs fetch-results-help-site \"pipelines\" --out ./artifacts/help.md",
  ];

  static args = {
    query: Args.string({
      description: "Search query",
      required: true,
    }),
  };

  static flags = {
    limit: Flags.integer({
      description: "Maximum number of results (max 100)",
      default: 5,
    }),
    language: Flags.string({
      description: "Help language (default en_US)",
      default: "en_US",
    }),
    json: Flags.boolean({
      description: "Output JSON",
      default: false,
    }),
    out: Flags.string({
      char: "o",
      description: "Write output to a file",
    }),
    includeNonHelp: Flags.boolean({
      description: "Include results outside help.salesforce.com and developer.salesforce.com",
      default: false,
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
    debug: Flags.boolean({
      description: "Enable debug logging",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DocsFetchResultsHelpSite);
    const showStatus = !flags.json;

    if (showStatus) {
      this.log(`-> Searching Help for "${args.query}"...`);
    }

    const results = await searchHelp({
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

    const detailed = [] as Array<{ url: string; title: string | null; markdown: string }>;

    for (const [index, item] of results.entries()) {
      if (showStatus) {
        this.log(`-> Fetching article ${index + 1}/${results.length}...`);
      }
      const detail = await getHelpDetails({
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
      const output = JSON.stringify(
        {
          query: args.query,
          count: detailed.length,
          results: detailed,
        },
        null,
        2
      ) + "\n";

      if (flags.out) {
        await fs.mkdir(path.dirname(flags.out), { recursive: true });
        await fs.writeFile(flags.out, output, "utf8");
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
      await fs.mkdir(path.dirname(flags.out), { recursive: true });
      await fs.writeFile(flags.out, output + "\n", "utf8");
      this.log(`Saved output to ${flags.out}`);
      return;
    }

    this.log(output);
  }
}

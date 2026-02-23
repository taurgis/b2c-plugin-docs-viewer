import { Args, Command, Flags } from "@oclif/core";
import { searchHelp } from "../../lib/helpSearch";
import { renderSearchResultsTable } from "../../lib/searchTable";

export default class DocsSearchHelpSite extends Command {
  static description = "Search Salesforce Help for matching Help and Developer docs pages.";

  static longDescription =
    "Queries the Salesforce Help search service and returns a boxed table of results. " +
    "Use --json for machine-readable output and --no-cache to force a fresh request.";

  static examples = [
    "b2c docs search-help-site \"b2c commerce roles\" --limit 5",
    "b2c docs search-help-site \"order management\" --language en_US",
    "b2c docs search-help-site \"pipelines\" --json",
    "b2c docs search-help-site \"pipelines\" --no-cache",
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
      default: 10,
    }),
    language: Flags.string({
      description: "Help language (default en_US)",
      default: "en_US",
    }),
    json: Flags.boolean({
      description: "Output JSON",
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
    const { args, flags } = await this.parse(DocsSearchHelpSite);
    const showStatus = !flags.json;

    if (showStatus) {
      this.log(`-> Searching Help for "${args.query}"...`);
    }

    const results = await searchHelp({
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

    if (flags.json) {
      this.log(JSON.stringify({ query: args.query, count: results.length, results }, null, 2));
      return;
    }
    this.log(renderSearchResultsTable(results));
  }
}

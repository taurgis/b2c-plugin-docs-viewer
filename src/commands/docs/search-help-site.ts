import { Args, Command, Flags } from "@oclif/core";
import { searchHelpDocs } from "../../api";
import { getHelpDocsErrorCode } from "../../apiErrors";
import { getErrorMessage } from "../../lib/errorUtils";
import { renderSearchResultsTable } from "../../lib/searchTable";
import {
  cacheFlag,
  debugFlag,
  headedFlag,
  timeoutFlag,
} from "../../lib/commandFlags";

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
    cache: cacheFlag(),
    timeout: timeoutFlag(),
    headed: headedFlag(),
    debug: debugFlag(),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DocsSearchHelpSite);
    const showStatus = !flags.json;

    try {
      if (showStatus) {
        this.log(`-> Searching Help for "${args.query}"...`);
      }

      const result = await searchHelpDocs({
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

      this.log(renderSearchResultsTable(result.results));
    } catch (error) {
      this.error(getErrorMessage(error), {
        code: getHelpDocsErrorCode(error),
      });
    }
  }
}

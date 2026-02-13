import { Args, Command, Flags } from "@oclif/core";
import { searchHelp } from "../../lib/helpSearch";

export default class DocsSearchHelpSite extends Command {
  static description = "Search Salesforce Help for matching articles.";

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
    includeNonHelp: Flags.boolean({
      description: "Include results outside help.salesforce.com",
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
      includeNonHelp: flags.includeNonHelp,
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

    const padRight = (value: string, width: number) => value.padEnd(width, " ");
    const wrap = (value: string, width: number) => {
      if (width <= 0) return [value];
      const parts: string[] = [];
      for (let i = 0; i < value.length; i += width) {
        parts.push(value.slice(i, i + width));
      }
      return parts.length ? parts : [""];
    };

    const rows = results.map((item, index) => ({
      number: String(index + 1).padStart(2, "0"),
      title: item.title || "(untitled)",
      url: item.url,
    }));

    const maxTitleWidth = Math.min(
      60,
      Math.max("Title".length, ...rows.map((row) => row.title.length))
    );
    const maxUrlWidth = Math.min(80, Math.max("URL".length, 65));
    const numberWidth = Math.max("#".length, ...rows.map((row) => row.number.length));

    const border =
      "+" +
      "-".repeat(numberWidth + 2) +
      "+" +
      "-".repeat(maxTitleWidth + 2) +
      "+" +
      "-".repeat(maxUrlWidth + 2) +
      "+";

    const header =
      `| ${padRight("#", numberWidth)} ` +
      `| ${padRight("Title", maxTitleWidth)} ` +
      `| ${padRight("URL", maxUrlWidth)} |`;

    const body = rows.flatMap((row, rowIndex) => {
      const titleLine = padRight(row.title.slice(0, maxTitleWidth), maxTitleWidth);
      const urlLines = wrap(row.url, maxUrlWidth).map((line) => padRight(line, maxUrlWidth));
      const lineCount = Math.max(1, urlLines.length);
      const output: string[] = [];

      for (let i = 0; i < lineCount; i += 1) {
        const numberCell = i === 0 ? padRight(row.number, numberWidth) : padRight("", numberWidth);
        const titleCell = i === 0 ? titleLine : padRight("", maxTitleWidth);
        const urlCell = urlLines[i] || padRight("", maxUrlWidth);
        output.push(`| ${numberCell} | ${titleCell} | ${urlCell} |`);
      }

      if (rowIndex < rows.length - 1) {
        output.push(border);
      }

      return output;
    });

    const output = [border, header, border, ...body, border].join("\n");
    this.log(output);
  }
}

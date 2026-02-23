import { Args, Command, Flags } from "@oclif/core";
import { searchHelp } from "../../lib/helpSearch";
import { getHelpDetails } from "../../lib/helpScraper";
import { normalizeAndValidateDocUrl } from "../../lib/urlPolicy";
import { getErrorMessage } from "../../lib/errorUtils";
import { writeTextFile } from "../../lib/fileOutput";
import {
  cacheFlag,
  debugFlag,
  headedFlag,
  timeoutFlag,
  waitFlag,
} from "../../lib/commandFlags";

type DetailedResult = {
  url: string;
  title: string | null;
  markdown: string;
};

type FetchFailure = {
  url: string;
  title: string | null;
  error: string;
};

function buildFailureSection(failures: FetchFailure[]): string {
  if (failures.length === 0) return "";
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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const output = new Array<R>(items.length);
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
    concurrency: Flags.integer({
      description: "Parallel article fetch workers",
      default: 2,
    }),
    cache: cacheFlag(),
    timeout: timeoutFlag(),
    wait: waitFlag(),
    headed: headedFlag(),
    debug: debugFlag(),
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
      timeoutMs: flags.timeout,
      useCache: flags.cache,
      headed: flags.headed,
      debug: flags.debug,
    });

    if (showStatus) {
      this.log(`-> Found ${results.length} result${results.length === 1 ? "" : "s"}.`);
    }

    if (results.length === 0) {
      if (flags.json) {
        const output = JSON.stringify(
          {
            query: args.query,
            count: 0,
            results: [],
            errors: [],
          },
          null,
          2
        ) + "\n";

        if (flags.out) {
          await writeTextFile(flags.out, output);
          this.log(`Saved JSON to ${flags.out}`);
        } else {
          this.log(output.trimEnd());
        }
      } else if (flags.out) {
        await writeTextFile(flags.out, "No results found.\n");
        this.log(`Saved output to ${flags.out}`);
      } else {
        this.log("No results found.");
      }

      return;
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
        const validatedUrl = normalizeAndValidateDocUrl(item.url);
        const detail = await getHelpDetails({
          url: validatedUrl,
          timeoutMs: flags.timeout,
          waitMs: flags.wait,
          headed: flags.headed,
          useCache: flags.cache,
          debug: flags.debug,
        });

        return {
          ok: true as const,
          item: {
            url: validatedUrl,
            title: detail.title || item.title,
            markdown: detail.markdown,
          },
        };
      } catch (error) {
        return {
          ok: false as const,
          item: {
            url: item.url,
            title: item.title,
            error: getErrorMessage(error),
          },
        };
      }
    });

    const detailed: DetailedResult[] = [];
    const failures: FetchFailure[] = [];
    for (const entry of settled) {
      if (entry.ok) {
        detailed.push(entry.item);
      } else {
        failures.push(entry.item);
      }
    }

    if (showStatus) {
      this.log(
        `-> Completed: ${detailed.length} succeeded, ${failures.length} failed.`
      );
    }

    if (flags.json) {
      const output = JSON.stringify(
        {
          query: args.query,
          count: detailed.length,
          results: detailed,
          errors: failures,
        },
        null,
        2
      ) + "\n";

      if (flags.out) {
        await writeTextFile(flags.out, output);
        this.log(`Saved JSON to ${flags.out}`);
      } else {
        this.log(output.trimEnd());
      }

      if (results.length > 0 && detailed.length === 0) {
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
      await writeTextFile(flags.out, fullOutput + "\n");
      this.log(`Saved output to ${flags.out}`);
      if (failures.length > 0) {
        this.warn(`Completed with ${failures.length} failed article fetch(es).`);
      }
    } else {
      this.log(fullOutput);
      if (failures.length > 0) {
        this.warn(`Completed with ${failures.length} failed article fetch(es).`);
      }
    }

    if (results.length > 0 && detailed.length === 0) {
      this.error("Failed to fetch all articles.", { code: "ALL_FETCHES_FAILED" });
    }
  }
}

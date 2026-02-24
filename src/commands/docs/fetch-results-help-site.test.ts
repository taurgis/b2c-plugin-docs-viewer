import { beforeEach, describe, expect, it, vi } from "vitest";
import DocsFetchResultsHelpSite from "./fetch-results-help-site";
import { searchHelp } from "../../lib/helpSearch";
import { createScraperSession, getHelpDetails } from "../../lib/helpScraper";
import { normalizeAndValidateDocUrl } from "../../lib/urlPolicy";

vi.mock("../../lib/helpSearch", () => ({
  searchHelp: vi.fn(),
}));

vi.mock("../../lib/helpScraper", () => ({
  createScraperSession: vi.fn(),
  getHelpDetails: vi.fn(),
}));

vi.mock("../../lib/urlPolicy", () => ({
  normalizeAndValidateDocUrl: vi.fn(),
}));

type RunContext = {
  parse: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function createContext(parseResult: unknown): RunContext {
  return {
    parse: vi.fn().mockResolvedValue(parseResult),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn((message: string) => {
      throw new Error(message);
    }),
  };
}

describe("docs fetch-results-help-site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(normalizeAndValidateDocUrl).mockImplementation((value: string) => value);
    vi.mocked(createScraperSession).mockResolvedValue({
      context: {} as never,
      close: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("reports partial failures and keeps successful markdown output", async () => {
    vi.mocked(searchHelp).mockResolvedValue([
      { title: "Doc A", url: "https://help.salesforce.com/s/articleView?id=a&type=5" },
      { title: "Doc B", url: "https://developer.salesforce.com/docs/commerce/example" },
    ]);

    vi.mocked(getHelpDetails)
      .mockResolvedValueOnce({
        url: "https://help.salesforce.com/s/articleView?id=a&type=5",
        title: "Doc A",
        markdown: "# Doc A\ncontent",
      })
      .mockRejectedValueOnce(new Error("fetch failed"));

    const ctx = createContext({
      args: { query: "roles" },
      flags: {
        limit: 2,
        language: "en_US",
        json: false,
        out: undefined,
        concurrency: 2,
        cache: true,
        timeout: 45000,
        wait: 2500,
        headed: false,
        debug: false,
      },
    });

    await DocsFetchResultsHelpSite.prototype.run.call(ctx as never);

    const combinedLogs = ctx.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(combinedLogs).toContain("# Doc A");
    expect(combinedLogs).toContain("## Failed URLs");
    expect(combinedLogs).toContain("fetch failed");
    expect(ctx.warn).toHaveBeenCalledWith("Completed with 1 failed article fetch(es).");
  });

  it("emits JSON failure details then exits non-zero when all fetches fail", async () => {
    vi.mocked(searchHelp).mockResolvedValue([
      { title: "Doc A", url: "https://help.salesforce.com/s/articleView?id=a&type=5" },
    ]);

    vi.mocked(getHelpDetails).mockRejectedValue(new Error("network down"));

    const ctx = createContext({
      args: { query: "roles" },
      flags: {
        limit: 1,
        language: "en_US",
        json: true,
        out: undefined,
        concurrency: 1,
        cache: false,
        timeout: 45000,
        wait: 2500,
        headed: false,
        debug: false,
      },
    });

    await expect(DocsFetchResultsHelpSite.prototype.run.call(ctx as never)).rejects.toThrow(
      /Failed to fetch all articles/
    );

    const lastLog = String(ctx.log.mock.calls[ctx.log.mock.calls.length - 1][0]);
    const parsed = JSON.parse(lastLog) as {
      count: number;
      errors: Array<{ error: string }>;
    };
    expect(parsed.count).toBe(0);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].error).toContain("network down");
  });

  it("returns JSON with count 0 when search has no hits", async () => {
    vi.mocked(searchHelp).mockResolvedValue([]);

    const ctx = createContext({
      args: { query: "nope" },
      flags: {
        limit: 3,
        language: "en_US",
        json: true,
        out: undefined,
        concurrency: 2,
        cache: true,
        timeout: 45000,
        wait: 2500,
        headed: false,
        debug: false,
      },
    });

    await DocsFetchResultsHelpSite.prototype.run.call(ctx as never);

    expect(getHelpDetails).not.toHaveBeenCalled();
    const output = String(ctx.log.mock.calls[0][0]);
    const parsed = JSON.parse(output) as {
      query: string;
      count: number;
      results: unknown[];
      errors: unknown[];
    };

    expect(parsed.query).toBe("nope");
    expect(parsed.count).toBe(0);
    expect(parsed.results).toHaveLength(0);
    expect(parsed.errors).toHaveLength(0);
  });

  it("prints a friendly message when search has no hits in non-JSON mode", async () => {
    vi.mocked(searchHelp).mockResolvedValue([]);

    const ctx = createContext({
      args: { query: "nope" },
      flags: {
        limit: 3,
        language: "en_US",
        json: false,
        out: undefined,
        concurrency: 2,
        cache: true,
        timeout: 45000,
        wait: 2500,
        headed: false,
        debug: false,
      },
    });

    await DocsFetchResultsHelpSite.prototype.run.call(ctx as never);

    expect(getHelpDetails).not.toHaveBeenCalled();
    const lastLog = String(ctx.log.mock.calls[ctx.log.mock.calls.length - 1][0]);
    expect(lastLog).toBe("No results found.");
  });
});

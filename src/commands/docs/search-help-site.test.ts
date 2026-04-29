import { beforeEach, describe, expect, it, vi } from "vitest";
import DocsSearchHelpSite from "./search-help-site";
import { searchHelpDocs } from "../../api";

vi.mock("../../api", () => ({
  searchHelpDocs: vi.fn(),
}));

type RunContext = {
  parse: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
};

function createContext(parseResult: unknown): RunContext {
  return {
    parse: vi.fn().mockResolvedValue(parseResult),
    log: vi.fn(),
  };
}

describe("docs search-help-site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints JSON output in --json mode", async () => {
    vi.mocked(searchHelpDocs).mockResolvedValue({
      query: "roles",
      language: "en_US",
      count: 1,
      results: [
        {
          id: 1,
          rank: 1,
          title: "Doc A",
          url: "https://help.salesforce.com/s/articleView?id=a&type=5",
          source: "help",
          hostname: "help.salesforce.com",
          label: "Doc A",
        },
      ],
    });

    const ctx = createContext({
      args: { query: "roles" },
      flags: {
        json: true,
        language: "en_US",
        limit: 10,
        timeout: 45000,
        cache: true,
        headed: false,
        debug: false,
      },
    });

    await DocsSearchHelpSite.prototype.run.call(ctx as never);

    expect(searchHelpDocs).toHaveBeenCalledWith({
      query: "roles",
      language: "en_US",
      limit: 10,
      timeoutMs: 45000,
      cache: true,
      headed: false,
      debug: false,
    });
    expect(ctx.log).toHaveBeenCalledTimes(1);
    const output = String(ctx.log.mock.calls[0][0]);
    const parsed = JSON.parse(output) as { query: string; count: number; results: Array<{ title: string | null; url: string }> };
    expect(parsed.query).toBe("roles");
    expect(parsed.count).toBe(1);
    expect(parsed.results[0].title).toBe("Doc A");
  });

  it("prints a boxed table in non-JSON mode", async () => {
    vi.mocked(searchHelpDocs).mockResolvedValue({
      query: "roles",
      language: "en_US",
      count: 2,
      results: [
        {
          id: 1,
          rank: 1,
          title: "Doc A",
          url: "https://help.salesforce.com/s/articleView?id=a&type=5",
          source: "help",
          hostname: "help.salesforce.com",
          label: "Doc A",
        },
        {
          id: 2,
          rank: 2,
          title: "Doc B",
          url: "https://developer.salesforce.com/docs/commerce/example",
          source: "developer",
          hostname: "developer.salesforce.com",
          label: "Doc B",
        },
      ],
    });

    const ctx = createContext({
      args: { query: "roles" },
      flags: {
        json: false,
        language: "en_US",
        limit: 10,
        timeout: 45000,
        cache: true,
        headed: false,
        debug: false,
      },
    });

    await DocsSearchHelpSite.prototype.run.call(ctx as never);

    expect(ctx.log).toHaveBeenCalledTimes(3);
    const tableOutput = String(ctx.log.mock.calls[2][0]);
    expect(tableOutput).toContain("| #");
    expect(tableOutput).toContain("Doc A");
    expect(tableOutput).toContain("Doc B");
  });

  it("treats zero results as a valid non-error outcome", async () => {
    vi.mocked(searchHelpDocs).mockResolvedValue({
      query: "nothing",
      language: "en_US",
      count: 0,
      results: [],
    });

    const ctx = createContext({
      args: { query: "nothing" },
      flags: {
        json: false,
        language: "en_US",
        limit: 10,
        timeout: 45000,
        cache: true,
        headed: false,
        debug: false,
      },
    });

    await DocsSearchHelpSite.prototype.run.call(ctx as never);

    expect(ctx.log).toHaveBeenCalledTimes(3);
    expect(String(ctx.log.mock.calls[2][0])).toBe("No results found.");
  });
});

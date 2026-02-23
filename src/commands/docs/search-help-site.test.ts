import { beforeEach, describe, expect, it, vi } from "vitest";
import DocsSearchHelpSite from "./search-help-site";
import { searchHelp } from "../../lib/helpSearch";

vi.mock("../../lib/helpSearch", () => ({
  searchHelp: vi.fn(),
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
    vi.mocked(searchHelp).mockResolvedValue([
      { title: "Doc A", url: "https://help.salesforce.com/s/articleView?id=a&type=5" },
    ]);

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

    expect(searchHelp).toHaveBeenCalledWith({
      query: "roles",
      language: "en_US",
      limit: 10,
      timeoutMs: 45000,
      useCache: true,
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
    vi.mocked(searchHelp).mockResolvedValue([
      { title: "Doc A", url: "https://help.salesforce.com/s/articleView?id=a&type=5" },
      { title: "Doc B", url: "https://developer.salesforce.com/docs/commerce/example" },
    ]);

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
    vi.mocked(searchHelp).mockResolvedValue([]);

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

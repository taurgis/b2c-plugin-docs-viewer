import { beforeEach, describe, expect, it, vi } from "vitest";
import DocsHelpSiteArticle from "./help-site-article";
import { readHelpDoc, resolveHelpDoc } from "../../api";
import { loadLatestSearch } from "../../lib/latestSearch";
import { writeTextFile } from "../../lib/fileOutput";

vi.mock("../../api", () => ({
  readHelpDoc: vi.fn(),
  resolveHelpDoc: vi.fn(),
}));

vi.mock("../../lib/latestSearch", () => ({
  loadLatestSearch: vi.fn(),
}));

vi.mock("../../lib/fileOutput", () => ({
  writeTextFile: vi.fn(),
}));

type RunContext = {
  parse: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function createContext(parseResult: unknown): RunContext {
  return {
    parse: vi.fn().mockResolvedValue(parseResult),
    log: vi.fn(),
    error: vi.fn((message: string) => {
      throw new Error(message);
    }),
  };
}

describe("docs help-site-article", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves #id references from latest search and passes debug flag", async () => {
    vi.mocked(loadLatestSearch).mockResolvedValue({
      query: "roles",
      results: [
        { title: "Doc A", url: "https://help.salesforce.com/s/articleView?id=a&type=5" },
        { title: "Doc B", url: "https://developer.salesforce.com/docs/commerce/example" },
      ],
    });
    vi.mocked(resolveHelpDoc).mockImplementation((value: { url: string } | string) => ({
      url: typeof value === "string" ? value : value.url,
      source: "developer",
      hostname: "developer.salesforce.com",
    }));
    vi.mocked(readHelpDoc).mockResolvedValue({
      url: "https://developer.salesforce.com/docs/commerce/example",
      title: "Doc B",
      source: "developer",
      hostname: "developer.salesforce.com",
      markdown: "# Doc B\ncontent",
    });

    const ctx = createContext({
      args: { reference: "#2" },
      flags: {
        json: true,
        rawHtml: false,
        out: undefined,
        cache: false,
        timeout: 45000,
        wait: 2500,
        headed: false,
        debug: true,
      },
    });

    await DocsHelpSiteArticle.prototype.run.call(ctx as never);

    expect(resolveHelpDoc).toHaveBeenCalledWith(
      "https://developer.salesforce.com/docs/commerce/example"
    );
    expect(readHelpDoc).toHaveBeenCalledWith("https://developer.salesforce.com/docs/commerce/example", {
      timeoutMs: 45000,
      waitMs: 2500,
      headed: false,
      cache: false,
      includeRawHtml: false,
      debug: true,
    });
  });

  it("rejects --raw-html without --json or --out", async () => {
    vi.mocked(resolveHelpDoc).mockImplementation((value: { url: string } | string) => ({
      url: typeof value === "string" ? value : value.url,
      source: "help",
      hostname: "help.salesforce.com",
    }));

    const ctx = createContext({
      args: { reference: "https://help.salesforce.com/s/articleView?id=a&type=5" },
      flags: {
        json: false,
        rawHtml: true,
        out: undefined,
        cache: true,
        timeout: 45000,
        wait: 2500,
        headed: false,
        debug: false,
      },
    });

    await expect(DocsHelpSiteArticle.prototype.run.call(ctx as never)).rejects.toThrow(
      /--raw-html requires --json or --out/
    );
  });

  it("writes JSON file when --json and --out are used", async () => {
    vi.mocked(resolveHelpDoc).mockImplementation((value: { url: string } | string) => ({
      url: typeof value === "string" ? value : value.url,
      source: "help",
      hostname: "help.salesforce.com",
    }));
    vi.mocked(readHelpDoc).mockResolvedValue({
      url: "https://help.salesforce.com/s/articleView?id=a&type=5",
      title: "Doc A",
      source: "help",
      hostname: "help.salesforce.com",
      markdown: "# Doc A\ncontent",
    });

    const ctx = createContext({
      args: { reference: "https://help.salesforce.com/s/articleView?id=a&type=5" },
      flags: {
        json: true,
        rawHtml: false,
        out: "./artifacts/test.json",
        cache: true,
        timeout: 45000,
        wait: 2500,
        headed: false,
        debug: false,
      },
    });

    await DocsHelpSiteArticle.prototype.run.call(ctx as never);

    expect(writeTextFile).toHaveBeenCalledTimes(1);
    expect(writeTextFile).toHaveBeenCalledWith(
      "./artifacts/test.json",
      expect.stringContaining("\"markdown\"")
    );
  });
});

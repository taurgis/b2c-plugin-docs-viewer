import { describe, expect, it } from "vitest";

describe("package exports", () => {
  it("exports the programmatic API from the root package and /api subpath", async () => {
    const rootModuleId = "b2c-plugin-help-docs-viewer";
    const subpathModuleId = "b2c-plugin-help-docs-viewer/api";
    const rootApi = await import(rootModuleId);
    const subpathApi = await import(subpathModuleId);

    expect(typeof rootApi.searchHelpDocs).toBe("function");
    expect(typeof rootApi.readHelpDoc).toBe("function");
    expect(typeof rootApi.resolveHelpDoc).toBe("function");
    expect(typeof subpathApi.searchHelpDocs).toBe("function");
    expect(typeof subpathApi.readHelpDoc).toBe("function");
    expect(typeof subpathApi.resolveHelpDoc).toBe("function");
  });
});
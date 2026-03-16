import { describe, expect, it } from "vitest";
import {
  normalizeRegressionAssetUrl,
  normalizeRegressionMarkdown,
} from "./regressionMarkdown";

describe("normalizeRegressionAssetUrl", () => {
  it("replaces volatile Salesforce docs image version segments", () => {
    const normalized = normalizeRegressionAssetUrl(
      "https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/9a3da05c-fbd0-49b1-869c-d93578489dde/comm/images/comm_agent_template.jpg"
    );

    expect(normalized).toBe(
      "https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/__asset_version__/comm/images/comm_agent_template.jpg"
    );
  });

  it("leaves non-image Salesforce docs URLs untouched", () => {
    const original =
      "https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-comm-260-0-0-production-enus/9a3da05c-fbd0-49b1-869c-d93578489dde/comm/content/topic.html";

    expect(normalizeRegressionAssetUrl(original)).toBe(original);
  });

  it("leaves other hosts untouched", () => {
    const original = "https://help.salesforce.com/s/articleView?id=cc.b2c_site_import_export.htm&type=5";

    expect(normalizeRegressionAssetUrl(original)).toBe(original);
  });
});

describe("normalizeRegressionMarkdown", () => {
  it("normalizes image URLs without changing ordinary links", () => {
    const markdown = [
      "![Setup](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/397a7fba-4405-4871-b57a-c30a5b665968/images/setup_icon_no_border.png)",
      "[Help article](https://help.salesforce.com/s/articleView?id=cc.b2c_site_import_export.htm&type=5)",
    ].join("\n\n");

    const normalized = normalizeRegressionMarkdown(markdown);

    expect(normalized).toContain(
      "https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/__asset_version__/images/setup_icon_no_border.png"
    );
    expect(normalized).toContain(
      "[Help article](https://help.salesforce.com/s/articleView?id=cc.b2c_site_import_export.htm&type=5)"
    );
  });
});
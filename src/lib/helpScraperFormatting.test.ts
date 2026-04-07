import { describe, expect, it } from "vitest";
import {
  convertHtmlToMarkdown,
  formatDeveloperArticleMarkdown,
  formatHelpArticleMarkdown,
  renderDeveloperResponseSections,
  replaceDeveloperResponsesSection,
} from "./helpScraper";

describe("convertHtmlToMarkdown", () => {
  it("renders dx-code-block as fenced code", () => {
    const html = `
      <div class="markdown-content">
        <h1>OCAPI System Jobs</h1>
        <dx-code-block language="txt" code-block="POST /dw/data/v24_5/jobs/{job_id}/executions"></dx-code-block>
      </div>
    `;

    const markdown = convertHtmlToMarkdown(
      html,
      "https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/systemjobs.html"
    );

    expect(markdown).toContain("```txt");
    expect(markdown).toContain("POST /dw/data/v24_5/jobs/{job_id}/executions");
  });

  it("renders HTML tables as markdown tables", () => {
    const html = `
      <table>
        <thead>
          <tr><th>Status</th><th>Type</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td>400</td><td><code>BodyDecodingException</code></td><td>Body couldn't be decoded.</td></tr>
          <tr><td>401</td><td><code>InvalidAccessTokenException</code></td><td>Access token is invalid.</td></tr>
        </tbody>
      </table>
    `;

    const markdown = convertHtmlToMarkdown(
      html,
      "https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/exceptions.html"
    );

    expect(markdown).toContain("| Status | Type | Description |");
    expect(markdown).toContain("| --- | --- | --- |");
    expect(markdown).toContain("BodyDecodingException");
  });

  it("normalizes relative links and images to absolute URLs", () => {
    const html = `
      <p>
        <a href="/docs/path/page.html">Read docs</a>
        <img src="/images/example.png" alt="Example" />
      </p>
    `;

    const markdown = convertHtmlToMarkdown(html, "https://developer.salesforce.com/base");

    expect(markdown).toContain("[Read docs](https://developer.salesforce.com/docs/path/page.html)");
    expect(markdown).toContain("![Example](https://developer.salesforce.com/images/example.png)");
  });

  it("removes empty heading permalink anchors", () => {
    const html = `
      <h2>
        <a name="about" id="about" href="https://help.salesforce.com/s?language=en_US"></a>
        About the Exam
      </h2>
    `;

    const markdown = convertHtmlToMarkdown(html, "https://help.salesforce.com/s/articleView?id=005298936&type=1");

    expect(markdown).toContain("## About the Exam");
    expect(markdown).not.toContain("https://help.salesforce.com/s?language=en_US");
  });

  it("adds spacing for adjacent links and image-followed text", () => {
    const html = `
      <p><a href="#about-exam">About the Exam</a><a href="#exam-outline">Exam Outline</a></p>
      <p>Click <img src="/images/setup.png" alt="Setup" />and continue.</p>
    `;

    const markdown = convertHtmlToMarkdown(html, "https://help.salesforce.com/s/articleView?id=005298936&type=1");

    expect(markdown).toContain("[About the Exam](#about-exam) [Exam Outline](#exam-outline)");
    expect(markdown).toContain("![Setup](https://help.salesforce.com/images/setup.png) and continue");
  });
});

describe("formatHelpArticleMarkdown", () => {
  it("trims help chrome and preserves title/content", () => {
    const raw = [
      "Updated Rollout Schedule",
      "Read More",
      "Enable Agentforce for Guided Shopping",
      "Turn on Agentforce for Guided Shopping for your B2C storefront.",
      "DID THIS ARTICLE SOLVE YOUR ISSUE?",
      "Yes",
      "No",
      "COOKIE CONSENT MANAGER",
    ].join("\n");

    const markdown = formatHelpArticleMarkdown(raw, "Enable Agentforce for Guided Shopping");

    expect(markdown.startsWith("# Enable Agentforce for Guided Shopping")).toBe(true);
    expect(markdown).toContain("Turn on Agentforce for Guided Shopping");
    expect(markdown).not.toContain("DID THIS ARTICLE SOLVE YOUR ISSUE?");
    expect(markdown).not.toContain("COOKIE CONSENT MANAGER");
  });

  it("does not truncate content when the title appears again later", () => {
    const raw = [
      "Read More",
      "Enable Agentforce for Guided Shopping",
      "First paragraph that should be preserved.",
      "Some body text.",
      "Later we mention Enable Agentforce for Guided Shopping again in context.",
      "Final paragraph.",
    ].join("\n");

    const markdown = formatHelpArticleMarkdown(raw, "Enable Agentforce for Guided Shopping");

    expect(markdown.startsWith("# Enable Agentforce for Guided Shopping")).toBe(true);
    expect(markdown).toContain("First paragraph that should be preserved.");
    expect(markdown).toContain("Final paragraph.");
  });

  it("ignores title text inside TOC links and starts at the real title line", () => {
    const raw = [
      "Enable Agentforce for Guided Shopping](https://help.salesforce.com/s/articleView?id=x&type=5)",
      "- Another nav link",
      "Enable Agentforce for Guided Shopping",
      "You are here:",
      "Body content starts here.",
    ].join("\n");

    const markdown = formatHelpArticleMarkdown(raw, "Enable Agentforce for Guided Shopping");

    expect(markdown.startsWith("# Enable Agentforce for Guided Shopping")).toBe(true);
    expect(markdown).toContain("Body content starts here.");
    expect(markdown).not.toContain("](/s/articleView?id=x&type=5)");
  });

  it("removes leading 'You are here' breadcrumbs and duplicate title heading", () => {
    const raw = [
      "Enable Agentforce for Guided Shopping",
      "You are here:",
      "1. Salesforce Help",
      "2. Docs",
      "Enable Agentforce for Guided Shopping",
      "Body content starts here.",
    ].join("\n");

    const markdown = formatHelpArticleMarkdown(raw, "Enable Agentforce for Guided Shopping");

    expect(markdown.startsWith("# Enable Agentforce for Guided Shopping")).toBe(true);
    expect((markdown.match(/# Enable Agentforce for Guided Shopping/g) || []).length).toBe(1);
    expect(markdown).not.toContain("You are here:");
    expect(markdown).toContain("Body content starts here.");
  });
});

describe("formatDeveloperArticleMarkdown", () => {
  it("leaves non-meta developer docs unchanged", () => {
    const raw = [
      "# OCAPI OAuth 2.0",
      "",
      "1.  **Register your client application using Account Manager:**",
      "    ",
      "    All client applications that access the Open Commerce API must be registered through the Commerce Cloud Account Manager.",
    ].join("\n");

    const markdown = formatDeveloperArticleMarkdown(
      raw,
      "https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/oauth.html",
      "OCAPI OAuth 2.0 | B2C Commerce | Salesforce Developers"
    );

    expect(markdown).toBe(raw);
  });

  it("trims developer reference chrome and focuses meta-targeted operation content", () => {
    const raw = [
      "**DID THIS ARTICLE SOLVE YOUR ISSUE?**",
      "Share your feedback",
      "[Open Commerce API](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi)",
      "[Get campaign](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-campaigns?meta=Get%2BCampaign)",
      "Get Campaign",
      "Operation ID: Get Campaign",
      "GET",
      "https://{host}/s/-/dw/data/v25_6/sites/{site_id}/campaigns/{campaign_id}",
      "Action to get campaign information.",
      "This endpoint may return the following faults:",
      "- 404 - CampaignNotFoundException - Thrown in case the campaign does not exist matching the given id",
      "Request",
      "Request Example",
      "cURL",
      "HTTP",
      "`curl \"https://{host}/s/-/dw/data/v25_6/sites/{site_id}/campaigns/{campaign_id}\"`",
      "Hide",
      "Security",
      "Show",
      "### Settings",
      "URI parameters",
      "false",
      "site\\_id",
      "string",
      "Required",
      "The site the requested campaign belongs to.",
      "Minimum characters: 1",
      "campaign\\_id",
      "string",
      "Required",
      "The id of the requested campaign.",
      "Minimum characters: 1",
      "Responses",
      "404default",
      "`CampaignNotFoundException` - Thrown in case the campaign does not exist matching the given id",
      "Example",
      "```",
      "{",
      '  "arguments": {},',
      "}",
      "```",
      "Body",
      "Media type:",
      "application/jsontext/xml",
      "false",
      "arguments",
      "object",
      "A map that provides fault arguments.",
      "Data can be used to provide error messages on the client side.",
      "[Commerce Cloud](https://developer.salesforce.com/developer-centers/commerce-cloud)",
    ].join("\n");

    const markdown = formatDeveloperArticleMarkdown(
      raw,
      "https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-campaigns?meta=Get%2BCampaign",
      "Get campaign | Data Campaigns | B2C Commerce | Salesforce Developers"
    );

    expect(markdown.startsWith("# Get Campaign")).toBe(true);
    expect(markdown).toContain("Operation ID: Get Campaign");
    expect(markdown).toContain("**GET** `https://{host}/s/-/dw/data/v25_6/sites/{site_id}/campaigns/{campaign_id}`");
    expect(markdown).toContain("Action to get campaign information.");
    expect(markdown).toContain("This endpoint may return the following faults:");
    expect(markdown).toContain("## Request");
    expect(markdown).toContain("## Security");
    expect(markdown).toContain("## Responses");
    expect(markdown).toContain("### Request Example");
    expect(markdown).toContain("#### URI Parameters");
    expect(markdown).toContain("| Name | Type | Required | Description | Constraints |");
    expect(markdown).toContain("| site_id | string | Yes | The site the requested campaign belongs to. | Minimum characters: 1 |");
    expect(markdown).toContain("| campaign_id | string | Yes | The id of the requested campaign. | Minimum characters: 1 |");
    expect(markdown).toContain("### 404 DEFAULT");
    expect(markdown).toContain("Media types: application/json, text/xml");
    expect(markdown).toContain("| Field | Type | Flags | Description | Constraints |");
    expect(markdown).toContain(
      "| arguments | object |  | A map that provides fault arguments. Data can be used to provide error messages on the client side. |  |"
    );
    expect(markdown).not.toContain("DID THIS ARTICLE SOLVE YOUR ISSUE?");
    expect(markdown).not.toContain("Share your feedback");
    expect(markdown).not.toContain("[Get campaign](");
    expect(markdown).not.toContain("[Commerce Cloud](");
    expect(markdown).not.toContain("\nHide\n");
    expect(markdown).not.toContain("\nShow\n");
    expect(markdown).not.toContain("\nfalse\n");
    expect(markdown).not.toContain("application/jsontext/xml");
    expect(markdown).not.toContain("\nJavaScript-Fetch\n");
  });
});

describe("structured developer responses", () => {
  it("renders status sections and body tables", () => {
    const markdown = renderDeveloperResponseSections([
      {
        statusLabel: "404",
        summary: "CampaignNotFoundException - Thrown in case the campaign does not exist matching the given id",
        example: '{\n  "message": "not found"\n}',
        bodies: [
          {
            mediaTypes: ["application/json", "text/xml"],
            rows: [
              {
                name: "message",
                type: "string",
                flags: [],
                descriptions: ["The message text of the java exception."],
                constraints: [],
              },
            ],
          },
        ],
      },
    ]);

    expect(markdown).toContain("## Responses");
    expect(markdown).toContain("### 404");
    expect(markdown).toContain("#### Example");
    expect(markdown).toContain("#### Body");
    expect(markdown).toContain("Media types: application/json, text/xml");
    expect(markdown).toContain("| Field | Type | Flags | Description | Constraints |");
    expect(markdown).toContain("| message | string |  | The message text of the java exception. |  |");
  });

  it("replaces an existing responses section", () => {
    const input = [
      "# Get Campaign",
      "",
      "## Request",
      "",
      "Body before responses.",
      "",
      "## Responses",
      "",
      "Old content",
    ].join("\n");

    const replaced = replaceDeveloperResponsesSection(input, "## Responses\n\n### 404\n\nUpdated");

    expect(replaced).toContain("Body before responses.");
    expect(replaced).toContain("### 404");
    expect(replaced).not.toContain("Old content");
  });
});

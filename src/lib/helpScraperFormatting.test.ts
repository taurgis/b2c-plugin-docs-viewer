import { describe, expect, it } from "vitest";
import { convertHtmlToMarkdown, formatHelpArticleMarkdown } from "./helpScraper";

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
});

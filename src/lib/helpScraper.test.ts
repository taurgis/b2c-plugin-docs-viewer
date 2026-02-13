import { describe, expect, it } from "vitest";
import { getDetailSourceType } from "./helpScraper";

describe("getDetailSourceType", () => {
  it("classifies developer docs URLs as developer", () => {
    const result = getDetailSourceType(
      "https://developer.salesforce.com/docs/commerce/commerce-api/references/shopper-customers?meta=getCustomer"
    );

    expect(result).toBe("developer");
  });

  it("classifies help site URLs as help", () => {
    const result = getDetailSourceType(
      "https://help.salesforce.com/s/articleView?id=cc.b2c_roles_and_permissions.htm&type=5"
    );

    expect(result).toBe("help");
  });

  it("falls back to help for invalid URLs", () => {
    const result = getDetailSourceType("not-a-url");

    expect(result).toBe("help");
  });
});

import { describe, expect, it } from "vitest";
import { listContactsQuerySchema } from "./operational-contacts.dto.js";

describe("listContactsQuerySchema", () => {
  it("parses ?activeStatus=false as false — not Boolean('false') === true", () => {
    const result = listContactsQuerySchema.parse({ activeStatus: "false" });
    expect(result.activeStatus).toBe(false);
  });

  it("parses ?activeStatus=true as true", () => {
    const result = listContactsQuerySchema.parse({ activeStatus: "true" });
    expect(result.activeStatus).toBe(true);
  });

  it("rejects a nonsense activeStatus value rather than silently coercing it", () => {
    expect(() => listContactsQuerySchema.parse({ activeStatus: "yes" })).toThrow();
  });

  it("leaves activeStatus undefined when omitted", () => {
    const result = listContactsQuerySchema.parse({});
    expect(result.activeStatus).toBeUndefined();
  });
});

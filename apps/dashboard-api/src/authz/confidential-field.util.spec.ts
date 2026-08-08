import { describe, expect, it } from "vitest";
import {
  redactConfidentialFields,
  redactConfidentialFieldsFromList,
} from "./confidential-field.util.js";

// Illustrative fixture shape only — no such business entity exists as code yet (Task 8+).
interface SampleCaseStudyRecord extends Record<string, unknown> {
  readonly id: string;
  readonly title: string;
  readonly internalMargin: number;
  readonly clientContractValue: number;
}

const RECORD: SampleCaseStudyRecord = {
  id: "cs-1",
  title: "Acme Growth Case Study",
  internalMargin: 0.42,
  clientContractValue: 150_000,
};
const CONFIDENTIAL_FIELDS: readonly (keyof SampleCaseStudyRecord)[] = [
  "internalMargin",
  "clientContractValue",
];

describe("redactConfidentialFields", () => {
  it("strips every confidential field when the caller cannot view confidential data", () => {
    const result = redactConfidentialFields(RECORD, CONFIDENTIAL_FIELDS, false);
    expect(result).toEqual({ id: "cs-1", title: "Acme Growth Case Study" });
    expect(result).not.toHaveProperty("internalMargin");
    expect(result).not.toHaveProperty("clientContractValue");
  });

  it("returns the record unchanged when the caller can view confidential data", () => {
    const result = redactConfidentialFields(RECORD, CONFIDENTIAL_FIELDS, true);
    expect(result).toEqual(RECORD);
  });

  it("does not mutate the original record", () => {
    redactConfidentialFields(RECORD, CONFIDENTIAL_FIELDS, false);
    expect(RECORD.internalMargin).toBe(0.42);
  });

  it("is a no-op when the field list is empty, regardless of permission", () => {
    expect(redactConfidentialFields(RECORD, [], false)).toEqual(RECORD);
  });
});

describe("redactConfidentialFieldsFromList", () => {
  it("redacts every record in the list when the caller cannot view confidential data", () => {
    const result = redactConfidentialFieldsFromList(
      [RECORD, { ...RECORD, id: "cs-2" }],
      CONFIDENTIAL_FIELDS,
      false,
    );
    expect(result).toHaveLength(2);
    for (const record of result) {
      expect(record).not.toHaveProperty("internalMargin");
      expect(record).not.toHaveProperty("clientContractValue");
    }
  });

  it("leaves every record intact when the caller can view confidential data", () => {
    const result = redactConfidentialFieldsFromList([RECORD], CONFIDENTIAL_FIELDS, true);
    expect(result).toEqual([RECORD]);
  });
});

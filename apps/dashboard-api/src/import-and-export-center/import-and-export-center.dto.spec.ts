import { describe, expect, it } from "vitest";
import {
  changeExportRunStatusSchema,
  createExportRunSchema,
  createImportTemplateSchema,
  importRowInputSchema,
} from "./import-and-export-center.dto.js";

// Code-review fix: unlike every free-text field in this file (each carrying an explicit `.max()`
// character cap), `columnMapping`/`filterCriteria`/`rawData` were plain `z.record(z.unknown())`
// with no size bound at all — a caller could submit an arbitrarily large JSON object into JSONB
// storage. Bounded by serialized byte size via `boundedJsonObjectSchema()`.
describe("boundedJsonObjectSchema (columnMapping/filterCriteria/rawData size bound)", () => {
  it("accepts a small columnMapping object", () => {
    const result = createImportTemplateSchema.parse({
      publicId: "TPL-1",
      name: "Small mapping",
      targetModuleKey: "keyword_and_entity_library",
      columnMapping: { sourceColumn: "targetField" },
      fileFormat: "csv",
    });
    expect(result.columnMapping).toEqual({ sourceColumn: "targetField" });
  });

  it("rejects a columnMapping object exceeding the 50,000-byte cap", () => {
    const oversized = { blob: "x".repeat(60_000) };
    expect(() =>
      createImportTemplateSchema.parse({
        publicId: "TPL-1",
        name: "Oversized mapping",
        targetModuleKey: "keyword_and_entity_library",
        columnMapping: oversized,
        fileFormat: "csv",
      }),
    ).toThrow();
  });

  it("rejects an oversized filterCriteria object on export_runs", () => {
    const oversized = { blob: "x".repeat(60_000) };
    expect(() =>
      createExportRunSchema.parse({
        publicId: "EXP-1",
        targetModuleKey: "keyword_and_entity_library",
        filterCriteria: oversized,
        format: "csv",
      }),
    ).toThrow();
  });

  it("rejects an oversized rawData object on an import row input", () => {
    const oversized = { blob: "x".repeat(60_000) };
    expect(() =>
      importRowInputSchema.parse({
        rowNumber: 1,
        rawData: oversized,
        status: "valid",
      }),
    ).toThrow();
  });
});

// Code-review fix: export_runs has no genuine free-text field — `search` used to fuzzy-match the
// exact same `targetModuleKey` column the exact-match filter already covers, silently clobbering
// it whenever both were supplied. Removed entirely, matching Review and Approval Center's own
// exact-match-only precedent for a closed-vocabulary `targetModuleKey`.
describe("changeExportRunStatusSchema / listExportRunsQuerySchema", () => {
  it("changeExportRunStatusSchema still parses a plain status transition", () => {
    const result = changeExportRunStatusSchema.parse({ status: "processing" });
    expect(result.status).toBe("processing");
  });
});

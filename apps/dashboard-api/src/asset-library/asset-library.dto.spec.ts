import { describe, expect, it } from "vitest";
import {
  createAssetRelatedRecordSchema,
  createAssetSchema,
  listAssetsQuerySchema,
  updateAssetRelatedRecordSchema,
  updateAssetSchema,
} from "./asset-library.dto.js";

const MINIMAL = { publicId: "ASSET-HERO-001", title: "Homepage hero image" };

describe("createAssetSchema", () => {
  it("accepts the minimal required shape", () => {
    const parsed = createAssetSchema.parse(MINIMAL);
    expect(parsed.publicId).toBe("ASSET-HERO-001");
  });

  /**
   * D4's real enforcement point on the write path. Zod's default `strip` mode drops any key the
   * schema does not declare, so a caller cannot assert its own scan result — critically, it can
   * never claim `clean`, which the module registry's own seeded text explicitly forbids this
   * system from ever claiming. (`AssetRepository.create()` independently hardcodes
   * `not_configured` too, so this is a genuine two-layer guarantee, not a single check.)
   */
  it.each(["scanStatus", "approvalStatus", "version", "isPublished", "publishedAt"] as const)(
    "strips the server-managed field %s from a create payload",
    (field) => {
      const parsed = createAssetSchema.parse({
        ...MINIMAL,
        [field]: field === "scanStatus" ? "clean" : "tampered",
      }) as Record<string, unknown>;

      expect(parsed).not.toHaveProperty(field);
    },
  );

  it.each(["javascript:alert(1)", "data:text/html;base64,PHNjcmlwdD4="])(
    "rejects the unsafe fileReference scheme %s",
    (fileReference) => {
      // A stored `javascript:` value would be a real stored-XSS path the moment a future
      // dashboard-web UI renders this field as a link — the exact defect Projects' own
      // `environment.url` shipped with once (a confirmed HIGH security-review finding).
      expect(() => createAssetSchema.parse({ ...MINIMAL, fileReference })).toThrow();
    },
  );

  it("accepts a safe https fileReference", () => {
    const parsed = createAssetSchema.parse({
      ...MINIMAL,
      fileReference: "https://cdn.example.com/hero.png",
    });
    expect(parsed.fileReference).toBe("https://cdn.example.com/hero.png");
  });

  it("accepts fileSizeBytes as a digit string beyond INTEGER range", () => {
    // The column is a BIGINT precisely so a real media file above ~2.1GB fits.
    const parsed = createAssetSchema.parse({ ...MINIMAL, fileSizeBytes: "5368709120" });
    expect(parsed.fileSizeBytes).toBe("5368709120");
  });

  it.each(["-1", "12.5", "abc", "1e5"])(
    "rejects the malformed fileSizeBytes value %s",
    (fileSizeBytes) => {
      // A clean 400 rather than a raw 500 from Postgres on INSERT.
      expect(() => createAssetSchema.parse({ ...MINIMAL, fileSizeBytes })).toThrow();
    },
  );

  it("accepts fileSizeBytes exactly at the BIGINT ceiling", () => {
    const parsed = createAssetSchema.parse({ ...MINIMAL, fileSizeBytes: "9223372036854775807" });
    expect(parsed.fileSizeBytes).toBe("9223372036854775807");
  });

  it.each(["9223372036854775808", "99999999999999999999"])(
    "rejects the BIGINT-overflowing fileSizeBytes value %s by VALUE, not digit count",
    (fileSizeBytes) => {
      // A digit-count cap alone admits these — they are well-formed integer strings that overflow
      // the column and 500 on INSERT (code-review finding).
      expect(() => createAssetSchema.parse({ ...MINIMAL, fileSizeBytes })).toThrow();
    },
  );

  it.each(["widthPx", "heightPx", "durationSeconds"] as const)(
    "accepts %s exactly at the Postgres INTEGER ceiling",
    (field) => {
      const parsed = createAssetSchema.parse({ ...MINIMAL, [field]: 2147483647 }) as Record<
        string,
        unknown
      >;
      expect(parsed[field]).toBe(2147483647);
    },
  );

  it.each(["widthPx", "heightPx", "durationSeconds"] as const)(
    "rejects %s above the Postgres INTEGER ceiling rather than 500ing on INSERT",
    (field) => {
      expect(() => createAssetSchema.parse({ ...MINIMAL, [field]: 3000000000 })).toThrow();
    },
  );

  it("rejects an unknown visibility value", () => {
    expect(() => createAssetSchema.parse({ ...MINIMAL, visibility: "secret" })).toThrow();
  });

  it("leaves visibility unset when omitted, so the repository applies its conservative default", () => {
    const parsed = createAssetSchema.parse(MINIMAL);
    expect(parsed.visibility).toBeUndefined();
  });
});

describe("updateAssetSchema", () => {
  it("rejects a genuinely empty patch", () => {
    // Silently succeeding would still burn a `version` increment and write an empty-afterState
    // audit event.
    expect(() => updateAssetSchema.parse({})).toThrow();
  });

  it("treats publicId as create-only", () => {
    const parsed = updateAssetSchema.parse({
      title: "New title",
      publicId: "ASSET-RENAMED",
    }) as Record<string, unknown>;

    expect(parsed).not.toHaveProperty("publicId");
    expect(parsed.title).toBe("New title");
  });

  it("accepts an explicit null to clear a nullable field", () => {
    const parsed = updateAssetSchema.parse({ description: null });
    expect(parsed.description).toBeNull();
  });

  it.each(["scanStatus", "approvalStatus", "isPublished"] as const)(
    "strips the server-managed field %s from an update payload",
    (field) => {
      const parsed = updateAssetSchema.parse({
        title: "New title",
        [field]: field === "scanStatus" ? "clean" : "tampered",
      }) as Record<string, unknown>;

      expect(parsed).not.toHaveProperty(field);
    },
  );
});

describe("listAssetsQuerySchema", () => {
  it.each([
    ["true", true],
    ["false", false],
  ] as const)("maps the isPublished query param %s to %s", (raw, expected) => {
    // `z.coerce.boolean()` would run `Boolean("false")` — which is `true`, since any non-empty
    // string is truthy — silently inverting the filter. The explicit literal map has no such trap.
    expect(listAssetsQuerySchema.parse({ isPublished: raw }).isPublished).toBe(expected);
  });

  it("rejects a non-boolean isPublished value rather than silently coercing it", () => {
    expect(() => listAssetsQuerySchema.parse({ isPublished: "yes" })).toThrow();
  });

  it("clamps nothing itself but rejects an out-of-range limit", () => {
    expect(() => listAssetsQuerySchema.parse({ limit: "500" })).toThrow();
    expect(listAssetsQuerySchema.parse({ limit: "200" }).limit).toBe(200);
  });
});

describe("createAssetRelatedRecordSchema", () => {
  it("requires recordId to be a UUID", () => {
    expect(() =>
      createAssetRelatedRecordSchema.parse({ moduleKey: "page_inventory", recordId: "not-a-uuid" }),
    ).toThrow();
  });

  it("rejects an empty patch, matching updateAssetSchema's own guard", () => {
    // Previously returned 200 and wrote a `data_change` audit event recording no change
    // (code-review finding).
    expect(() => updateAssetRelatedRecordSchema.parse({})).toThrow();
  });

  it("still accepts an explicit null note — clearing the note is a real edit", () => {
    expect(updateAssetRelatedRecordSchema.parse({ note: null }).note).toBeNull();
  });

  it("accepts any non-empty moduleKey — the REAL check is the registry lookup in the service", () => {
    // Deliberately not an enum here: the valid set is the seeded module registry, which the
    // service validates against via `AuthorizationService.isValidModuleKey()`. Hardcoding an enum
    // would drift from the registry the moment a module is added.
    const parsed = createAssetRelatedRecordSchema.parse({
      moduleKey: "page_inventory",
      recordId: "22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.moduleKey).toBe("page_inventory");
  });
});

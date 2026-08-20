import { DataTypes, type QueryInterface } from "sequelize";

/**
 * `docs/task-packages/business-knowledge-center-rich-content-attachments.md` §5. A record's
 * `content` becomes optional — a record may now carry only file attachments, no typed content;
 * the real "must have one or the other" invariant is enforced at the application layer (Zod),
 * matching this project's existing pattern of splitting real invariants between a DB constraint
 * and app-layer validation (see the same doc's §5 rationale). One `business_knowledge_attachments`
 * row per uploaded file, 1-to-many against a record — the Blob object itself is the binary only
 * (`blob_pathname`, never a raw public URL); `scan_status` uses the interim vocabulary from
 * `knowledge/08-vercel-blob-and-file-handling.md` (malware scanning is deferred project-wide — no
 * status here ever asserts a file is malware-free).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.changeColumn("business_knowledge_records", "content", {
    type: DataTypes.TEXT,
    allowNull: true,
  });

  await context.createTable("business_knowledge_attachments", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    record_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "business_knowledge_records", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    size_bytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    checksum_sha256: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    blob_pathname: {
      type: DataTypes.STRING(1024),
      allowNull: false,
    },
    extracted_preview_html: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    scan_status: {
      type: DataTypes.ENUM(
        "uploaded",
        "validation_passed",
        "validation_failed",
        "scan_not_configured",
        "externally_approved",
        "rejected",
        "deleted",
      ),
      allowNull: false,
      defaultValue: "scan_not_configured",
    },
    uploaded_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.addIndex("business_knowledge_attachments", ["record_id"], {
    name: "business_knowledge_attachments_record_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("business_knowledge_attachments", {});
  await context.sequelize.query(
    `DROP TYPE IF EXISTS "enum_business_knowledge_attachments_scan_status";`,
  );
  // Any attachment-only record created while content was nullable has no real content to restore —
  // coerce to an empty string rather than leaving the column un-revertible (a genuine data loss on
  // rollback either way; this at least keeps the down-migration mechanically reversible instead of
  // failing outright on the NOT NULL constraint below).
  await context.sequelize.query(
    `UPDATE "business_knowledge_records" SET content = '' WHERE content IS NULL;`,
  );
  await context.changeColumn("business_knowledge_records", "content", {
    type: DataTypes.TEXT,
    allowNull: false,
  });
}

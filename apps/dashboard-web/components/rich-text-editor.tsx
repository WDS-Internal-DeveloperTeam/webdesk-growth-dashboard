"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { toSafeRichTextValue } from "@/lib/rich-text";
import styles from "./rich-text-editor.module.css";

export interface RichTextEditorProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (html: string) => void;
  readonly placeholder?: string;
  readonly "aria-required"?: boolean;
}

/**
 * The create/edit form's rich-text editor for `content` — Tiptap's `starter-kit` (headings,
 * bold/italic/underline/strike, lists, blockquote, code, link, undo/redo), matching exactly the
 * tag set `apps/dashboard-api/src/business-knowledge/sanitize-html.util.ts`'s allowlist accepts,
 * so nothing a user can produce here is ever silently stripped server-side. WYSIWYG by nature, so
 * "preview" (the New Business Knowledge Record form's requirement) needs no separate preview
 * pane — what's shown while typing is what gets saved.
 *
 * `immediatelyRender: false` is required for Next.js SSR — without it, Tiptap tries to render
 * (and hydrate) on the server, which it explicitly doesn't support and warns loudly about.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  "aria-required": ariaRequired,
}: RichTextEditorProps): ReactNode {
  const attributes: Record<string, string> = {
    class: styles.editorContent ?? "",
    role: "textbox",
    "aria-multiline": "true",
  };
  if (id) {
    attributes.id = id;
  }
  if (placeholder) {
    attributes["data-placeholder"] = placeholder;
  }
  if (ariaRequired) {
    attributes["aria-required"] = "true";
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    // `toSafeRichTextValue()` guards against a field that held real, unsanitized plain text
    // before it switched to this editor (code-review finding, rich-text-editor-long-fields
    // branch) — a no-op for any value this app's own sanitizer has ever produced.
    content: toSafeRichTextValue(value),
    editorProps: { attributes },
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getHTML());
    },
  });

  // Keeps the editor in sync when `value` changes from OUTSIDE typing (e.g. the edit form's own
  // initial load once `editor` becomes non-null, or a future external reset) — `emitUpdate: false`
  // stops this from re-firing onChange and looping back into itself.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(toSafeRichTextValue(value), { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar} role="toolbar" aria-label="Formatting">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const previousUrl = editor.getAttributes("link").href as string | undefined;
            // A lightweight prompt is a deliberate, minimal choice here — a full link-editing
            // dialog is out of proportion for this form.
            const url = window.prompt("Link URL", previousUrl ?? "https://");
            if (url === null) {
              return;
            }
            if (url === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
        >
          <LinkIcon size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo size={16} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  readonly label: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={
        active ? `${styles.toolbarButton} ${styles.toolbarButtonActive}` : styles.toolbarButton
      }
    >
      {children}
    </button>
  );
}

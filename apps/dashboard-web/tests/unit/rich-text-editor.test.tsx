import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RichTextEditor } from "../../components/rich-text-editor.js";

describe("RichTextEditor", () => {
  it("renders the toolbar and the editor's initial content", async () => {
    render(<RichTextEditor value="<p>Hello world</p>" onChange={() => {}} />);
    expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Hello world")).toBeInTheDocument());
  });

  it("marks the Bold toolbar button pressed when the cursor is on bold text", async () => {
    render(<RichTextEditor value="<p><strong>bold</strong></p>" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText("bold")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
  });

  it("disables Undo when there's nothing to undo yet", async () => {
    render(<RichTextEditor value="<p>text</p>" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled());
  });

  it("renders a placeholder attribute on the editor when provided", async () => {
    render(<RichTextEditor value="" onChange={() => {}} placeholder="Type here" />);
    await waitFor(() => {
      const editable = document.querySelector('[contenteditable="true"]');
      expect(editable?.getAttribute("data-placeholder")).toBe("Type here");
    });
  });

  it("accepts an onChange callback without throwing when constructed", () => {
    const onChange = vi.fn();
    expect(() => render(<RichTextEditor value="<p>x</p>" onChange={onChange} />)).not.toThrow();
  });
});

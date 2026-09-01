import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { CaseStudyLibraryTestimonial } from "@webdesk/shared-types";

import { CaseStudyLibraryTestimonialsField } from "../../components/case-study-library-testimonials-field.js";

/** A thin controlled-state wrapper — `CaseStudyLibraryTestimonialsField` itself is stateless
 *  (`values`/`onChange`), matching `TagListField`'s own controlled shape, so tests exercise it the
 *  same way a real parent form would. */
function Harness() {
  const [values, setValues] = useState<readonly CaseStudyLibraryTestimonial[]>([]);
  return <CaseStudyLibraryTestimonialsField values={values} onChange={setValues} />;
}

describe("CaseStudyLibraryTestimonialsField", () => {
  it("renders no rows and a draft form when empty", () => {
    render(<Harness />);
    expect(screen.queryByText(/Remove/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("New testimonial quote")).toBeInTheDocument();
  });

  it("disables Add testimonial until a quote is entered", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Add testimonial" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("New testimonial quote"), {
      target: { value: "Great work!" },
    });
    expect(screen.getByRole("button", { name: "Add testimonial" })).not.toBeDisabled();
  });

  it("adds a testimonial with quote/author/role and clears the draft", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("New testimonial quote"), {
      target: { value: "Great work!" },
    });
    fireEvent.change(screen.getByLabelText("New testimonial author"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByLabelText("New testimonial role"), {
      target: { value: "CTO" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add testimonial" }));

    expect(screen.getByText("“Great work!”")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe, CTO")).toBeInTheDocument();
    expect(screen.getByLabelText("New testimonial quote")).toHaveValue("");
  });

  it("adds a testimonial with a blank author/role trimmed to null (no attribution line)", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("New testimonial quote"), {
      target: { value: "Solid partner." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add testimonial" }));

    expect(screen.getByText("“Solid partner.”")).toBeInTheDocument();
    expect(screen.queryByText(",")).not.toBeInTheDocument();
  });

  it("removes a testimonial", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("New testimonial quote"), {
      target: { value: "Great work!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add testimonial" }));
    expect(screen.getByText("“Great work!”")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("“Great work!”")).not.toBeInTheDocument();
  });

  it("hides the draft add-form once the max testimonial count is reached", () => {
    const initial: readonly CaseStudyLibraryTestimonial[] = Array.from({ length: 20 }, (_, i) => ({
      quote: `Quote ${i}`,
      author: null,
      role: null,
    }));
    function FullHarness() {
      const [values, setValues] = useState(initial);
      return <CaseStudyLibraryTestimonialsField values={values} onChange={setValues} />;
    }
    render(<FullHarness />);
    expect(screen.queryByLabelText("New testimonial quote")).not.toBeInTheDocument();
  });
});

# 04 — KB Update Workflow

Turn captured failures into durable fixes. For each failure: generalize (will this recur on other projects?), find the smallest instruction change that prevents it, edit the KB file, bump its `Last reviewed` line, and note it in the retro. Avoid overfitting to the pilot — fix the pattern, not the one instance. Re-run `tools/scripts/validate-frontmatter.py` after edits.

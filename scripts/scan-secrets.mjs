#!/usr/bin/env node
/**
 * Dependency-free secret-pattern scan — same pattern family used by this
 * project's skill-build validators (validate-package.py), kept consistent
 * rather than introducing a third-party scanning action. Scans tracked,
 * non-binary files for common secret shapes. Not a substitute for a real
 * secrets-management process (docs/security/secrets-management-plan.md) —
 * a structural safety net, not the primary control.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SECRET_PATTERNS = [
  { name: "OpenAI-style API key", pattern: /sk-[A-Za-z0-9]{20,}/g },
  { name: "AWS Access Key ID", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "Private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "GitHub personal access token", pattern: /ghp_[A-Za-z0-9]{30,}/g },
  { name: "GitHub App/OAuth token", pattern: /gh[oprsu]_[A-Za-z0-9]{30,}/g },
  { name: "Generic bearer-looking secret assignment", pattern: /(?:secret|password|token|api[_-]?key)\s*[:=]\s*["'][A-Za-z0-9+/_-]{20,}["']/gi },
];

const IGNORED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf",
  ".zip", ".xlsm", ".xlsx", ".pdf", ".lock",
]);

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files"], { encoding: "utf-8" });
  return output.split("\n").filter(Boolean);
}

function main() {
  const files = listTrackedFiles();
  const findings = [];

  for (const file of files) {
    const ext = file.slice(file.lastIndexOf("."));
    if (IGNORED_EXTENSIONS.has(ext)) continue;
    if (file === "scripts/scan-secrets.mjs") continue; // this file's own pattern list

    let content;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue; // binary or unreadable — skip rather than crash the scan
    }

    for (const { name, pattern } of SECRET_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        findings.push({ file, name, count: matches.length });
      }
    }
  }

  if (findings.length > 0) {
    console.error("Secret-pattern scan FAILED — possible secrets found:\n");
    for (const finding of findings) {
      console.error(`  ${finding.file}: ${finding.name} (${finding.count} match(es))`);
    }
    console.error("\nIf any of these are real, rotate the credential immediately and remove it from history.");
    console.error("If a match is a false positive (e.g. documentation showing an example pattern), adjust the pattern or add a targeted exclusion — do not blanket-disable this check.");
    process.exit(1);
  }

  console.log(`Secret-pattern scan passed — ${files.length} tracked files checked, no matches.`);
}

main();

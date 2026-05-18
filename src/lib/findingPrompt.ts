import { execFileSync } from "node:child_process";
import type { Finding } from "./dashboardData";
import { formatLabel } from "./format";

export function copyFindingPromptToClipboard(finding: Finding) {
  execFileSync("pbcopy", { input: buildFindingPrompt(finding) });
}

export function buildFindingPrompt(finding: Finding) {
  const tags = finding.tags.length ? finding.tags.map((tag) => formatLabel(tag)).join(", ") : "None";

  return [
    "Address this security finding in the current repository.",
    "Investigate the root cause, make the smallest safe code change, and explain the fix.",
    "",
    `Title: ${finding.title}`,
    `Severity: ${formatLabel(finding.severity)}`,
    `Confidence: ${formatLabel(finding.confidence)}`,
    `Location: ${formatFindingLocation(finding)}`,
    `Tags: ${tags}`,
    `Description: ${finding.description || "Not provided."}`,
    `Recommendation: ${finding.recommendation || "Not provided."}`,
  ].join("\n");
}

function formatFindingLocation(finding: Finding) {
  if (!finding.lineNumbers.length) return finding.filePath;

  const lineLabel = finding.lineNumbers.length === 1 ? "line" : "lines";
  return `${finding.filePath} - ${lineLabel} ${finding.lineNumbers.join(", ")}`;
}

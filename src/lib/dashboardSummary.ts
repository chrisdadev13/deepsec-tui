import { dashboardColors, type Finding, type Severity } from "./dashboardData";
import { formatLabel } from "./format";

const severityOrder: Array<{ key: Severity; color: string }> = [
  { key: "critical", color: dashboardColors.red },
  { key: "high", color: dashboardColors.orange },
  { key: "medium", color: dashboardColors.yellow },
  { key: "high_bug", color: dashboardColors.purple },
  { key: "bug", color: dashboardColors.blue },
];

export function sortFindingsBySeverity(findings: Finding[]) {
  const severityRank = new Map(severityOrder.map((item, index) => [item.key, index]));

  return findings.slice().sort((left, right) => {
    const leftRank = severityRank.get(left.severity) ?? severityOrder.length;
    const rightRank = severityRank.get(right.severity) ?? severityOrder.length;

    return leftRank - rightRank;
  });
}

export function buildSeverityCounts(findings: Finding[]) {
  return severityOrder.map((item) => ({
    ...item,
    label: formatLabel(item.key),
    value: findings.filter((finding) => finding.severity === item.key).length,
  }));
}

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDeepsecDir, resolveWorkspaceRoot } from "./workspace";

export type Severity = "critical" | "high" | "medium" | "high_bug" | "bug";

export type Finding = {
  severity: Severity;
  title: string;
  filePath: string;
  lineNumbers: number[];
  confidence: "high" | "medium" | "low";
  tags: string[];
  verdict?: "true-positive" | "needs-review";
  description: string;
  recommendation: string;
  analysis: string;
  runId: string;
};

export type DashboardRun = {
  id: string;
  label: string;
  state: string;
  detail: string;
};

export type DashboardData = {
  projectId: string;
  rootPath: string;
  files: number;
  analyzed: number;
  pending: number;
  totalFindings: number;
  generatedAt: string | null;
  techTags: string[];
  latestCandidates: number;
  findings: Finding[];
  runs: DashboardRun[];
};

export const dashboardColors = {
  bg: "#000000",
  panel: "#121212",
  border: "#2a2a2a",
  borderSoft: "#1b1b1b",
  text: "#d7d7d7",
  bright: "#f2f2f2",
  muted: "#8d8d8d",
  faint: "#5f5f5f",
  green: "#39b36b",
  blue: "#69aafc",
  yellow: "#d9b44a",
  orange: "#f08c49",
  red: "#ff6868",
  purple: "#b88cff",
};

export const severityColors: Record<Severity, string> = {
  critical: dashboardColors.red,
  high: dashboardColors.orange,
  medium: dashboardColors.yellow,
  high_bug: dashboardColors.purple,
  bug: dashboardColors.blue,
};

type DeepsecProject = {
  projectId?: string;
  rootPath?: string;
};

type DeepsecTech = {
  tags?: string[];
};

type DeepsecRun = {
  runId?: string;
  projectId?: string;
  createdAt?: string;
  completedAt?: string;
  type?: string;
  phase?: string;
  stats?: {
    filesScanned?: number;
    filesProcessed?: number;
    findingsCount?: number;
    candidatesFound?: number;
    totalCostUsd?: number;
    totalDurationMs?: number;
  };
};

type DeepsecReportFinding = {
  severity?: string;
  vulnSlug?: string;
  title?: string;
  description?: string;
  lineNumbers?: number[];
  recommendation?: string;
  confidence?: "high" | "medium" | "low";
  producedByRunId?: string;
};

type DeepsecReportFile = {
  filePath?: string;
  findings?: DeepsecReportFinding[];
  analysisHistory?: DeepsecAnalysisHistoryEntry[];
};

type DeepsecAnalysisHistoryEntry = {
  runId?: string;
  model?: string;
  findingCount?: number;
  costUsd?: number;
  totalCostUsd?: number;
  durationMs?: number;
  totalDurationMs?: number;
};

type DeepsecReport = {
  projectId?: string;
  generatedAt?: string;
  summary?: {
    filesAnalyzed?: number;
    totalFindings?: number;
  };
  files?: DeepsecReportFile[];
};

const EMPTY_DASHBOARD_DATA: DashboardData = {
  projectId: "unknown",
  rootPath: "",
  files: 0,
  analyzed: 0,
  pending: 0,
  totalFindings: 0,
  generatedAt: null,
  techTags: [],
  latestCandidates: 0,
  findings: [],
  runs: [],
};

export function getDashboardData(cwd = process.cwd()): DashboardData {
  const projectDir = getDeepsecProjectDir(resolveWorkspaceRoot(cwd));
  if (!projectDir) return EMPTY_DASHBOARD_DATA;

  const project = readJsonFile<DeepsecProject>(path.join(projectDir, "project.json"));
  const tech = readJsonFile<DeepsecTech>(path.join(projectDir, "tech.json"));
  const report = readJsonFile<DeepsecReport>(path.join(projectDir, "reports", "report.json"));
  const runs = getRuns(path.join(projectDir, "runs"));
  const findings = report ? getFindings(report) : [];
  const analyzed = report?.summary?.filesAnalyzed ?? 0;
  const latestScan = getLatestRun(path.join(projectDir, "runs"), "scan");
  const files = analyzed || latestScan?.stats?.filesScanned || 0;

  return {
    projectId: project?.projectId ?? report?.projectId ?? path.basename(projectDir),
    rootPath: project?.rootPath ?? "",
    files,
    analyzed,
    pending: Math.max(files - analyzed, 0),
    totalFindings: report?.summary?.totalFindings ?? findings.length,
    generatedAt: report?.generatedAt ?? null,
    techTags: tech?.tags ?? [],
    latestCandidates: latestScan?.stats?.candidatesFound ?? 0,
    findings,
    runs,
  };
}

function getDeepsecProjectDir(cwd: string) {
  const dataDir = path.join(getDeepsecDir(cwd), "data");
  if (!existsSync(dataDir)) return null;

  const projectDirs = readdirSync(dataDir)
    .map((entry) => path.join(dataDir, entry))
    .filter((entry) => existsSync(path.join(entry, "project.json")));

  for (const projectDir of projectDirs) {
    const project = readJsonFile<DeepsecProject>(path.join(projectDir, "project.json"));
    if (project?.rootPath === cwd) {
      return projectDir;
    }
  }

  return projectDirs[0] ?? null;
}

function getFindings(report: DeepsecReport) {
  return (report.files ?? []).flatMap((file) => {
    const filePath = file.filePath ?? "unknown";

    return (file.findings ?? []).map((finding) => {
      const analysis = file.analysisHistory?.find(
        (entry) => entry.runId === finding.producedByRunId,
      );

      return {
        severity: normalizeSeverity(finding.severity),
        title: finding.title ?? "Untitled finding",
        filePath,
        lineNumbers: finding.lineNumbers ?? [],
        confidence: finding.confidence ?? "medium",
        tags: finding.vulnSlug ? [finding.vulnSlug] : [],
        description: finding.description ?? "",
        recommendation: finding.recommendation ?? "",
        analysis: formatAnalysis(analysis),
        runId: shortRunId(finding.producedByRunId),
      } satisfies Finding;
    });
  });
}

function getRuns(runsDir: string): DashboardRun[] {
  if (!existsSync(runsDir)) return [];

  return readdirSync(runsDir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => readJsonFile<DeepsecRun>(path.join(runsDir, entry)))
    .filter((run): run is DeepsecRun => Boolean(run?.runId && run.type))
    .sort((left, right) => {
      const leftTime = Date.parse(left.completedAt ?? left.createdAt ?? "");
      const rightTime = Date.parse(right.completedAt ?? right.createdAt ?? "");
      return rightTime - leftTime;
    })
    .map((run) => ({
      id: shortRunId(run.runId),
      label: capitalize(run.type ?? "run"),
      state: capitalize(run.phase ?? "unknown"),
      detail: formatRunDetail(run),
    }));
}

function getLatestRun(runsDir: string, type: string) {
  if (!existsSync(runsDir)) return null;

  return readdirSync(runsDir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => readJsonFile<DeepsecRun>(path.join(runsDir, entry)))
    .filter((run): run is DeepsecRun => Boolean(run?.runId && run.type === type))
    .sort((left, right) => {
      const leftTime = Date.parse(left.completedAt ?? left.createdAt ?? "");
      const rightTime = Date.parse(right.completedAt ?? right.createdAt ?? "");
      return rightTime - leftTime;
    })[0] ?? null;
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function normalizeSeverity(severity?: string): Severity {
  switch (severity) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    case "HIGH_BUG":
      return "high_bug";
    case "BUG":
      return "bug";
    default:
      return "medium";
  }
}

function formatAnalysis(analysis?: DeepsecAnalysisHistoryEntry) {
  if (!analysis) return "No analysis metadata";

  const segments = [analysis.model, formatDuration(analysis.durationMs ?? analysis.totalDurationMs)];
  if (typeof analysis.findingCount === "number") {
    segments.push(`${analysis.findingCount} findings`);
  }
  if (typeof analysis.costUsd === "number" || typeof analysis.totalCostUsd === "number") {
    segments.push(formatUsd(analysis.costUsd ?? analysis.totalCostUsd ?? 0));
  }

  return segments.filter(Boolean).join(" - ");
}

function formatRunDetail(run: DeepsecRun) {
  if (run.type === "process") {
    const detail = [formatDuration(run.stats?.totalDurationMs)];
    if (typeof run.stats?.findingsCount === "number") {
      detail.push(`${run.stats.findingsCount} findings`);
    }
    if (typeof run.stats?.totalCostUsd === "number") {
      detail.push(formatUsd(run.stats.totalCostUsd));
    }

    return detail.filter(Boolean).join(" - ") || `${run.stats?.filesProcessed ?? 0} processed`;
  }

  if (run.type === "scan") {
    const detail = [];
    if (typeof run.stats?.filesScanned === "number") {
      detail.push(`${run.stats.filesScanned} scanned`);
    }
    if (typeof run.stats?.candidatesFound === "number") {
      detail.push(`${run.stats.candidatesFound} candidates`);
    }

    return detail.join(" - ") || "Scan complete";
  }

  return "Run complete";
}

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs < 1000) return durationMs ? `${durationMs}ms` : "";

  const totalSeconds = durationMs / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  return `${Math.round(totalSeconds / 60)}m`;
}

function formatUsd(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function shortRunId(runId?: string) {
  return runId?.split("-")[1]?.slice(0, 7) ?? "unknown";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

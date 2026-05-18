import { existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDeepsecDir, resolveWorkspaceRoot } from "./workspace";

export type ProcessAgent = "codex" | "claude";

export type ProcessMode =
  | "full-scan"
  | "diff"
  | "diff-staged"
  | "diff-working"
  | "files"
  | "files-from";

export type ProcessFormValues = {
  projectId: string;
  runId: string;
  agent: ProcessAgent;
  model: string;
  maxTurns: string;
  reinvestigate: string;
  concurrency: string;
  batchSize: string;
  limit: string;
  filter: string;
  root: string;
  manifest: string;
  onlySlugs: string;
  skipSlugs: string;
  mode: ProcessMode;
  modeValue: string;
  noIgnore: boolean;
  commentOut: string;
};

export type ProcessRunOption = {
  id: string;
  label: string;
  detail: string;
};

type DeepsecRun = {
  runId?: string;
  createdAt?: string;
  completedAt?: string;
  type?: string;
  phase?: string;
  stats?: {
    filesScanned?: number;
    filesProcessed?: number;
    findingsCount?: number;
    candidatesFound?: number;
  };
};

export const processModeOptions: Array<{
  name: string;
  description: string;
  value: ProcessMode;
}> = [
  {
    name: "working changes",
    description: "uncommitted and untracked files",
    value: "diff-working",
  },
  {
    name: "staged changes",
    description: "files staged in the git index",
    value: "diff-staged",
  },
  {
    name: "diff from ref",
    description: "files changed between a ref and HEAD",
    value: "diff",
  },
  {
    name: "specific files",
    description: "comma-separated file path list",
    value: "files",
  },
  {
    name: "files from list",
    description: "newline-delimited file path list",
    value: "files-from",
  },
  {
    name: "full project scan",
    description: "all pending candidate files",
    value: "full-scan",
  },
];

export function getDefaultProcessValues(): ProcessFormValues {
  return {
    projectId: getDefaultProjectId(),
    runId: "",
    agent: "codex",
    model: getDefaultModel("codex"),
    maxTurns: "",
    reinvestigate: "",
    concurrency: String(Math.max(1, os.cpus().length - 1)),
    batchSize: "",
    limit: "",
    filter: "",
    root: resolveWorkspaceRoot(),
    manifest: "",
    onlySlugs: "",
    skipSlugs: "",
    mode: "full-scan",
    modeValue: "",
    noIgnore: false,
    commentOut: "",
  };
}

export function getDefaultModel(agent: ProcessAgent) {
  return agent === "claude" ? "claude-opus-4-7" : "gpt-5.5";
}

export function buildProcessArgs(values: ProcessFormValues) {
  const args = ["process"];

  pushFlag(args, "--project-id", values.projectId);
  pushFlag(args, "--run-id", values.runId);
  pushFlag(args, "--agent", values.agent);
  pushFlag(args, "--model", values.model);
  pushFlag(args, "--max-turns", values.maxTurns);
  pushOptionalFlag(args, "--reinvestigate", values.reinvestigate);
  pushFlag(args, "--concurrency", values.concurrency);
  pushFlag(args, "--batch-size", values.batchSize);
  pushFlag(args, "--limit", values.limit);
  pushFlag(args, "--filter", values.filter);
  pushFlag(args, "--root", values.root);
  pushFlag(args, "--manifest", values.manifest);
  pushFlag(args, "--only-slugs", values.onlySlugs);
  pushFlag(args, "--skip-slugs", values.skipSlugs);
  pushFlag(args, "--comment-out", values.commentOut);

  switch (values.mode) {
    case "diff":
      pushFlag(args, "--diff", values.modeValue);
      break;
    case "diff-staged":
      args.push("--diff-staged");
      break;
    case "diff-working":
      args.push("--diff-working");
      break;
    case "files":
      pushFlag(args, "--files", values.modeValue);
      break;
    case "files-from":
      pushFlag(args, "--files-from", values.modeValue);
      break;
    case "full-scan":
      break;
  }

  if (values.noIgnore) {
    args.push("--no-ignore");
  }

  return args;
}

export function buildProcessCommand(values: ProcessFormValues) {
  return ["deepsec", ...buildProcessArgs(values)].map(shellQuote).join(" ");
}

export function buildProcessWorkspaceCommand(values: ProcessFormValues) {
  return `cd ${shellQuote(getDeepsecDir(resolveWorkspaceRoot()))} && ${buildProcessCommand(values)}`;
}

export function buildProcessWorkflowCommand(values: ProcessFormValues) {
  const reportCommand = ["deepsec", ...buildReportArgs(values.projectId)].map(shellQuote).join(" ");
  return `${buildProcessWorkspaceCommand(values)} && ${reportCommand}`;
}

export function buildReportArgs(projectId: string) {
  const args = ["report"];
  pushFlag(args, "--project-id", projectId);
  return args;
}

export function validateProcessForm(values: ProcessFormValues) {
  if (!values.projectId.trim() && values.mode === "full-scan") {
    return "project id is required for full scan mode";
  }

  if (values.mode !== "full-scan" && requiresModeValue(values.mode) && !values.modeValue.trim()) {
    return "this mode requires an input value";
  }

  return null;
}

export function getModeValueLabel(mode: ProcessMode) {
  switch (mode) {
    case "diff":
      return "base ref";
    case "files":
      return "file paths";
    case "files-from":
      return "list file";
    default:
      return "mode value";
  }
}

export function getModeValuePlaceholder(mode: ProcessMode) {
  switch (mode) {
    case "diff":
      return "origin/main";
    case "files":
      return "src/a.ts,src/b.ts";
    case "files-from":
      return "files.txt";
    default:
      return "";
  }
}

export function requiresModeValue(mode: ProcessMode) {
  return mode === "diff" || mode === "files" || mode === "files-from";
}

export function getProcessRunOptions(
  projectId: string,
  cwd = process.cwd(),
): ProcessRunOption[] {
  const dataDir = path.join(getDeepsecDir(cwd), "data");
  if (!existsSync(dataDir)) return [];

  const normalizedProjectId = projectId.trim();
  const projectDirs = normalizedProjectId
    ? [path.join(dataDir, normalizedProjectId)]
    : readdirSync(dataDir).map((entry) => path.join(dataDir, entry));

  return projectDirs
    .flatMap((projectDir) => readRuns(path.join(projectDir, "runs")))
    .sort((left, right) => {
      const leftTime = Date.parse(left.completedAt ?? left.createdAt ?? "");
      const rightTime = Date.parse(right.completedAt ?? right.createdAt ?? "");
      return rightTime - leftTime;
    })
    .map((run) => ({
      id: run.runId ?? "",
      label: capitalize(run.type ?? "run"),
      detail: formatRunOptionDetail(run),
    }))
    .filter((run) => run.id);
}

function getDefaultProjectId() {
  try {
    const config = readFileSync(path.join(getDeepsecDir(resolveWorkspaceRoot()), "deepsec.config.ts"), "utf8");
    const ids = Array.from(config.matchAll(/id:\s*["']([^"']+)["']/g), (match) => match[1]);
    return ids.length === 1 ? ids[0] ?? "" : "";
  } catch {
    return "";
  }
}

function readRuns(runsDir: string): DeepsecRun[] {
  if (!existsSync(runsDir)) return [];

  return readdirSync(runsDir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => readJsonFile<DeepsecRun>(path.join(runsDir, entry)))
    .filter((run): run is DeepsecRun => Boolean(run?.runId));
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function formatRunOptionDetail(run: DeepsecRun) {
  const segments = [formatTimestamp(run.completedAt ?? run.createdAt), capitalize(run.phase ?? "unknown")];

  if (typeof run.stats?.filesProcessed === "number") {
    segments.push(`${run.stats.filesProcessed} processed`);
  } else if (typeof run.stats?.filesScanned === "number") {
    segments.push(`${run.stats.filesScanned} scanned`);
  }

  if (typeof run.stats?.findingsCount === "number") {
    segments.push(`${run.stats.findingsCount} findings`);
  } else if (typeof run.stats?.candidatesFound === "number") {
    segments.push(`${run.stats.candidatesFound} candidates`);
  }

  return segments.filter(Boolean).join(" - ");
}

function formatTimestamp(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function pushFlag(args: string[], flag: string, value: string) {
  const normalized = value.trim();
  if (!normalized) return;
  args.push(flag, normalized);
}

function pushOptionalFlag(args: string[], flag: string, value: string) {
  if (value === "") return;

  const normalized = value.trim();
  args.push(flag);
  if (normalized) {
    args.push(normalized);
  }
}

function shellQuote(value: string) {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

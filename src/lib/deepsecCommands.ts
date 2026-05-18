import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDefaultModel, type ProcessAgent } from "./process";
import { getDeepsecDir, resolveWorkspaceRoot } from "./workspace";

export type CommandValue = string | boolean;
export type CommandValues = Record<string, CommandValue>;

export function getDefaultCommandValues(): CommandValues {
  return {
    projectId: getDefaultProjectId(),
    concurrency: String(Math.max(1, os.cpus().length - 1)),
    root: resolveWorkspaceRoot(),
  };
}

export function buildScanArgs(values: CommandValues) {
  const args = ["scan"];
  pushFlag(args, "--project-id", getString(values, "projectId"));
  pushFlag(args, "--root", getString(values, "root"));
  pushFlag(args, "--matchers", getString(values, "matchers"));
  return args;
}

export function buildTriageArgs(values: CommandValues) {
  const args = ["triage"];
  pushFlag(args, "--project-id", getString(values, "projectId"));
  pushFlag(args, "--severity", getString(values, "severity"));
  pushFlag(args, "--model", getString(values, "model"));
  pushFlag(args, "--limit", getString(values, "limit"));
  pushFlag(args, "--concurrency", getString(values, "concurrency"));
  if (getBoolean(values, "force")) args.push("--force");
  return args;
}

export function buildRevalidateArgs(values: CommandValues) {
  const args = ["revalidate"];
  pushFlag(args, "--project-id", getString(values, "projectId"));
  pushFlag(args, "--run-id", getString(values, "runId"));
  pushFlag(args, "--agent", getString(values, "agent"));
  pushFlag(args, "--model", getString(values, "model"));
  pushFlag(args, "--max-turns", getString(values, "maxTurns"));
  pushFlag(args, "--min-severity", getString(values, "minSeverity"));
  pushFlag(args, "--limit", getString(values, "limit"));
  pushFlag(args, "--concurrency", getString(values, "concurrency"));
  pushFlag(args, "--batch-size", getString(values, "batchSize"));
  pushFlag(args, "--filter", getString(values, "filter"));
  pushFlag(args, "--root", getString(values, "root"));
  pushFlag(args, "--manifest", getString(values, "manifest"));
  pushFlag(args, "--only-slugs", getString(values, "onlySlugs"));
  pushFlag(args, "--skip-slugs", getString(values, "skipSlugs"));
  if (getBoolean(values, "force")) args.push("--force");
  return args;
}

export function buildEnrichArgs(values: CommandValues) {
  const args = ["enrich"];
  pushFlag(args, "--project-id", getString(values, "projectId"));
  pushFlag(args, "--filter", getString(values, "filter"));
  pushFlag(args, "--min-severity", getString(values, "minSeverity"));
  pushFlag(args, "--concurrency", getString(values, "concurrency"));
  if (getBoolean(values, "force")) args.push("--force");
  return args;
}

export function buildExportArgs(values: CommandValues) {
  const args = ["export"];
  pushFlag(args, "--project-id", getString(values, "projectId"));
  pushFlag(args, "--format", getString(values, "format"));
  pushFlag(args, "--out", getString(values, "out"));
  pushFlag(args, "--min-severity", getString(values, "minSeverity"));
  pushFlag(args, "--only-severity", getString(values, "onlySeverity"));
  pushFlag(args, "--since", getString(values, "since"));
  pushFlag(args, "--only-slugs", getString(values, "onlySlugs"));
  pushFlag(args, "--skip-slugs", getString(values, "skipSlugs"));
  pushFlag(args, "--only-agent", getString(values, "onlyAgent"));
  pushFlag(args, "--only-marker", getString(values, "onlyMarker"));
  if (getBoolean(values, "discoveredToday")) args.push("--discovered-today");
  if (getBoolean(values, "onlyTruePositive")) args.push("--only-true-positive");
  if (getBoolean(values, "includeResolved")) args.push("--include-resolved");
  if (getBoolean(values, "requireOwner")) args.push("--require-owner");
  return args;
}

export function buildMetricsArgs(values: CommandValues) {
  const args = ["metrics"];
  pushFlag(args, "--project-id", getString(values, "projectId"));
  pushFlag(args, "--min-severity", getString(values, "minSeverity"));
  return args;
}

export function buildDeepsecCommand(args: string[]) {
  return ["deepsec", ...args].map(shellQuote).join(" ");
}

export function buildDeepsecWorkspaceCommand(args: string[]) {
  return `cd ${shellQuote(getDeepsecDir(resolveWorkspaceRoot()))} && ${buildDeepsecCommand(args)}`;
}

export function buildReportArgs(projectId: string) {
  const args = ["report"];
  pushFlag(args, "--project-id", projectId);
  return args;
}

export function buildWorkflowCommand(args: string[], includeReport: boolean) {
  const command = buildDeepsecWorkspaceCommand(args);
  const reportArgs = buildReportArgs(getFlagValue(args, "--project-id"));
  const reportCommand = buildDeepsecCommand(reportArgs);
  return includeReport ? `${command} && ${reportCommand}` : command;
}

export function getString(values: CommandValues, name: string) {
  const value = values[name];
  return typeof value === "string" ? value : "";
}

export function getBoolean(values: CommandValues, name: string) {
  return values[name] === true;
}

export function getAgentModel(values: CommandValues) {
  const agent = getString(values, "agent") as ProcessAgent;
  return getDefaultModel(agent === "claude" ? "claude" : "codex");
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

function pushFlag(args: string[], flag: string, value: string) {
  const normalized = value.trim();
  if (!normalized) return;
  args.push(flag, normalized);
}

function getFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) return "";
  return args[index + 1] ?? "";
}

function shellQuote(value: string) {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

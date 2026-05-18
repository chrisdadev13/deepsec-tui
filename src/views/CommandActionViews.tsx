import {
  buildEnrichArgs,
  buildExportArgs,
  buildMetricsArgs,
  buildRevalidateArgs,
  buildScanArgs,
  buildTriageArgs,
  getDefaultCommandValues,
  getString,
  type CommandValues,
} from "../lib/deepsecCommands";
import {
  DeepsecCommandView,
  MetricsRunOutput,
  type DeepsecCommandConfig,
} from "./DeepsecCommandView";

type CommandActionViewProps = {
  onBack: () => void;
};

export function ScanView({ onBack }: CommandActionViewProps) {
  return <DeepsecCommandView config={scanConfig} onBack={onBack} />;
}

export function TriageView({ onBack }: CommandActionViewProps) {
  return <DeepsecCommandView config={triageConfig} onBack={onBack} />;
}

export function RevalidateView({ onBack }: CommandActionViewProps) {
  return <DeepsecCommandView config={revalidateConfig} onBack={onBack} />;
}

export function EnrichView({ onBack }: CommandActionViewProps) {
  return <DeepsecCommandView config={enrichConfig} onBack={onBack} />;
}

export function ExportView({ onBack }: CommandActionViewProps) {
  return <DeepsecCommandView config={exportConfig} onBack={onBack} />;
}

export function MetricsView({ onBack }: CommandActionViewProps) {
  return <DeepsecCommandView config={metricsConfig} onBack={onBack} />;
}

const scanConfig: DeepsecCommandConfig = {
  title: "scan",
  heading: "What do you want to scan?",
  description: "Runs regex matchers to find candidate vulnerability sites.",
  initialValues: {
    ...getDefaultCommandValues(),
    matchers: "",
  },
  fields: [
    { name: "projectId", label: "project id", type: "text", placeholder: "auto" },
    { name: "matchers", label: "matchers", type: "text", placeholder: "all registered matchers" },
  ],
  advancedFields: [
    { name: "root", label: "root", type: "text", placeholder: "override project root" },
  ],
  buildArgs: buildScanArgs,
  buildSummary: (values) => {
    const matchers = getString(values, "matchers").trim();
    const root = getString(values, "root").trim();
    if (root) return `Will scan ${root} with ${matchers || "all matchers"}.`;
    return `Will scan the configured project root with ${matchers || "all matchers"}.`;
  },
};

const triageConfig: DeepsecCommandConfig = {
  title: "triage",
  heading: "Which findings should be triaged?",
  description: "Classifies findings by priority without reading source code.",
  initialValues: {
    ...getDefaultCommandValues(),
    severity: "MEDIUM",
    model: "claude-sonnet-4-6",
    force: false,
    limit: "",
  },
  fields: [
    { name: "severity", label: "severity", type: "text", placeholder: "MEDIUM" },
    { name: "model", label: "model", type: "text", placeholder: "claude-sonnet-4-6" },
    { name: "concurrency", label: "jobs", type: "text", width: 12 },
    { name: "force", label: "force", type: "boolean" },
  ],
  advancedFields: [
    { name: "projectId", label: "project id", type: "text", placeholder: "auto" },
    { name: "limit", label: "limit", type: "text", width: 12 },
  ],
  buildArgs: buildTriageArgs,
  buildSummary: (values) => {
    const severity = getString(values, "severity").trim() || "MEDIUM";
    const jobs = getString(values, "concurrency").trim() || "auto";
    const limit = getString(values, "limit").trim();
    return `Will triage ${severity} findings${limit ? `, max ${limit}` : ""} using ${jobs} jobs.`;
  },
  runReportAfter: true,
};

const revalidateConfig: DeepsecCommandConfig = {
  title: "revalidate",
  heading: "What should be revalidated?",
  description: "Re-checks existing findings to reduce false positives.",
  initialValues: {
    ...getDefaultCommandValues(),
    runId: "",
    agent: "codex",
    model: "",
    maxTurns: "",
    minSeverity: "",
    force: false,
    limit: "",
    batchSize: "",
    filter: "",
    manifest: "",
    onlySlugs: "",
    skipSlugs: "",
  },
  fields: [
    { name: "agent", label: "agent", type: "segmented", leftLabel: "codex", rightLabel: "claude" },
    { name: "minSeverity", label: "min severity", type: "text", placeholder: "all" },
    { name: "concurrency", label: "jobs", type: "text", width: 12 },
    { name: "force", label: "force", type: "boolean" },
  ],
  advancedFields: [
    { name: "projectId", label: "project id", type: "text", placeholder: "auto" },
    { name: "runId", label: "run id", type: "text", placeholder: "auto" },
    { name: "model", label: "model", type: "text", placeholder: "agent default" },
    { name: "maxTurns", label: "max turns", type: "text", width: 12 },
    { name: "limit", label: "limit", type: "text", width: 12 },
    { name: "batchSize", label: "batch size", type: "text", width: 12 },
    { name: "filter", label: "filter prefix", type: "text" },
    { name: "root", label: "root", type: "text" },
    { name: "manifest", label: "manifest", type: "text" },
    { name: "onlySlugs", label: "only slugs", type: "text" },
    { name: "skipSlugs", label: "skip slugs", type: "text" },
  ],
  buildArgs: buildRevalidateArgs,
  buildSummary: (values: CommandValues) => {
    const agent = getString(values, "agent") || "codex";
    const minSeverity = getString(values, "minSeverity").trim();
    const jobs = getString(values, "concurrency").trim() || "auto";
    return `Will revalidate ${minSeverity || "all"} findings with ${agent} using ${jobs} jobs.`;
  },
  runReportAfter: true,
};

const enrichConfig: DeepsecCommandConfig = {
  title: "enrich",
  heading: "Which findings should be enriched?",
  description: "Adds git committer metadata and plugin-backed ownership data.",
  initialValues: {
    ...getDefaultCommandValues(),
    minSeverity: "",
    filter: "",
    force: false,
  },
  fields: [
    { name: "projectId", label: "project id", type: "text", placeholder: "auto" },
    { name: "concurrency", label: "jobs", type: "text", width: 12 },
    { name: "force", label: "force", type: "boolean" },
  ],
  advancedFields: [
    { name: "minSeverity", label: "min severity", type: "text", placeholder: "all" },
    { name: "filter", label: "filter prefix", type: "text", placeholder: "app/api/" },
  ],
  buildArgs: buildEnrichArgs,
  buildSummary: (values) => {
    const severity = getString(values, "minSeverity").trim();
    const filter = getString(values, "filter").trim();
    return `Will enrich ${severity || "all"} findings${filter ? ` under ${filter}` : ""}.`;
  },
};

const exportConfig: DeepsecCommandConfig = {
  title: "export",
  heading: "How should findings be exported?",
  description: "Writes findings as JSON or a markdown directory for downstream review.",
  initialValues: {
    ...getDefaultCommandValues(),
    format: "md-dir",
    out: "./findings",
    minSeverity: "",
    onlySeverity: "",
    since: "",
    onlySlugs: "",
    skipSlugs: "",
    onlyAgent: "",
    onlyMarker: "",
    discoveredToday: false,
    onlyTruePositive: false,
    includeResolved: false,
    requireOwner: false,
  },
  fields: [
    { name: "projectId", label: "project id", type: "text", placeholder: "auto or csv" },
    { name: "format", label: "format", type: "segmented", leftLabel: "json", rightLabel: "md-dir" },
    { name: "out", label: "out", type: "text", placeholder: "./findings" },
    { name: "onlyTruePositive", label: "only true positive", type: "boolean" },
  ],
  advancedFields: [
    { name: "minSeverity", label: "min severity", type: "text", placeholder: "all" },
    { name: "onlySeverity", label: "only severity", type: "text", placeholder: "HIGH,CRITICAL" },
    { name: "since", label: "since", type: "text", placeholder: "2026-05-01" },
    { name: "onlySlugs", label: "only slugs", type: "text" },
    { name: "skipSlugs", label: "skip slugs", type: "text" },
    { name: "onlyAgent", label: "only agent", type: "text", placeholder: "codex" },
    { name: "onlyMarker", label: "only marker", type: "text", placeholder: "1" },
    { name: "discoveredToday", label: "discovered today", type: "boolean" },
    { name: "includeResolved", label: "include resolved", type: "boolean" },
    { name: "requireOwner", label: "require owner", type: "boolean" },
  ],
  buildArgs: buildExportArgs,
  buildSummary: (values) => {
    const format = getString(values, "format") || "md-dir";
    const out = getString(values, "out").trim() || "./findings";
    return `Will export findings as ${format} to ${out}.`;
  },
};

const metricsConfig: DeepsecCommandConfig = {
  title: "metrics",
  heading: "Which findings should be counted?",
  description: "Summarizes severities, vulnerability classes, and true-positive rates.",
  initialValues: {
    ...getDefaultCommandValues(),
    minSeverity: "",
  },
  fields: [
    { name: "projectId", label: "project id", type: "text", placeholder: "blank = all projects" },
    { name: "minSeverity", label: "min severity", type: "text", placeholder: "all" },
  ],
  buildArgs: buildMetricsArgs,
  buildSummary: (values) => {
    const projectId = getString(values, "projectId").trim();
    const minSeverity = getString(values, "minSeverity").trim();
    return `Will summarize ${projectId || "all configured projects"}${minSeverity ? ` at ${minSeverity}+` : ""}.`;
  },
  hideRunHeader: true,
  renderRunOutput: MetricsRunOutput,
};

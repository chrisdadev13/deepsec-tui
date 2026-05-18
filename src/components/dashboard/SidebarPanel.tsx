import { TextAttributes } from "@opentui/core";
import {
  dashboardColors as colors,
  type DashboardRun,
} from "../../lib/dashboardData";

type SidebarPanelProps = {
  projectId: string;
  rootPath: string;
  branch: string;
  path: string;
  files: number;
  analyzed: number;
  pending: number;
  totalFindings: number;
  generatedAt: string | null;
  techTags: string[];
  latestCandidates: number;
  runs: DashboardRun[];
  counts: Array<{ key: string; label: string; color: string; value: number }>;
};

export function SidebarPanel({
  projectId,
  rootPath,
  branch,
  path,
  files,
  analyzed,
  pending,
  totalFindings,
  generatedAt,
  techTags,
  latestCandidates,
  runs,
  counts,
}: SidebarPanelProps) {
  return (
    <box
      border={["right"]}
      backgroundColor="#1A1A1A"
      borderColor={colors.border}
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      width={48}
    >
      <box flexDirection="column" gap={0}>
        <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
          Project
        </text>
        <text style={{ fg: colors.text }}>{projectId}</text>
        {rootPath ? (
          <text attributes={TextAttributes.DIM} style={{ fg: colors.muted }}>
            {formatPath(rootPath)}
          </text>
        ) : null}
      </box>

      <box flexDirection="column" gap={0} marginTop={1}>
        <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
          Workspace
        </text>
        <SidebarMetric label="Branch" value={branch} />
        <SidebarMetric label="Path" value={path} />
      </box>

      <box flexDirection="column" gap={0} marginTop={1}>
        <SidebarMetric label="Files" value={String(files)} />
        <SidebarMetric label="Analyzed" value={String(analyzed)} />
        <SidebarMetric label="Pending" value={String(pending)} />
        <SidebarMetric label="Candidates" value={String(latestCandidates)} />
        <SidebarMetric label="Findings" value={String(totalFindings)} />
      </box>

      <box flexDirection="column" gap={0} marginTop={2}>
        <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
          Context
        </text>
        <SidebarMetric
          label="Tech"
          value={techTags.length ? techTags.join(", ") : "n/a"}
        />
        <SidebarMetric
          label="Report"
          value={generatedAt ? formatTimestamp(generatedAt) : "n/a"}
        />
      </box>

      <box flexDirection="column" gap={0} marginTop={2}>
        <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
          Findings
        </text>
        {counts.map((count) => (
          <box key={count.key} flexDirection="row" gap={1}>
            <text style={{ fg: count.color }}>*</text>
            <box flexGrow={1}>
              <text style={{ fg: colors.muted }}>{count.label}</text>
            </box>
            <text style={{ fg: count.color }}>{String(count.value)}</text>
          </box>
        ))}
      </box>

      <box flexDirection="column" gap={0} marginTop={2}>
        <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
          Runs
        </text>
        {runs.map((run) => (
          <box key={run.id} flexDirection="column" marginBottom={1}>
            <box flexDirection="row" gap={1}>
              <text style={{ fg: colors.faint }}>{run.id}</text>
              <text
                attributes={TextAttributes.BOLD}
                style={{ fg: colors.text }}
              >
                {run.label}
              </text>
              <text style={{ fg: colors.green }}>{run.state}</text>
            </box>
            <text attributes={TextAttributes.DIM} style={{ fg: colors.muted }}>
              {run.detail}
            </text>
          </box>
        ))}
      </box>
    </box>
  );
}

function SidebarMetric({ label, value }: { label: string; value: string }) {
  return (
    <box flexDirection="row">
      <box flexGrow={1} minWidth={0}>
        <text style={{ fg: colors.muted }}>{label}</text>
      </box>
      <text
        attributes={TextAttributes.BOLD}
        style={{ fg: colors.text }}
        wrapMode="word"
      >
        {value}
      </text>
    </box>
  );
}

function formatPath(rootPath: string) {
  return rootPath.replace(/^\/Users\/[^/]+/, "~");
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

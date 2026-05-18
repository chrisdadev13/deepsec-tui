import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import { ShortcutBar, type ShortcutHint } from "../chrome";
import { dashboardColors as colors, severityColors, type Finding } from "../../lib/dashboardData";
import { formatLabel } from "../../lib/format";

type DetailPanelProps = {
  finding: Finding | null;
  hasReport: boolean;
  reportGeneratedAt: string | null;
  shortcuts?: ShortcutHint[];
  width?: number | "auto" | `${number}%`;
};

export function DetailPanel({
  finding,
  hasReport,
  reportGeneratedAt,
  shortcuts = [{ key: "C", label: "fix prompt" }],
  width = 46,
}: DetailPanelProps) {
  if (!finding) {
    return (
      <box flexDirection="column" minHeight={0} width={width}>
        <PanelHeader leftLabel="Detail" />
        <box
          alignItems="center"
          justifyContent="center"
          flexDirection="column"
          flexGrow={1}
          paddingX={3}
          gap={0}
        >
          <text attributes={TextAttributes.BOLD} style={{ fg: colors.faint }}>
            {hasReport ? "Nothing to inspect" : "Waiting for report"}
          </text>
          {hasReport && reportGeneratedAt ? (
            <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
              {formatReportTime(reportGeneratedAt)}
            </text>
          ) : null}
          <box marginTop={1} flexDirection="column" alignItems="center" gap={0}>
            <text style={{ fg: colors.muted }}>
              {hasReport
                ? "No finding is selected."
                : "No report data yet."}
            </text>
            <text style={{ fg: colors.faint }}>
              {hasReport
                ? "The report contains zero findings."
                : "Run Process, then Report."}
            </text>
          </box>
          {!hasReport ? (
            <text attributes={TextAttributes.DIM} style={{ fg: colors.blue }}>
              deepsec report
            </text>
          ) : null}
        </box>
        <box flexGrow={1} />
      </box>
    );
  }

  const severityColor = severityColors[finding.severity];

  return (
    <box flexDirection="column" minHeight={0} width={width}>
      <PanelHeader leftLabel="Detail" />
      <box
        flexDirection="column"
        flexGrow={1}
        gap={1}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
      >
        <text attributes={TextAttributes.BOLD} wrapMode="word" style={{ fg: colors.bright }}>
          {finding.title}
        </text>

        <box flexDirection="column" gap={0}>
          <InlineField label="Severity" value={formatLabel(finding.severity)} color={severityColor} />
          <InlineField label="Confidence" value={formatLabel(finding.confidence)} />
          {finding.verdict ? (
            <InlineField
              label="Verdict"
              value={formatLabel(finding.verdict)}
              color={finding.verdict === "true-positive" ? colors.green : colors.yellow}
            />
          ) : null}
          {finding.tags.length ? (
            <InlineField
              label="Class"
              value={finding.tags.map((tag) => formatLabel(tag)).join(", ")}
            />
          ) : null}
        </box>

        <DetailSection label="Location">
          <text style={{ fg: colors.blue }}>
            {`${finding.filePath}${finding.lineNumbers.length ? ` - ${finding.lineNumbers.join(", ")}` : ""}`}
          </text>
        </DetailSection>

        <DetailSection label="Description">
          <text wrapMode="word" style={{ fg: colors.muted }}>
            {finding.description}
          </text>
        </DetailSection>

        <DetailSection label="Recommendation">
          <text wrapMode="word" style={{ fg: colors.muted }}>
            {finding.recommendation}
          </text>
        </DetailSection>

        <DetailSection label="Analysis">
          <text style={{ fg: colors.faint }}>{finding.analysis}</text>
          <text style={{ fg: colors.faint }}>{`Run ${finding.runId}`}</text>
        </DetailSection>

        <box flexGrow={1} />
      </box>
      <ShortcutBar shortcuts={shortcuts} label="finding" />
    </box>
  );
}

export function FindingDetailDialog({
  finding,
  hasReport,
  reportGeneratedAt,
  onClose,
}: DetailPanelProps & { onClose: () => void }) {
  return (
    <box
      alignItems="center"
      justifyContent="center"
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      zIndex={11}
    >
      <box
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        opacity={0.34}
        style={{ backgroundColor: "#000000" }}
        onMouseUp={onClose}
      />
      <box
        flexDirection="column"
        width={76}
        maxWidth="92%"
        maxHeight="90%"
        border={true}
        borderColor={colors.border}
        style={{ backgroundColor: colors.panel }}
      >
        <DetailPanel
          finding={finding}
          hasReport={hasReport}
          reportGeneratedAt={reportGeneratedAt}
          width="100%"
          shortcuts={[
            { key: "Esc", label: "close" },
            { key: "Enter", label: "close" },
            { key: "C", label: "fix prompt" },
          ]}
        />
      </box>
    </box>
  );
}

function formatReportTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function PanelHeader({ leftLabel }: { leftLabel: string }) {
  return (
    <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingY={1}>
      <text attributes={TextAttributes.BOLD} style={{ fg: colors.text }}>
        {leftLabel}
      </text>
    </box>
  );
}

function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <box flexDirection="column" gap={0}>
      <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
        {label}
      </text>
      {children}
    </box>
  );
}

function InlineField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <box flexDirection="row">
      <box width={11}>
        <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
          {label}
        </text>
      </box>
      <text style={{ fg: colors.faint }}>{":"}</text>
      <text style={{ fg: colors.faint }}> </text>
      <text style={{ fg: color ?? colors.muted }} wrapMode="word">
        {value}
      </text>
    </box>
  );
}

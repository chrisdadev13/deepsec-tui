import { type ScrollBoxRenderable, TextAttributes } from "@opentui/core";
import { useEffect, useRef } from "react";
import {
  dashboardColors as colors,
  type Finding,
  severityColors,
} from "../../lib/dashboardData";
import { formatLabel } from "../../lib/format";
import type { ShortcutHint } from "../chrome";
import { HeroLogo, ShortcutBar } from "../chrome";

type FindingsPanelProps = {
  findings: Finding[];
  selectedFindingIndex: number;
  totalFindings: number;
  searchQuery: string;
  searchFocused: boolean;
  sortLabel: string;
  sortReversed: boolean;
  onSearchChange: (query: string) => void;
  onSearchFocus: () => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  onCycleSort: () => void;
  onToggleSortDirection: () => void;
  shortcutHints: ShortcutHint[];
  hasReport: boolean;
  reportGeneratedAt: string | null;
  copiedFindingKey: string | null;
  copyError: string | null;
  onCopyPrompt: (finding: Finding) => void;
  onOpenDetails: (finding: Finding) => void;
};

export function FindingsPanel({
  findings,
  selectedFindingIndex,
  totalFindings,
  searchQuery,
  searchFocused,
  sortLabel,
  sortReversed,
  onSearchChange,
  onSearchFocus,
  onSearchSubmit,
  onClearSearch,
  onCycleSort,
  onToggleSortDirection,
  shortcutHints,
  hasReport,
  reportGeneratedAt,
  copiedFindingKey,
  copyError,
  onCopyPrompt,
  onOpenDetails,
}: FindingsPanelProps) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const findingShortcutHints = shortcutHints.some((shortcut) => shortcut.key.toLowerCase() === "enter")
    ? shortcutHints
    : [{ key: "Enter", label: "details" }, ...shortcutHints];

  useEffect(() => {
    scrollRef.current?.scrollTo(0);
  }, [searchQuery, sortLabel, sortReversed]);

  useEffect(() => {
    const finding = findings[selectedFindingIndex];
    if (!finding) return;

    scrollRef.current?.scrollChildIntoView(
      getFindingRowId(finding, selectedFindingIndex),
    );
  }, [selectedFindingIndex]);

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      minWidth={0}
      minHeight={0}
      overflow="hidden"
    >
      {/* <PanelHeader leftLabel="Findings" /> */}
      <FindingsToolbar
        visibleCount={findings.length}
        totalCount={totalFindings}
        searchQuery={searchQuery}
        searchFocused={searchFocused}
        sortLabel={sortLabel}
        sortReversed={sortReversed}
        onSearchChange={onSearchChange}
        onSearchFocus={onSearchFocus}
        onSearchSubmit={onSearchSubmit}
        onClearSearch={onClearSearch}
        onCycleSort={onCycleSort}
        onToggleSortDirection={onToggleSortDirection}
      />
      <scrollbox
        ref={scrollRef}
        flexGrow={1}
        flexShrink={1}
        flexBasis={0}
        minHeight={0}
        minWidth={0}
        scrollY={true}
        paddingTop={0}
        paddingLeft={1}
        paddingRight={1}
        paddingBottom={1}
      >
        {findings.length ? (
          findings.map((finding, index) => (
            <FindingRow
              key={getFindingKey(finding)}
              id={getFindingRowId(finding, index)}
              finding={finding}
              isSelected={index === selectedFindingIndex}
              copied={copiedFindingKey === getFindingKey(finding)}
              onCopyPrompt={onCopyPrompt}
              onOpenDetails={onOpenDetails}
            />
          ))
        ) : (
          <EmptyFindings
            hasReport={hasReport}
            reportGeneratedAt={reportGeneratedAt}
            searchQuery={searchQuery}
            totalFindings={totalFindings}
          />
        )}
      </scrollbox>

      {findingShortcutHints.length ? <ShortcutBar shortcuts={findingShortcutHints} /> : null}
      {copyError ? (
        <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
          <text attributes={TextAttributes.DIM} style={{ fg: colors.red }}>
            {copyError}
          </text>
        </box>
      ) : null}
    </box>
  );
}

function FindingsToolbar({
  visibleCount,
  totalCount,
  searchQuery,
  searchFocused,
  sortLabel,
  sortReversed,
  onSearchChange,
  onSearchFocus,
  onSearchSubmit,
  onClearSearch,
  onCycleSort,
  onToggleSortDirection,
}: {
  visibleCount: number;
  totalCount: number;
  searchQuery: string;
  searchFocused: boolean;
  sortLabel: string;
  sortReversed: boolean;
  onSearchChange: (query: string) => void;
  onSearchFocus: () => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  onCycleSort: () => void;
  onToggleSortDirection: () => void;
}) {
  const countLabel = `${visibleCount}/${totalCount}`;
  const countText = `${countLabel} findings`;
  const countWidth = `${totalCount}/${totalCount} findings`.length;
  const hasSearchQuery = Boolean(searchQuery);

  return (
    <box
      flexDirection="column"
      flexShrink={0}
      minHeight={4}
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={0}
      paddingTop={1}
      gap={0}
    >
      <box
        flexDirection="row"
        alignItems="center"
        flexShrink={0}
        minHeight={1}
        minWidth={0}
        flexWrap="wrap"
        gap={1}
      >
        <box
          flexDirection="row"
          alignItems="center"
          flexGrow={1}
          flexShrink={1}
          minWidth={0}
          flexWrap="wrap"
          gap={1}
        >
          <ToolbarButton
            shortcut="/"
            label="search"
            active={searchFocused || Boolean(searchQuery)}
            onMouseUp={onSearchFocus}
          />
          <ToolbarButton
            shortcut="s"
            label={sortLabel}
            active={true}
            onMouseUp={onCycleSort}
          />
          <ToolbarButton
            shortcut="r"
            label={sortReversed ? "reverse" : "forward"}
            active={sortReversed}
            onMouseUp={onToggleSortDirection}
          />
          <ToolbarButton
            shortcut="esc"
            label="clear"
            active={false}
            onMouseUp={hasSearchQuery ? onClearSearch : () => undefined}
          />
        </box>
        <box width={countWidth} minWidth={countWidth} flexShrink={0}>
          <text
            attributes={TextAttributes.DIM}
            wrapMode="none"
            style={{ fg: colors.faint }}
          >
            {countText}
          </text>
        </box>
      </box>
      <box
        marginTop={1}
        width="100%"
        flexShrink={0}
        flexDirection="row"
        alignItems="center"
        height={1}
        minHeight={1}
        minWidth={0}
        paddingLeft={1}
        paddingRight={1}
        style={{
          backgroundColor: searchFocused ? colors.borderSoft : colors.panel,
        }}
        onMouseUp={onSearchFocus}
      >
        {searchFocused && !searchQuery ? (
          <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
            search: 
          </text>
        ) : null}
        <input
          focused={searchFocused}
          placeholder={searchFocused ? "" : "search title, path, severity, tag"}
          placeholderColor={colors.faint}
          backgroundColor={colors.panel}
          focusedBackgroundColor={colors.borderSoft}
          textColor={colors.text}
          focusedTextColor={colors.bright}
          value={searchQuery}
          flexGrow={1}
          minWidth={0}
          width="auto"
          onInput={onSearchChange}
          onSubmit={onSearchSubmit}
        />
      </box>
    </box>
  );
}

function ToolbarButton({
  shortcut,
  label,
  active,
  onMouseUp,
}: {
  shortcut: string;
  label: string;
  active: boolean;
  onMouseUp: () => void;
}) {
  const width = shortcut.length + label.length + 3;
  const backgroundColor = active ? colors.borderSoft : colors.panel;
  const shortcutColor = active ? colors.blue : colors.faint;
  const labelColor = active ? colors.text : colors.muted;

  return (
    <box
      flexDirection="row"
      width={width}
      maxWidth={width}
      minWidth={Math.min(width, shortcut.length + 2)}
      flexShrink={1}
      paddingLeft={1}
      paddingRight={1}
      style={{ backgroundColor }}
      onMouseUp={onMouseUp}
    >
      <text
        attributes={TextAttributes.BOLD}
        wrapMode="none"
        style={{ fg: shortcutColor }}
      >
        {shortcut}
      </text>
      <text
        flexShrink={1}
        truncate={true}
        wrapMode="none"
        style={{ fg: labelColor }}
      >
        {` ${label}`}
      </text>
    </box>
  );
}

function EmptyFindings({
  hasReport,
  reportGeneratedAt,
  searchQuery,
  totalFindings,
}: {
  hasReport: boolean;
  reportGeneratedAt: string | null;
  searchQuery: string;
  totalFindings: number;
}) {
  const hasFilteredResults = Boolean(searchQuery && totalFindings > 0);

  return (
    <box
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
      flexGrow={1}
      paddingX={4}
      gap={0}
    >
      <box height={5} alignItems="center" justifyContent="center">
        <HeroLogo />
      </box>
      <text attributes={TextAttributes.BOLD} style={{ fg: colors.green }}>
        {hasFilteredResults
          ? "No matches"
          : hasReport
            ? "Clean report"
            : "No report yet"}
      </text>
      <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
        {hasFilteredResults
          ? `No findings match \"${searchQuery}\"`
          : hasReport && reportGeneratedAt
            ? `Generated ${formatReportTime(reportGeneratedAt)}`
            : "reports/report.json is missing"}
      </text>
      <box marginTop={1} flexDirection="column" alignItems="center" gap={0}>
        <text style={{ fg: colors.muted }}>
          {hasReport
            ? hasFilteredResults
              ? "Press Esc to clear the search."
              : "Latest report contains zero findings."
            : "The dashboard reads generated reports."}
        </text>
        <text style={{ fg: colors.faint }}>
          {hasReport
            ? "Run Process to investigate another scope."
            : "Run Scan, Process, then Report."}
        </text>
      </box>
        <text attributes={TextAttributes.DIM} style={{ fg: colors.blue }}>
          {hasReport ? "Ctrl+P commands" : "scan -> process -> report"}
        </text>
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

function FindingRow({
  finding,
  isSelected,
  copied,
  onCopyPrompt,
  onOpenDetails,
  id,
}: {
  finding: Finding;
  isSelected: boolean;
  copied: boolean;
  onCopyPrompt: (finding: Finding) => void;
  onOpenDetails: (finding: Finding) => void;
  id: string;
}) {
  const severityColor = severityColors[finding.severity];
  const location = formatFindingLocation(finding);
  const primaryTag = formatPrimaryTag(finding.tags);
  const metadata = buildFindingMetadata(finding, primaryTag);
  const actionShortcut = "enter";
  const actionLabel = copied ? "copied" : "details";
  const actionWidth = copied
    ? actionLabel.length + 2
    : actionShortcut.length + actionLabel.length + 3;

  return (
    <box
      id={id}
      flexDirection="row"
      alignItems="stretch"
      minHeight={5}
      minWidth={0}
      paddingLeft={0}
      paddingRight={0}
      paddingTop={1}
      paddingBottom={1}
      style={{ backgroundColor: colors.bg }}
    >
      <box width={1} minWidth={1}>
        <text style={{ fg: isSelected ? colors.blue : colors.bg }}>|</text>
      </box>
      <box width={1} minWidth={1} />
      <box
        flexDirection="row"
        flexGrow={1}
        flexShrink={1}
        minWidth={0}
        paddingLeft={1}
        paddingRight={2}
        style={{ backgroundColor: isSelected ? colors.borderSoft : colors.bg }}
      >
        <box
          flexDirection="column"
          width={12}
          minWidth={12}
          flexShrink={0}
          gap={0}
          paddingTop={0}
        >
          <text attributes={TextAttributes.BOLD} style={{ fg: severityColor }}>
            {formatLabel(finding.severity)}
          </text>
          <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
            {formatLabel(finding.confidence)}
          </text>
        </box>
        <box flexDirection="column" flexGrow={1} minWidth={0} gap={0}>
          <text
            attributes={isSelected ? TextAttributes.BOLD : undefined}
            truncate={true}
            wrapMode="none"
            style={{ fg: isSelected ? colors.bright : colors.text }}
          >
            {finding.title}
          </text>
          <text
            attributes={TextAttributes.DIM}
            truncate={true}
            wrapMode="none"
            style={{ fg: colors.muted }}
          >
            {location}
          </text>
          <text
            attributes={TextAttributes.DIM}
            truncate={true}
            wrapMode="none"
            style={{ fg: colors.faint }}
          >
            {metadata}
          </text>
        </box>
        <box
          alignItems="flex-end"
          justifyContent="center"
          width={actionWidth + 2}
          minWidth={actionWidth + 2}
          paddingLeft={1}
        >
          <box
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            width={actionWidth}
            paddingLeft={1}
            paddingRight={1}
            style={{
              backgroundColor: copied ? colors.green : isSelected ? colors.panel : colors.borderSoft,
            }}
            onMouseUp={() => onOpenDetails(finding)}
          >
            {copied ? (
              <text attributes={TextAttributes.BOLD} style={{ fg: colors.bg }}>
                {actionLabel}
              </text>
            ) : (
              <>
                <text attributes={TextAttributes.BOLD} style={{ fg: colors.blue }}>
                  {actionShortcut}
                </text>
                <text attributes={TextAttributes.DIM} style={{ fg: colors.muted }}>
                  {` ${actionLabel}`}
                </text>
              </>
            )}
          </box>
        </box>
      </box>
    </box>
  );
}

function buildFindingMetadata(finding: Finding, primaryTag: string | null) {
  const segments = [formatLabel(finding.confidence)];

  if (finding.verdict) {
    segments.push(formatLabel(finding.verdict));
  }

  if (primaryTag) {
    segments.push(primaryTag);
  }

  return segments.join("  ");
}

function formatFindingLocation(finding: Finding) {
  if (!finding.lineNumbers.length) return finding.filePath;

  const lineLabel = finding.lineNumbers.length === 1 ? "line" : "lines";
  return `${finding.filePath} - ${lineLabel} ${finding.lineNumbers.join(", ")}`;
}

function formatPrimaryTag(tags: string[]) {
  const primaryTag = tags[0];
  if (!primaryTag) return null;

  const suffix = tags.length > 1 ? ` +${tags.length - 1}` : "";
  const label = formatLabel(primaryTag);
  const maxLabelLength = 22 - suffix.length;
  const compactLabel =
    label.length > maxLabelLength
      ? `${label.slice(0, Math.max(maxLabelLength - 1, 1))}~`
      : label;

  return `${compactLabel}${suffix}`;
}

function getFindingRowId(finding: Finding, index: number) {
  return `finding-${index}-${getFindingKey(finding)}`;
}

function getFindingKey(finding: Finding) {
  return [finding.filePath, finding.title, finding.lineNumbers.join(",")].join(":");
}

function PanelHeader({
  leftLabel,
  rightLabel,
}: {
  leftLabel: string;
  rightLabel?: string;
}) {
  return (
    <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingY={1}>
      <box flexGrow={1}>
        <text attributes={TextAttributes.BOLD} style={{ fg: colors.text }}>
          {leftLabel}
        </text>
      </box>
      {rightLabel ? (
        <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
          {rightLabel}
        </text>
      ) : null}
    </box>
  );
}

import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useState } from "react";
import { CommandPalette } from "../components/actions/CommandPalette";
import type { ShortcutHint } from "../components/chrome";
import {
  DetailPanel,
  FindingDetailDialog,
} from "../components/dashboard/DetailPanel";
import { FindingsPanel } from "../components/dashboard/FindingsPanel";
import { SidebarPanel } from "../components/dashboard/SidebarPanel";
import { useCommandPalette } from "../hooks/useCommandPalette";
import { useFindingSelection } from "../hooks/useFindingSelection";
import { useWorkspaceStatus } from "../hooks/useWorkspaceStatus";
import { buildActions } from "../lib/actions";
import {
  dashboardColors as colors,
  type Finding,
  getDashboardData,
} from "../lib/dashboardData";
import {
  buildSeverityCounts,
  sortFindingsBySeverity,
} from "../lib/dashboardSummary";
import { copyFindingPromptToClipboard } from "../lib/findingPrompt";

type FindingSort = "severity" | "title" | "path";

const findingSorts: FindingSort[] = ["severity", "title", "path"];

type DashboardViewProps = {
  onOpenAction: (label: string) => void;
  keyboardDisabled?: boolean;
};

const SHOW_DETAIL_MIN_WIDTH = 120;
const SHOW_SIDEBAR_MIN_WIDTH = 84;

export function DashboardView({
  onOpenAction,
  keyboardDisabled = false,
}: DashboardViewProps) {
  const { width } = useTerminalDimensions();
  const { branchName, displayPath, workspaceState } = useWorkspaceStatus();
  const dashboardData = useMemo(() => getDashboardData(), []);
  const [findingSearch, setFindingSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [findingSort, setFindingSort] = useState<FindingSort>("severity");
  const [sortReversed, setSortReversed] = useState(false);
  const [copiedFindingKey, setCopiedFindingKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [detailDialogFinding, setDetailDialogFinding] = useState<Finding | null>(null);
  const detailDialogOpen = Boolean(detailDialogFinding);
  const actions = useMemo(
    () => buildActions(workspaceState, { includeInitAction: false }),
    [workspaceState],
  );
  const statusShortcuts = useMemo<ShortcutHint[]>(
    () =>
      actions
        .filter((action) => action.label !== "process")
        .map((action) => ({
          key: action.shortcut.replace("ctrl-", "Ctrl+"),
          label: action.label,
        }))
        .concat(
          { key: "Enter", label: "details" },
          { key: "Ctrl+P", label: "commands" },
        ),
    [actions],
  );
  const counts = useMemo(
    () => buildSeverityCounts(dashboardData.findings),
    [dashboardData],
  );
  const visibleFindings = useMemo(
    () =>
      sortFindings(
        filterFindings(dashboardData.findings, findingSearch),
        findingSort,
        sortReversed,
      ),
    [dashboardData.findings, findingSearch, findingSort, sortReversed],
  );
  const commandPalette = useCommandPalette({
    actions,
    keyboardDisabled: keyboardDisabled || detailDialogOpen,
    paletteActionLabel: "process",
    onOpenAction,
  });
  const { selectedFinding, selectedFindingIndex } = useFindingSelection(
    visibleFindings,
    keyboardDisabled ||
      commandPalette.isOpen ||
      detailDialogOpen ||
      searchFocused,
  );
  const showDetailPanel = width >= SHOW_DETAIL_MIN_WIDTH;
  const showSidebarPanel = width >= SHOW_SIDEBAR_MIN_WIDTH;

  useEffect(() => {
    if (!copiedFindingKey && !copyError) return;

    const timeout = setTimeout(() => {
      setCopiedFindingKey(null);
      setCopyError(null);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [copiedFindingKey, copyError]);

  function cycleFindingSort() {
    const currentIndex = findingSorts.indexOf(findingSort);
    setFindingSort(
      findingSorts[(currentIndex + 1) % findingSorts.length] ?? "severity",
    );
  }

  function copyFindingPrompt(finding = selectedFinding) {
    if (!finding) return;

    try {
      copyFindingPromptToClipboard(finding);
      setCopiedFindingKey(getFindingKey(finding));
      setCopyError(null);
    } catch {
      setCopiedFindingKey(null);
      setCopyError("Clipboard unavailable");
    }
  }

  function openFindingDetails(finding = selectedFinding) {
    if (!finding) return;
    setDetailDialogFinding(finding);
  }

  useKeyboard((key) => {
    if (keyboardDisabled || commandPalette.isOpen) return;

    if (detailDialogOpen) {
      if (
        key.name === "escape" ||
        key.name === "return" ||
        key.name === "enter"
      ) {
        setDetailDialogFinding(null);
        return;
      }

      if (key.name === "c") {
        copyFindingPrompt();
      }

      return;
    }

    if (searchFocused) {
      if (key.name === "escape") {
        if (findingSearch) {
          setFindingSearch("");
        } else {
          setSearchFocused(false);
        }
        return;
      }

      if (key.name === "return") {
        setSearchFocused(false);
      }

      return;
    }

    if (key.ctrl) return;

    if ((key.name === "return" || key.name === "enter") && selectedFinding) {
      openFindingDetails();
      return;
    }

    if (key.name === "/" || key.name === "slash") {
      setSearchFocused(true);
      return;
    }

    if (key.name === "s") {
      cycleFindingSort();
      return;
    }

    if (key.name === "r") {
      setSortReversed((current) => !current);
      return;
    }

    if (key.name === "c") {
      copyFindingPrompt();
      return;
    }

    if (key.name === "escape" && findingSearch) {
      setFindingSearch("");
    }
  });

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      minHeight={0}
      style={{ backgroundColor: colors.bg }}
    >
      <box flexDirection="row" flexGrow={1} minHeight={0}>
        <FindingsPanel
          findings={visibleFindings}
          selectedFindingIndex={selectedFindingIndex}
          totalFindings={dashboardData.findings.length}
          searchQuery={findingSearch}
          searchFocused={searchFocused}
          sortLabel={formatFindingSort(findingSort)}
          sortReversed={sortReversed}
          onSearchChange={setFindingSearch}
          onSearchFocus={() => setSearchFocused(true)}
          onSearchSubmit={() => setSearchFocused(false)}
          onClearSearch={() => setFindingSearch("")}
          onCycleSort={cycleFindingSort}
          onToggleSortDirection={() => setSortReversed((current) => !current)}
          shortcutHints={statusShortcuts}
          hasReport={Boolean(dashboardData.generatedAt)}
          reportGeneratedAt={dashboardData.generatedAt}
          copiedFindingKey={copiedFindingKey}
          copyError={copyError}
          onCopyPrompt={copyFindingPrompt}
          onOpenDetails={openFindingDetails}
        />
        {showSidebarPanel ? (
          <SidebarPanel
            counts={counts}
            projectId={dashboardData.projectId}
            rootPath={dashboardData.rootPath}
            branch={branchName}
            path={displayPath}
            files={dashboardData.files}
            analyzed={dashboardData.analyzed}
            pending={dashboardData.pending}
            totalFindings={dashboardData.totalFindings}
            generatedAt={dashboardData.generatedAt}
            techTags={dashboardData.techTags}
            latestCandidates={dashboardData.latestCandidates}
            runs={dashboardData.runs}
          />
        ) : null}
        {/* {showDetailPanel ? ( */}
        {/*   <DetailPanel */}
        {/*     finding={selectedFinding} */}
        {/*     hasReport={Boolean(dashboardData.generatedAt)} */}
        {/*     reportGeneratedAt={dashboardData.generatedAt} */}
        {/*   /> */}
        {/* ) : null} */}
      </box>

      {commandPalette.isOpen ? (
        <CommandPalette
          query={commandPalette.query}
          selectedAction={commandPalette.selectedAction}
          sections={commandPalette.sections}
          filteredActions={commandPalette.filteredActions}
          paletteAction={commandPalette.paletteAction}
          onQueryChange={commandPalette.setQuery}
          onSubmitSelected={commandPalette.submitSelected}
        />
      ) : null}

      {detailDialogFinding ? (
        <FindingDetailDialog
          finding={detailDialogFinding}
          hasReport={Boolean(dashboardData.generatedAt)}
          reportGeneratedAt={dashboardData.generatedAt}
          onClose={() => setDetailDialogFinding(null)}
        />
      ) : null}
    </box>
  );
}

function getFindingKey(
  finding: ReturnType<typeof getDashboardData>["findings"][number],
) {
  return [finding.filePath, finding.title, finding.lineNumbers.join(",")].join(
    ":",
  );
}

function filterFindings(
  findings: ReturnType<typeof getDashboardData>["findings"],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return findings;

  return findings.filter((finding) => {
    const haystack = [
      finding.title,
      finding.filePath,
      finding.severity,
      finding.confidence,
      finding.verdict ?? "",
      finding.tags.join(" "),
      finding.lineNumbers.join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function sortFindings(
  findings: ReturnType<typeof getDashboardData>["findings"],
  sort: FindingSort,
  reversed: boolean,
) {
  const sorted =
    sort === "severity"
      ? sortFindingsBySeverity(findings)
      : findings
          .slice()
          .sort((left, right) => compareFindings(left, right, sort));

  return reversed ? sorted.reverse() : sorted;
}

function compareFindings(
  left: ReturnType<typeof getDashboardData>["findings"][number],
  right: ReturnType<typeof getDashboardData>["findings"][number],
  sort: Exclude<FindingSort, "severity">,
) {
  const leftValue = sort === "title" ? left.title : left.filePath;
  const rightValue = sort === "title" ? right.title : right.filePath;
  return leftValue.localeCompare(rightValue, undefined, {
    sensitivity: "base",
  });
}

function formatFindingSort(sort: FindingSort) {
  return sort === "path" ? "path" : sort;
}

import type { WorkspaceState } from "./workspace";

export type ActionDef = {
  label: string;
  shortcut: string;
  description: string;
  disabled?: boolean;
};

export function buildActions(
  workspaceState: WorkspaceState,
  options: { includeInitAction?: boolean } = {},
): ActionDef[] {
  const includeInitAction = options.includeInitAction ?? true;

  return [
    includeInitAction && !workspaceState.hasWorkspace
      ? {
          label: "init",
          shortcut: "ctrl-i",
          description: "scaffold .deepsec/ then open scan options",
        }
      : null,
    {
      label: "scan",
      shortcut: "ctrl-s",
      description: "find candidate sites with regex matchers (free, no AI)",
      disabled: !workspaceState.hasWorkspace,
    },
    {
      label: "process",
      shortcut: "ctrl-p",
      description: "AI investigation - emits findings and recommendations",
      disabled: !workspaceState.hasCandidates,
    },
    {
      label: "triage",
      shortcut: "ctrl-t",
      description: "classify findings by priority (P0 / P1 / P2)",
      disabled: !workspaceState.hasFindings,
    },
    {
      label: "revalidate",
      shortcut: "ctrl-v",
      description: "re-check findings to cut false positive rate",
      disabled: !workspaceState.hasFindings,
    },
    {
      label: "enrich",
      shortcut: "ctrl-e",
      description: "attach git committer and ownership metadata to findings",
      disabled: !workspaceState.hasFindings,
    },
    {
      label: "export",
      shortcut: "ctrl-x",
      description: "write findings to json or markdown for downstream review",
      disabled: !workspaceState.hasFindings,
    },
    {
      label: "metrics",
      shortcut: "ctrl-m",
      description: "summarize counts and true-positive rates across findings",
      disabled: !workspaceState.hasWorkspace,
    },
  ].filter(Boolean) as ActionDef[];
}

export function getDisabledReason(label: string): string {
  switch (label) {
    case "process":
    case "triage":
    case "revalidate":
    case "enrich":
    case "export":
      return "run scan first to generate candidates";
    case "metrics":
      return "initialize a workspace first";
    default:
      return "initialize a workspace first";
  }
}

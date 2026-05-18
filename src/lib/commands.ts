import type { ActionDef } from "./actions";

export type CommandSection = {
  label: string;
  actions: ActionDef[];
};

const commandGroups = [
  {
    label: "analysis",
    actionLabels: ["scan", "process", "triage", "revalidate", "enrich"],
  },
  {
    label: "reporting",
    actionLabels: ["export", "metrics"],
  },
];

export function buildCommandSections(actions: ActionDef[]): CommandSection[] {
  return commandGroups
    .map((group) => ({
      label: group.label,
      actions: group.actionLabels
        .map((label) => actions.find((action) => action.label === label) ?? null)
        .filter(Boolean) as ActionDef[],
    }))
    .filter((group) => group.actions.length > 0);
}

export function filterActions(actions: ActionDef[], query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) return actions;

  return actions.filter((action) => {
    const haystack = `${action.label} ${action.description} ${action.shortcut}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

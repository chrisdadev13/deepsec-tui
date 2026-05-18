import { useKeyboard } from "@opentui/react";
import { useMemo, useState } from "react";
import type { ActionDef } from "../lib/actions";

export function useActionSelection(
  actions: ActionDef[],
  onOpenAction: (label: string) => void,
  keyboardDisabled = false,
) {
  const enabledActions = useMemo(
    () => actions.filter((action) => !action.disabled),
    [actions],
  );
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(
    enabledActions[0]?.label ?? null,
  );

  const activeAction = hoveredAction ?? selectedAction;
  const activeActionDef = actions.find((action) => action.label === activeAction);

  function selectAction(label: string) {
    setHoveredAction(label);
    setSelectedAction(label);
    onOpenAction(label);
  }

  useKeyboard((key) => {
    if (keyboardDisabled) return;

    if (!enabledActions.length) return;

    if (key.name === "up" || key.name === "down") {
      const current = activeAction ?? enabledActions[0]?.label ?? null;
      if (!current) return;

      const index = enabledActions.findIndex((action) => action.label === current);
      const direction = key.name === "down" ? 1 : -1;
      const next = enabledActions[(index + direction + enabledActions.length) % enabledActions.length]!.label;
      setHoveredAction(next);
      setSelectedAction(next);
    }

    if (key.ctrl) {
      const matched = actions.find(
        (action) => !action.disabled && action.shortcut === `ctrl-${key.name}`,
      );
      if (matched) {
        setHoveredAction(matched.label);
        setSelectedAction(matched.label);
        onOpenAction(matched.label);
      }
    }

    if (key.name === "return" && selectedAction) {
      const action = actions.find((item) => item.label === selectedAction);
      if (action && !action.disabled) {
        onOpenAction(action.label);
      }
    }
  });

  return {
    activeAction,
    activeActionDef,
    hoveredAction,
    selectAction,
    setHoveredAction,
  };
}

import { useKeyboard } from "@opentui/react";
import { useEffect, useMemo, useState } from "react";
import type { ActionDef } from "../lib/actions";
import { buildCommandSections, filterActions } from "../lib/commands";

export function useCommandPalette({
  actions,
  keyboardDisabled = false,
  paletteActionLabel,
  onOpenAction,
}: {
  actions: ActionDef[];
  keyboardDisabled?: boolean;
  paletteActionLabel: string;
  onOpenAction: (label: string) => void;
}) {
  const paletteAction = actions.find((action) => action.label === paletteActionLabel) ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState(
    paletteAction?.label ?? actions[0]?.label ?? paletteActionLabel,
  );
  const filteredActions = useMemo(() => filterActions(actions, query), [actions, query]);
  const sections = useMemo(
    () => buildCommandSections(filteredActions),
    [filteredActions],
  );

  function open() {
    setQuery("");
    setSelectedAction(paletteAction?.label ?? actions[0]?.label ?? paletteActionLabel);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

  function runAction(action: ActionDef) {
    if (action.disabled) return;

    setIsOpen(false);
    onOpenAction(action.label);
  }

  function submitSelected() {
    const matched = filteredActions.find((action) => action.label === selectedAction);
    if (matched) {
      runAction(matched);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const selectedStillVisible = filteredActions.some(
      (action) => action.label === selectedAction,
    );
    if (!selectedStillVisible) {
      setSelectedAction(filteredActions[0]?.label ?? "");
    }
  }, [filteredActions, isOpen, selectedAction]);

  useKeyboard((key) => {
    if (keyboardDisabled) return;

    if (isOpen) {
      if (key.name === "escape") {
        close();
        return;
      }

      if (key.name === "up" || key.name === "down") {
        if (filteredActions.length === 0) return;

        const currentIndex = filteredActions.findIndex(
          (action) => action.label === selectedAction,
        );
        const direction = key.name === "down" ? 1 : -1;
        const nextIndex = (currentIndex + direction + filteredActions.length) % filteredActions.length;
        setSelectedAction(filteredActions[nextIndex]?.label ?? selectedAction);
        return;
      }

      if (key.ctrl) {
        const matched = actions.find((action) => action.shortcut === `ctrl-${key.name}`);
        if (matched) {
          setSelectedAction(matched.label);
          runAction(matched);
          return;
        }
      }

      if (key.name === "return") {
        submitSelected();
        return;
      }

      return;
    }

    if (key.ctrl) {
      const matched = actions.find((action) => action.shortcut === `ctrl-${key.name}`);
      if (!matched) return;

      if (matched.label === paletteActionLabel) {
        open();
        return;
      }

      runAction(matched);
    }
  });

  return {
    filteredActions,
    isOpen,
    open,
    paletteAction,
    query,
    sections,
    selectedAction,
    setQuery,
    submitSelected,
  };
}

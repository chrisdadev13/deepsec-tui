import { useMemo } from "react";
import { ActionList } from "../components/actions/ActionList";
import type { ShortcutHint } from "../components/chrome";
import { Footer, HeroLogo, StatusBar } from "../components/chrome";
import { useActionSelection } from "../hooks/useActionSelection";
import { useWorkspaceStatus } from "../hooks/useWorkspaceStatus";
import { buildActions } from "../lib/actions";
import { formatShortcut } from "../lib/format";

type InitViewProps = {
  keyboardDisabled?: boolean;
  onOpenAction: (label: string) => void;
};

export function InitView({ keyboardDisabled = false, onOpenAction }: InitViewProps) {
  const { branchName, displayPath, workspaceState } = useWorkspaceStatus();
  const actions = useMemo(
    () => buildActions(workspaceState, { includeInitAction: true }),
    [workspaceState],
  );
  const {
    activeAction,
    activeActionDef,
    hoveredAction,
    selectAction,
    setHoveredAction,
  } = useActionSelection(actions, onOpenAction, keyboardDisabled);
  const footerShortcuts = useMemo<ShortcutHint[]>(() => {
    if (!activeActionDef || activeActionDef.disabled) return [];

    const actionLabel = activeActionDef.label === "init"
      ? "initialize"
      : `run ${activeActionDef.label}`;

    return [
      { key: formatShortcut(activeActionDef.shortcut), label: actionLabel },
      { key: "Enter", label: actionLabel },
    ];
  }, [activeActionDef]);

  return (
    <box flexDirection="column" flexGrow={1}>
      <StatusBar branch={branchName} path={displayPath} />

      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <box alignItems="center" gap={2} flexDirection="column">
          <HeroLogo />
          <ActionList
            actions={actions}
            activeAction={activeAction}
            hoveredAction={hoveredAction}
            onHover={setHoveredAction}
            onSelect={selectAction}
          />
        </box>
      </box>

      <Footer
        hint={activeActionDef ? activeActionDef.description : "select an action to get started"}
        shortcuts={footerShortcuts}
      />
    </box>
  );
}

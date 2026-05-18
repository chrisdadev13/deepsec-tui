import { TextAttributes } from "@opentui/core";
import type { ActionDef } from "../../lib/actions";
import { getDisabledReason } from "../../lib/actions";
import type { CommandSection } from "../../lib/commands";
import { dashboardColors as colors } from "../../lib/dashboardData";

type CommandPaletteProps = {
  query: string;
  selectedAction: string;
  sections: CommandSection[];
  filteredActions: ActionDef[];
  paletteAction: ActionDef | null;
  onQueryChange: (query: string) => void;
  onSubmitSelected: () => void;
};

export function CommandPalette({
  query,
  selectedAction,
  sections,
  filteredActions,
  paletteAction,
  onQueryChange,
  onSubmitSelected,
}: CommandPaletteProps) {
  return (
    <box
      alignItems="center"
      justifyContent="center"
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      zIndex={10}
    >
      <box
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        opacity={0.28}
        style={{ backgroundColor: "#000000" }}
      />
      <box
        flexDirection="column"
        width={96}
        maxWidth="84%"
        style={{ backgroundColor: colors.panel }}
      >
        <box
          alignItems="center"
          flexDirection="row"
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
        >
          <text attributes={TextAttributes.BOLD} style={{ fg: "#353535" }}>
            &gt;
          </text>
          <box flexGrow={1} paddingLeft={1}>
            <input
              focused={true}
              placeholder="run a command."
              value={query}
              width="100%"
              onInput={onQueryChange}
              onSubmit={onSubmitSelected}
            />
          </box>
          <text attributes={TextAttributes.DIM} style={{ fg: "#4e4e4e" }}>
            esc back
          </text>
        </box>
        <box flexDirection="column" paddingLeft={2} paddingRight={2}>
          {sections.map((section) => (
            <box key={section.label} flexDirection="column" marginBottom={1}>
              <text attributes={TextAttributes.DIM} style={{ fg: "#4f4f4f" }}>
                {section.label}
              </text>
              {section.actions.map((action) => (
                <CommandActionRow
                  key={action.label}
                  action={action}
                  isSelected={action.label === selectedAction}
                  status={
                    action.disabled
                      ? getDisabledReason(action.label)
                      : action.description
                  }
                />
              ))}
            </box>
          ))}
          {filteredActions.length === 0 ? (
            <box paddingTop={1} paddingBottom={1}>
              <text attributes={TextAttributes.DIM} style={{ fg: "#5f5f5f" }}>
                No commands match `{query}`.
              </text>
            </box>
          ) : null}
        </box>
        <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text attributes={TextAttributes.DIM} style={{ fg: "#5f5f5f" }}>
            {paletteAction?.disabled
              ? getDisabledReason(paletteAction.label)
              : "Up/down move. Enter runs. Ctrl shortcut jumps."}
          </text>
        </box>
      </box>
    </box>
  );
}

function CommandActionRow({
  action,
  isSelected,
  status,
}: {
  action: ActionDef;
  isSelected: boolean;
  status: string;
}) {
  return (
    <box
      alignItems="center"
      flexDirection="row"
      paddingLeft={0}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
      style={{ backgroundColor: isSelected ? "#1a1a1a" : colors.panel }}
    >
      <box width={2}>
        <text style={{ fg: isSelected ? colors.blue : colors.panel }}>|</text>
      </box>
      <box width={16}>
        <text
          attributes={action.disabled ? TextAttributes.DIM : TextAttributes.BOLD}
          style={{
            fg: action.disabled ? "#6f6f6f" : isSelected ? colors.bright : "#dddddd",
          }}
        >
          {action.label}
        </text>
      </box>
      <box flexGrow={1} paddingRight={1}>
        <text
          attributes={TextAttributes.DIM}
          style={{ fg: action.disabled ? "#606060" : "#737373" }}
        >
          {status}
        </text>
      </box>
      <text
        attributes={TextAttributes.DIM}
        style={{ fg: action.disabled ? "#3f3f3f" : "#555555" }}
      >
        {action.shortcut}
      </text>
    </box>
  );
}

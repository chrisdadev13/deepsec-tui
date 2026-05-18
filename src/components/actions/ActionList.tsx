import { TextAttributes } from "@opentui/core";
import type { ActionDef } from "../../lib/actions";

type ActionListProps = {
  actions: ActionDef[];
  activeAction: string | null;
  hoveredAction: string | null;
  onHover: (label: string | null) => void;
  onSelect: (label: string) => void;
};

export function ActionList({
  actions,
  activeAction,
  hoveredAction,
  onHover,
  onSelect,
}: ActionListProps) {
  return (
    <box flexDirection="column" width={42}>
      {actions.map((action) => {
        const isActive = activeAction === action.label;
        const isHovered = hoveredAction === action.label;
        const isDisabled = action.disabled;

        let bg: string | undefined;
        if (isHovered && !isDisabled) bg = "#1e1e1e";
        else if (isActive && !isDisabled) bg = "#161616";

        return (
          <box
            key={action.label}
            alignItems="center"
            border={["bottom"]}
            borderColor="#252525"
            flexDirection="row"
            onMouseOut={() => onHover(null)}
            onMouseOver={() => {
              if (!isDisabled) onHover(action.label);
            }}
            onMouseUp={() => {
              if (!isDisabled) onSelect(action.label);
            }}
            paddingBottom={0}
            paddingTop={0}
            width="100%"
          >
            <box width={2}>
              {isActive && !isDisabled ? (
                <text style={{ fg: "#4a9eff" }}>|</text>
              ) : (
                <text> </text>
              )}
            </box>

            <box
              flexDirection="row"
              alignItems="center"
              flexGrow={1}
              paddingX={1}
              style={{ backgroundColor: bg }}
            >
              <box flexGrow={1}>
                <text
                  attributes={
                    isDisabled ? TextAttributes.DIM : TextAttributes.BOLD
                  }
                  style={{
                    fg: isDisabled ? "#555" : isActive ? "#e0e0e0" : "#c0c0c0",
                  }}
                >
                  {action.label}
                </text>
              </box>
              <text
                attributes={
                  isActive && !isDisabled ? TextAttributes.BOLD : TextAttributes.DIM
                }
                style={{
                  fg: isDisabled ? "#333" : isActive ? "#4a9eff" : "#555",
                }}
              >
                {action.shortcut}
              </text>
            </box>
          </box>
        );
      })}
    </box>
  );
}

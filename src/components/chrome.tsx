import { TextAttributes } from "@opentui/core";

export type ShortcutHint = {
  key: string;
  label?: string;
};

export function HeroLogo() {
  return (
    <box alignItems="center" flexDirection="column">
      <ascii-font font="tiny" text="DeepSec" />
    </box>
  );
}

type StatusBarProps = {
  branch: string;
  path: string;
  shortcuts?: ShortcutHint[];
};

export function StatusBar({ branch, path, shortcuts }: StatusBarProps) {
  const hasShortcuts = Boolean(shortcuts?.length);

  return (
    <box
      flexDirection="column"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      gap={hasShortcuts ? 1 : 0}
    >
      <box alignItems="center" flexDirection="row" gap={1}>
        <text style={{ fg: "#6f6f6f" }}>|</text>
        <text style={{ fg: "#a0a0a0" }}>{branch}</text>
        <text attributes={TextAttributes.DIM} style={{ fg: "#6f6f6f" }}>
          {path}
        </text>
      </box>
      {hasShortcuts ? <ShortcutBar shortcuts={shortcuts ?? []} /> : null}
    </box>
  );
}

export function ShortcutBar({
  shortcuts,
  label = "actions",
}: {
  shortcuts: ShortcutHint[];
  label?: string;
}) {
  return (
    <box
      alignItems="center"
      flexDirection="row"
      paddingLeft={2}
      paddingBottom={1}
    >
      <text attributes={TextAttributes.DIM} style={{ fg: "#4d4d4d" }}>
        {label}
      </text>
      <box width={1} />
      <ShortcutHints shortcuts={shortcuts} tone="subtle" />
    </box>
  );
}

type FooterProps = { hint: string; shortcuts?: ShortcutHint[] };

export function Footer({ hint, shortcuts }: FooterProps) {
  return (
    <box
      flexDirection="column"
      alignItems="center"
      paddingBottom={2}
      paddingTop={1}
      gap={0}
    >
      <text attributes={TextAttributes.DIM} style={{ fg: "#666" }}>
        {hint}
      </text>
      {shortcuts?.length ? (
        <ShortcutHints shortcuts={shortcuts} tone="muted" />
      ) : null}
    </box>
  );
}

function ShortcutHints({
  shortcuts,
  tone,
}: {
  shortcuts: ShortcutHint[];
  tone: "muted" | "subtle";
}) {
  return (
    <box alignItems="center" flexDirection="row" flexWrap="wrap" gap={1}>
      {shortcuts.map((shortcut, index) => (
        <box
          key={`${shortcut.key}-${shortcut.label ?? index}`}
          alignItems="center"
          flexDirection="row"
        >
          {index > 0 ? (
            <text
              attributes={TextAttributes.DIM}
              style={{ fg: tone === "subtle" ? "#555" : "#3a3a3a" }}
            >
              |
            </text>
          ) : null}
          {index > 0 ? <box width={1} /> : null}
          <text
            attributes={TextAttributes.BOLD}
            style={{ fg: tone === "subtle" ? "#8a8a8a" : "#6a6a6a" }}
          >
            {shortcut.key}
          </text>
          {shortcut.label ? (
            <text
              attributes={TextAttributes.DIM}
              style={{ fg: tone === "subtle" ? "#6f6f6f" : "#444" }}
            >
              {` ${shortcut.label}`}
            </text>
          ) : null}
        </box>
      ))}
    </box>
  );
}

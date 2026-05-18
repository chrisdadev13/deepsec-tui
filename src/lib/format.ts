export function formatLabel(value: string) {
  return value
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatShortcut(value: string) {
  const [modifier, key] = value.split("-");

  if (modifier?.toLowerCase() === "ctrl" && key) {
    return `Ctrl+${key.toUpperCase()}`;
  }

  return value;
}

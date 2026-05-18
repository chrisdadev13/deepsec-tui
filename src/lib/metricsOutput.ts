import { dashboardColors as colors } from "./dashboardData";

export type MetricsTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

export type ParsedMetricsOutput = {
  heading: string;
  subtitle: string;
  tables: MetricsTable[];
  footer: string;
};

export function parseMetricsOutput(lines: string[]): ParsedMetricsOutput | null {
  const cleaned = lines
    .map(stripAnsi)
    .map((line) => line.replace(/^\s*!?\s?/, "").trimEnd())
    .filter(
      (line) =>
        line &&
        !line.startsWith("$ deepsec ") &&
        line !== "ok metrics" &&
        line !== "metrics completed successfully",
    );

  if (!cleaned.length) return null;

  const headingLine = cleaned.find((line) => !isTableBorder(line) && !isTableRow(line));
  if (!headingLine) return null;

  const { heading, subtitle } = splitHeading(headingLine);
  const footer = cleaned.findLast((line) => line.startsWith("Files:")) ?? "";
  const tables: MetricsTable[] = [];
  let currentTitle = "Overview";

  for (let index = 0; index < cleaned.length; index += 1) {
    const line = cleaned[index];
    if (!line) continue;

    if (!isTableBorder(line) && !isTableRow(line) && !line.startsWith("Files:")) {
      currentTitle = splitHeading(line).heading === heading ? "Overview" : normalizeTitle(line);
      continue;
    }

    if (!line.startsWith("┌")) continue;

    const headerLine = cleaned[index + 1];
    const separatorLine = cleaned[index + 2];
    if (!headerLine || !separatorLine || !isTableRow(headerLine) || !separatorLine.startsWith("├")) {
      continue;
    }

    const headers = splitTableRow(headerLine);
    const rows: string[][] = [];
    index += 3;

    while (index < cleaned.length) {
      const row = cleaned[index];
      if (!row) {
        index += 1;
        continue;
      }
      if (row.startsWith("└")) break;
      if (isTableRow(row)) rows.push(splitTableRow(row));
      index += 1;
    }

    tables.push({ title: currentTitle || "Overview", headers, rows });
  }

  return tables.length ? { heading, subtitle, tables, footer } : null;
}

export function getMetricsValueColor(header: string) {
  switch (header.toUpperCase()) {
    case "CRIT":
      return colors.red;
    case "HIGH":
      return colors.orange;
    case "MED":
      return colors.yellow;
    case "HBUG":
      return colors.purple;
    case "BUG":
      return colors.blue;
    case "TP":
      return colors.green;
    case "FP":
      return colors.red;
    default:
      return colors.text;
  }
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-9;]*m/g, "").replace(/�/g, "");
}

function splitHeading(line: string) {
  const match = line.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (!match) return { heading: normalizeTitle(line), subtitle: "" };
  return {
    heading: normalizeTitle(match[1] ?? line),
    subtitle: match[2] ?? "",
  };
}

function normalizeTitle(value: string) {
  return value.trim();
}

function isTableBorder(line: string) {
  return /^[┌┬┐├┼┤└┴┘─]+$/.test(line.trim());
}

function isTableRow(line: string) {
  return line.trim().startsWith("│") && line.trim().endsWith("│");
}

function splitTableRow(line: string) {
  return line
    .trim()
    .slice(1, -1)
    .split("│")
    .map((cell) => cell.trim());
}

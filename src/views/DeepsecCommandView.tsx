import { spawn, type ChildProcess } from "node:child_process";
import { TextAttributes } from "@opentui/core";
import { type InputProps, useKeyboard } from "@opentui/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { dashboardColors as colors } from "../lib/dashboardData";
import {
  buildDeepsecCommand,
  buildReportArgs,
  buildWorkflowCommand,
  type CommandValues,
  getString,
} from "../lib/deepsecCommands";
import { getMetricsValueColor, parseMetricsOutput } from "../lib/metricsOutput";
import { getDeepsecDir, resolveWorkspaceRoot } from "../lib/workspace";

export type CommandField =
  | {
      name: string;
      label: string;
      type: "text";
      placeholder?: string;
      width?: number | "auto" | `${number}%`;
    }
  | {
      name: string;
      label: string;
      type: "boolean";
    }
  | {
      name: string;
      label: string;
      type: "segmented";
      leftLabel: string;
      rightLabel: string;
    };

export type DeepsecCommandConfig = {
  title: string;
  heading: string;
  description: string;
  initialValues: CommandValues;
  fields: CommandField[];
  advancedFields?: CommandField[];
  buildArgs: (values: CommandValues) => string[];
  buildSummary: (values: CommandValues) => string;
  validate?: (values: CommandValues) => string | null;
  runReportAfter?: boolean;
  renderRunOutput?: (props: CommandRunOutputProps) => ReactNode;
  hideRunHeader?: boolean;
};

type DeepsecCommandViewProps = {
  config: DeepsecCommandConfig;
  onBack: () => void;
};

export function DeepsecCommandView({ config, onBack }: DeepsecCommandViewProps) {
  const [values, setValues] = useState<CommandValues>(() => config.initialValues);
  const [focusedField, setFocusedField] = useState(config.fields[0]?.name ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const childRef = useRef<ChildProcess | null>(null);
  const mountedRef = useRef(true);
  const fields = useMemo(
    () => (showAdvanced ? [...config.fields, ...(config.advancedFields ?? [])] : config.fields),
    [config.fields, config.advancedFields, showAdvanced],
  );
  const focusedFieldDef = fields.find((field) => field.name === focusedField);
  const validationError = config.validate?.(values) ?? null;
  const commandArgs = useMemo(() => config.buildArgs(values), [config, values]);
  const commandPreview = useMemo(
    () => buildWorkflowCommand(commandArgs, config.runReportAfter ?? false),
    [commandArgs, config.runReportAfter],
  );
  const workflowSteps = useMemo(
    () => config.runReportAfter ? [config.title, "report"] : [config.title],
    [config.runReportAfter, config.title],
  );
  const summary = useMemo(() => config.buildSummary(values), [config, values]);
  const showRunOutput = isRunning || logs.length > 0;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      childRef.current?.kill("SIGTERM");
    };
  }, []);

  useKeyboard((key) => {
    if (isRunning) return;

    if (key.name === "escape") {
      onBack();
      return;
    }

    if (
      (key.name === "backspace" || key.name === "delete") &&
      focusedFieldDef?.type !== "text"
    ) {
      onBack();
      return;
    }

    if (key.name === "tab") {
      const currentIndex = fields.findIndex((field) => field.name === focusedField);
      const direction = key.shift ? -1 : 1;
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      setFocusedField(fields[(safeIndex + direction + fields.length) % fields.length]?.name ?? "");
      return;
    }

    if (
      key.ctrl &&
      key.name === "a" &&
      focusedFieldDef?.type !== "text" &&
      config.advancedFields?.length
    ) {
      setShowAdvanced((current) => !current);
      return;
    }

    if (focusedFieldDef?.type === "boolean" && key.name === "space") {
      setField(focusedField, values[focusedField] !== true);
      return;
    }

    if (focusedFieldDef?.type === "segmented") {
      if (key.name === "left") {
        setField(focusedFieldDef.name, focusedFieldDef.leftLabel);
        return;
      }

      if (key.name === "right") {
        setField(focusedFieldDef.name, focusedFieldDef.rightLabel);
        return;
      }
    }

    if (key.name === "return") {
      runCommand();
    }
  });

  function setField(name: string, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function appendLog(line: string) {
    if (!mountedRef.current) return;
    setLogs((current) => [...current, line]);
  }

  function attachStream(prefix: string, stream: NodeJS.ReadableStream) {
    let remainder = "";

    stream.on("data", (chunk: Buffer | string) => {
      const text = remainder + chunk.toString();
      const parts = text.split(/\r?\n/);
      remainder = parts.pop() ?? "";

      for (const part of parts) {
        if (part.trim()) appendLog(`${prefix}${part}`);
      }
    });

    stream.on("end", () => {
      if (remainder.trim()) appendLog(`${prefix}${remainder}`);
    });
  }

  function runDeepsecStep(label: string, args: readonly string[]) {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn("deepsec", args, {
        cwd: getDeepsecDir(resolveWorkspaceRoot()),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let settled = false;

      childRef.current = proc;
      appendLog(`$ deepsec ${args.join(" ")}`);
      attachStream("  ", proc.stdout);
      attachStream("  ! ", proc.stderr);

      proc.on("error", (error) => {
        if (settled) return;
        settled = true;
        if (childRef.current === proc) childRef.current = null;
        reject(error);
      });

      proc.on("close", (code) => {
        if (settled) return;
        settled = true;
        if (childRef.current === proc) childRef.current = null;

        if (code === 0) {
          appendLog(`ok ${label}`);
          resolve();
          return;
        }

        reject({ label, code });
      });
    });
  }

  async function runCommand() {
    if (isRunning) return;

    if (validationError) {
      setStatus(validationError);
      return;
    }

    setStatus(`running deepsec ${config.title}`);
    setIsRunning(true);
    setActiveStep(null);
    setCompletedSteps([]);
    setLogs([]);
    let currentStep = config.title;

    try {
      setActiveStep(config.title);
      await runDeepsecStep(config.title, commandArgs);
      setCompletedSteps((current) => [...current, config.title]);

      if (config.runReportAfter) {
        currentStep = "report";
        setActiveStep("report");
        setStatus("building dashboard report");
        await runDeepsecStep("report", buildReportArgs(getString(values, "projectId")));
        setCompletedSteps((current) => [...current, "report"]);
      }

      setActiveStep(null);
      setStatus(`${config.title}${config.runReportAfter ? " and report" : ""} completed successfully`);
    } catch (error) {
      if (!mountedRef.current) return;

      const exitCode =
        typeof error === "object" && error && "status" in error
          ? error.status
          : typeof error === "object" && error && "code" in error
            ? error.code
          : null;
      setStatus(
        typeof exitCode === "number"
          ? `${currentStep} exited with status ${exitCode}`
          : `${currentStep} failed to start`,
      );
    } finally {
      if (mountedRef.current) setIsRunning(false);
    }
  }

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
        minHeight={0}
        maxHeight="90%"
        width={96}
        maxWidth="84%"
        overflow="hidden"
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
            <text attributes={TextAttributes.BOLD} style={{ fg: colors.blue }}>
              {config.title}
            </text>
          </box>
          <text attributes={TextAttributes.DIM} style={{ fg: "#4e4e4e" }}>
            esc back
          </text>
        </box>

        <box flexDirection="column" minHeight={0} paddingLeft={2} paddingRight={2} overflow="hidden">
          {showRunOutput ? (
            <CommandRunOutput
              activeStep={activeStep}
              commandPreview={commandPreview}
              completedSteps={completedSteps}
              logs={logs}
              status={status}
              summary={summary}
              title={config.title}
              workflowSteps={workflowSteps}
              renderContent={config.renderRunOutput}
              hideHeader={config.hideRunHeader ?? false}
            />
          ) : (
            <>
              <box paddingTop={1} paddingBottom={1} flexDirection="column">
                <text attributes={TextAttributes.BOLD} style={{ fg: colors.bright }}>
                  {config.heading}
                </text>
                <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
                  {config.description}
                </text>
              </box>

              {fields.map((field) => (
                <CommandFormRow
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  isFocused={focusedField === field.name}
                  onFocus={() => setFocusedField(field.name)}
                  onChange={(value) => setField(field.name, value)}
                />
              ))}

              {config.advancedFields?.length ? (
                <box paddingTop={1}>
                  <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
                    {showAdvanced
                      ? "Ctrl+A hides advanced options."
                      : "Ctrl+A shows advanced options."}
                  </text>
                </box>
              ) : null}

              <box paddingTop={1} paddingBottom={1} flexDirection="column">
                <text
                  attributes={validationError ? TextAttributes.BOLD : undefined}
                  style={{ fg: validationError ? "#d08d8d" : colors.bright }}
                >
                  {validationError ?? summary}
                </text>
                <text attributes={TextAttributes.DIM} style={{ fg: "#5f5f5f" }}>
                  {commandPreview}
                </text>
              </box>
            </>
          )}
        </box>

        <box
          alignItems="center"
          flexDirection="row"
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
        >
          <box flexGrow={1}>
            <text
              attributes={TextAttributes.DIM}
              style={{ fg: status ? "#7f7f7f" : "#5f5f5f" }}
            >
              {status || "Tab edits options. Ctrl+A toggles advanced. Enter runs."}
            </text>
          </box>
          <box onMouseUp={runCommand} paddingLeft={2} paddingRight={2}>
            <text
              attributes={TextAttributes.BOLD}
              style={{ fg: validationError ? "#7f7f7f" : colors.blue }}
            >
              {isRunning ? "running" : "run"}
            </text>
          </box>
        </box>
      </box>
    </box>
  );
}

type CommandRunOutputProps = {
  activeStep: string | null;
  commandPreview: string;
  completedSteps: string[];
  hideHeader?: boolean;
  logs: string[];
  renderContent?: (props: CommandRunOutputProps) => ReactNode;
  status: string;
  summary: string;
  title: string;
  workflowSteps: string[];
};

function CommandRunOutput({
  activeStep,
  commandPreview,
  completedSteps,
  hideHeader,
  logs,
  renderContent,
  status,
  summary,
  title,
  workflowSteps,
}: CommandRunOutputProps) {
  const content = renderContent?.({
    activeStep,
    commandPreview,
    completedSteps,
    hideHeader,
    logs,
    renderContent,
    status,
    summary,
    title,
    workflowSteps,
  });

  return (
    <box flexDirection="column" minWidth={0} paddingTop={1} paddingBottom={1} overflow="hidden">
      {!hideHeader ? (
        <>
          <box flexDirection="column" paddingBottom={1}>
            <text attributes={TextAttributes.BOLD} style={{ fg: colors.bright }}>
              {title} output
            </text>
            <text attributes={TextAttributes.DIM} style={{ fg: "#737373" }}>
              {status || summary}
            </text>
            <text attributes={TextAttributes.DIM} style={{ fg: "#5f5f5f" }}>
              {commandPreview}
            </text>
          </box>

          <box flexDirection="row" gap={2} paddingBottom={1}>
            {workflowSteps.map((step) => {
              const isActive = step === activeStep;
              const isDone = completedSteps.includes(step);

              return (
                <text
                  key={step}
                  attributes={isActive ? TextAttributes.BOLD : undefined}
                  style={{
                    fg: isActive
                      ? colors.blue
                      : isDone
                        ? colors.green
                        : colors.faint,
                  }}
                >
                  {isDone ? "[ok]" : isActive ? "[..]" : "[  ]"} {step}
                </text>
              );
            })}
          </box>
        </>
      ) : null}

      {content ?? (
        <box
          flexDirection="column"
          minWidth={0}
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          minHeight={16}
          style={{ backgroundColor: "#111111" }}
        >
          {logs.length ? (
            logs.slice(-18).map((line, index) => (
              <text key={`${index}-${line}`} style={{ fg: colors.text }}>
                {line}
              </text>
            ))
          ) : (
            <text attributes={TextAttributes.DIM} style={{ fg: "#737373" }}>
              waiting for output...
            </text>
          )}
        </box>
      )}
    </box>
  );
}

export function MetricsRunOutput({ logs }: CommandRunOutputProps) {
  const parsed = parseMetricsOutput(logs);

  if (!parsed) {
    return (
      <box
        flexDirection="column"
        minWidth={0}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        minHeight={16}
        style={{ backgroundColor: "#111111" }}
      >
        {logs.length ? (
          logs.slice(-18).map((line, index) => (
            <text key={`${index}-${line}`} style={{ fg: colors.text }}>
              {line}
            </text>
          ))
        ) : (
          <text attributes={TextAttributes.DIM} style={{ fg: "#737373" }}>
            waiting for metrics...
          </text>
        )}
      </box>
    );
  }

  const outputHeight = getMetricsOutputHeight(parsed);

  return (
    <scrollbox
      width="100%"
      minWidth={0}
      height={outputHeight}
      maxHeight={outputHeight}
      scrollY={true}
      overflow="hidden"
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      style={{ backgroundColor: "#111111" }}
    >
      <box flexDirection="column" minWidth={0} gap={1} overflow="hidden">
        <box flexDirection="row" alignItems="center" gap={2} marginBottom={1} minWidth={0} overflow="hidden">
          <text attributes={TextAttributes.BOLD} style={{ fg: colors.bright }}>
            {parsed.heading}
          </text>
          {parsed.subtitle ? (
            <box paddingLeft={1} paddingRight={1} style={{ backgroundColor: colors.panel }}>
              <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
                {parsed.subtitle}
              </text>
            </box>
          ) : null}
        </box>

        {parsed.tables.map((table) => (
          <MetricsSection key={table.title} table={table} />
        ))}

        {parsed.footer ? (
          <box marginTop={1} paddingLeft={1} paddingRight={1} style={{ backgroundColor: colors.panel }}>
            <text attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
              {parsed.footer}
            </text>
          </box>
        ) : null}
      </box>
    </scrollbox>
  );
}

type RenderMetricTable = { title: string; headers: string[]; rows: string[][] };

function MetricsSection({ table }: { table: RenderMetricTable }) {
  return (
    <box flexDirection="column" minWidth={0} marginBottom={1} overflow="hidden">
      {table.title !== "Overview" ? (
        <text attributes={TextAttributes.BOLD} style={{ fg: colors.blue }}>
          {table.title}
        </text>
      ) : null}

      <box
        flexDirection="column"
        minWidth={0}
        marginTop={table.title === "Overview" ? 0 : 1}
        gap={1}
        overflow="hidden"
      >
        {table.rows.map((row, rowIndex) => (
          <MetricCard
            key={`${table.title}-${rowIndex}`}
            table={table}
            row={row}
            rowIndex={rowIndex}
          />
        ))}
      </box>
    </box>
  );
}

function MetricCard({
  table,
  row,
  rowIndex,
}: {
  table: RenderMetricTable;
  row: string[];
  rowIndex: number;
}) {
  if (isVulnerabilityMetricsTable(table)) {
    return (
      <box flexDirection="column" paddingX={1} paddingY={1} gap={1} style={{ backgroundColor: cardBg(rowIndex) }}>
        <MetricCardTitle value={row[0] ?? `row ${rowIndex + 1}`} />
        <MetricChipRow>
          <MetricChip label="Files" value={metricValue(table, row, "Files")} width={8} />
          <MetricChip label="Done" value={metricValue(table, row, "Done")} width={8} />
        </MetricChipRow>
        <MetricChipRow>
          {severityMetricLabels.map((label) => (
            <MetricChip
              key={label}
              label={label}
              value={metricValue(table, row, label)}
              color={getMetricsValueColor(label)}
              width={6}
            />
          ))}
        </MetricChipRow>
      </box>
    );
  }

  if (isCostMetricsTable(table)) {
    return (
      <box flexDirection="column" paddingX={1} paddingY={1} gap={1} style={{ backgroundColor: cardBg(rowIndex) }}>
        <MetricCardTitle value={row[0] ?? `row ${rowIndex + 1}`} />
        <MetricChipRow>
          <MetricChip label="Analyses" value={metricValue(table, row, "Analyses")} width={10} />
          <MetricChip label="Cost" value={metricValue(table, row, "Cost")} width={10} color={colors.green} />
          <MetricChip label="Input" value={metricValue(table, row, "Input")} width={10} />
          <MetricChip label="Output" value={metricValue(table, row, "Output")} width={10} />
        </MetricChipRow>
        <MetricChipRow>
          <MetricChip label="Cache" value={metricValue(table, row, "Cache Hit")} width={10} />
          <MetricChip label="$/Run" value={metricValue(table, row, "$/Analysis")} width={10} color={colors.green} />
        </MetricChipRow>
      </box>
    );
  }

  return <GenericMetricCard table={table} row={row} rowIndex={rowIndex} />;
}

function GenericMetricCard({
  table,
  row,
  rowIndex,
}: {
  table: RenderMetricTable;
  row: string[];
  rowIndex: number;
}) {
  const title = row[0] ?? `row ${rowIndex + 1}`;
  const modelIndex = table.headers.findIndex((header) => header.toLowerCase() === "model");
  const subtitle = modelIndex > 0 ? row[modelIndex] : "";

  return (
    <box flexDirection="column" paddingX={1} paddingY={1} gap={1} style={{ backgroundColor: cardBg(rowIndex) }}>
      <box flexDirection="row" minWidth={0} gap={1} overflow="hidden">
        <MetricCardTitle value={title} />
        {subtitle ? (
          <text truncate={true} wrapMode="none" attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
            {subtitle}
          </text>
        ) : null}
      </box>
      <MetricChipRow>
        {table.headers.slice(1).map((header, index) => {
          if (index + 1 === modelIndex) return null;
          return (
            <MetricChip
              key={`${header}-${index}`}
              label={formatMetricHeader(header)}
              value={row[index + 1] ?? "-"}
              color={getMetricsValueColor(header)}
              width={10}
            />
          );
        })}
      </MetricChipRow>
    </box>
  );
}

function MetricCardTitle({ value }: { value: string }) {
  return (
    <text truncate={true} wrapMode="none" attributes={TextAttributes.BOLD} style={{ fg: colors.bright }}>
      {value}
    </text>
  );
}

function MetricChipRow({ children }: { children: ReactNode }) {
  return (
    <box flexDirection="row" minWidth={0} flexWrap="wrap" gap={1} overflow="hidden">
      {children}
    </box>
  );
}

function MetricChip({
  label,
  value,
  color = colors.text,
  width,
}: {
  label: string;
  value: string;
  color?: string;
  width: number;
}) {
  return (
    <box flexDirection="column" width={width} minWidth={0} height={2} overflow="hidden">
      <text truncate={true} wrapMode="none" attributes={TextAttributes.DIM} style={{ fg: colors.faint }}>
        {label}
      </text>
      <text truncate={true} wrapMode="none" attributes={TextAttributes.BOLD} style={{ fg: color }}>
        {value || "-"}
      </text>
    </box>
  );
}

const severityMetricLabels = ["CRIT", "HIGH", "MED", "HBUG", "BUG", "LOW", "TP", "FP"];

function isVulnerabilityMetricsTable(table: RenderMetricTable) {
  return hasMetricHeader(table, "CRIT") && hasMetricHeader(table, "HIGH");
}

function isCostMetricsTable(table: RenderMetricTable) {
  return hasMetricHeader(table, "Cost") && hasMetricHeader(table, "Input") && hasMetricHeader(table, "Output");
}

function metricValue(table: RenderMetricTable, row: string[], header: string) {
  const index = table.headers.findIndex((item) => item.toLowerCase() === header.toLowerCase());
  return index >= 0 ? row[index] ?? "-" : "-";
}

function hasMetricHeader(table: RenderMetricTable, header: string) {
  return table.headers.some((item) => item.toLowerCase() === header.toLowerCase());
}

function cardBg(index: number) {
  return index % 2 === 0 ? colors.panel : "#151515";
}

function getMetricsOutputHeight(parsed: { footer: string; tables: RenderMetricTable[] }) {
  const contentRows = parsed.tables.reduce((total, table) => {
    const titleRows = table.title === "Overview" ? 0 : 2;
    const cardRows = isVulnerabilityMetricsTable(table) || isCostMetricsTable(table) ? 7 : 4;
    return total + titleRows + table.rows.length * cardRows;
  }, 3);
  const footerRows = parsed.footer ? 2 : 0;

  return Math.min(26, Math.max(12, contentRows + footerRows + 2));
}

function formatMetricHeader(header: string) {
  switch (header.toLowerCase()) {
    case "cache hit":
      return "Cache";
    case "$/analysis":
      return "$/Run";
    default:
      return header;
  }
}

function CommandFormRow({
  field,
  value,
  isFocused,
  onFocus,
  onChange,
}: {
  field: CommandField;
  value: string | boolean | undefined;
  isFocused: boolean;
  onFocus: () => void;
  onChange: (value: string | boolean) => void;
}) {
  return (
    <FormRow label={field.label} isFocused={isFocused}>
      {field.type === "text" ? (
        <InputField
          focused={isFocused}
          width={field.width}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onInput={onChange}
          onMouseUp={onFocus}
        />
      ) : null}
      {field.type === "boolean" ? (
        <BooleanField
          isFocused={isFocused}
          value={value === true}
          onMouseUp={() => {
            onFocus();
            onChange(value !== true);
          }}
        />
      ) : null}
      {field.type === "segmented" ? (
        <SegmentedField
          leftLabel={field.leftLabel}
          rightLabel={field.rightLabel}
          selected={getString({ value: value ?? "" }, "value")}
          isFocused={isFocused}
          onFocus={onFocus}
          onSelectLeft={() => onChange(field.leftLabel)}
          onSelectRight={() => onChange(field.rightLabel)}
        />
      ) : null}
    </FormRow>
  );
}

function FormRow({
  label,
  isFocused = false,
  children,
}: {
  label: string;
  isFocused?: boolean;
  children: ReactNode;
}) {
  return (
    <box
      alignItems="center"
      flexDirection="row"
      paddingTop={0}
      paddingBottom={0}
      style={{ backgroundColor: isFocused ? "#1a1a1a" : colors.panel }}
    >
      <box width={2}>
        <text style={{ fg: isFocused ? colors.blue : colors.panel }}>|</text>
      </box>
      <box width={16}>
        <text
          attributes={isFocused ? TextAttributes.BOLD : TextAttributes.DIM}
          style={{ fg: isFocused ? colors.bright : "#737373" }}
        >
          {label}
        </text>
      </box>
      <box flexGrow={1}>{children}</box>
    </box>
  );
}

function SegmentedField({
  leftLabel,
  rightLabel,
  selected,
  isFocused,
  onFocus,
  onSelectLeft,
  onSelectRight,
}: {
  leftLabel: string;
  rightLabel: string;
  selected: string;
  isFocused: boolean;
  onFocus: () => void;
  onSelectLeft: () => void;
  onSelectRight: () => void;
}) {
  return (
    <box alignItems="center" flexDirection="row">
      <SegmentButton
        width={12}
        isActive={selected === leftLabel}
        isFocused={isFocused && selected === leftLabel}
        label={leftLabel}
        onMouseUp={() => {
          onFocus();
          onSelectLeft();
        }}
      />
      <SegmentButton
        width={12}
        isActive={selected === rightLabel}
        isFocused={isFocused && selected === rightLabel}
        label={rightLabel}
        onMouseUp={() => {
          onFocus();
          onSelectRight();
        }}
      />
    </box>
  );
}

function SegmentButton({
  width,
  isActive,
  isFocused,
  label,
  onMouseUp,
}: {
  width?: number;
  isActive: boolean;
  isFocused: boolean;
  label: string;
  onMouseUp: () => void;
}) {
  return (
    <box
      style={{ backgroundColor: isFocused ? "#1a1a1a" : colors.panel }}
      onMouseUp={onMouseUp}
      paddingLeft={1}
      paddingRight={1}
      width={width}
    >
      <text
        attributes={isActive ? TextAttributes.BOLD : undefined}
        style={{ fg: isActive ? colors.blue : "#8a8a8a" }}
      >
        {label}
      </text>
    </box>
  );
}

function BooleanField({
  isFocused,
  value,
  onMouseUp,
}: {
  isFocused: boolean;
  value: boolean;
  onMouseUp: () => void;
}) {
  return (
    <box
      style={{ backgroundColor: isFocused ? "#1a1a1a" : colors.panel }}
      onMouseUp={onMouseUp}
      paddingLeft={1}
      paddingRight={2}
    >
      <text
        attributes={value ? TextAttributes.BOLD : undefined}
        style={{ fg: value ? colors.blue : "#8a8a8a" }}
      >
        {value ? "on" : "off"}
      </text>
    </box>
  );
}

function InputField({
  width = "100%",
  ...props
}: InputProps & { width?: number | "auto" | `${number}%` }) {
  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      style={{ backgroundColor: props.focused ? "#1a1a1a" : "#111111" }}
      width={width}
    >
      <input {...props} width="100%" />
    </box>
  );
}

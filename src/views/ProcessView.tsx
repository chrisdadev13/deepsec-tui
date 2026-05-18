import { spawn, type ChildProcess } from "node:child_process";
import { TextAttributes } from "@opentui/core";
import { type InputProps, useKeyboard } from "@opentui/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { dashboardColors as colors } from "../lib/dashboardData";
import {
  buildReportArgs,
  buildProcessArgs,
  buildProcessWorkflowCommand,
  getDefaultModel,
  getDefaultProcessValues,
  getModeValueLabel,
  getModeValuePlaceholder,
  getProcessRunOptions,
  type ProcessAgent,
  type ProcessFormValues,
  type ProcessMode,
  type ProcessRunOption,
  processModeOptions,
  requiresModeValue,
  validateProcessForm,
} from "../lib/process";
import { getDeepsecDir, resolveWorkspaceRoot } from "../lib/workspace";

type ProcessViewProps = {
  onBack: () => void;
};

type FocusField =
  | "scope"
  | "projectId"
  | "agent"
  | "model"
  | "modeValue"
  | "concurrency"
  | "runId"
  | "reinvestigate"
  | "limit"
  | "filter"
  | "batchSize"
  | "maxTurns"
  | "root"
  | "manifest"
  | "onlySlugs"
  | "skipSlugs"
  | "commentOut"
  | "noIgnore";

const advancedFocusOrder: FocusField[] = [
  "projectId",
  "model",
  "runId",
  "reinvestigate",
  "limit",
  "filter",
  "batchSize",
  "maxTurns",
  "root",
  "manifest",
  "onlySlugs",
  "skipSlugs",
  "commentOut",
  "noIgnore",
];

const textInputFields = new Set<FocusField>([
  "projectId",
  "model",
  "modeValue",
  "concurrency",
  "runId",
  "reinvestigate",
  "limit",
  "filter",
  "batchSize",
  "maxTurns",
  "root",
  "manifest",
  "onlySlugs",
  "skipSlugs",
  "commentOut",
]);

export function ProcessView({ onBack }: ProcessViewProps) {
  const [values, setValues] = useState<ProcessFormValues>(() =>
    getDefaultProcessValues(),
  );
  const [focusedField, setFocusedField] = useState<FocusField>("scope");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<"process" | "report" | null>(null);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [highlightedRunIndex, setHighlightedRunIndex] = useState(0);
  const childRef = useRef<ChildProcess | null>(null);
  const mountedRef = useRef(true);
  const validationError = validateProcessForm(values);
  const commandPreview = useMemo(() => buildProcessWorkflowCommand(values), [values]);
  const runOptions = useMemo(
    () => getProcessRunOptions(values.projectId),
    [values.projectId],
  );
  const filteredRunOptions = useMemo(
    () => filterRunOptions(runOptions, values.runId),
    [runOptions, values.runId],
  );
  const modeIndex = processModeOptions.findIndex(
    (option) => option.value === values.mode,
  );
  const modeRequiresInput = requiresModeValue(values.mode);
  const projectIdNeeded =
    values.mode === "full-scan" && !values.projectId.trim();
  const focusOrder = useMemo(() => {
    const order: FocusField[] = ["scope"];

    if (modeRequiresInput) order.push("modeValue");
    if (projectIdNeeded) order.push("projectId");

    order.push("agent", "concurrency");

    if (showAdvanced) {
      for (const field of advancedFocusOrder) {
        if (!order.includes(field)) order.push(field);
      }
    }

    return order;
  }, [modeRequiresInput, projectIdNeeded, showAdvanced]);
  const runSummary = useMemo(() => buildRunSummary(values), [values]);
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
      !textInputFields.has(focusedField)
    ) {
      onBack();
      return;
    }

    if (key.name === "tab") {
      const currentIndex = focusOrder.indexOf(focusedField);
      const direction = key.shift ? -1 : 1;
      const safeIndex = currentIndex === -1 ? 0 : currentIndex;
      const nextIndex =
        (safeIndex + direction + focusOrder.length) % focusOrder.length;
      setFocusedField(focusOrder[nextIndex] ?? "scope");
      return;
    }

    if (focusedField === "scope" && key.ctrl && key.name === "a") {
      setShowAdvanced((current) => !current);
      return;
    }

    if (focusedField === "scope") {
      if (key.name === "up" || key.name === "left") {
        updateMode(
          (modeIndex - 1 + processModeOptions.length) %
            processModeOptions.length,
        );
        return;
      }

      if (key.name === "down" || key.name === "right") {
        updateMode((modeIndex + 1) % processModeOptions.length);
        return;
      }
    }

    if (focusedField === "agent") {
      if (key.name === "left") {
        updateAgent("codex");
        return;
      }

      if (key.name === "right") {
        updateAgent("claude");
        return;
      }
    }

    if (focusedField === "runId" && filteredRunOptions.length > 0) {
      if (key.name === "up") {
        setHighlightedRunIndex(
          (current) =>
            (current - 1 + filteredRunOptions.length) %
            filteredRunOptions.length,
        );
        return;
      }

      if (key.name === "down") {
        setHighlightedRunIndex(
          (current) => (current + 1) % filteredRunOptions.length,
        );
        return;
      }

      if (key.name === "return") {
        selectRunOption(
          filteredRunOptions[highlightedRunIndex] ?? filteredRunOptions[0],
        );
        return;
      }
    }

    if (focusedField === "noIgnore" && key.name === "space") {
      setField("noIgnore", !values.noIgnore);
      return;
    }

    if (key.name === "return") {
      runProcess();
      return;
    }
  });

  function setField<K extends keyof ProcessFormValues>(
    field: K,
    value: ProcessFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateRunId(value: string) {
    setHighlightedRunIndex(0);
    setField("runId", value);
  }

  function selectRunOption(option?: ProcessRunOption) {
    if (!option) return;

    setField("runId", option.id);
  }

  function updateAgent(agent: ProcessAgent) {
    setValues((current) => {
      const shouldResetModel =
        current.model.trim() === "" ||
        current.model === getDefaultModel(current.agent);

      return {
        ...current,
        agent,
        model: shouldResetModel ? getDefaultModel(agent) : current.model,
      };
    });
  }

  function updateMode(index: number) {
    const option = processModeOptions[index];
    if (!option) return;

    setMode(option.value);
  }

  function setMode(mode: ProcessMode) {
    setValues((current) => ({
      ...current,
      mode,
      modeValue: requiresModeValue(mode) ? current.modeValue : "",
    }));
  }

  function appendLog(line: string) {
    if (!mountedRef.current) return;
    setLogs((current) => [...current, line].slice(-18));
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

  function runDeepsecStep(
    label: "process" | "report",
    args: readonly string[],
    allowedExitCodes: readonly number[] = [0],
  ) {
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

        if (allowedExitCodes.includes(code ?? -1)) {
          appendLog(`ok ${label}`);
          resolve();
          return;
        }

        reject({ label, code });
      });
    });
  }

  async function runProcess() {
    if (isRunning) return;

    if (validationError) {
      setStatus(validationError);
      return;
    }

    setStatus("running deepsec process");
    setIsRunning(true);
    setActiveStep(null);
    setCompletedSteps([]);
    setLogs([]);
    let currentStep: "process" | "report" = "process";

    try {
      setActiveStep("process");
      await runDeepsecStep(
        "process",
        buildProcessArgs(values),
        values.mode === "full-scan" ? [0] : [0, 1],
      );
      setCompletedSteps((current) => [...current, "process"]);
      currentStep = "report";
      setActiveStep("report");
      setStatus("building dashboard report");
      await runDeepsecStep("report", buildReportArgs(values.projectId));
      setCompletedSteps((current) => [...current, "report"]);
      setActiveStep(null);
      setStatus("process and report completed successfully");
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
          ? currentStep === "process" && exitCode === 1 && values.mode !== "full-scan"
            ? "process completed with findings; report did not run"
            : `${currentStep} exited with status ${exitCode}`
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
            <text attributes={TextAttributes.BOLD} style={{ fg: colors.blue }}>
              process
            </text>
          </box>
          <text attributes={TextAttributes.DIM} style={{ fg: "#4e4e4e" }}>
            esc back
          </text>
        </box>

        <box flexDirection="column" paddingLeft={2} paddingRight={2}>
          {showRunOutput ? (
            <ProcessRunOutput
              activeStep={activeStep}
              completedSteps={completedSteps}
              commandPreview={commandPreview}
              logs={logs}
              runSummary={runSummary}
              status={status}
            />
          ) : (
            <>
              <box paddingTop={1} paddingBottom={1}>
            <text
              attributes={TextAttributes.BOLD}
              style={{ fg: colors.bright }}
            >
              What do you want to process?
            </text>
              </box>

              <ScopeList
                focused={focusedField === "scope"}
                selectedMode={values.mode}
                onFocus={() => setFocusedField("scope")}
                onSelect={setMode}
              />

          {modeRequiresInput ? (
            <FormRow
              label={getModeValueLabel(values.mode)}
              isFocused={focusedField === "modeValue"}
            >
              <InputField
                focused={focusedField === "modeValue"}
                placeholder={getModeValuePlaceholder(values.mode)}
                value={values.modeValue}
                onInput={(value: string) => setField("modeValue", value)}
                onMouseUp={() => setFocusedField("modeValue")}
              />
            </FormRow>
          ) : null}

          {projectIdNeeded ? (
            <FormRow
              label="project id"
              isFocused={focusedField === "projectId"}
            >
              <InputField
                focused={focusedField === "projectId"}
                placeholder="required for full project scan"
                value={values.projectId}
                onInput={(value: string) => setField("projectId", value)}
                onMouseUp={() => setFocusedField("projectId")}
              />
            </FormRow>
          ) : values.projectId.trim() ? (
            <SummaryLine label="project" value={values.projectId} />
          ) : null}

          <FormRow label="agent" isFocused={focusedField === "agent"}>
            <SegmentedField
              leftLabel="codex"
              rightLabel="claude"
              selected={values.agent}
              isFocused={focusedField === "agent"}
              onFocus={() => setFocusedField("agent")}
              onSelectLeft={() => updateAgent("codex")}
              onSelectRight={() => updateAgent("claude")}
            />
          </FormRow>

          <FormRow label="jobs" isFocused={focusedField === "concurrency"}>
            <InputField
              focused={focusedField === "concurrency"}
              width={12}
              value={values.concurrency}
              onInput={(value: string) => setField("concurrency", value)}
              onMouseUp={() => setFocusedField("concurrency")}
            />
          </FormRow>

          {showAdvanced ? (
            <box flexDirection="column" marginTop={1} marginBottom={1}>
              <box paddingTop={1} paddingBottom={1}>
                <text
                  attributes={TextAttributes.BOLD}
                  style={{ fg: colors.bright }}
                >
                  Advanced options
                </text>
                <text attributes={TextAttributes.DIM} style={{ fg: "#5f5f5f" }}>
                  {" "}
                  Only change these when you need to override the command.
                </text>
              </box>

              {!projectIdNeeded ? (
                <FormRow
                  label="project id"
                  isFocused={focusedField === "projectId"}
                >
                  <InputField
                    focused={focusedField === "projectId"}
                    placeholder="auto"
                    value={values.projectId}
                    onInput={(value: string) => setField("projectId", value)}
                    onMouseUp={() => setFocusedField("projectId")}
                  />
                </FormRow>
              ) : null}

              <FormRow label="model" isFocused={focusedField === "model"}>
                <InputField
                  focused={focusedField === "model"}
                  placeholder={getDefaultModel(values.agent)}
                  value={values.model}
                  onInput={(value: string) => setField("model", value)}
                  onMouseUp={() => setFocusedField("model")}
                />
              </FormRow>

              <FormRow label="run id" isFocused={focusedField === "runId"}>
                <InputField
                  focused={focusedField === "runId"}
                  value={values.runId}
                  placeholder={runOptions.length ? "pick previous run" : "auto"}
                  onInput={updateRunId}
                  onMouseUp={() => setFocusedField("runId")}
                />
              </FormRow>

              {focusedField === "runId" && filteredRunOptions.length > 0 ? (
                <RunIdSuggestions
                  highlightedIndex={highlightedRunIndex}
                  options={filteredRunOptions}
                  onSelect={selectRunOption}
                />
              ) : null}

              <FormRow
                label="reinvestigate"
                isFocused={focusedField === "reinvestigate"}
              >
                <InputField
                  focused={focusedField === "reinvestigate"}
                  placeholder="blank = off, space = all, or N"
                  value={values.reinvestigate}
                  onInput={(value: string) => setField("reinvestigate", value)}
                  onMouseUp={() => setFocusedField("reinvestigate")}
                />
              </FormRow>

              <FormRow label="limit" isFocused={focusedField === "limit"}>
                <InputField
                  focused={focusedField === "limit"}
                  width={12}
                  value={values.limit}
                  onInput={(value: string) => setField("limit", value)}
                  onMouseUp={() => setFocusedField("limit")}
                />
              </FormRow>

              <FormRow
                label="filter prefix"
                isFocused={focusedField === "filter"}
              >
                <InputField
                  focused={focusedField === "filter"}
                  value={values.filter}
                  onInput={(value: string) => setField("filter", value)}
                  onMouseUp={() => setFocusedField("filter")}
                />
              </FormRow>

              <FormRow
                label="batch size"
                isFocused={focusedField === "batchSize"}
              >
                <InputField
                  focused={focusedField === "batchSize"}
                  width={12}
                  value={values.batchSize}
                  onInput={(value: string) => setField("batchSize", value)}
                  onMouseUp={() => setFocusedField("batchSize")}
                />
              </FormRow>

              <FormRow
                label="max turns"
                isFocused={focusedField === "maxTurns"}
              >
                <InputField
                  focused={focusedField === "maxTurns"}
                  width={12}
                  value={values.maxTurns}
                  onInput={(value: string) => setField("maxTurns", value)}
                  onMouseUp={() => setFocusedField("maxTurns")}
                />
              </FormRow>

              <FormRow label="root" isFocused={focusedField === "root"}>
                <InputField
                  focused={focusedField === "root"}
                  value={values.root}
                  onInput={(value: string) => setField("root", value)}
                  onMouseUp={() => setFocusedField("root")}
                />
              </FormRow>

              <FormRow label="manifest" isFocused={focusedField === "manifest"}>
                <InputField
                  focused={focusedField === "manifest"}
                  value={values.manifest}
                  onInput={(value: string) => setField("manifest", value)}
                  onMouseUp={() => setFocusedField("manifest")}
                />
              </FormRow>

              <FormRow
                label="only slugs"
                isFocused={focusedField === "onlySlugs"}
              >
                <InputField
                  focused={focusedField === "onlySlugs"}
                  value={values.onlySlugs}
                  onInput={(value: string) => setField("onlySlugs", value)}
                  onMouseUp={() => setFocusedField("onlySlugs")}
                />
              </FormRow>

              <FormRow
                label="skip slugs"
                isFocused={focusedField === "skipSlugs"}
              >
                <InputField
                  focused={focusedField === "skipSlugs"}
                  value={values.skipSlugs}
                  onInput={(value: string) => setField("skipSlugs", value)}
                  onMouseUp={() => setFocusedField("skipSlugs")}
                />
              </FormRow>

              <FormRow
                label="comment out"
                isFocused={focusedField === "commentOut"}
              >
                <InputField
                  focused={focusedField === "commentOut"}
                  placeholder="path/to/comment.md"
                  value={values.commentOut}
                  onInput={(value: string) => setField("commentOut", value)}
                  onMouseUp={() => setFocusedField("commentOut")}
                />
              </FormRow>

              <FormRow
                label="no ignore"
                isFocused={focusedField === "noIgnore"}
              >
                <BooleanField
                  isFocused={focusedField === "noIgnore"}
                  value={values.noIgnore}
                  onMouseUp={() => {
                    setFocusedField("noIgnore");
                    setField("noIgnore", !values.noIgnore);
                  }}
                />
              </FormRow>
            </box>
          ) : null}

              <box paddingTop={1} paddingBottom={1} flexDirection="column">
                <text
                  attributes={validationError ? TextAttributes.BOLD : undefined}
                  style={{ fg: validationError ? "#d08d8d" : colors.bright }}
                >
                  {validationError ?? runSummary}
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
              {status ||
                (showAdvanced
                  ? "Tab edits options. Scope+Ctrl+A hides advanced. Enter runs."
                  : "Up/down chooses scope. Tab edits. Scope+Ctrl+A advanced. Enter runs.")}
            </text>
          </box>
          <box onMouseUp={runProcess} paddingLeft={2} paddingRight={2}>
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

function ScopeList({
  focused,
  selectedMode,
  onFocus,
  onSelect,
}: {
  focused: boolean;
  selectedMode: ProcessMode;
  onFocus: () => void;
  onSelect: (mode: ProcessMode) => void;
}) {
  return (
    <box flexDirection="column" marginBottom={1}>
      {processModeOptions.map((option) => {
        const selected = selectedMode === option.value;
        const isActive = focused && selected;
        const rowBackground = isActive ? colors.blue : colors.panel;
        const nameColor = isActive
          ? "#000000"
          : selected
            ? colors.bright
            : "#dddddd";
        const descriptionColor = isActive ? "#111111" : "#737373";

        return (
          <box
            key={option.value}
            alignItems="center"
            flexDirection="row"
            onMouseUp={() => {
              onFocus();
              onSelect(option.value);
            }}
            paddingTop={0}
            paddingBottom={0}
            style={{ backgroundColor: rowBackground }}
          >
            <box width={2}>
              <text style={{ fg: rowBackground }}>{selected ? "|" : " "}</text>
            </box>
            <box width={20}>
              <text
                attributes={selected ? TextAttributes.BOLD : undefined}
                style={{ fg: nameColor }}
              >
                {option.name}
              </text>
            </box>
            <box flexGrow={1}>
              <text
                attributes={TextAttributes.DIM}
                style={{ fg: descriptionColor }}
              >
                {option.description}
              </text>
            </box>
          </box>
        );
      })}
    </box>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <box
      alignItems="center"
      flexDirection="row"
      paddingTop={0}
      paddingBottom={0}
    >
      <box width={2}>
        <text> </text>
      </box>
      <box width={16}>
        <text attributes={TextAttributes.DIM} style={{ fg: "#737373" }}>
          {label}
        </text>
      </box>
      <box flexGrow={1} paddingLeft={1}>
        <text attributes={TextAttributes.DIM} style={{ fg: "#8a8a8a" }}>
          {value}
        </text>
      </box>
    </box>
  );
}

function buildRunSummary(values: ProcessFormValues) {
  const scope = processModeOptions.find(
    (option) => option.value === values.mode,
  );
  const jobs = values.concurrency.trim() || "auto";

  switch (values.mode) {
    case "diff":
      return `Will process changes from ${values.modeValue || getModeValuePlaceholder(values.mode)} with ${values.agent} using ${jobs} jobs.`;
    case "files":
      return `Will process selected file paths with ${values.agent} using ${jobs} jobs.`;
    case "files-from":
      return `Will process paths listed in ${values.modeValue || getModeValuePlaceholder(values.mode)} with ${values.agent} using ${jobs} jobs.`;
    default:
      return `Will process ${scope?.name ?? "selected scope"} with ${values.agent} using ${jobs} jobs.`;
  }
}

function ProcessRunOutput({
  activeStep,
  completedSteps,
  commandPreview,
  logs,
  runSummary,
  status,
}: {
  activeStep: "process" | "report" | null;
  completedSteps: string[];
  commandPreview: string;
  logs: string[];
  runSummary: string;
  status: string;
}) {
  return (
    <box flexDirection="column" paddingTop={1} paddingBottom={1}>
      <box flexDirection="column" paddingBottom={1}>
        <text attributes={TextAttributes.BOLD} style={{ fg: colors.bright }}>
          Process output
        </text>
        <text attributes={TextAttributes.DIM} style={{ fg: "#737373" }}>
          {status || runSummary}
        </text>
        <text attributes={TextAttributes.DIM} style={{ fg: "#5f5f5f" }}>
          {commandPreview}
        </text>
      </box>

      <box flexDirection="row" gap={2} paddingBottom={1}>
        {["process", "report"].map((step) => {
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

      <box
        flexDirection="column"
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        minHeight={16}
        style={{ backgroundColor: "#111111" }}
      >
        {logs.length ? (
          logs.map((line, index) => (
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
    </box>
  );
}

function filterRunOptions(options: ProcessRunOption[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return options.slice(0, 5);

  if (options.some((option) => option.id.toLowerCase() === normalized)) {
    return [];
  }

  return options
    .filter((option) => {
      return [option.id, option.label, option.detail]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    })
    .slice(0, 5);
}

function RunIdSuggestions({
  highlightedIndex,
  options,
  onSelect,
}: {
  highlightedIndex: number;
  options: ProcessRunOption[];
  onSelect: (option: ProcessRunOption) => void;
}) {
  return (
    <box flexDirection="column" paddingLeft={18}>
      {options.map((option, index) => {
        const isHighlighted = index === highlightedIndex;

        return (
          <box
            key={option.id}
            flexDirection="row"
            onMouseUp={() => onSelect(option)}
            paddingLeft={1}
            paddingRight={1}
            style={{ backgroundColor: isHighlighted ? "#1a1a1a" : colors.panel }}
          >
            <box width={22}>
              <text
                attributes={isHighlighted ? TextAttributes.BOLD : undefined}
                style={{ fg: isHighlighted ? colors.blue : "#8a8a8a" }}
              >
                {option.id}
              </text>
            </box>
            <box width={10}>
              <text style={{ fg: colors.bright }}>{option.label}</text>
            </box>
            <text attributes={TextAttributes.DIM} style={{ fg: "#737373" }}>
              {option.detail}
            </text>
          </box>
        );
      })}
    </box>
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
      paddingLeft={2}
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
}: InputProps & { width?: number | string }) {
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

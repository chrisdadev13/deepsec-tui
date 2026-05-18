import { spawn, type ChildProcess } from "node:child_process";
import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Footer, HeroLogo, StatusBar } from "../components/chrome";
import { useWorkspaceStatus } from "../hooks/useWorkspaceStatus";
import { buildActions, getDisabledReason } from "../lib/actions";
import { dashboardColors as colors } from "../lib/dashboardData";
import { getDeepsecDir, resolveWorkspaceRoot } from "../lib/workspace";
import {
  EnrichView,
  ExportView,
  MetricsView,
  RevalidateView,
  ScanView,
  TriageView,
} from "./CommandActionViews";
import { DashboardView } from "./DashboardView";
import { InitView } from "./InitView";
import { ProcessView } from "./ProcessView";

export function ActionView() {
  const { action } = useParams();

  if (action === "init") {
    return <InitActionRoute />;
  }

  if (action === "process") {
    return <ProcessActionRoute />;
  }

  if (
    action === "scan" ||
    action === "triage" ||
    action === "revalidate" ||
    action === "enrich" ||
    action === "export" ||
    action === "metrics"
  ) {
    return <CommandActionRoute action={action} />;
  }

  return <GenericActionView />;
}

function InitActionRoute() {
  const navigate = useNavigate();
  const { branchName, displayPath } = useWorkspaceStatus();
  const steps = ["init", "install"] as const;
  const [status, setStatus] = useState("starting deepsec init workflow...");
  const [result, setResult] = useState<"running" | "success" | "error">("running");
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "$ npx deepsec init",
    "$ pnpm install",
  ]);
  const activeStepIndex = activeStep ? steps.indexOf(activeStep as (typeof steps)[number]) : -1;

  useEffect(() => {
    let cancelled = false;
    let child: ChildProcess | null = null;
    let currentStep: string | null = null;
    const workspaceDir = resolveWorkspaceRoot();
    const deepsecDir = getDeepsecDir(workspaceDir);
    const workflow = [
      {
        label: "init",
        command: "npx",
        args: ["deepsec", "init"],
        cwd: workspaceDir,
        status: "initializing workspace",
      },
      {
        label: "install",
        command: "pnpm",
        args: ["install"],
        cwd: deepsecDir,
        status: "installing deepsec dependencies",
      },
    ] as const;

    function appendLog(line: string) {
      setLogs((current) => [...current, line].slice(-24));
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

    function runCommand(
      label: string,
      command: string,
      args: readonly string[],
      cwd: string,
    ) {
      return new Promise<void>((resolve, reject) => {
        const proc = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
        child = proc;
        appendLog(`$ ${command} ${args.join(" ")}`);

        attachStream("  ", proc.stdout);
        attachStream("  ! ", proc.stderr);

        proc.on("error", reject);
        proc.on("close", (code) => {
          child = null;

          if (code === 0) {
            appendLog(`ok ${label}`);
            resolve();
            return;
          }

          reject({ label, code });
        });
      });
    }

    void (async () => {
      try {
        for (const step of workflow) {
          if (cancelled) return;

          currentStep = step.label;
          setActiveStep(step.label);
          setStatus(step.status);
          await runCommand(step.label, step.command, step.args, step.cwd);
        }

        if (!cancelled) {
          currentStep = null;
          setActiveStep(null);
          setResult("success");
          setStatus("init and install completed successfully");
          navigate("/action/scan", { replace: true });
        }
      } catch (error) {
        if (cancelled) return;

        const failedStep =
          typeof error === "object" && error && "label" in error
            ? String(error.label)
            : currentStep ?? "workflow";
        const exitCode =
          typeof error === "object" && error && "code" in error
            ? error.code
            : null;

        setActiveStep(failedStep);
        setResult("error");
        setStatus(
          typeof exitCode === "number"
            ? `${failedStep} failed with status ${exitCode}`
            : `${failedStep} failed to start`,
        );
      }
    })();

    return () => {
      cancelled = true;
      child?.kill("SIGTERM");
    };
  }, []);

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "backspace") {
      navigate("/");
      return;
    }

    if (key.name === "return" && result !== "running") {
      navigate("/");
    }
  });

  return (
    <box flexDirection="column" flexGrow={1}>
      <StatusBar branch={branchName} path={displayPath} />

      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <box flexDirection="column" width={92} maxWidth="92%" gap={1}>
          <box alignItems="center" gap={2} flexDirection="column" marginBottom={1}>
            <HeroLogo />
            <text attributes={TextAttributes.BOLD}>init</text>
            <text>{status}</text>
          </box>

          <box flexDirection="row" gap={2}>
            {steps.map((step) => {
              const isActive = step === activeStep;
              const isDone = result === "success" || steps.indexOf(step) < activeStepIndex;

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
            minHeight={18}
            style={{ backgroundColor: colors.panel }}
          >
            {logs.map((line, index) => (
              <text key={`${index}-${line}`} style={{ fg: colors.text }}>
                {line}
              </text>
            ))}
          </box>

          {result === "success" ? <text>Workspace setup is complete. Opening scan options...</text> : null}

          {result === "error" ? (
            <text>See the log above for the failed command output.</text>
          ) : null}
        </box>
      </box>

      <Footer
        hint={
          result === "running"
            ? "running init and install"
            : result === "success"
              ? "init complete"
              : "init failed"
        }
        shortcuts={
          result === "running"
            ? []
            : [
                { key: "Enter", label: "return" },
                { key: "Esc", label: "return" },
                { key: "Backspace", label: "return" },
              ]
        }
      />
    </box>
  );
}

function ProcessActionRoute() {
  const navigate = useNavigate();
  const { workspaceState } = useWorkspaceStatus();

  function openAction(label: string) {
    navigate(`/action/${label}`);
  }

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0}>
      {workspaceState.hasWorkspace ? (
        <DashboardView keyboardDisabled={true} onOpenAction={openAction} />
      ) : (
        <InitView keyboardDisabled={true} onOpenAction={openAction} />
      )}
      <ProcessView onBack={() => navigate("/")} />
    </box>
  );
}

function CommandActionRoute({
  action,
}: {
  action: "scan" | "triage" | "revalidate" | "enrich" | "export" | "metrics";
}) {
  const navigate = useNavigate();
  const { workspaceState } = useWorkspaceStatus();

  function openAction(label: string) {
    navigate(`/action/${label}`);
  }

  return (
    <box flexDirection="column" flexGrow={1} minHeight={0}>
      {workspaceState.hasWorkspace ? (
        <DashboardView keyboardDisabled={true} onOpenAction={openAction} />
      ) : (
        <InitView keyboardDisabled={true} onOpenAction={openAction} />
      )}
      {action === "scan" ? <ScanView onBack={() => navigate("/")} /> : null}
      {action === "triage" ? <TriageView onBack={() => navigate("/")} /> : null}
      {action === "revalidate" ? <RevalidateView onBack={() => navigate("/")} /> : null}
      {action === "enrich" ? <EnrichView onBack={() => navigate("/")} /> : null}
      {action === "export" ? <ExportView onBack={() => navigate("/")} /> : null}
      {action === "metrics" ? <MetricsView onBack={() => navigate("/")} /> : null}
    </box>
  );
}

function GenericActionView() {
  const navigate = useNavigate();
  const { action } = useParams();
  const { branchName, displayPath, workspaceState } = useWorkspaceStatus();
  const actions = useMemo(() => buildActions(workspaceState), [workspaceState]);
  const currentAction = actions.find((item) => item.label === action);

  useKeyboard((key) => {
    if (key.name === "escape" || key.name === "backspace") {
      navigate("/");
    }

    if (key.name === "return") {
      navigate("/");
    }
  });

  return (
    <box flexDirection="column" flexGrow={1}>
      <StatusBar branch={branchName} path={displayPath} />

      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <box alignItems="center" gap={2} flexDirection="column" width={48}>
          <HeroLogo />
          <text>{currentAction ? currentAction.label : "unknown action"}</text>
          <text>
            {currentAction
              ? currentAction.description
              : "this action does not exist in the current menu"}
          </text>
          <text>
            {currentAction && currentAction.disabled
              ? getDisabledReason(currentAction.label)
              : "press escape or enter to go back"}
          </text>
        </box>
      </box>

      <Footer
        hint={currentAction ? `view for ${currentAction.label}` : "no action selected"}
        shortcuts={[
          { key: "Esc", label: "return" },
          { key: "Enter", label: "return" },
          { key: "Backspace", label: "return" },
        ]}
      />
    </box>
  );
}

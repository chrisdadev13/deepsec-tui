import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export type WorkspaceState = {
  hasWorkspace: boolean;
  hasCandidates: boolean;
  hasFindings: boolean;
};

function resolveGitRoot(cwd: string) {
  try {
    return realpathSync(
      execFileSync("git", ["rev-parse", "--show-toplevel"], {
        encoding: "utf8",
        cwd,
      }).trim(),
    );
  } catch {
    return null;
  }
}

export function getBranchName() {
  const workspaceRoot = resolveWorkspaceRoot();

  try {
    return execFileSync("git", ["branch", "--show-current"], {
      encoding: "utf8",
      cwd: workspaceRoot,
    }).trim();
  } catch {
    return "detached";
  }
}

export function getDisplayPath() {
  const cwd = resolveWorkspaceRoot();
  const homeDir = os.homedir();
  const ensureSlash = (path: string) => (path.endsWith("/") ? path : `${path}/`);

  if (cwd === homeDir) return ensureSlash("~");
  if (cwd.startsWith(`${homeDir}/`)) return ensureSlash(cwd.replace(homeDir, "~"));

  return ensureSlash(cwd);
}

export function getWorkspaceState(): WorkspaceState {
  const workspaceRoot = resolveWorkspaceRoot();
  const deepsecDir = getDeepsecDir(workspaceRoot);
  const hasWorkspace = existsSync(deepsecDir);

  if (!hasWorkspace) {
    return { hasWorkspace: false, hasCandidates: false, hasFindings: false };
  }

  const dataDir = path.join(deepsecDir, "data");
  let hasCandidates = false;
  let hasFindings = false;

  if (existsSync(dataDir)) {
    try {
      const projects = readdirSync(dataDir);
      for (const project of projects) {
        const filesDir = `${dataDir}/${project}/files`;
        if (existsSync(filesDir) && readdirSync(filesDir).length > 0) {
          hasCandidates = true;
        }

        const runsDir = `${dataDir}/${project}/runs`;
        if (existsSync(runsDir) && readdirSync(runsDir).length > 0) {
          hasFindings = true;
        }
      }
    } catch {
      // The data dir can exist before it is readable or fully initialized.
    }
  }

  return { hasWorkspace, hasCandidates, hasFindings };
}

export function resolveWorkspaceRoot(cwd = process.cwd()) {
  const resolvedCwd = realpathSync(path.resolve(cwd));

  if (path.basename(resolvedCwd) === ".deepsec" && existsSync(path.join(resolvedCwd, "deepsec.config.ts"))) {
    return path.dirname(resolvedCwd);
  }

  const gitRoot = resolveGitRoot(resolvedCwd);
  let current = resolvedCwd;

  while (true) {
    if (existsSync(path.join(current, ".deepsec"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (current === gitRoot || parent === current) {
      return gitRoot ?? resolvedCwd;
    }

    current = parent;
  }
}

export function getDeepsecDir(cwd = process.cwd()) {
  return path.join(resolveWorkspaceRoot(cwd), ".deepsec");
}

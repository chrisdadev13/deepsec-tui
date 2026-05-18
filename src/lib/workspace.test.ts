import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";

import { resolveWorkspaceRoot } from "./workspace";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "deepsec-tui-workspace-"));
  tempDirs.push(dir);
  return dir;
}

describe("resolveWorkspaceRoot", () => {
  test("does not reuse a parent .deepsec outside the git root", () => {
    const tempDir = createTempDir();
    const parentDeepsecDir = path.join(tempDir, ".deepsec");
    const repoRoot = path.join(tempDir, "project");
    const nestedDir = path.join(repoRoot, "src", "feature");

    mkdirSync(parentDeepsecDir, { recursive: true });
    writeFileSync(path.join(parentDeepsecDir, "deepsec.config.ts"), "export default {};\n");

    mkdirSync(nestedDir, { recursive: true });
    execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });

    expect(resolveWorkspaceRoot(nestedDir)).toBe(realpathSync(repoRoot));
  });

  test("finds .deepsec when it exists inside the git repo", () => {
    const tempDir = createTempDir();
    const repoRoot = path.join(tempDir, "project");
    const nestedDir = path.join(repoRoot, "src", "feature");
    const deepsecDir = path.join(repoRoot, ".deepsec");

    mkdirSync(nestedDir, { recursive: true });
    mkdirSync(deepsecDir, { recursive: true });
    writeFileSync(path.join(deepsecDir, "deepsec.config.ts"), "export default {};\n");
    execFileSync("git", ["init"], { cwd: repoRoot, stdio: "ignore" });

    expect(resolveWorkspaceRoot(nestedDir)).toBe(realpathSync(repoRoot));
  });
});

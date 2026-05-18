import { useMemo } from "react";
import { getBranchName, getDisplayPath, getWorkspaceState } from "../lib/workspace";

export function useWorkspaceStatus() {
  return useMemo(
    () => ({
      branchName: getBranchName(),
      displayPath: getDisplayPath(),
      workspaceState: getWorkspaceState(),
    }),
    [],
  );
}

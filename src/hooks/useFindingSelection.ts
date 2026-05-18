import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";

export function useFindingSelection<T>(findings: T[], keyboardDisabled = false) {
  const [selectedFindingIndex, setSelectedFindingIndex] = useState(0);
  const selectedFinding = findings[selectedFindingIndex] ?? findings[0] ?? null;

  useEffect(() => {
    setSelectedFindingIndex(0);
  }, [findings]);

  useKeyboard((key) => {
    if (keyboardDisabled || findings.length === 0) return;

    if (key.name === "up") {
      setSelectedFindingIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (key.name === "down") {
      setSelectedFindingIndex((current) => Math.min(findings.length - 1, current + 1));
    }
  });

  return { selectedFinding, selectedFindingIndex };
}

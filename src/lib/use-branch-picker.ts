"use client";

import { useCallback, useRef, useState } from "react";
import type { BranchPickerOptions } from "@/app/components/BranchPickerDialog";

type Pending = {
  options: BranchPickerOptions;
  resolve: (name: string | null) => void;
};

export function useBranchPicker() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const requestBranch = useCallback((options: BranchPickerOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      const entry: Pending = { options, resolve };
      pendingRef.current = entry;
      setPending(entry);
    });
  }, []);

  const close = useCallback(() => {
    pendingRef.current?.resolve(null);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const select = useCallback((name: string) => {
    pendingRef.current?.resolve(name);
    pendingRef.current = null;
    setPending(null);
  }, []);

  return {
    branchPickerOpen: !!pending,
    branchPickerOptions: pending?.options ?? null,
    requestBranch,
    closeBranchPicker: close,
    selectBranch: select,
  };
}

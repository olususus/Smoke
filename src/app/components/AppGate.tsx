"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredAuth } from "@/lib/auth";
import { applyReleaseRuntimeTuning, isReleaseBuild } from "@/lib/app-runtime";
import { SmokeBootScreen } from "./SmokeBootScreen";

const EXIT_MS = isReleaseBuild() ? 200 : 600;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removePbo() {
  const pbo = document.getElementById("__smoke_pbo");
  if (!pbo) return;
  pbo.style.opacity = "0";
  setTimeout(() => pbo.remove(), 240);
}

type BootPhase = "boot" | "exit" | "ready";

export function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<BootPhase>("boot");
  const [status, setStatus] = useState("Loading theme…");
  const bootRunRef = useRef(0);

  useEffect(() => {
    applyReleaseRuntimeTuning();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const runId = ++bootRunRef.current;

    (async () => {
      try {
        // Step 1: Theme (already loaded by inline script — brief acknowledgment)
        removePbo();
        if (!isReleaseBuild()) await sleep(300);

        if (bootRunRef.current !== runId) return;

        // Step 2: Auth check
        setStatus("Checking sign-in…");
        const auth = await Promise.race([
          getStoredAuth(),
          sleep(isReleaseBuild() ? 3000 : 8000).then(() => null),
        ]);
        const loggedIn = Boolean(auth?.has_token);

        if (bootRunRef.current !== runId) return;

        // Step 3: navigate
        if (!isReleaseBuild()) {
          setStatus(loggedIn ? "Welcome back" : "Almost there…");
          await sleep(350);
        }

        if (bootRunRef.current !== runId) return;

        const path = window.location.pathname;
        if (loggedIn && path === "/") {
          router.replace("/dashboard");
        } else if (!loggedIn && path !== "/") {
          router.replace("/");
        }

        setPhase("exit");
        await sleep(EXIT_MS);
      } catch {
        /* ignore boot errors */
      } finally {
        if (bootRunRef.current === runId) {
          setPhase("ready");
        }
      }
    })();
  }, [mounted, router]);

  // Before mount: render nothing — pre-boot overlay covers the screen
  if (!mounted) {
    return null;
  }

  const showBoot = phase !== "ready";

  return (
    <>
      {showBoot && <SmokeBootScreen status={status} exiting={phase === "exit"} />}
      <div className={showBoot ? "app-gate-content--hidden" : "app-gate-content"}>
        {children}
      </div>
    </>
  );
}

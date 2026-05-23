"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Copy, Check, ExternalLink } from "lucide-react";
import { AppLogo } from "./components/AppLogo";
import { NeuralBackdrop } from "./components/NeuralBackdrop";
import { AppMenubar } from "./components/AppMenubar";
import { BetaBanner } from "./components/BetaBanner";
import { normalizeDeviceCode, normalizePollResult, type DeviceCodeResponse } from "@/lib/tauri-auth";

function GitHubMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

type AuthStage = "idle" | "requesting" | "polling" | "success" | "error";

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export default function LoginPage() {
  const [stage, setStage] = useState<AuthStage>("idle");
  const [deviceData, setDeviceData] = useState<DeviceCodeResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [openingBrowser, setOpeningBrowser] = useState(false);
  const pollActiveRef = useRef(true);
  const browserOpenedRef = useRef(false);

  const openBrowser = useCallback(async () => {
    setOpeningBrowser(true);
    setErrorMsg("");
    try {
      await invokeTauri<string>("auth_open_device_page");
      setStatusMsg("Browser opened — approve the request on GitHub.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setOpeningBrowser(false);
    }
  }, []);

  const startAuth = useCallback(async () => {
    setStage("requesting");
    setErrorMsg("");
    setStatusMsg("");
    try {
      const raw = await invokeTauri<unknown>("auth_request_device_code");
      const data = normalizeDeviceCode(raw);
      setDeviceData(data);
      setStage("polling");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Could not start GitHub sign-in.");
      setStage("error");
    }
  }, []);

  useEffect(() => {
    if (stage !== "polling") {
      browserOpenedRef.current = false;
      return;
    }

    pollActiveRef.current = true;
    let pollIntervalMs = Math.max(3, deviceData?.interval || 5) * 1000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (!browserOpenedRef.current) {
      browserOpenedRef.current = true;
      void openBrowser();
    }

    const scheduleNext = (delayMs: number) => {
      if (!pollActiveRef.current) return;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => void poll(), delayMs);
    };

    const poll = async () => {
      if (!pollActiveRef.current) return;

      try {
        const raw = await invokeTauri<unknown>("auth_poll_token");
        const result = normalizePollResult(raw);

        if (!pollActiveRef.current) return;

        if (result.message) setStatusMsg(result.message);

        if (result.status === "success") {
          const { getStoredAuth } = await import("@/lib/auth");
          const auth = await getStoredAuth();
          if (!auth?.has_token) {
            setErrorMsg(
              "GitHub approved sign-in, but Smoke could not save your token. " +
                "Check ~/.config/smoke is writable and you have free disk space, then try again."
            );
            setStage("error");
            return;
          }
          setStage("success");
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 600);
          return;
        }

        if (result.status === "expired") {
          setErrorMsg(result.message ?? "Authorization expired.");
          setStage("error");
          return;
        }

        if (result.status === "slow_down" && result.retryAfterSecs) {
          pollIntervalMs = (result.retryAfterSecs + 1) * 1000;
        }

        scheduleNext(pollIntervalMs);
      } catch (err: unknown) {
        if (!pollActiveRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        if (msg.includes("denied") || msg.includes("No active sign-in")) {
          setStage("error");
          return;
        }
        scheduleNext(pollIntervalMs);
      }
    };

    void poll();

    return () => {
      pollActiveRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [stage, deviceData?.interval, openBrowser]);

  const handleVerifyToken = async () => {
    if (!manualToken.trim()) return;
    setVerifyingToken(true);
    setErrorMsg("");
    try {
      await invokeTauri("auth_login_with_token", { token: manualToken.trim() });
      setStage("success");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 600);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid token");
      setStage("error");
    } finally {
      setVerifyingToken(false);
    }
  };

  const copyCode = useCallback(async () => {
    if (!deviceData?.userCode) return;
    await navigator.clipboard.writeText(deviceData.userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [deviceData]);

  return (
    <div className="login-screen">
      <AppMenubar variant="minimal" />
      <BetaBanner />
      <div className="login-screen__body">
        <NeuralBackdrop />
        <div className="login-card glass-panel">
        <div className="login-hero">
          <AppLogo size={72} className="login-logo" />
          <h1 className="login-title">Sign in to Smoke</h1>
          <p className="login-subtitle">GitHub Desktop workflow for Linux</p>
        </div>

        {stage === "idle" && (
          <>
            <button type="button" className="login-github-btn" onClick={startAuth}>
              <GitHubMark />
              Sign in with GitHub
            </button>

            <div className="login-divider">or</div>

            <div className="login-pat-row">
              <input
                type="password"
                className="login-pat-input"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Personal access token"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVerifyToken();
                }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleVerifyToken}
                disabled={!manualToken.trim() || verifyingToken}
              >
                {verifyingToken ? <Loader2 size={14} className="animate-spin" /> : "Verify"}
              </button>
            </div>
          </>
        )}

        {stage === "requesting" && (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
            <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>Requesting device code…</p>
          </div>
        )}

        {stage === "polling" && deviceData && (
          <>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>
              Approve this code on GitHub:
            </p>
            <div
              className="login-device-code"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}
            >
              {deviceData.userCode}
              <button type="button" className="btn btn-ghost" onClick={copyCode} style={{ padding: 6 }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <button
              type="button"
              className="login-github-btn"
              onClick={openBrowser}
              disabled={openingBrowser}
            >
              {openingBrowser ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ExternalLink size={16} />
              )}
              Open GitHub in browser
            </button>
            <p
              style={{
                marginTop: 16,
                textAlign: "center",
                fontSize: 12,
                color: "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Loader2 size={12} className="animate-spin" />
              {statusMsg || "Waiting for authorization…"}
            </p>
            {errorMsg && (
              <div className="login-error" style={{ marginTop: 12 }}>
                {errorMsg}
              </div>
            )}
          </>
        )}

        {stage === "success" && (
          <div style={{ textAlign: "center", padding: 24, color: "var(--success)" }}>
            <Check size={32} strokeWidth={2.5} />
            <p style={{ marginTop: 8, fontWeight: 600 }}>Signed in</p>
          </div>
        )}

        {errorMsg && stage !== "polling" && <div className="login-error">{errorMsg}</div>}

        {stage === "error" && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: "100%", marginTop: 12 }}
            onClick={() => {
              setStage("idle");
              setErrorMsg("");
              setStatusMsg("");
              setDeviceData(null);
            }}
          >
            Try again
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

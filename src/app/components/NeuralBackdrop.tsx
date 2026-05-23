"use client";

/** Soft Frutiger-aero blobs (welcome-pane style) */
export function NeuralBackdrop({ variant = "full" }: { variant?: "full" | "subtle" }) {
  return (
    <div className={`aero-backdrop aero-backdrop--${variant}`} aria-hidden>
      <div className="aero-backdrop__blob aero-backdrop__blob--1" />
      <div className="aero-backdrop__blob aero-backdrop__blob--2" />
      <div className="aero-backdrop__blob aero-backdrop__blob--3" />
      <div className="aero-backdrop__blob aero-backdrop__blob--4" />
    </div>
  );
}

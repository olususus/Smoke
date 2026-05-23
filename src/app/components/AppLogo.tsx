"use client";

/** App mark from `public/logo.png` (also source for Tauri bundle icons). */
export function AppLogo({
  size = 64,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Smoke"
      width={size}
      height={size}
      className={`app-logo${className ? ` ${className}` : ""}`}
      draggable={false}
    />
  );
}

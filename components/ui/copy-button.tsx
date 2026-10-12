"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CopyIcon } from "@/components/ui/icons";

type CopyState = "idle" | "copied" | "failed";

export function CopyButton({
  value,
  label,
  variant = "secondary",
}: Readonly<{
  value: string;
  label: string;
  variant?: "primary" | "secondary";
}>) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    window.setTimeout(() => setCopyState("idle"), 2000);
  }

  const text =
    copyState === "copied"
      ? "Copied"
      : copyState === "failed"
        ? "Copy failed"
        : label;

  return (
    <Button variant={variant} onClick={copy}>
      <CopyIcon />
      <span aria-live="polite">{text}</span>
    </Button>
  );
}

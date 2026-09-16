"use client";

// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import { useEffect } from "react";
import { COPYRIGHT_NOTICE } from "@/lib/copyright";

/** Prints a console notice and appends attribution to long copied passages. Renders nothing. */
export function CopyrightGuard() {
  useEffect(() => {
    console.info(`%c${COPYRIGHT_NOTICE}`, "font: 600 12px monospace; color: #ff4400;");

    const onCopy = (event: ClipboardEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
      const text = window.getSelection()?.toString() ?? "";
      if (text.trim().length < 120 || !event.clipboardData) return;
      event.clipboardData.setData("text/plain", `${text}\n\n${COPYRIGHT_NOTICE}`);
      event.preventDefault();
    };

    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, []);

  return null;
}

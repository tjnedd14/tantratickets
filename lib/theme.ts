"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("tantra_theme") as Theme | null) || "dark";
    setThemeState(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    localStorage.setItem("tantra_theme", next);
    applyTheme(next);
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, setTheme, toggle, mounted };
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  if (t === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

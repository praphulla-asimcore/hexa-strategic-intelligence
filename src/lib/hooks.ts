"use client";

import { useEffect, useState } from "react";

/** Reads ?focus= from the URL after mount (avoids Suspense requirements of useSearchParams). */
export function useFocusParam() {
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    setFocus(new URLSearchParams(window.location.search).get("focus"));
  }, []);
  return [focus, setFocus] as const;
}

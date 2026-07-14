"use client";

import { useEffect, useState } from "react";

/** Returns `value`, but only updates after it's stopped changing for `delayMs` — the standard
 *  "don't spam the API while typing" debounce, generic so it isn't tied to search specifically. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

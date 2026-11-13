"use client";

import { useEffect } from "react";
import { describeError, isTransientRenderError } from "./report";

const retried = new Set<string>();

/**
 * Logs the message, stack and digest, then asks the boundary to re-fetch once when the
 * failure looks like a dropped connection or an aborted refresh. A second failure of the
 * same error stays on the screen so a real bug is not hidden.
 */
export function useBoundaryRecovery(scope: string, error: unknown, retry: () => void) {
  useEffect(() => {
    console.error(`[${scope}] render failed`, describeError(error));
    if (!isTransientRenderError(error)) return;
    const id = JSON.stringify(describeError(error));
    if (retried.has(id)) return;
    retried.add(id);
    retry();
  }, [scope, error, retry]);
}

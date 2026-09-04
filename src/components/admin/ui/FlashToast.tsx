"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast, type ToastKind } from "@/components/admin/ui/Toast";

const KINDS: ToastKind[] = ["success", "error", "info"];

/**
 * Shows a toast for a message carried in the URL, then strips it.
 *
 * Server actions that `redirect()` throw away all client state, so a toast
 * fired before the redirect would never render. Instead the action appends
 * `?flash=…&kind=…` to its destination and this picks it up on arrival —
 * the standard flash-message pattern. See `flashRedirect()` in
 * src/lib/admin/flash.ts for the writing half.
 */
export default function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const message = params.get("flash");
  const kind = params.get("kind");
  // Guards against re-firing when the router re-renders before the URL swap
  // has landed.
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    if (!message || shownRef.current === message) return;
    shownRef.current = message;

    toast(message, KINDS.includes(kind as ToastKind) ? (kind as ToastKind) : "success");

    // Drop the params so a refresh doesn't replay the message.
    const next = new URLSearchParams(params.toString());
    next.delete("flash");
    next.delete("kind");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [message, kind, params, pathname, router, toast]);

  return null;
}

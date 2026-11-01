"use client";

import { useEffect, useState } from "react";

let session: Promise<boolean> | null = null;

/** One request per page load, however many components ask. A failed check counts as signed in. */
function readIsGuest(): Promise<boolean> {
  session ??= fetch("/api/auth/session")
    .then((response) => response.json())
    .then((data) => !data?.user)
    .catch(() => false);
  return session;
}

/**
 * Is this visitor signed out? Asked in the browser, because the public pages are statically
 * generated and can't know who is looking. False until the answer is in, so nothing aimed at
 * new customers flashes up in front of someone who already has an account.
 */
export function useIsGuest(): boolean {
  const [guest, setGuest] = useState(false);
  useEffect(() => {
    let live = true;
    readIsGuest().then((value) => {
      if (live) setGuest(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return guest;
}

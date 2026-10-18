"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * The visitor's delivery address, remembered on this device after they give it once
 * (the "Where should we deliver?" dialog), so checkout can fill itself in.
 *
 * It lives in localStorage — the same place the basket lives — and nowhere else: it is
 * never sent to the server until an order is placed. Like all stored data it is
 * untrusted on the way back in (`readLocation` checks every field), and the server
 * measures the address itself at checkout regardless.
 */

export interface SavedLocation {
  street: string;
  houseNumber: string;
  addition: string;
  postcode: string;
  city: string;
  /** Straight-line km from the kitchen, as measured when it was saved. */
  km: number | null;
}

const STORAGE_KEY = "kebabish-location-v1";
const CHANGE_EVENT = "kebabish-location-change";
/** An address this old is probably someone else's, or an old flat — ask again. */
const MAX_AGE_MS = 90 * 86_400_000;

// Kept in memory too, so a browser that refuses storage (private mode) still remembers
// the address for the rest of the visit.
let memory = "";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

/** null = "not read yet" (server render and the first client paint agree on it). */
function getServerSnapshot(): string | null {
  return null;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Turn what was stored into a valid address, or null if it isn't one. */
export function readLocation(raw: string | null): SavedLocation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (!v || typeof v !== "object") return null;
    const savedAt = typeof v.savedAt === "number" ? v.savedAt : 0;
    if (Date.now() - savedAt > MAX_AGE_MS) return null;

    const postcode = text(v.postcode, 8).replace(/\s+/g, "").toUpperCase();
    const houseNumber = text(v.houseNumber, 12);
    const street = text(v.street, 80);
    const city = text(v.city, 60);
    if (!/^[1-9]\d{3}[A-Z]{2}$/.test(postcode) || !houseNumber || !street || !city) return null;

    const km = typeof v.km === "number" && Number.isFinite(v.km) ? v.km : null;
    return { street, houseNumber, addition: text(v.addition, 12), postcode, city, km };
  } catch {
    return null;
  }
}

interface LocationContextValue {
  /** False until storage has been read, so server and browser agree on the first paint. */
  ready: boolean;
  location: SavedLocation | null;
  save: (location: SavedLocation) => void;
  clear: () => void;
  dialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

const noop = () => {};
const LocationContext = createContext<LocationContextValue>({
  ready: true,
  location: null,
  save: noop,
  clear: noop,
  dialogOpen: false,
  openDialog: noop,
  closeDialog: noop,
});

export function useLocation() {
  return useContext(LocationContext);
}

export default function LocationProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dialogOpen, setDialogOpen] = useState(false);

  const ready = raw !== null;
  const location = useMemo(() => readLocation(raw), [raw]);

  const write = useCallback((value: string) => {
    memory = value;
    try {
      if (value) window.localStorage.setItem(STORAGE_KEY, value);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // No storage: the in-memory copy still serves this visit.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const save = useCallback(
    (next: SavedLocation) => write(JSON.stringify({ ...next, savedAt: Date.now() })),
    [write]
  );
  const clear = useCallback(() => write(""), [write]);
  const openDialog = useCallback(() => setDialogOpen(true), []);
  const closeDialog = useCallback(() => setDialogOpen(false), []);

  const value = useMemo(
    () => ({ ready, location, save, clear, dialogOpen, openDialog, closeDialog }),
    [ready, location, save, clear, dialogOpen, openDialog, closeDialog]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

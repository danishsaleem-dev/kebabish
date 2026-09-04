import type { StoredSettings } from "@/lib/admin/store/types";

/**
 * Store hours are fixed to the kitchen's own clock, not the visitor's —
 * always compute "now" in Europe/Amsterdam regardless of where the
 * request is served from or where the visitor is.
 */
const TIME_ZONE = "Europe/Amsterdam";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface StoreStatus {
  /** True only when the owner has ordering switched on AND it's within today's hours. */
  isOpen: boolean;
  acceptingOrders: boolean;
  orderNotice: string;
  today: StoredSettings["hours"][number];
}

function nowInAmsterdam() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return { day: WEEKDAYS.indexOf(weekday), minutes: hour * 60 + minute };
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function getStoreStatus(settings: StoredSettings): StoreStatus {
  const { day, minutes } = nowInAmsterdam();
  const today =
    settings.hours.find((h) => h.day === day) ?? settings.hours[0];

  const withinHours =
    !today.closed &&
    minutes >= toMinutes(today.opens) &&
    minutes < toMinutes(today.closes);

  return {
    isOpen: settings.acceptingOrders && withinHours,
    acceptingOrders: settings.acceptingOrders,
    orderNotice: settings.orderNotice,
    today,
  };
}

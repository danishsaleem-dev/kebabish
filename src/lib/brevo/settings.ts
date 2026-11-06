import "server-only";
import { getSettings, updateSettings } from "@/lib/admin/store";
import { siteConfig } from "@/lib/site-config";

/**
 * The integration's own settings, inside the store document.
 *
 * A slice of `StoredSettings` rather than a table of its own: these are a
 * handful of ids and a timestamp, exactly the shape the store document is
 * for, and giving them a table would mean a migration for every new field.
 *
 * **The API key is never in here.** It is `BREVO_API_KEY`, read server-side
 * only. The store document is backed up and restored and read by several
 * screens; a credential has no business in it.
 */

export interface BrevoSettings {
  /** The standing "Kebabish subscribers" list in Brevo. */
  listId?: number | null;
  /** The folder ad-hoc selection lists are filed in. */
  folderId?: number | null;
  /** Shown as the sender on campaigns. Defaults to the brand and info@. */
  senderName?: string;
  senderEmail?: string;
  /** When the full contact sync last ran, and how many contacts it pushed. */
  lastSyncAt?: string;
  lastSyncCount?: number;
  /** The webhook registered with Brevo, so the settings screen can say whether it exists. */
  webhookId?: number | null;
  /**
   * The last send the admin submitted, as `<hash>:<campaignId>`. A repeat of
   * the same submission within the hour is answered with that campaign rather
   * than creating a second one — the double-click guard.
   */
  lastSendKey?: string;
  lastSendAt?: string;
}

function defaults(): BrevoSettings {
  return {
    listId: null,
    folderId: null,
    senderName: siteConfig.brandName,
    senderEmail: siteConfig.contact.email,
    webhookId: null,
  };
}

/**
 * Read and write the slice.
 *
 * `updateSettings()` is a shallow top-level merge, so writing `brevo` replaces
 * the whole object — which is why `update()` reads first and spreads. Getting
 * this wrong would silently drop the list id every time the sender changed.
 */
export const supabaseStore = {
  async read(): Promise<BrevoSettings> {
    try {
      const settings = await getSettings();
      return { ...defaults(), ...(settings.brevo ?? {}) };
    } catch (error) {
      console.error("[brevo] could not read the integration settings:", error);
      return defaults();
    }
  },

  async update(patch: Partial<BrevoSettings>): Promise<BrevoSettings> {
    const current = await this.read();
    const next: BrevoSettings = { ...current, ...patch };
    await updateSettings({ brevo: next });
    return next;
  },
};

/** The sender every campaign goes out as. Brevo requires one. */
export async function campaignSender(): Promise<{ name: string; email: string }> {
  const settings = await supabaseStore.read();
  return {
    name: settings.senderName?.trim() || siteConfig.brandName,
    email: settings.senderEmail?.trim() || siteConfig.contact.email,
  };
}

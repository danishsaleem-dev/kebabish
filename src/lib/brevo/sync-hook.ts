import "server-only";
import { after } from "next/server";

/**
 * "This person's marketing contact needs refreshing in Brevo."
 *
 * Called from the places a customer's consent or details change — checkout,
 * signup, the dashboard's preferences, the account form. Three deliberate
 * choices here, all of them about the call never being felt by the customer:
 *
 * - **`after()`**, so the work happens once the response has gone out. This
 *   is the pattern the fourteen email call sites already use.
 * - **A dynamic import**, so the whole Brevo layer stays out of the module
 *   graph of the checkout action unless it is actually needed. Checkout is
 *   the hottest path on the site and it should not be loading a marketing
 *   client to decide it doesn't need one.
 * - **It cannot throw.** A Brevo outage, a missing key or an unrun migration
 *   must never fail an order or a saved preference. Whatever this misses, the
 *   nightly catch-up pass (`syncContactsDaily`) picks up.
 */
export function queueContactSync(email: string | null | undefined): void {
  const address = String(email ?? "").trim();
  if (!address) return;

  const run = async () => {
    try {
      if (!process.env.BREVO_API_KEY?.trim()) return;
      const { syncOneContact } = await import("@/lib/brevo/contacts");
      await syncOneContact(address);
    } catch (error) {
      console.error("[brevo] background contact sync failed:", error);
    }
  };

  try {
    after(run);
  } catch {
    // Not inside a request (a script, or a call during build): let it go
    // rather than blocking. The daily pass is the backstop.
    void run();
  }
}

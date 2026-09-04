/**
 * Builds a redirect URL carrying a flash message.
 *
 * Used by server actions that redirect after success — the client is torn
 * down by the navigation, so the message has to travel in the URL.
 * `FlashToast` reads it on arrival and removes it from the address bar.
 */
export function flashRedirect(
  path: string,
  message: string,
  kind: "success" | "error" | "info" = "success"
): string {
  const params = new URLSearchParams({ flash: message.slice(0, 200), kind });
  return `${path}?${params.toString()}`;
}

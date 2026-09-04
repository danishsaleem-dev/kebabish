import { Suspense, type ReactNode } from "react";
import { ToastProvider } from "@/components/admin/ui/Toast";
import FlashToast from "@/components/admin/ui/FlashToast";

/**
 * The inside of <body> shared by every authenticated section (admin, the
 * auth pages, the customer dashboard). Kept separate from the fonts/<html>
 * wrapper so each segment's layout.tsx stays a two-line file.
 */
export default function AppShellBody({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {/* useSearchParams needs a boundary so it can't opt whole pages out
          of static rendering. */}
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
      {children}
    </ToastProvider>
  );
}

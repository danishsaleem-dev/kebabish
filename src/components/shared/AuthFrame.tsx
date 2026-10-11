import type { ReactNode } from "react";
import BrandLogo from "@/components/shared/BrandLogo";

/** The logo + heading + card the standalone auth pages share. */
export default function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo
            src="/logo/Kebabish-light.png"
            alt="Kebabish"
            width={300}
            height={225}
            priority
            className="h-14 w-auto"
          />
          <h1 className="mt-5 font-display text-xl font-semibold text-heading">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-hairline bg-panel p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

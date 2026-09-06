"use client";

import Image, { type ImageProps } from "next/image";

/**
 * The Kebabish logo, wrapped with light anti-theft affordances: no
 * right-click "Save image as…", no native drag-out. This is a deterrent,
 * not real protection — view-source, devtools and screenshots still work,
 * and can't not — but it stops the casual right-click a visitor might
 * otherwise do. A client component (event handlers), so it's dropped into
 * server-rendered pages the same way Motion/CartButton already are.
 */
export default function BrandLogo({ className = "", ...props }: ImageProps) {
  return (
    <Image
      {...props}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-auto select-none ${className}`}
    />
  );
}

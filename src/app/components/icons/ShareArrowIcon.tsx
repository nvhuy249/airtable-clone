"use client";

import React from "react";

// Simple share/arrow icon resembling Airtable's share glyph.
export function ShareArrowIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* vertical + baseline */}
      <path d="M6 4.5v11.5a2 2 0 0 0 2 2h8.5" />
      {/* curved arrow */}
      <path d="M12 13.5c2.5-3.5 5.5-4 9-4" />
      <path d="m20.5 9.5-3-3" />
      <path d="m20.5 9.5-3 3" />
    </svg>
  );
}

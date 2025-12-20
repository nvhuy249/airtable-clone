"use client";

import React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

// 16x16 grid icon modeled after Airtable's sprite-style glyph.
export function GridViewIcon({ className, ...rest }: IconProps) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M2.5 2C1.672 2 1 2.672 1 3.5v9c0 .828.672 1.5 1.5 1.5h11c.828 0 1.5-.672 1.5-1.5v-9C15 2.672 14.328 2 13.5 2h-11ZM2.5 3h11c.276 0 .5.224.5.5V5H2V3.5c0-.276.224-.5.5-.5ZM2 6h5.5v7H2.5a.5.5 0 0 1-.5-.5V6Zm6.5 0H14v6.5a.5.5 0 0 1-.5.5H8.5V6Z"
      />
      <path
        d="M8 6.25v6.5"
        stroke="currentColor"
        strokeWidth={0.9}
        strokeLinecap="round"
      />
      <path
        d="M2 9.75h12"
        stroke="currentColor"
        strokeWidth={0.9}
        strokeLinecap="butt"
      />
    </svg>
  );
}

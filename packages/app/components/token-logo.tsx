"use client";

import { useState } from "react";

const sizeClasses = {
  xs: { container: "w-4 h-4 text-[8px]", img: "w-4 h-4" },
  sm: { container: "w-5 h-5 text-[10px]", img: "w-5 h-5" },
  md: { container: "w-7 h-7 text-xs", img: "w-7 h-7" },
  "md-lg": { container: "w-10 h-10 text-sm", img: "w-10 h-10" },
  lg: { container: "w-12 h-12 text-base", img: "w-12 h-12" },
} as const;

const vineRingSize = {
  xs: "w-6 h-6",
  sm: "w-7 h-7",
  md: "w-9 h-9",
  "md-lg": "w-14 h-14",
  lg: "w-16 h-16",
} as const;

export type TokenLogoSize = keyof typeof sizeClasses;

type TokenLogoProps = {
  name: string;
  logoUrl?: string | null;
  size?: TokenLogoSize;
  showVineRing?: boolean;
};

export function TokenLogo({
  name,
  logoUrl,
  size = "md-lg",
  showVineRing = false,
}: TokenLogoProps) {
  const [imgError, setImgError] = useState(false);
  const classes = sizeClasses[size];
  const gradient = "from-moss-400 to-moss-600";

  const logoElement =
    logoUrl && !imgError ? (
      <img
        src={logoUrl}
        alt={name}
        className={`${classes.img} rounded-full object-cover`}
        onError={() => setImgError(true)}
      />
    ) : (
      <div
        className={`${classes.container} rounded-full flex items-center justify-center font-semibold bg-gradient-to-br ${gradient} text-white shadow-lg`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );

  if (showVineRing) {
    return (
      <div className={`relative inline-flex items-center justify-center ${vineRingSize[size]}`}>
        <img
          src="/botanicals/vine-ring.svg"
          alt=""
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10">
          {logoElement}
        </div>
      </div>
    );
  }

  return logoElement;
}

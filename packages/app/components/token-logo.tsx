"use client";

import { useState } from "react";

const sizeClasses = {
  xs: { container: "w-4 h-4 text-[8px]", img: "w-4 h-4" },
  sm: { container: "w-5 h-5 text-[10px]", img: "w-5 h-5" },
  md: { container: "w-7 h-7 text-xs", img: "w-7 h-7" },
  "md-lg": { container: "w-10 h-10 text-sm", img: "w-10 h-10" },
  lg: { container: "w-12 h-12 text-base", img: "w-12 h-12" },
} as const;

export type TokenLogoSize = keyof typeof sizeClasses;

function rigTypeGradient(rigType: string): string {
  switch (rigType) {
    case "spin":
      return "from-purple-500 to-purple-700";
    case "fund":
      return "from-emerald-500 to-emerald-700";
    case "mine":
    default:
      return "from-blue-500 to-blue-700";
  }
}

type TokenLogoProps = {
  name: string;
  logoUrl?: string | null;
  size?: TokenLogoSize;
  rigType?: string;
};

export function TokenLogo({
  name,
  logoUrl,
  size = "md-lg",
  rigType,
}: TokenLogoProps) {
  const [imgError, setImgError] = useState(false);
  const classes = sizeClasses[size];
  const gradient = rigType
    ? rigTypeGradient(rigType)
    : "from-zinc-500 to-zinc-700";
  const shadowClass = rigType ? " shadow-lg" : "";

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={`${classes.img} rounded-full object-cover`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${classes.container} rounded-full flex items-center justify-center font-semibold bg-gradient-to-br ${gradient} text-white${shadowClass}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

"use client";

import { memo } from "react";
import { formatUnits } from "viem";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useBatchProfiles";
import { viewProfile } from "@/hooks/useFarcaster";
import { formatNumber } from "@/lib/format";
import { TokenLogo } from "@/components/token-logo";

type DonationHistoryItemProps = {
  donation: {
    id: string;
    donor: string;
    uri?: string;
    amount: bigint;
    estimatedTokens: bigint;
    timestamp: number;
  };
  timeAgo: (ts: number) => string;
  tokenSymbol?: string;
  logoUrl?: string;
  isNew?: boolean;
};

export const DonationHistoryItem = memo(function DonationHistoryItem({
  donation,
  timeAgo,
  tokenSymbol = "TOKEN",
  logoUrl,
  isNew,
}: DonationHistoryItemProps) {
  const { displayName, avatarUrl, fid } = useProfile(donation.donor);

  const handleProfileClick = () => {
    if (fid) viewProfile(fid);
  };

  const amount = Number(formatUnits(donation.amount, 6));
  const tokens = Number(formatUnits(donation.estimatedTokens, 18));

  return (
    <div
      className={`data-row flex items-center gap-3 px-3 py-3 transition-colors duration-1000 ${
        isNew ? "light-leak animate-bump-in" : ""
      }`}
    >
      <button
        onClick={handleProfileClick}
        disabled={!fid}
        className={fid ? "cursor-pointer" : "cursor-default"}
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="text-xs">
            {donation.donor.slice(2, 4).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleProfileClick}
            disabled={!fid}
            className={`truncate text-sm font-medium ${fid ? "cursor-pointer hover:text-primary" : "cursor-default"}`}
          >
            {displayName}
          </button>
          <span className="text-xs text-muted-foreground">{timeAgo(donation.timestamp)}</span>
        </div>
        {donation.uri && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{donation.uri}</div>
        )}
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 text-right">
        <div>
          <div className="text-[12px] text-muted-foreground">Funded</div>
          <div className="text-[13px] font-medium font-mono tabular-nums">${amount.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[12px] text-muted-foreground">Mining</div>
          <div className="text-[13px] font-medium font-mono tabular-nums flex items-center justify-end gap-1">
            <TokenLogo name={tokenSymbol} logoUrl={logoUrl} size="xs" variant="circle" />
            {formatNumber(tokens, 0)}
          </div>
        </div>
      </div>
    </div>
  );
});

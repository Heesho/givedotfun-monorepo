import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { zeroAddress } from "viem";
import {
  CONTRACT_ADDRESSES,
  MULTICALL_ABI,
  type FundraiserState,
  type ClaimableEpoch,
} from "@/lib/contracts";

export function useFundraiserState(
  fundraiserAddress: `0x${string}` | undefined,
  account: `0x${string}` | undefined,
  enabled: boolean = true,
) {
  const multicallAddr = CONTRACT_ADDRESSES.multicall as `0x${string}`;

  const { data: rawState, refetch, isLoading } = useReadContract({
    address: multicallAddr,
    abi: MULTICALL_ABI,
    functionName: "getFundraiser",
    args: fundraiserAddress ? [fundraiserAddress, account ?? zeroAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!fundraiserAddress && enabled,
      refetchInterval: 5_000,
    },
  });

  const fundraiserState = rawState as FundraiserState | undefined;
  const currentEpoch = fundraiserState?.currentEpoch ?? 0n;

  // Fetch claimable epochs (from epoch 0 to currentEpoch)
  const { data: rawClaimable } = useReadContract({
    address: multicallAddr,
    abi: MULTICALL_ABI,
    functionName: "getClaimableEpochs",
    args: fundraiserAddress && account
      ? [fundraiserAddress, account, 0n, currentEpoch]
      : undefined,
    chainId: base.id,
    query: {
      enabled: !!fundraiserAddress && !!account && currentEpoch > 0n && enabled,
      refetchInterval: 10_000,
    },
  });

  // Fetch total pending rewards
  const { data: rawPending } = useReadContract({
    address: multicallAddr,
    abi: MULTICALL_ABI,
    functionName: "getTotalPendingRewards",
    args: fundraiserAddress && account
      ? [fundraiserAddress, account, 0n, currentEpoch]
      : undefined,
    chainId: base.id,
    query: {
      enabled: !!fundraiserAddress && !!account && currentEpoch > 0n && enabled,
      refetchInterval: 10_000,
    },
  });

  const claimableEpochs = (rawClaimable as ClaimableEpoch[] | undefined)
    ?.filter(d => !d.hasClaimed && d.pendingReward > 0n) ?? [];

  // rawPending is a tuple: [totalPending, unclaimedDays[]]
  const totalPending = rawPending
    ? (rawPending as [bigint, bigint[]])[0]
    : 0n;

  return {
    fundraiserState,
    claimableEpochs,
    totalPending,
    refetch,
    isLoading,
  };
}

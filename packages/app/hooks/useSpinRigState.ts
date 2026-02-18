import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { zeroAddress } from "viem";
import {
  CONTRACT_ADDRESSES,
  SPIN_MULTICALL_ABI,
  type SpinRigState,
} from "@/lib/contracts";

export function useSpinRigState(
  rigAddress: `0x${string}` | undefined,
  account: `0x${string}` | undefined,
  enabled: boolean = true,
) {
  const multicallAddr = CONTRACT_ADDRESSES.spinMulticall as `0x${string}`;

  const { data: rawState, refetch, isLoading } = useReadContract({
    address: multicallAddr,
    abi: SPIN_MULTICALL_ABI,
    functionName: "getRig",
    args: rigAddress ? [rigAddress, account ?? zeroAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!rigAddress && enabled,
      refetchInterval: 15_000,
    },
  });

  const { data: rawOdds } = useReadContract({
    address: multicallAddr,
    abi: SPIN_MULTICALL_ABI,
    functionName: "getOdds",
    args: rigAddress ? [rigAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!rigAddress && enabled,
      staleTime: 60_000,
    },
  });

  return {
    spinState: rawState as SpinRigState | undefined,
    odds: (rawOdds as bigint[] | undefined) ?? [],
    refetch,
    isLoading,
  };
}

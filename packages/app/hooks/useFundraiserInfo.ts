import { useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import {
  CONTRACT_ADDRESSES,
  FUNDRAISER_ABI,
  ERC20_ABI,
} from "@/lib/contracts";

export type FundraiserInfo = {
  address: `0x${string}`;
  coinAddress: `0x${string}`;
  auctionAddress: `0x${string}`;
  lpAddress: `0x${string}`;
  quoteAddress: `0x${string}`;
  launcher: `0x${string}`;
  tokenName: string;
  tokenSymbol: string;
};

// Simplified core ABI for reading fundraiser-to-auction and fundraiser-to-LP mappings
const CORE_ABI = [
  {
    inputs: [{ internalType: "address", name: "fundraiser", type: "address" }],
    name: "fundraiserToAuction",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "fundraiser", type: "address" }],
    name: "fundraiserToLP",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function useFundraiserInfo(
  fundraiserAddress: `0x${string}` | undefined,
  coreAddress?: `0x${string}`,
) {
  const resolvedCore = coreAddress ?? CONTRACT_ADDRESSES.core as `0x${string}`;

  // Get coin token address from fundraiser contract
  const { data: coinAddress } = useReadContract({
    address: fundraiserAddress,
    abi: FUNDRAISER_ABI,
    functionName: "coin",
    chainId: base.id,
    query: {
      enabled: !!fundraiserAddress,
    },
  });

  // Get quote token address from fundraiser contract
  const { data: quoteAddress } = useReadContract({
    address: fundraiserAddress,
    abi: FUNDRAISER_ABI,
    functionName: "quote",
    chainId: base.id,
    query: {
      enabled: !!fundraiserAddress,
    },
  });

  // Get auction address from Core
  const { data: auctionAddress } = useReadContract({
    address: resolvedCore,
    abi: CORE_ABI,
    functionName: "fundraiserToAuction",
    args: fundraiserAddress ? [fundraiserAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!fundraiserAddress,
    },
  });

  // Get LP token address from Core
  const { data: lpAddress } = useReadContract({
    address: resolvedCore,
    abi: CORE_ABI,
    functionName: "fundraiserToLP",
    args: fundraiserAddress ? [fundraiserAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!fundraiserAddress,
    },
  });

  // Get owner (launcher) from fundraiser contract
  const { data: launcher } = useReadContract({
    address: fundraiserAddress,
    abi: [
      {
        inputs: [],
        name: "owner",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
      },
    ] as const,
    functionName: "owner",
    chainId: base.id,
    query: {
      enabled: !!fundraiserAddress,
    },
  });

  // Get token name
  const { data: tokenName } = useReadContract({
    address: coinAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "name",
    chainId: base.id,
    query: {
      enabled: !!coinAddress,
    },
  });

  // Get token symbol
  const { data: tokenSymbol } = useReadContract({
    address: coinAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "symbol",
    chainId: base.id,
    query: {
      enabled: !!coinAddress,
    },
  });

  const fundraiserInfo: FundraiserInfo | undefined =
    fundraiserAddress && coinAddress && auctionAddress && lpAddress && launcher
      ? {
          address: fundraiserAddress,
          coinAddress: coinAddress as `0x${string}`,
          auctionAddress: auctionAddress as `0x${string}`,
          lpAddress: lpAddress as `0x${string}`,
          quoteAddress: (quoteAddress as `0x${string}`) ?? CONTRACT_ADDRESSES.usdc,
          launcher: launcher as `0x${string}`,
          tokenName: (tokenName as string) ?? "",
          tokenSymbol: (tokenSymbol as string) ?? "",
        }
      : undefined;

  return {
    fundraiserInfo,
    isLoading: !fundraiserInfo && !!fundraiserAddress,
  };
}

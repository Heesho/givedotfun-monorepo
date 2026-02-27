import { GraphQLClient, gql } from "graphql-request";

// Subgraph URL (Goldsky)
export const LAUNCHPAD_SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_LAUNCHPAD_SUBGRAPH_URL ||
  "https://api.goldsky.com/api/public/project_cmgscxhw81j5601xmhgd42rej/subgraphs/givedotfun/1.0.0/gn";

const client = new GraphQLClient(LAUNCHPAD_SUBGRAPH_URL);

// =============================================================================
// Types matching the subgraph schema
// =============================================================================

export type SubgraphLaunchpad = {
  id: string;
  totalCoins: string;
  totalFundraisers: string;
  totalVolumeUsdc: string;
  totalLiquidityUsdc: string;
  totalTreasuryRevenue: string;
  totalProtocolRevenue: string;
  totalMinted: string;
};

export type SubgraphFundraiser = {
  id: string; // Fundraiser contract address
  coin: {
    id: string; // Coin token address
    name: string;
    symbol: string;
    lpPair: string; // LP pair address (Bytes)
    price: string; // BigDecimal (in USDC)
    marketCap: string; // BigDecimal (in USDC)
    liquidity: string; // BigDecimal (USDC in LP)
    totalSupply: string; // BigDecimal
    totalMinted: string; // BigDecimal
    lastActivityAt: string; // BigInt timestamp
    createdAt: string;
  };
  launcher: { id: string };
  auction: string; // Bytes
  quoteToken: string; // Bytes
  uri: string;
  usdcAmount: string; // BigDecimal — USDC deposited into LP at launch
  coinAmount: string; // BigDecimal — Coin tokens deposited into LP at launch
  treasuryRevenue: string; // BigDecimal
  teamRevenue: string; // BigDecimal
  protocolRevenue: string; // BigDecimal
  recipientRevenue: string; // BigDecimal
  totalMinted: string; // BigDecimal
  lastActivityAt: string; // BigInt
  createdAt: string;
  createdAtBlock: string;
  initialEmission: string;
  minEmission: string;
  halvingPeriod: string;
  minDonation: string;
  epochDuration: string;
};

export type SubgraphCoinListItem = {
  id: string; // Coin token address
  name: string;
  symbol: string;
  lpPair: string;
  price: string;
  priceUSD: string;
  marketCap: string;
  marketCapUSD: string;
  liquidity: string;
  liquidityUSD: string;
  volume24h: string;
  priceChange24h: string;
  totalSupply: string;
  totalMinted: string;
  lastActivityAt: string;
  createdAt: string;
  dayData?: { close: string; open: string; timestamp: string }[];
  fundraiser: {
    id: string; // Fundraiser contract address
    uri: string;
    launcher: { id: string };
    auction: string;
  };
};

export type SubgraphAccount = {
  id: string;
  totalSwapVolume: string;
  totalFundraiserSpend: string;
  lastActivityAt: string;
};

export type SubgraphDonation = {
  id: string;
  donor: { id: string };
  day: string;
  amount: string; // BigDecimal (USDC)
  uri: string;
  recipientAmount: string; // BigDecimal
  recipient: string | null; // nullable
  timestamp: string;
  txHash: string;
};

export type SubgraphCoinCandle = {
  id: string;
  timestamp: string;
  open: string; // BigDecimal price in USDC
  high: string;
  low: string;
  close: string;
  volumeCoin: string;
  volumeUsdc: string;
  txCount: string;
};

// =============================================================================
// GraphQL field fragments (reusable field sets)
// =============================================================================

const FUNDRAISER_FIELDS = `
  id
  coin {
    id
    name
    symbol
    lpPair
    price
    marketCap
    liquidity
    totalSupply
    totalMinted
    lastActivityAt
    createdAt
  }
  launcher { id }
  auction
  quoteToken
  uri
  usdcAmount
  coinAmount
  treasuryRevenue
  teamRevenue
  protocolRevenue
  recipientRevenue
  totalMinted
  lastActivityAt
  createdAt
  createdAtBlock
  initialEmission
  minEmission
  halvingPeriod
  minDonation
  epochDuration
`;

const COIN_LIST_FIELDS = `
  id
  name
  symbol
  lpPair
  price
  priceUSD
  marketCap
  marketCapUSD
  liquidity
  liquidityUSD
  volume24h
  priceChange24h
  totalSupply
  totalMinted
  lastActivityAt
  createdAt
  dayData(first: 7, orderBy: timestamp, orderDirection: desc) {
    close
    open
    timestamp
  }
  fundraiser {
    id
    uri
    launcher { id }
    auction
  }
`;

// =============================================================================
// Queries
// =============================================================================

// Get global protocol stats
export const GET_LAUNCHPAD_STATS_QUERY = gql`
  query GetProtocolStats {
    protocol(id: "givedotfun") {
      id
      totalCoins
      totalFundraisers
      totalVolumeUsdc
      totalLiquidityUsdc
      totalTreasuryRevenue
      totalProtocolRevenue
      totalMinted
    }
  }
`;

// Get fundraisers with pagination and ordering
export const GET_FUNDRAISERS_QUERY = gql`
  query GetFundraisers(
    $first: Int!
    $skip: Int!
    $orderBy: Fundraiser_orderBy!
    $orderDirection: OrderDirection!
  ) {
    fundraisers(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      ${FUNDRAISER_FIELDS}
    }
  }
`;

// Search coins by name or symbol
export const SEARCH_COINS_QUERY = gql`
  query SearchCoins($search: String!, $first: Int!) {
    coins(
      first: $first
      where: {
        or: [
          { name_contains_nocase: $search }
          { symbol_contains_nocase: $search }
        ]
      }
      orderBy: marketCap
      orderDirection: desc
    ) {
      ${COIN_LIST_FIELDS}
    }
  }
`;

// Get a single fundraiser by ID
export const GET_FUNDRAISER_QUERY = gql`
  query GetFundraiser($id: ID!) {
    fundraiser(id: $id) {
      ${FUNDRAISER_FIELDS}
    }
  }
`;

// Get trending fundraisers (most recently active)
export const GET_TRENDING_FUNDRAISERS_QUERY = gql`
  query GetTrendingFundraisers($first: Int!) {
    fundraisers(first: $first, orderBy: lastActivityAt, orderDirection: desc) {
      ${FUNDRAISER_FIELDS}
    }
  }
`;

// Get top fundraisers by treasury revenue
export const GET_TOP_FUNDRAISERS_QUERY = gql`
  query GetTopFundraisers($first: Int!) {
    fundraisers(first: $first, orderBy: treasuryRevenue, orderDirection: desc) {
      ${FUNDRAISER_FIELDS}
    }
  }
`;

// Get account stats
export const GET_ACCOUNT_QUERY = gql`
  query GetAccount($id: ID!) {
    account(id: $id) {
      id
      totalSwapVolume
      totalFundraiserSpend
      lastActivityAt
    }
  }
`;

// Get user totals for a specific fundraiser (donations + claims)
export const GET_USER_FUNDRAISER_TOTALS_QUERY = gql`
  query GetUserFundraiserTotals($fundraiserAddress: String!, $donorAddress: String!) {
    donations(
      where: { fundraiser: $fundraiserAddress, donor: $donorAddress }
      first: 1000
      orderBy: timestamp
      orderDirection: desc
    ) {
      amount
    }
    claims(
      where: { fundraiser: $fundraiserAddress, claimer: $donorAddress }
      first: 1000
      orderBy: timestamp
      orderDirection: desc
    ) {
      amount
    }
  }
`;

// Get donations for a Fundraiser
export const GET_DONATIONS_QUERY = gql`
  query GetDonations($fundraiserAddress: String!, $limit: Int!) {
    donations(
      where: { fundraiser: $fundraiserAddress }
      orderBy: timestamp
      orderDirection: desc
      first: $limit
    ) {
      id
      donor {
        id
      }
      day
      amount
      uri
      recipientAmount
      recipient
      timestamp
      txHash
    }
  }
`;

// Get minute candle data for a coin token
export const GET_COIN_MINUTE_DATA_QUERY = gql`
  query GetCoinMinuteData($coinAddress: String!, $since: BigInt!) {
    coinMinuteDatas(
      where: { coin: $coinAddress, timestamp_gte: $since }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      id
      timestamp
      open
      high
      low
      close
      volumeCoin
      volumeUsdc
      txCount
    }
  }
`;

// Get hourly candle data for a coin token
export const GET_COIN_HOUR_DATA_QUERY = gql`
  query GetCoinHourData($coinAddress: String!, $since: BigInt!) {
    coinHourDatas(
      where: { coin: $coinAddress, timestamp_gte: $since }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      id
      timestamp
      open
      high
      low
      close
      volumeCoin
      volumeUsdc
      txCount
    }
  }
`;

// Get daily candle data for a coin token
export const GET_COIN_DAY_DATA_QUERY = gql`
  query GetCoinDayData($coinAddress: String!, $since: BigInt!) {
    coinDayDatas(
      where: { coin: $coinAddress, timestamp_gte: $since }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      id
      timestamp
      open
      high
      low
      close
      volumeCoin
      volumeUsdc
      txCount
    }
  }
`;

// Get hourly candle data for multiple coins (for sparklines)
export const GET_BATCH_COIN_HOUR_DATA_QUERY = gql`
  query GetBatchCoinHourData($coinAddresses: [String!]!, $since: BigInt!) {
    coinHourDatas(
      where: { coin_in: $coinAddresses, timestamp_gte: $since }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      id
      coin {
        id
      }
      timestamp
      close
    }
  }
`;

// Get minute candle data for multiple coins (for sparklines on new tokens)
export const GET_BATCH_COIN_MINUTE_DATA_QUERY = gql`
  query GetBatchCoinMinuteData($coinAddresses: [String!]!, $since: BigInt!) {
    coinMinuteDatas(
      where: { coin_in: $coinAddresses, timestamp_gte: $since }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      id
      coin {
        id
      }
      timestamp
      close
    }
  }
`;

// =============================================================================
// Coin listing queries (for explore page)
// =============================================================================

// Get coins sorted by lastActivityAt (bump order)
export const GET_COINS_BY_ACTIVITY_QUERY = gql`
  query GetCoinsByActivity($first: Int!) {
    coins(first: $first, orderBy: lastActivityAt, orderDirection: desc) {
      ${COIN_LIST_FIELDS}
    }
  }
`;

// Get coins sorted by marketCap (top order)
export const GET_COINS_BY_MARKET_CAP_QUERY = gql`
  query GetCoinsByMarketCap($first: Int!) {
    coins(first: $first, orderBy: marketCap, orderDirection: desc) {
      ${COIN_LIST_FIELDS}
    }
  }
`;

// Get coins sorted by createdAt (new order)
export const GET_COINS_BY_CREATED_AT_QUERY = gql`
  query GetCoinsByCreatedAt($first: Int!) {
    coins(first: $first, orderBy: createdAt, orderDirection: desc) {
      ${COIN_LIST_FIELDS}
    }
  }
`;

// Get all coins (for portfolio balance checks)
export const GET_ALL_COINS_QUERY = gql`
  query GetAllCoins($first: Int!) {
    coins(first: $first, orderBy: createdAt, orderDirection: desc) {
      ${COIN_LIST_FIELDS}
    }
  }
`;

// =============================================================================
// API Functions
// =============================================================================

export async function getLaunchpadStats(): Promise<SubgraphLaunchpad | null> {
  try {
    const data = await client.request<{
      protocol: SubgraphLaunchpad | null;
    }>(GET_LAUNCHPAD_STATS_QUERY);
    return data.protocol;
  } catch (error) {
    console.error("[getLaunchpadStats] Error:", error);
    return null;
  }
}

export async function getFundraisers(
  first = 20,
  skip = 0,
  orderBy:
    | "totalMinted"
    | "createdAt"
    | "lastActivityAt"
    | "treasuryRevenue" = "totalMinted",
  orderDirection: "asc" | "desc" = "desc"
): Promise<SubgraphFundraiser[]> {
  try {
    const data = await client.request<{ fundraisers: SubgraphFundraiser[] }>(
      GET_FUNDRAISERS_QUERY,
      {
        first,
        skip,
        orderBy,
        orderDirection,
      }
    );
    return data.fundraisers;
  } catch (error) {
    console.error("[getFundraisers] Error:", error);
    return [];
  }
}

export async function searchCoins(
  search: string,
  first = 20
): Promise<SubgraphCoinListItem[]> {
  try {
    const data = await client.request<{ coins: SubgraphCoinListItem[] }>(
      SEARCH_COINS_QUERY,
      {
        search,
        first,
      }
    );
    return data.coins;
  } catch (error) {
    console.error("[searchCoins] Error:", error);
    return [];
  }
}

export async function getFundraiser(
  id: string
): Promise<SubgraphFundraiser | null> {
  try {
    const data = await client.request<{
      fundraiser: SubgraphFundraiser | null;
    }>(GET_FUNDRAISER_QUERY, {
      id: id.toLowerCase(),
    });
    return data.fundraiser;
  } catch (error) {
    console.error("[getFundraiser] Error:", error);
    return null;
  }
}

export async function getAccount(id: string): Promise<SubgraphAccount | null> {
  try {
    const data = await client.request<{ account: SubgraphAccount | null }>(
      GET_ACCOUNT_QUERY,
      {
        id: id.toLowerCase(),
      }
    );
    return data.account;
  } catch (error) {
    console.error("[getAccount] Error:", error);
    return null;
  }
}

export async function getTrendingFundraisers(
  first = 20
): Promise<SubgraphFundraiser[]> {
  try {
    const data = await client.request<{ fundraisers: SubgraphFundraiser[] }>(
      GET_TRENDING_FUNDRAISERS_QUERY,
      { first }
    );
    return data.fundraisers;
  } catch (error) {
    console.error("[getTrendingFundraisers] Error:", error);
    return [];
  }
}

export async function getTopFundraisers(
  first = 20
): Promise<SubgraphFundraiser[]> {
  try {
    const data = await client.request<{ fundraisers: SubgraphFundraiser[] }>(
      GET_TOP_FUNDRAISERS_QUERY,
      { first }
    );
    return data.fundraisers;
  } catch (error) {
    console.error("[getTopFundraisers] Error:", error);
    return [];
  }
}

// Coin listing functions (for explore page)

export async function getCoinsByActivity(
  first = 20
): Promise<SubgraphCoinListItem[]> {
  try {
    const data = await client.request<{ coins: SubgraphCoinListItem[] }>(
      GET_COINS_BY_ACTIVITY_QUERY,
      { first }
    );
    return data.coins ?? [];
  } catch (error) {
    console.error("[getCoinsByActivity] Error:", error);
    return [];
  }
}

export async function getCoinsByMarketCap(
  first = 20
): Promise<SubgraphCoinListItem[]> {
  try {
    const data = await client.request<{ coins: SubgraphCoinListItem[] }>(
      GET_COINS_BY_MARKET_CAP_QUERY,
      { first }
    );
    return data.coins ?? [];
  } catch (error) {
    console.error("[getCoinsByMarketCap] Error:", error);
    return [];
  }
}

export async function getCoinsByCreatedAt(
  first = 20
): Promise<SubgraphCoinListItem[]> {
  try {
    const data = await client.request<{ coins: SubgraphCoinListItem[] }>(
      GET_COINS_BY_CREATED_AT_QUERY,
      { first }
    );
    return data.coins ?? [];
  } catch (error) {
    console.error("[getCoinsByCreatedAt] Error:", error);
    return [];
  }
}

export async function getAllCoins(
  first = 100
): Promise<SubgraphCoinListItem[]> {
  try {
    const data = await client.request<{ coins: SubgraphCoinListItem[] }>(
      GET_ALL_COINS_QUERY,
      { first }
    );
    return data.coins ?? [];
  } catch (error) {
    console.error("[getAllCoins] Error:", error);
    return [];
  }
}

// Helper to format subgraph address
export function formatSubgraphAddress(address: string): `0x${string}` {
  return address.toLowerCase() as `0x${string}`;
}

// Get user total funded + total mined for a specific fundraiser
export async function getUserFundraiserTotals(
  fundraiserAddress: string,
  donorAddress: string
): Promise<{ totalFunded: number; totalMined: number }> {
  try {
    const data = await client.request<{
      donations: { amount: string }[];
      claims: { amount: string }[];
    }>(GET_USER_FUNDRAISER_TOTALS_QUERY, {
      fundraiserAddress: fundraiserAddress.toLowerCase(),
      donorAddress: donorAddress.toLowerCase(),
    });

    const totalFunded = (data.donations ?? []).reduce(
      (sum, d) => sum + parseFloat(d.amount),
      0
    );
    const totalMined = (data.claims ?? []).reduce(
      (sum, c) => sum + parseFloat(c.amount),
      0
    );

    return { totalFunded, totalMined };
  } catch (error) {
    console.error("[getUserFundraiserTotals] Error:", error);
    return { totalFunded: 0, totalMined: 0 };
  }
}

// Get donations for a Fundraiser
export async function getDonations(
  fundraiserAddress: string,
  limit = 20
): Promise<SubgraphDonation[]> {
  try {
    const data = await client.request<{ donations: SubgraphDonation[] }>(
      GET_DONATIONS_QUERY,
      {
        fundraiserAddress: fundraiserAddress.toLowerCase(),
        limit,
      }
    );
    return data.donations ?? [];
  } catch (error) {
    console.error("[getDonations] Error:", error);
    return [];
  }
}

// Get minute candle data for a coin token
export async function getCoinMinuteData(
  coinAddress: string,
  since: number
): Promise<SubgraphCoinCandle[]> {
  try {
    const data = await client.request<{
      coinMinuteDatas: SubgraphCoinCandle[];
    }>(GET_COIN_MINUTE_DATA_QUERY, {
      coinAddress: coinAddress.toLowerCase(),
      since: since.toString(),
    });
    return data.coinMinuteDatas ?? [];
  } catch (error) {
    console.error("[getCoinMinuteData] Error:", error);
    return [];
  }
}

// Get hourly candle data for a coin token
export async function getCoinHourData(
  coinAddress: string,
  since: number
): Promise<SubgraphCoinCandle[]> {
  try {
    const data = await client.request<{ coinHourDatas: SubgraphCoinCandle[] }>(
      GET_COIN_HOUR_DATA_QUERY,
      {
        coinAddress: coinAddress.toLowerCase(),
        since: since.toString(),
      }
    );
    return data.coinHourDatas ?? [];
  } catch (error) {
    console.error("[getCoinHourData] Error:", error);
    return [];
  }
}

// Get daily candle data for a coin token
export async function getCoinDayData(
  coinAddress: string,
  since: number
): Promise<SubgraphCoinCandle[]> {
  try {
    const data = await client.request<{ coinDayDatas: SubgraphCoinCandle[] }>(
      GET_COIN_DAY_DATA_QUERY,
      {
        coinAddress: coinAddress.toLowerCase(),
        since: since.toString(),
      }
    );
    return data.coinDayDatas ?? [];
  } catch (error) {
    console.error("[getCoinDayData] Error:", error);
    return [];
  }
}

// Batch fetch sparkline data for multiple coins (last 24h hourly)
export type SparklineDataPoint = { timestamp: number; price: number };
export type SparklineMap = Map<string, SparklineDataPoint[]>;

export async function getBatchSparklineData(
  coinAddresses: string[]
): Promise<SparklineMap> {
  if (coinAddresses.length === 0) return new Map();

  const since = Math.floor(Date.now() / 1000) - 86400; // Last 24 hours

  try {
    const data = await client.request<{
      coinHourDatas: Array<{
        coin: { id: string };
        timestamp: string;
        close: string;
      }>;
    }>(GET_BATCH_COIN_HOUR_DATA_QUERY, {
      coinAddresses: coinAddresses.map((a) => a.toLowerCase()),
      since: since.toString(),
    });

    // Group by coin address
    const result: SparklineMap = new Map();
    for (const candle of data.coinHourDatas ?? []) {
      const coinId = candle.coin.id.toLowerCase();
      if (!result.has(coinId)) {
        result.set(coinId, []);
      }
      result.get(coinId)!.push({
        timestamp: parseInt(candle.timestamp),
        price: parseFloat(candle.close),
      });
    }

    return result;
  } catch (error) {
    console.error("[getBatchSparklineData] Error:", error);
    return new Map();
  }
}

// Batch fetch minute-level sparkline data (last 4h, for new tokens without hourly candles)
export async function getBatchSparklineMinuteData(
  coinAddresses: string[]
): Promise<SparklineMap> {
  if (coinAddresses.length === 0) return new Map();

  const since = Math.floor(Date.now() / 1000) - 4 * 3600; // Last 4 hours

  try {
    const data = await client.request<{
      coinMinuteDatas: Array<{
        coin: { id: string };
        timestamp: string;
        close: string;
      }>;
    }>(GET_BATCH_COIN_MINUTE_DATA_QUERY, {
      coinAddresses: coinAddresses.map((a) => a.toLowerCase()),
      since: since.toString(),
    });

    const result: SparklineMap = new Map();
    for (const candle of data.coinMinuteDatas ?? []) {
      const coinId = candle.coin.id.toLowerCase();
      if (!result.has(coinId)) {
        result.set(coinId, []);
      }
      result.get(coinId)!.push({
        timestamp: parseInt(candle.timestamp),
        price: parseFloat(candle.close),
      });
    }

    return result;
  } catch (error) {
    console.error("[getBatchSparklineMinuteData] Error:", error);
    return new Map();
  }
}

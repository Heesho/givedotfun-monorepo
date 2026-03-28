import "server-only";

import { cache } from "react";

const LAUNCHPAD_SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_LAUNCHPAD_SUBGRAPH_URL ||
  "https://api.goldsky.com/api/public/project_cmgscxhw81j5601xmhgd42rej/subgraphs/givedotfun/1.0.0/gn";

const GET_FUNDRAISER_METADATA_QUERY = `
  query GetFundraiserMetadata($id: ID!) {
    fundraiser(id: $id) {
      coin {
        symbol
      }
    }
  }
`;

type FundraiserMetadataRecord = {
  coin?: {
    symbol?: string | null;
  } | null;
} | null;

export const getFundraiserMetadata = cache(
  async (fundraiserAddress: string): Promise<FundraiserMetadataRecord> => {
    try {
      const response = await fetch(LAUNCHPAD_SUBGRAPH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query: GET_FUNDRAISER_METADATA_QUERY,
          variables: {
            id: fundraiserAddress.toLowerCase(),
          },
        }),
        next: { revalidate: 30 },
      });

      if (!response.ok) {
        console.error("[getFundraiserMetadata] Request failed:", response.status);
        return null;
      }

      const payload = (await response.json()) as {
        data?: { fundraiser?: FundraiserMetadataRecord };
        errors?: unknown;
      };

      if (payload.errors) {
        console.error("[getFundraiserMetadata] GraphQL errors:", payload.errors);
        return null;
      }

      return payload.data?.fundraiser ?? null;
    } catch (error) {
      console.error("[getFundraiserMetadata] Error:", error);
      return null;
    }
  }
);

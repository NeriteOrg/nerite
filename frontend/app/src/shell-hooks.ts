import type { Address } from "@/src/types";

import { DATA_REFRESH_INTERVAL } from "@/src/constants";
import { useQuery } from "@tanstack/react-query";
import {
  graphQuery,
  AllocationsQuery,
  BalancesByTokenQuery,
  BalancesForHoldersQuery,
} from "./shell-queries";
import { CONTRACT_SHELL_TOKEN, SHELL_SUBGRAPH_URL } from "./env";
import { getUniswapPositionsByOwners, PoolKey } from "./uniswap-hooks";
import { readContracts } from "@wagmi/core";
import { useWagmiConfig } from "@/src/services/Arbitrum";
import { CONTRACT_ADDRESSES } from "./contracts";
import { UniswapV4PositionManager } from "./abi/UniswapV4PositionManager";
import { Abi } from "abitype";
import { isAddressEqual, zeroAddress } from "viem";


// NERI Airdrop Configuration
export const NERI_CONFIG = {
  SHELL_ALLOCATION_PERCENT: 10,
};

type Options = {
  refetchInterval?: number;
};

function prepareOptions(options?: Options) {
  return {
    refetchInterval: DATA_REFRESH_INTERVAL,
    ...options,
  };
}

export function useAllocations(
  options?: Options,
) {
  return useQuery({
    queryKey: ["Allocations"],
    queryFn: async () => {
      const { allocations } = await graphQuery(AllocationsQuery);
      return allocations;
    },
    ...prepareOptions(options),
  });
}

export function useShellBalances(
  options?: Options,
) {
  return useBalancesByToken(CONTRACT_SHELL_TOKEN as Address, options);
}

export function useBalancesByToken(
  token?: Address,
  options?: Options,
) {
  let queryFn = async () => {
    const { balances } = await graphQuery(
      BalancesByTokenQuery,
      { token: token as string },
    );

    return balances;
  };

  return useQuery({
    queryKey: ["BalancesByToken", token],
    queryFn,
    ...prepareOptions(options),
  });
}

export function useShellActivitiesOfHolders(
  holders?: Address[],
  options?: Options,
) {
  const config = useWagmiConfig();

  return useQuery({
    queryKey: ["ShellActivitiesOfHolders", holders],
    queryFn: async () => {
      const { balances } = await graphQuery(
        BalancesForHoldersQuery,
        { token: CONTRACT_SHELL_TOKEN as string, holders: holders?.map(String) ?? [] },
      );

      const positions = await getUniswapPositionsByOwners(holders ?? []);
      console.log("positions", positions);

      const existingOwners = new Set<string>();
      const uniswapV4Positions = positions ? (await readContracts(config, {
        allowFailure: false,
        contracts: positions.map((position) => ({
          address: CONTRACT_ADDRESSES.strategies.UniswapV4 as Address,
          abi: UniswapV4PositionManager as Abi,
          functionName: "getPoolAndPositionInfo",
          args: [position.tokenId],
        })),
      }) as [PoolKey, bigint][])
        .map(([poolKey], i) => ({
          poolKey,
          ...positions[i]
        }))
        .filter(
          ({ poolKey, owner }) => {
            const valid = (isAddressEqual(poolKey.currency0, CONTRACT_ADDRESSES.BoldToken) || isAddressEqual(poolKey.currency1, CONTRACT_ADDRESSES.BoldToken))
              && owner !== zeroAddress
            if (valid && owner && !existingOwners.has(owner.toLowerCase())) {
              existingOwners.add(owner.toLowerCase());
              return true;
            }
            return false;
          }
        ) : []

      return balances.concat(uniswapV4Positions.map(({ owner, tokenId }) => ({
        __typename: "Balance",
        holder: owner!,
        token: CONTRACT_ADDRESSES.strategies.UniswapV4,
        balance: tokenId!,
      })));
    },
    enabled: Boolean(holders && holders.length > 0),
    ...prepareOptions(options),
  });
}

export function useWeightedActivitySnapshots(
  user?: Address,
  options?: Options,
) {
  return useQuery({
    queryKey: ["WeightedActivitySnapshots", user],
    queryFn: async () => {
      const response = await fetch(SHELL_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query WeightedActivitySnapshots($user: Bytes!) {
              weightedActivitySnapshots(
                where: { user: $user }
                orderBy: blockTimestamp
                orderDirection: desc
              ) {
                id
                user
                activityLabel
                baseValue
                weight
                weightedValue
                multiplier
                blockTimestamp
              }
            }
          `,
          variables: { user: user?.toLowerCase() },
        }),
      });
      const result = await response.json();
      return result.data?.weightedActivitySnapshots ?? [];
    },
    enabled: Boolean(user),
    ...prepareOptions(options),
  });
}

export function usePrivacyPoolSnapshots(
  user?: Address,
  options?: Options,
) {
  return useQuery({
    queryKey: ["PrivacyPoolSnapshots", user],
    queryFn: async () => {
      const response = await fetch(SHELL_SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query PrivacyPoolSnapshots($user: Bytes!) {
              privacyPoolSnapshots(
                where: { user: $user }
                orderBy: blockTimestamp
                orderDirection: desc
              ) {
                id
                user
                depositValue
                blockTimestamp
              }
            }
          `,
          variables: { user: user?.toLowerCase() },
        }),
      });
      const result = await response.json();
      return result.data?.privacyPoolSnapshots ?? [];
    },
    enabled: Boolean(user),
    ...prepareOptions(options),
  });
}

// Get total shells across all holders
export function useTotalShells(options?: Options) {
  const { data: allBalances, ...rest } = useShellBalances(options);

  const totalShells = allBalances?.reduce((sum, balance) => {
    return sum + BigInt(balance.balance);
  }, 0n) ?? 0n;

  return {
    data: totalShells,
    ...rest,
  };
}

// Hook to get NERI total supply from contract
export function useNeriTotalSupply(options?: Options) {
  const config = useWagmiConfig();

  return useQuery({
    queryKey: ["NeriTotalSupply"],
    queryFn: async () => {
      const result = await readContracts(config, {
        allowFailure: false,
        contracts: [{
          address: CONTRACT_ADDRESSES.NeriToken as `0x${string}`,
          abi: [{
            name: "totalSupply",
            type: "function",
            stateMutability: "view",
            inputs: [],
            outputs: [{ type: "uint256" }],
          }] as const,
          functionName: "totalSupply",
          args: [],
        }],
      });
      return result[0] as bigint;
    },
    // Don't fetch if NERI token address is not set (zero address)
    enabled: CONTRACT_ADDRESSES.NeriToken !== "0x0000000000000000000000000000000000000000",
    ...prepareOptions(options),
  });
}

// Calculate NERI amount for a given shell balance
export function calculateNeriAllocation(
  userShells: bigint,
  totalShells: bigint,
  neriTotalSupply: bigint
): bigint {
  if (totalShells === 0n || neriTotalSupply === 0n) return 0n;

  // NERI allocated to shell holders = neriTotalSupply * SHELL_ALLOCATION_PERCENT / 100
  const neriForShells = neriTotalSupply * BigInt(NERI_CONFIG.SHELL_ALLOCATION_PERCENT) / 100n;

  // User's NERI = (userShells / totalShells) * neriForShells
  return (userShells * neriForShells) / totalShells;
}
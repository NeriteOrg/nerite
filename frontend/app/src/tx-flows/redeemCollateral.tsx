import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { Address } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { LOCAL_STORAGE_PREFIX } from "@/src/constants";
import { getContracts, getProtocolContract } from "@/src/contracts";
import { dnum18, jsonParseWithDnum, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vDnum } from "@/src/valibot-utils";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { Fragment } from "react";
import * as v from "valibot";
import { createPublicClient } from "viem";
import { http, useConfig as useWagmiConfig } from "wagmi";
import { createRequestSchema, verifyTransaction } from "./shared";
import { COLLATERAL_CONTRACTS } from "../env";

const RequestSchema = createRequestSchema(
  "redeemCollateral",
  {
    amount: vDnum(),
    maxFee: vDnum(),
  },
);

export type RedeemCollateralRequest = v.InferOutput<typeof RequestSchema>;

export const redeemCollateral: FlowDeclaration<RedeemCollateralRequest> = {
  title: "Review & Send Transaction",
  Summary: () => null,
  Details(ctx) {
    const estimatedGains = useSimulatedBalancesChange(ctx);
    const boldChange = estimatedGains.data?.find(({ symbol }: any) => symbol === "USND")?.change;
    const collChanges = estimatedGains.data?.filter(({ symbol }: any) => symbol !== "USND");
    return (
      <>
        <TransactionDetailsRow
          label="Max fee"
          value={[
            <Amount
              key="start"
              value={ctx.request.maxFee}
              percentage
              format="pctfull"
            />,
          ]}
        />
        <TransactionDetailsRow
          label="Reedeming USND"
          value={[
            <Amount
              key="start"
              value={boldChange}
              fallback="fetching…"
              suffix=" USND"
            />,
            <Fragment key="end">
              Estimated USND that will be redeemed.
            </Fragment>,
          ]}
        />
        {COLLATERAL_CONTRACTS.map(({ symbol }) => {
          const collChange = collChanges?.find((change: any) => symbol === change.symbol)?.change;
          const symbol_ = symbol === "ETH" ? "WETH" : symbol;
          return (
            <TransactionDetailsRow
              key={symbol}
              label={`Receiving ${symbol_}`}
              value={[
                <Amount
                  key="start"
                  value={collChange}
                  fallback="fetching…"
                  suffix={` ${symbol_}`}
                />,
                <Fragment key="end">
                  Estimated {symbol_} you will receive.
                </Fragment>,
              ]}
            />
          );
        })}
      </>
    );
  },
  steps: {
    approve: {
      name: () => "Approve USND",
      Status: TransactionStatus,
      async commit({ request, writeContract }) {
        const CollateralRegistry = getProtocolContract("CollateralRegistry");
        const BoldToken = getProtocolContract("BoldToken");

        return writeContract({
          ...BoldToken,
          functionName: "approve",
          args: [CollateralRegistry.address, request.amount[0]],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
    redeemCollateral: {
      name: () => "Redeem USND",
      Status: TransactionStatus,
      async commit({ request, writeContract }) {
        const CollateralRegistry = getProtocolContract("CollateralRegistry");
        return writeContract({
          ...CollateralRegistry,
          functionName: "redeemCollateral",
          args: [
            request.amount[0],
            0n,
            request.maxFee[0],
          ],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const steps = [];

    // check for allowance
    const boldAllowance = await ctx.readContract({
      ...getProtocolContract("BoldToken"),
      functionName: "allowance",
      args: [
        ctx.account!,
        getProtocolContract("CollateralRegistry").address,
      ],
    });
    if (dn.gt(ctx.request.amount, dnum18(boldAllowance))) {
      steps.push("approve");
    }

    steps.push("redeemCollateral");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};

export const StoredBalancesChangeSchema = v.object({
  stringifiedRequest: v.string(),
  balanceChanges: v.array(v.object({
    symbol: v.string(),
    change: vDnum(),
  })),
});

export function useSimulatedBalancesChange({
  account,
  request,
}: {
  account: Address | null;
  request: RedeemCollateralRequest;
}) {
  const wagmiConfig = useWagmiConfig();
  return useQuery({
    queryKey: ["simulatedBalancesChange", account, jsonStringifyWithDnum(request)],
    queryFn: async () => {
      const CollateralRegistry = getProtocolContract("CollateralRegistry");
      const BoldToken = getProtocolContract("BoldToken");

      let stored: v.InferOutput<typeof StoredBalancesChangeSchema> | null = null;
      try {
        stored = v.parse(
          StoredBalancesChangeSchema,
          jsonParseWithDnum(
            localStorage.getItem(
              `${LOCAL_STORAGE_PREFIX}:simulatedBalancesChange`,
            ) ?? "",
          ),
        );
      } catch (_) {
        stored = null;
      }

      if (stored && stored.stringifiedRequest === jsonStringifyWithDnum(request)) {
        return stored.balanceChanges;
      }

      const [chain] = wagmiConfig.chains;
      const [rpcUrl] = chain.rpcUrls.default.http;
      const client = createPublicClient({ chain, transport: http(rpcUrl) });

      const branchesBalanceCalls = getContracts().collaterals.map((branch) => ({
        to: branch.contracts.CollToken.address,
        abi: branch.contracts.CollToken.abi,
        functionName: "balanceOf",
        args: [account!],
      }));

      const boldBalanceCall = {
        to: BoldToken.address,
        abi: BoldToken.abi,
        functionName: "balanceOf",
        args: [account!],
      };

      console.log("Start simulation");

      const simulation = await client.simulateCalls({
        account: account!,
        calls: [
          // 1. get balances before
          boldBalanceCall,
          ...branchesBalanceCalls,

          // 2. redeem
          {
            to: CollateralRegistry.address,
            abi: CollateralRegistry.abi,
            functionName: "redeemCollateral",
            args: [request.amount[0], 0n, request.maxFee[0]],
          },

          // 3. get balances after
          boldBalanceCall,
          ...branchesBalanceCalls,
        ],

        // This is needed to avoid a “nonce too low” error with certain RPCs
        stateOverrides: [{ address: account!, nonce: 0 }],
      });

      console.log("simulation", simulation);

      const error = simulation.results.find((result) => result.error)?.error;
      if (error) {
        const message = error.message ?? (error.cause as any).shortMessage ?? "Unknown error";
        console.error(message);
        throw new Error(message);
      }

      const getBalancesFromSimulated = (position: number) => {
        return simulation.results
          .slice(position, position + COLLATERAL_CONTRACTS.length + 1)
          .map((result, index) => {
            const symbol = index === 0 ? "USND" : COLLATERAL_CONTRACTS[index - 1]?.symbol;
            return {
              symbol,
              balance: dnum18(result.data ?? 0n),
            };
          });
      };

      const balancesBefore = getBalancesFromSimulated(0);
      const balancesAfter = getBalancesFromSimulated(COLLATERAL_CONTRACTS.length + 2);

      const balanceChanges = balancesBefore.map((balanceBefore, index) => {
        const balanceAfter = balancesAfter[index];
        if (!balanceAfter) throw new Error();
        return {
          symbol: balanceBefore.symbol,
          change: dn.sub(balanceAfter.balance, balanceBefore.balance),
        };
      });

      localStorage.setItem(
        `${LOCAL_STORAGE_PREFIX}:simulatedBalancesChange`,
        jsonStringifyWithDnum({
          stringifiedRequest: jsonStringifyWithDnum(request),
          balanceChanges,
        }),
      );

      return balanceChanges;
    },
  });
}

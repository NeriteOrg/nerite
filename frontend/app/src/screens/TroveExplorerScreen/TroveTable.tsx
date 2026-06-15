import type { TroveExplorerItem } from "@/src/types";
import type { Dnum } from "dnum";

import { getLiquidationPrice, getLtv } from "@/src/liquity-math";
import { usePrice } from "@/src/services/Prices";
import { css } from "@/styled-system/css";
import * as dn from "dnum";
import { useMemo } from "react";
import { TroveRow } from "./TroveRow";

type Props = {
  troves: TroveExplorerItem[];
  isLoading: boolean;
  orderBy: string;
  orderDirection: "asc" | "desc";
  onSort: (field: string) => void;
};

function useAllPrices() {
  // Always call usePrice for every symbol — hook count is constant
  const eth = usePrice("ETH");
  const wsteth = usePrice("WSTETH");
  const reth = usePrice("RETH");
  const rseth = usePrice("RSETH");
  const weeth = usePrice("WEETH");
  const arb = usePrice("ARB");
  const comp = usePrice("COMP");
  const tbtc = usePrice("TBTC");

  return useMemo(() => {
    const map = new Map<string, readonly [bigint, number] | null>();
    const queries = [
      ["ETH", eth],
      ["WSTETH", wsteth],
      ["RETH", reth],
      ["RSETH", rseth],
      ["WEETH", weeth],
      ["ARB", arb],
      ["COMP", comp],
      ["TBTC", tbtc],
    ] as const;
    for (const [sym, q] of queries) {
      map.set(sym, q.data ?? null);
    }
    return map;
  }, [eth.data, wsteth.data, reth.data, rseth.data, weeth.data, arb.data, comp.data, tbtc.data]);
}

function compareDnum(a: Dnum | null, b: Dnum | null, orderDirection: "asc" | "desc") {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const comparison = dn.lt(a, b) ? -1 : dn.gt(a, b) ? 1 : 0;
  return orderDirection === "asc" ? comparison : -comparison;
}

function compareTroves(
  a: TroveExplorerItem,
  b: TroveExplorerItem,
  orderBy: string,
  orderDirection: "asc" | "desc",
  priceMap: Map<string, readonly [bigint, number] | null>,
) {
  if (orderBy === "status") {
    const comparison = a.status.localeCompare(b.status);
    return orderDirection === "asc" ? comparison : -comparison;
  }

  if (orderBy === "deposit") {
    return compareDnum(a.deposit, b.deposit, orderDirection);
  }

  if (orderBy === "debt") {
    return compareDnum(a.borrowed, b.borrowed, orderDirection);
  }

  if (orderBy === "collateralValue") {
    const priceA = priceMap.get(a.collateralSymbol);
    const priceB = priceMap.get(b.collateralSymbol);
    return compareDnum(
      priceA ? dn.mul(a.deposit, priceA) : null,
      priceB ? dn.mul(b.deposit, priceB) : null,
      orderDirection,
    );
  }

  if (orderBy === "liqPrice") {
    return compareDnum(
      getLiquidationPrice(a.deposit, a.borrowed, Number(a.minCollRatio) / 1e18),
      getLiquidationPrice(b.deposit, b.borrowed, Number(b.minCollRatio) / 1e18),
      orderDirection,
    );
  }

  if (orderBy === "ltv") {
    const priceA = priceMap.get(a.collateralSymbol);
    const priceB = priceMap.get(b.collateralSymbol);
    return compareDnum(
      priceA ? getLtv(a.deposit, a.borrowed, priceA) : null,
      priceB ? getLtv(b.deposit, b.borrowed, priceB) : null,
      orderDirection,
    );
  }

  if (orderBy === "interestRate") {
    return compareDnum(a.interestRate, b.interestRate, orderDirection);
  }

  return 0;
}

export function TroveTable({
  troves,
  isLoading,
  orderBy,
  orderDirection,
  onSort,
}: Props) {
  const priceMap = useAllPrices();

  const sortedTroves = useMemo(() => {
    return [...troves].sort((a, b) => {
      return compareTroves(a, b, orderBy, orderDirection, priceMap);
    });
  }, [troves, orderBy, orderDirection, priceMap]);

  const SortableHeader = ({ field, label }: { field: string; label: string }) => (
    <th
      onClick={() => onSort(field)}
      className={css({
        cursor: "pointer",
        userSelect: "none",
        _hover: {
          color: "content",
        },
      })}
    >
      {label}
      {orderBy === field && (orderDirection === "asc" ? " ↑" : " ↓")}
    </th>
  );

  if (isLoading) {
    return (
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          padding: 64,
          color: "contentAlt",
        })}
      >
        Loading troves...
      </div>
    );
  }

  if (sortedTroves.length === 0) {
    return (
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          padding: 64,
          color: "contentAlt",
        })}
      >
        No troves found
      </div>
    );
  }

  return (
    <table
      className={css({
        width: "100%",
        fontSize: 14,
        "& th, & td": {
          fontWeight: "inherit",
          whiteSpace: "nowrap",
          textAlign: "right",
          padding: "12px 8px",
        },
        "& th": {
          color: "contentAlt2",
          borderBottom: "1px solid token(colors.tableBorder)",
          position: "sticky",
          top: 0,
          background: "surface",
          zIndex: 1,
        },
        "& td": {
          borderBottom: "1px solid token(colors.tableBorder)",
        },
        "& th:first-of-type, & td:first-of-type": {
          textAlign: "left",
          paddingLeft: 0,
        },
        "& th:last-of-type, & td:last-of-type": {
          paddingRight: 0,
        },
        "& tbody tr": {
          _hover: {
            background: "surfaceAlt",
          },
        },
      })}
    >
      <thead>
        <tr>
          <SortableHeader field="status" label="Status" />
          <SortableHeader field="deposit" label="Collateral" />
          <SortableHeader field="debt" label="USND Borrowed" />
          <SortableHeader field="collateralValue" label="Collateral Value" />
          <SortableHeader field="liqPrice" label="Liq. Price" />
          <SortableHeader field="ltv" label="LTV" />
          <SortableHeader field="interestRate" label="Interest" />
          <th>Owner</th>
        </tr>
      </thead>
      <tbody>
        {sortedTroves.map((trove) => <TroveRow key={trove.id} trove={trove} />)}
      </tbody>
    </table>
  );
}

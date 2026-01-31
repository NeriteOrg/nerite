import type { TroveExplorerItem } from "@/src/types";

import { css } from "@/styled-system/css";
import { TroveRow } from "./TroveRow";

type Props = {
  troves: TroveExplorerItem[];
  isLoading: boolean;
  orderBy: string;
  orderDirection: "asc" | "desc";
  onSort: (field: string) => void;
};

export function TroveTable({
  troves,
  isLoading,
  orderBy,
  orderDirection,
  onSort,
}: Props) {
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

  if (troves.length === 0) {
    return (
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          padding: 64,
          color: "contentAlt",
        })}
      >
        No active troves found
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
          <SortableHeader field="collateral" label="Collateral" />
          <SortableHeader field="debt" label="USND Borrowed" />
          <th>Collateral Value</th>
          <th>Liq. Price</th>
          <th>LTV</th>
          <SortableHeader field="interestRate" label="Interest" />
          <th>Owner</th>
        </tr>
      </thead>
      <tbody>
        {troves.map((trove) => (
          <TroveRow key={trove.id} trove={trove} />
        ))}
      </tbody>
    </table>
  );
}

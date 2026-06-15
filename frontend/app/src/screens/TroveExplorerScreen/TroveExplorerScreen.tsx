"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import { useTrovesWithCurrentDebt } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import { useState } from "react";
import { TroveTable } from "./TroveTable";

export function TroveExplorerScreen() {
  const [orderBy, setOrderBy] = useState<string>("debt");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");

  const { data: troves, isLoading } = useTrovesWithCurrentDebt();

  const handleSort = (field: string) => {
    if (orderBy === field) {
      setOrderDirection(orderDirection === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(field);
      setOrderDirection("desc");
    }
  };

  return (
    <Screen
      heading={{
        title: "Trove Explorer",
        subtitle: "Explore all troves with current debt on Nerite",
      }}
      width={1200}
    >
      <div
        className={css({
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        })}
      >
        <div
          className={css({
            width: "100%",
            background: "surface",
            border: "1px solid token(colors.tableBorder)",
            borderRadius: 8,
            padding: 16,
            overflow: "auto",
            maxHeight: "calc(100vh - 300px)",
          })}
        >
          <TroveTable
            troves={troves ?? []}
            isLoading={isLoading}
            orderBy={orderBy}
            orderDirection={orderDirection}
            onSort={handleSort}
          />
        </div>
      </div>
    </Screen>
  );
}

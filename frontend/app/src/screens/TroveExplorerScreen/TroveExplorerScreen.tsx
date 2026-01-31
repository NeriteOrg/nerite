"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import { useAllActiveTroves } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import { useState } from "react";
import { TroveTable } from "./TroveTable";

export function TroveExplorerScreen() {
  const [orderBy, setOrderBy] = useState<string>("debt");
  const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  const { data: troves, isLoading } = useAllActiveTroves(
    pageSize,
    currentPage * pageSize,
    orderBy,
    orderDirection,
  );

  const handleSort = (field: string) => {
    if (orderBy === field) {
      setOrderDirection(orderDirection === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(field);
      setOrderDirection("desc");
    }
  };

  const hasPrevPage = currentPage > 0;
  const hasNextPage = troves && troves.length === pageSize;

  return (
    <Screen
      heading={{
        title: "Trove Explorer",
        subtitle: "Explore all active troves in the Liquity V2 protocol",
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

        {(hasPrevPage || hasNextPage) && (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: 16,
            })}
          >
            <button
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={!hasPrevPage}
              className={css({
                padding: "8px 16px",
                background: "secondary",
                color: "secondaryContent",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                _hover: {
                  background: "secondaryActive",
                },
                _disabled: {
                  opacity: 0.5,
                  cursor: "not-allowed",
                },
              })}
            >
              ← Previous
            </button>
            <span
              className={css({
                fontSize: 14,
                color: "contentAlt",
              })}
            >
              Page {currentPage + 1}
            </span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!hasNextPage}
              className={css({
                padding: "8px 16px",
                background: "secondary",
                color: "secondaryContent",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                _hover: {
                  background: "secondaryActive",
                },
                _disabled: {
                  opacity: 0.5,
                  cursor: "not-allowed",
                },
              })}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </Screen>
  );
}

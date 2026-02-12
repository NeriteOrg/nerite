# Trove Explorer Feature Specification

## Overview
Create a new page in the Liquity V2 frontend app that displays all active troves (loans) in the protocol. Users can view, sort, and filter troves to explore the protocol's loan positions.

---

## 1. Page Structure

### 1.1 Route & Navigation
- **URL Path**: `/troves` or `/explore`
- **Navigation**: Add new menu item to the top navigation bar
  - **Icon**: Use existing `IconSearch` or `IconDashboard`
  - **Label**: "Troves" or "Explorer"
  - **Position**: Between "Borrow" and "Earn" in the menu

### 1.2 Page Location
Create new files:
- `frontend/app/src/app/troves/page.tsx` - Next.js page component
- `frontend/app/src/screens/TroveExplorerScreen/TroveExplorerScreen.tsx` - Main screen component
- `frontend/app/src/screens/TroveExplorerScreen/TroveTable.tsx` - Table component
- `frontend/app/src/screens/TroveExplorerScreen/TroveRow.tsx` - Row component

---

## 2. Data Fetching

### 2.1 GraphQL Query
Create a new query in `frontend/app/src/subgraph-queries.ts`:

```typescript
export const AllActiveTrovesQuery = graphql(`
  query AllActiveTroves(
    $first: Int!
    $skip: Int!
    $orderBy: Trove_orderBy
    $orderDirection: OrderDirection
  ) {
    troves(
      where: { status: active }
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      troveId
      borrower
      debt
      deposit
      interestRate
      updatedAt
      createdAt
      collateral {
        collIndex
        minCollRatio
        token {
          symbol
          name
        }
      }
    }
  }
`);
```

### 2.2 React Hook
Create a new hook in `frontend/app/src/subgraph-hooks.ts`:

```typescript
export function useAllActiveTroves(
  first: number = 100,
  skip: number = 0,
  orderBy: string = "debt",
  orderDirection: "asc" | "desc" = "desc",
  options?: Options,
) {
  let queryFn = async () => {
    const { troves } = await graphQuery(AllActiveTrovesQuery, {
      first,
      skip,
      orderBy,
      orderDirection,
    });
    return troves.map(subgraphTroveToTroveExplorerItem);
  };

  if (DEMO_MODE) {
    queryFn = async () => {
      // Return demo data for testing
      return [];
    };
  }

  return useQuery({
    queryKey: ["AllActiveTroves", first, skip, orderBy, orderDirection],
    queryFn,
    ...prepareOptions(options),
  });
}

function subgraphTroveToTroveExplorerItem(
  trove: AllActiveTrovesQueryType["troves"][number]
): TroveExplorerItem {
  // Transform subgraph data to display format
  return {
    id: trove.id,
    troveId: trove.troveId,
    borrower: trove.borrower as Address,
    collateralSymbol: trove.collateral.token.symbol as CollateralSymbol,
    collateralName: trove.collateral.token.name,
    collIndex: trove.collateral.collIndex as CollIndex,
    borrowed: dnum18(trove.debt),
    deposit: dnum18(trove.deposit),
    minCollRatio: trove.collateral.minCollRatio,
    interestRate: dnum18(trove.interestRate),
    updatedAt: Number(trove.updatedAt) * 1000,
    createdAt: Number(trove.createdAt) * 1000,
  };
}
```

### 2.3 Type Definition
Add to `frontend/app/src/types.ts`:

```typescript
export type TroveExplorerItem = {
  id: string;
  troveId: TroveId;
  borrower: Address;
  collateralSymbol: CollateralSymbol;
  collateralName: string;
  collIndex: CollIndex;
  borrowed: Dnum; // USND (Bold Token) amount
  deposit: Dnum; // Collateral amount
  minCollRatio: bigint; // Minimum collateral ratio
  interestRate: Dnum;
  updatedAt: number; // timestamp in ms
  createdAt: number; // timestamp in ms
};
```

---

## 3. UI Components

### 3.1 Screen Component (`TroveExplorerScreen.tsx`)
```tsx
"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import { useAllActiveTroves } from "@/src/subgraph-hooks";
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
    orderDirection
  );

  return (
    <Screen>
      <h1>Trove Explorer</h1>
      <p>Explore all active troves in the Liquity V2 protocol</p>
      
      <TroveTable
        troves={troves ?? []}
        isLoading={isLoading}
        orderBy={orderBy}
        orderDirection={orderDirection}
        onSort={(field) => {
          if (orderBy === field) {
            setOrderDirection(orderDirection === "asc" ? "desc" : "asc");
          } else {
            setOrderBy(field);
            setOrderDirection("desc");
          }
        }}
      />
      
      {/* Pagination controls */}
      <div>
        <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))}>
          Previous
        </button>
        <span>Page {currentPage + 1}</span>
        <button onClick={() => setCurrentPage(p => p + 1)}>
          Next
        </button>
      </div>
    </Screen>
  );
}
```

### 3.2 Table Component (`TroveTable.tsx`)
Create a compact, sortable table with columns:

**Columns:**
1. **Collateral** - Token icon + symbol (e.g., ETH, wstETH)
2. **USND Borrowed** - Amount of Bold tokens borrowed
3. **Collateral Value** - USD value of collateral (deposit × price)
4. **Liquidation Price** - Price at which trove would be liquidated
5. **LTV** - Loan-to-Value ratio (percentage)
6. **Interest Rate** - Annual interest rate (percentage)
7. **Owner** - Shortened address linking to block explorer

**Styling:**
- Use existing table patterns from `HomeTable.tsx`
- Compact row height for dense information display
- Alternating row colors for readability
- Hover states for rows
- Sortable column headers with arrow indicators

```tsx
import { TroveExplorerItem } from "@/src/types";
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
  onSort 
}: Props) {
  const SortableHeader = ({ field, label }: { field: string; label: string }) => (
    <th 
      onClick={() => onSort(field)}
      className={css({ cursor: "pointer", userSelect: "none" })}
    >
      {label}
      {orderBy === field && (orderDirection === "asc" ? " ↑" : " ↓")}
    </th>
  );

  if (isLoading) {
    return <div>Loading troves...</div>;
  }

  return (
    <table className={css({ width: "100%", borderCollapse: "collapse" })}>
      <thead>
        <tr>
          <SortableHeader field="collateral" label="Collateral" />
          <SortableHeader field="debt" label="USND Borrowed" />
          <SortableHeader field="collateralValue" label="Collateral Value" />
          <SortableHeader field="liquidationPrice" label="Liq. Price" />
          <SortableHeader field="ltv" label="LTV" />
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
```

### 3.3 Row Component (`TroveRow.tsx`)
```tsx
import { AddressLink } from "@/src/comps/AddressLink/AddressLink";
import { Amount } from "@/src/comps/Amount/Amount";
import { TroveExplorerItem } from "@/src/types";
import { useCollPrice } from "@/src/services/Prices";
import { getLiquidationPrice, getLtv } from "@/src/liquity-math";
import { TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";

type Props = {
  trove: TroveExplorerItem;
};

export function TroveRow({ trove }: Props) {
  const collPrice = useCollPrice(trove.collateralSymbol);
  
  // Calculate derived values
  const collateralValue = collPrice.data 
    ? dn.mul(trove.deposit, collPrice.data)
    : null;
  
  const liquidationPrice = getLiquidationPrice(
    trove.deposit,
    trove.borrowed,
    Number(trove.minCollRatio) / 1e18
  );
  
  const ltv = collPrice.data
    ? getLtv(trove.deposit, trove.borrowed, collPrice.data)
    : null;

  return (
    <tr>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TokenIcon symbol={trove.collateralSymbol} size="mini" />
          <span>{trove.collateralSymbol}</span>
        </div>
      </td>
      <td>
        <Amount value={trove.borrowed} suffix=" USND" />
      </td>
      <td>
        <Amount value={collateralValue} prefix="$" format="compact" />
      </td>
      <td>
        <Amount value={liquidationPrice} prefix="$" />
      </td>
      <td>
        <Amount value={ltv} percentage />
      </td>
      <td>
        <Amount value={trove.interestRate} percentage />
      </td>
      <td>
        <AddressLink address={trove.borrower} />
      </td>
    </tr>
  );
}
```

---

## 4. Navigation Integration

### 4.1 Update Top Navigation
Edit `frontend/app/src/comps/TopBar/TopBar.tsx`:

```typescript
// Add to menu items array
const menuItems: [string, string, ComponentType<{}>][] = [
  ["Dashboard", "/", IconDashboard],
  ["Borrow", "/borrow", IconBorrow],
  ["Troves", "/troves", IconSearch], // NEW
  ["Earn", "/earn", IconEarn],
  ["Stake", "/stake", IconStake],
];
```

---

## 5. Sorting & Filtering

### 5.1 Sortable Fields
- **USND Borrowed** (debt)
- **Collateral Value** (calculated: deposit × price)
- **Liquidation Price** (calculated)
- **LTV** (calculated)
- **Interest Rate** (interestRate)

### 5.2 Default Sort
- **Field**: USND Borrowed (debt)
- **Direction**: Descending (largest loans first)

### 5.3 Future Enhancements (Optional)
- Filter by collateral type
- Search by owner address
- Filter by LTV range
- Filter by interest rate range

---

## 6. Styling Guidelines

### 6.1 Design System
- Follow existing component patterns from `HomeScreen` and `HomeTable`
- Use Panda CSS for styling (via `@/styled-system/css`)
- Maintain consistent spacing and typography
- Use existing color tokens

### 6.2 Responsive Design
- Table should scroll horizontally on mobile
- Consider mobile-friendly card layout as alternative
- Maintain readability at all viewport sizes

### 6.3 Performance
- Implement pagination (50-100 troves per page)
- Use React Query caching (already configured)
- Virtualization for very long lists (optional enhancement)

---

## 7. Error Handling

### 7.1 Loading States
- Show loading spinner or skeleton while fetching
- Use existing `LoadingSurface` component from uikit

### 7.2 Error States
- Display error message if query fails
- Provide retry button
- Use existing `ErrorBox` component

### 7.3 Empty State
- Show message when no troves exist
- Provide link to borrow page

---

## 8. Testing Considerations

### 8.1 Local Development
- Use Anvil local node with deployed contracts
- Run `./deploy local --open-demo-troves` to create test troves
- Subgraph must be running locally

### 8.2 Demo Mode Support
- Add demo data to `DEMO_MODE` in subgraph hooks
- Use existing patterns from `useLoansByAccount`

---

## 9. Implementation Checklist

### Phase 1: Data Layer
- [ ] Add `AllActiveTrovesQuery` to `subgraph-queries.ts`
- [ ] Add `useAllActiveTroves` hook to `subgraph-hooks.ts`
- [ ] Add `TroveExplorerItem` type to `types.ts`
- [ ] Test query returns correct data

### Phase 2: UI Components
- [ ] Create `TroveExplorerScreen.tsx`
- [ ] Create `TroveTable.tsx`
- [ ] Create `TroveRow.tsx`
- [ ] Add sorting logic
- [ ] Add pagination controls

### Phase 3: Integration
- [ ] Create `/troves/page.tsx` route
- [ ] Add menu item to TopBar
- [ ] Test navigation
- [ ] Test on different screen sizes

### Phase 4: Polish
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add empty state
- [ ] Style table for consistency
- [ ] Test with real data
- [ ] Add tooltips for complex fields (LTV, liquidation price)

---

## 10. Technical Dependencies

### 10.1 Existing Components to Reuse
- `AddressLink` - For owner addresses linking to Arbiscan
- `Amount` - For formatted number display
- `TokenIcon` - For collateral icons
- `Screen` - For page layout
- Existing GraphQL infrastructure

### 10.2 New Dependencies
- None required (all dependencies already in project)

---

## 11. Future Enhancements

### 11.1 Advanced Features (V2)
- Real-time updates via GraphQL subscriptions
- Export to CSV
- Advanced filtering UI
- Trove detail modal/page
- Analytics dashboard (total TVL, avg LTV, etc.)
- Historical data visualization

### 11.2 Performance Optimizations
- Virtual scrolling for large datasets
- Server-side pagination
- Cached aggregations

---

## 12. Example Data Flow

```
User visits /troves
  ↓
TroveExplorerScreen renders
  ↓
useAllActiveTroves hook fetches data via GraphQL
  ↓
Subgraph returns trove data
  ↓
Transform data to TroveExplorerItem[]
  ↓
TroveTable renders rows
  ↓
Each TroveRow:
  - Fetches collateral price (cached)
  - Calculates liquidation price
  - Calculates LTV
  - Renders formatted data
```

---

## 13. Visual Layout (ASCII Mockup)

```
┌──────────────────────────────────────────────────────────────────┐
│  LIQUITY                         Troves   Borrow   Earn   Stake  │
└──────────────────────────────────────────────────────────────────┘

    Trove Explorer
    Explore all active troves in the Liquity V2 protocol

┌──────────────────────────────────────────────────────────────────┐
│ Collateral ↓ │ USND Borrowed ↓│ Coll. Value │ Liq. Price │ LTV │ │
├──────────────────────────────────────────────────────────────────┤
│ 🔷 ETH       │ 50,000 USND    │ $75,000    │ $1,800     │ 67% │ │
│ 🔷 wstETH    │ 25,000 USND    │ $40,000    │ $2,100     │ 62% │ │
│ 🔷 rETH      │ 15,000 USND    │ $22,000    │ $1,950     │ 68% │ │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘

           ← Previous    Page 1 of 10    Next →
```

---

## Summary

This specification provides a complete blueprint for implementing a Trove Explorer page that:
- ✅ Shows all active troves in a compact, sortable list
- ✅ Displays collateral type, USND borrowed, collateral value, liquidation price, LTV, and owner
- ✅ Links to Arbiscan for owner addresses
- ✅ Follows existing code patterns and design system
- ✅ Integrates seamlessly with the existing app architecture
- ✅ Handles loading, error, and empty states
- ✅ Provides foundation for future enhancements

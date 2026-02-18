import type { TroveExplorerItem } from "@/src/types";

import { AddressLink } from "@/src/comps/AddressLink/AddressLink";
import { Amount } from "@/src/comps/Amount/Amount";
import { getLiquidationPrice, getLtv } from "@/src/liquity-math";
import { usePrice } from "@/src/services/Prices";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";

type Props = {
  trove: TroveExplorerItem;
};

export function TroveRow({ trove }: Props) {
  const collPrice = usePrice(trove.collateralSymbol);

  const collateralValue = collPrice.data
    ? dn.mul(trove.deposit, collPrice.data)
    : null;

  const liquidationPrice = getLiquidationPrice(
    trove.deposit,
    trove.borrowed,
    Number(trove.minCollRatio) / 1e18,
  );

  const ltv = collPrice.data
    ? getLtv(trove.deposit, trove.borrowed, collPrice.data)
    : null;

  return (
    <tr>
      <td>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
          })}
        >
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

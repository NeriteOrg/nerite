import { css } from "@/styled-system/css";
import { Button, Modal } from "@liquity2/uikit";

const DOCS_URL = "https://docs.nerite.org/";

export function FirstTimeOnboardingModal({
  onClose,
  visible,
}: {
  onClose: () => void;
  visible: boolean;
}) {
  return (
    <Modal
      onClose={onClose}
      title="Welcome to Nerite"
      visible={visible}
      maxWidth={560}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 24,
        })}
      >
        <p
          className={css({
            fontSize: 16,
            color: "contentAlt",
            lineHeight: 1.5,
          })}
        >
          Before opening your first position, here are some important things to know:
        </p>

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 16,
          })}
        >
          <FaqItem
            title="What is a Trove?"
            description="A Trove is your collateralized debt position. You deposit collateral (like ETH or LSTs) and borrow USND against it."
          />

          <FaqItem
            title="What are Redemptions?"
            description="Redemptions allow USND holders to exchange their USND for collateral at face value. Positions with lower interest rates are redeemed first. Setting a higher interest rate reduces your redemption risk."
          />

          <FaqItem
            title="How do Interest Rates work?"
            description="You set your own interest rate. Higher rates mean lower redemption risk but more interest paid. You can adjust your rate anytime, but there's a fee if you change it within 7 days of your last adjustment."
          />

          <FaqItem
            title="What about Liquidations?"
            description="If your collateral value drops and your Loan-to-Value (LTV) exceeds the maximum, your position can be liquidated. Monitor your position and add collateral if needed."
          />
        </div>

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 8,
          })}
        >
          <Button
            label="Got it, let's start"
            mode="primary"
            size="large"
            wide
            onClick={onClose}
          />
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={css({
              display: "block",
              textAlign: "center",
              color: "accent",
              fontSize: 14,
              textDecoration: "none",
              _hover: {
                textDecoration: "underline",
              },
            })}
          >
            Read the full documentation
          </a>
        </div>
      </div>
    </Modal>
  );
}

function FaqItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className={css({
        padding: 16,
        background: "infoSurface",
        borderRadius: 8,
      })}
    >
      <h3
        className={css({
          fontSize: 14,
          fontWeight: 600,
          color: "content",
          marginBottom: 4,
        })}
      >
        {title}
      </h3>
      <p
        className={css({
          fontSize: 14,
          color: "contentAlt",
          lineHeight: 1.5,
        })}
      >
        {description}
      </p>
    </div>
  );
}

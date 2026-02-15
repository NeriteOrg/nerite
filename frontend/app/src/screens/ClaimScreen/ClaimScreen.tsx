"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { useAccount } from "@/src/services/Arbitrum";
import { css } from "@/styled-system/css";
import { a, useSpring, useTrail } from "@react-spring/web";
import { Button, VFlex, ShellpointIcon, TokenIcon, IconDiscord, IconX } from "@liquity2/uikit";
import { useState, useMemo, useEffect } from "react";
import { useBalance } from "@/src/wagmi-utils";
import { useShellActivitiesOfHolders, useWeightedActivitySnapshots, usePrivacyPoolSnapshots, useTotalShells, useNeriTotalSupply, calculateNeriAllocation } from "@/src/shell-hooks";
import { CONTRACT_ADDRESSES } from "@/src/contracts";
import { getAddress, isAddress, isAddressEqual } from "viem";
import { getEnsAddress, normalize } from "viem/ens";
import { format } from "dnum";
import { DNUM_0 } from "@/src/dnum-utils";
import { getMainnetPublicClient } from "@/src/shellpoints/utils/client";
import "./ClaimScreen.css";
import type { Address } from "@/src/types";

const SNAILS = [
  { src: "/cute-snails/blue.png", name: "Blue Snail" },
  { src: "/cute-snails/green.png", name: "Green Snail" },
  { src: "/cute-snails/red.png", name: "Red Snail" },
  { src: "/cute-snails/tiger.png", name: "Tiger Snail" },
  { src: "/cute-snails/brown.png", name: "Brown Snail" },
  { src: "/cute-snails/battle.png", name: "Battle Snail" },
];

const CONFETTI_COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"];

type ActivityLabel =
  | "yUSND"
  | "Balancer"
  | "Bunni"
  | "Camelot"
  | "Spectra"
  | "Uniswap"
  | "GoSlow NFT"
  | "Borrowing"
  | "Stability Pool";

function getActivityLabel(token: string): ActivityLabel | null {
  const addr = token.toLowerCase();
  if (addr === CONTRACT_ADDRESSES.YUSND.toLowerCase()) return "yUSND";
  if (addr === CONTRACT_ADDRESSES.strategies.Balancer.toLowerCase()) return "Balancer";
  if (addr === CONTRACT_ADDRESSES.strategies.Balancer2.toLowerCase()) return "Balancer";
  if (addr === CONTRACT_ADDRESSES.strategies.Balancer3.toLowerCase()) return "Balancer";
  if (addr === CONTRACT_ADDRESSES.strategies.Bunni.toLowerCase()) return "Bunni";
  if (addr === CONTRACT_ADDRESSES.strategies.Camelot.toLowerCase()) return "Camelot";
  if (addr === CONTRACT_ADDRESSES.strategies.Spectra.toLowerCase()) return "Spectra";
  if (addr === CONTRACT_ADDRESSES.GoSlowNft.toLowerCase()) return "GoSlow NFT";
  if (addr === CONTRACT_ADDRESSES.strategies.UniswapV4.toLowerCase()) return "Uniswap";
  return null;
}

// Map subgraph activity labels to human-readable names
function formatActivityLabel(label: string): string {
  if (label.startsWith("SP_")) return "Stability Pool";
  if (label.startsWith("TROVE_")) return "Borrowing";
  if (label === "yUSND" || label === "YUSND") return "yUSND";
  if (label.toLowerCase().includes("balancer")) return "Balancer";
  if (label.toLowerCase().includes("bunni")) return "Bunni";
  if (label.toLowerCase().includes("camelot")) return "Camelot";
  if (label.toLowerCase().includes("spectra")) return "Spectra";
  if (label.toLowerCase().includes("uniswap")) return "Uniswap";
  if (label.toLowerCase().includes("goslow")) return "GoSlow NFT";
  return label;
}

export function ClaimScreen() {
  const account = useAccount();
  const [revealed, setRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [customAddress, setCustomAddress] = useState("");
  const [resolvedEnsAddress, setResolvedEnsAddress] = useState<Address | null>(null);
  const [isResolvingEns, setIsResolvingEns] = useState(false);
  const [ensError, setEnsError] = useState<string | null>(null);

  // Check if input looks like an ENS name
  const isEnsName = customAddress.includes(".") && !isAddress(customAddress);

  // Resolve ENS names
  useEffect(() => {
    if (!isEnsName) {
      setResolvedEnsAddress(null);
      setEnsError(null);
      return;
    }

    let cancelled = false;
    setIsResolvingEns(true);
    setEnsError(null);

    (async () => {
      try {
        const client = getMainnetPublicClient();
        const address = await getEnsAddress(client, { name: normalize(customAddress) });
        if (!cancelled) {
          if (address) {
            setResolvedEnsAddress(address);
            setEnsError(null);
          } else {
            setResolvedEnsAddress(null);
            setEnsError("ENS name not found");
          }
        }
      } catch {
        if (!cancelled) {
          setResolvedEnsAddress(null);
          setEnsError("Invalid ENS name");
        }
      } finally {
        if (!cancelled) {
          setIsResolvingEns(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customAddress, isEnsName]);

  // Use custom address if valid, otherwise connected wallet
  const lookupAddress: Address | undefined = useMemo(() => {
    if (customAddress && isAddress(customAddress)) {
      return getAddress(customAddress);
    }
    if (resolvedEnsAddress) {
      return resolvedEnsAddress;
    }
    return account.address;
  }, [customAddress, resolvedEnsAddress, account.address]);

  const isCustomLookup = customAddress && (isAddress(customAddress) || resolvedEnsAddress);

  // Fetch shell balance for lookup address
  const { data: shellBalance } = useBalance(lookupAddress, "SHELL");

  // Fetch activities for lookup address
  const { data: allActivities, isLoading: isLoadingActivities } = useShellActivitiesOfHolders(
    lookupAddress ? [lookupAddress] : undefined
  );

  // Fetch weighted activity snapshots (bonus weights)
  const { data: weightedSnapshots } = useWeightedActivitySnapshots(lookupAddress);

  // Fetch privacy pool snapshots (GoSlow NFT)
  const { data: privacyPoolSnapshots } = usePrivacyPoolSnapshots(lookupAddress);

  // Fetch total shells for NERI calculation
  const { data: totalShells } = useTotalShells();

  // Fetch NERI total supply from contract
  const { data: neriTotalSupply } = useNeriTotalSupply();

  // Calculate NERI allocation based on user's shell balance, total shells, and NERI supply
  const neriAllocation = useMemo(() => {
    if (!shellBalance || !totalShells || totalShells === 0n || !neriTotalSupply) return 0n;
    const userShells = shellBalance[0];
    return calculateNeriAllocation(userShells, totalShells, neriTotalSupply);
  }, [shellBalance, totalShells, neriTotalSupply]);

  // Get aggregated stats from weighted snapshots
  const activityStats = useMemo(() => {
    if (!weightedSnapshots || weightedSnapshots.length === 0) return null;

    // Group by formatted activity label and sum up values
    const byActivity = new Map<string, { baseValue: bigint; weightedValue: bigint; weight: number; multiplier: number }>();

    for (const snap of weightedSnapshots as Array<{ activityLabel: string; baseValue: string; weightedValue: string; weight: number; multiplier: number }>) {
      const formattedLabel = formatActivityLabel(snap.activityLabel);
      const existing = byActivity.get(formattedLabel);
      if (existing) {
        existing.baseValue += BigInt(snap.baseValue);
        existing.weightedValue += BigInt(snap.weightedValue);
        existing.weight = Math.max(existing.weight, snap.weight);
        existing.multiplier = Math.max(existing.multiplier, snap.multiplier);
      } else {
        byActivity.set(formattedLabel, {
          baseValue: BigInt(snap.baseValue),
          weightedValue: BigInt(snap.weightedValue),
          weight: snap.weight,
          multiplier: snap.multiplier,
        });
      }
    }

    return Array.from(byActivity.entries()).map(([label, stats]) => ({
      label,
      ...stats,
    }));
  }, [weightedSnapshots]);

  // Check if user has GoSlow NFT multiplier
  const hasGoSlowNft = privacyPoolSnapshots && privacyPoolSnapshots.length > 0;

  // Get user's activities from both sources
  const userActivities = useMemo(() => {
    const activities = new Set<string>();

    // From shell activities (strategy tokens)
    if (lookupAddress && allActivities) {
      allActivities
        .filter((activity) => isAddressEqual(getAddress(activity.holder), lookupAddress))
        .map((activity) => getActivityLabel(activity.token))
        .filter((label): label is ActivityLabel => label !== null)
        .forEach((label) => activities.add(label));
    }

    // From weighted snapshots (activity labels)
    if (weightedSnapshots) {
      weightedSnapshots.forEach((snap: { activityLabel: string }) => {
        if (snap.activityLabel) {
          activities.add(formatActivityLabel(snap.activityLabel));
        }
      });
    }

    return Array.from(activities);
  }, [lookupAddress, allActivities, weightedSnapshots]);

  // Generate stable confetti positions
  const confettiPieces = useMemo(() =>
    Array.from({ length: 150 }).map((_, i) => ({
      left: `${(i * 7) % 100}%`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${(i * 0.02) % 0.8}s`,
      duration: `${1.5 + (i % 4)}s`,
    })),
  []);

  // Animated snails floating around
  const snailTrail = useTrail(SNAILS.length, {
    from: { opacity: 0, transform: "scale(0) rotate(-180deg)" },
    to: { opacity: 1, transform: "scale(1) rotate(0deg)" },
    config: { mass: 1, tension: 280, friction: 20 },
  });

  // Main card animation
  const cardSpring = useSpring({
    from: { opacity: 0, transform: "scale(0.8) translateY(50px)" },
    to: { opacity: 1, transform: "scale(1) translateY(0px)" },
    delay: 300,
    config: { mass: 1, tension: 200, friction: 20 },
  });

  // Shell amount animation
  const shellAmountSpring = useSpring({
    from: { number: 0 },
    to: { number: revealed && shellBalance ? Number(format(shellBalance, 0).replace(/,/g, '')) : 0 },
    delay: revealed ? 200 : 0,
    config: { mass: 1, tension: 80, friction: 30 },
  });

  // NERI amount animation
  const neriAmountSpring = useSpring({
    from: { number: 0 },
    to: { number: revealed && neriAllocation ? Number(neriAllocation / 10n ** 18n) : 0 },
    delay: revealed ? 400 : 0,
    config: { mass: 1, tension: 80, friction: 30 },
  });

  const handleReveal = () => {
    setRevealed(true);
    setShowConfetti(true);
  };

  // Auto-hide confetti after animation
  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  // Reset reveal state when address changes
  useEffect(() => {
    setRevealed(false);
  }, [lookupAddress]);

  const hasShells = shellBalance && shellBalance[0] > 0n;
  const canReveal = lookupAddress && (account.isConnected || isCustomLookup);

  return (
    <div className={css({ position: "relative", overflow: "hidden", minHeight: "100vh" })}>
      {/* Confetti celebration */}
      {showConfetti && (
        <div className={css({
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 100
        })}>
          {confettiPieces.map((piece, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: piece.left,
                backgroundColor: piece.color,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
              }}
            />
          ))}
        </div>
      )}

      {/* Floating snails background */}
      <div className={css({
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      })}>
        {snailTrail.map((style, index) => {
          const snail = SNAILS[index];
          if (!snail) return null;
          return (
            <a.div
              key={index}
              className="floating-snail"
              style={{
                ...style,
                top: `${15 + (index % 3) * 30}%`,
                left: index < 3 ? `${5 + index * 3}%` : undefined,
                right: index >= 3 ? `${5 + (index - 3) * 3}%` : undefined,
                animationDelay: `${index * 0.3}s`,
                animationDuration: `${3 + index * 0.5}s`,
              }}
            >
              <img
                src={snail.src}
                alt={snail.name}
                className={css({
                  width: "80px",
                  height: "80px",
                  objectFit: "contain",
                  filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))",
                  opacity: 0.8,
                })}
              />
            </a.div>
          );
        })}
      </div>

      <Screen
        gap={24}
      >
        <a.div style={cardSpring}>
          <VFlex gap={20}>
            {/* Hero snail */}
            <div className={css({
              display: "flex",
              justifyContent: "center",
              position: "relative",
            })}>
              <div className="hero-snail">
                <img
                  src="/cute-snails/gold.png"
                  alt="NERI Snail"
                  className={css({
                    width: "120px",
                    height: "120px",
                    objectFit: "contain",
                    filter: "drop-shadow(0 8px 24px rgba(255, 215, 0, 0.4))",
                  })}
                />
              </div>
            </div>

            {/* Address lookup input */}
            <div className={css({
              display: "flex",
              flexDirection: "column",
              gap: 8,
            })}>
              <label className={css({
                fontSize: 13,
                color: "contentAlt",
              })}>
                Check any address
              </label>
              <input
                type="text"
                placeholder={account.address || "Enter address (0x...) or ENS name"}
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                className={css({
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: 13,
                  fontFamily: "monospace",
                  background: "secondary",
                  border: "1px solid",
                  borderColor: (customAddress && !isAddress(customAddress) && !isEnsName) || ensError ? "negative" : resolvedEnsAddress ? "positive" : "separator",
                  borderRadius: 8,
                  color: "content",
                  outline: "none",
                  transition: "border-color 0.2s",
                  _focus: {
                    borderColor: "accent",
                  },
                  _placeholder: {
                    color: "contentAlt",
                    opacity: 0.6,
                  },
                })}
              />
              {customAddress && !isAddress(customAddress) && !isEnsName && (
                <span className={css({ fontSize: 12, color: "negative" })}>
                  Invalid address format
                </span>
              )}
              {isEnsName && isResolvingEns && (
                <span className={css({ fontSize: 12, color: "contentAlt" })}>
                  Resolving {customAddress}...
                </span>
              )}
              {isEnsName && ensError && !isResolvingEns && (
                <span className={css({ fontSize: 12, color: "negative" })}>
                  {ensError}
                </span>
              )}
              {isEnsName && resolvedEnsAddress && !isResolvingEns && (
                <span className={css({ fontSize: 12, color: "positive" })}>
                  {customAddress} → {resolvedEnsAddress.slice(0, 6)}...{resolvedEnsAddress.slice(-4)}
                </span>
              )}
              {isCustomLookup && isAddress(customAddress) && (
                <span className={css({ fontSize: 12, color: "contentAlt" })}>
                  Looking up: {customAddress.slice(0, 6)}...{customAddress.slice(-4)}
                </span>
              )}
            </div>

            {/* Main reveal card */}
            <div
              className={css({
                background: "linear-gradient(135deg, token(colors.surface) 0%, token(colors.secondary) 100%)",
                borderRadius: 16,
                padding: 32,
                border: "2px solid",
                borderColor: revealed ? "positive" : "accent",
                transition: "all 0.5s ease",
              })}
              style={{
                boxShadow: revealed
                  ? "0 0 40px rgba(76, 175, 80, 0.3)"
                  : "0 0 40px rgba(255, 215, 0, 0.2)",
              }}
            >
              <VFlex gap={24}>
                {/* NERI Allocation */}
                <div className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                })}>
                  <span className={css({ color: "contentAlt", fontSize: 14 })}>
                    {isCustomLookup ? "NERI Allocation" : "Your NERI Allocation"}
                  </span>
                  <div className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 12px",
                    background: revealed ? "positive" : "accent",
                    borderRadius: 20,
                    color: revealed ? "white" : "accentContent",
                    fontSize: 12,
                    fontWeight: 600,
                  })}>
                    {revealed ? "Revealed" : "Ready to reveal"}
                  </div>
                </div>

                <div className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                })}>
                  {revealed ? (
                    <>
                      <a.span className="neri-amount">
                        {neriAmountSpring.number.to((n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 }))}
                      </a.span>
                      <TokenIcon symbol="NERI" size={32} />
                    </>
                  ) : (
                    <>
                      <span className={css({
                        fontSize: 36,
                        fontWeight: 700,
                        color: "contentAlt",
                      })}>
                        ???
                      </span>
                      <TokenIcon symbol="NERI" size={28} />
                    </>
                  )}
                </div>

                {canReveal && (
                  <div className={css({
                    fontSize: 14,
                    color: "contentAlt",
                    textAlign: "center",
                    opacity: revealed ? 0 : 1,
                    transition: "opacity 0.3s ease",
                  })}>
                    Click reveal to see the NERI allocation!
                  </div>
                )}

                {!lookupAddress && !account.isConnected && (
                  <div className={css({
                    fontSize: 14,
                    color: "contentAlt",
                    textAlign: "center",
                  })}>
                    Enter an address above or connect your wallet.
                  </div>
                )}
              </VFlex>
            </div>

            {/* Shells breakdown card */}
            {lookupAddress && (
              <div
                className={css({
                  background: "secondary",
                  borderRadius: 12,
                  padding: 16,
                  border: "1px solid token(colors.separator)",
                })}
              >
                <VFlex gap={12}>
                  <div className={css({
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  })}>
                    <span className={css({ color: "contentAlt", fontSize: 14, fontWeight: 500 })}>
                      {isCustomLookup ? "Shells Earned" : "Your Shells Earned"}
                    </span>
                    <div className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    })}>
                      {revealed ? (
                        <a.span className={css({ fontSize: 20, fontWeight: 600 })}>
                          {shellAmountSpring.number.to((n) => n.toLocaleString('en-US', { maximumFractionDigits: 0 }))}
                        </a.span>
                      ) : (
                        <span className={css({ fontSize: 20, fontWeight: 600 })}>
                          {hasShells ? format(shellBalance ?? DNUM_0, 0) : "0"}
                        </span>
                      )}
                      <ShellpointIcon size="medium" />
                    </div>
                  </div>

                  {/* Activities breakdown */}
                  {userActivities.length > 0 && (
                    <div className={css({
                      borderTop: "1px solid token(colors.separator)",
                      paddingTop: 12,
                    })}>
                      <div className={css({
                        fontSize: 11,
                        color: "contentAlt",
                        marginBottom: 8,
                      })}>
                        Earned from:
                      </div>
                      <div className={css({
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      })}>
                        {userActivities.map((activity) => (
                          <div
                            key={activity}
                            className={css({
                              padding: "4px 10px",
                              background: "surface",
                              borderRadius: 16,
                              fontSize: 12,
                              fontWeight: 500,
                              color: "content",
                              border: "1px solid token(colors.separator)",
                            })}
                          >
                            {activity}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {userActivities.length === 0 && hasShells && isLoadingActivities && (
                    <div className={css({
                      fontSize: 12,
                      color: "contentAlt",
                      fontStyle: "italic",
                    })}>
                      Loading activities...
                    </div>
                  )}

                  {/* Bonus stats */}
                  {(activityStats || hasGoSlowNft) && (
                    <div className={css({
                      borderTop: "1px solid token(colors.separator)",
                      paddingTop: 12,
                    })}>
                      <div className={css({
                        fontSize: 11,
                        color: "contentAlt",
                        marginBottom: 8,
                      })}>
                        Bonus multipliers:
                      </div>
                      <div className={css({
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      })}>
                        {activityStats?.map((stat) => {
                          // Weight is in basis points: 1000 = 1x, 1500 = 1.5x
                          const multiplier = stat.weight / 1000;
                          if (multiplier <= 1) return null;
                          return (
                            <div
                              key={stat.label}
                              className={css({
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "6px 10px",
                                background: "surface",
                                borderRadius: 6,
                                border: "1px solid token(colors.separator)",
                              })}
                            >
                              <span className={css({ fontSize: 12, color: "content" })}>
                                {stat.label}
                              </span>
                              <span className={css({
                                fontSize: 12,
                                fontWeight: 600,
                                color: "positive",
                              })}>
                                {multiplier}x
                              </span>
                            </div>
                          );
                        })}
                        {hasGoSlowNft && (
                          <div
                            className={css({
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "6px 10px",
                              background: "linear-gradient(135deg, token(colors.surface) 0%, rgba(255, 215, 0, 0.1) 100%)",
                              borderRadius: 6,
                              border: "1px solid rgba(255, 215, 0, 0.3)",
                            })}
                          >
                            <span className={css({ fontSize: 12, color: "content" })}>
                              GoSlow NFT
                            </span>
                            <span className={css({
                              fontSize: 12,
                              fontWeight: 600,
                              color: "warning",
                            })}>
                              Bonus!
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </VFlex>
              </div>
            )}

            {!isCustomLookup && <ConnectWarningBox />}

            {!revealed && canReveal && (
              <Button
                label={isCustomLookup ? "Reveal NERI" : "Reveal My NERI"}
                mode="primary"
                size="large"
                wide
                onClick={handleReveal}
              />
            )}

            {revealed && (
              <div className={css({
                textAlign: "center",
                padding: 16,
                background: "positive",
                borderRadius: 8,
                color: "white",
                fontWeight: 600,
                fontSize: 16,
              })}>
                {isCustomLookup ? "NERI tokens will be sent directly to this wallet!" : "NERI tokens will be sent directly to your wallet!"}
              </div>
            )}

            {/* Slogan */}
            <div className={css({
              textAlign: "center",
              fontSize: 14,
              color: "contentAlt",
              fontStyle: "italic",
            })}>
              Go slow.
            </div>
          </VFlex>
        </a.div>

        {/* Go Slow Foundation */}
        <section
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 16,
            width: "100%",
            maxWidth: 534,
            paddingTop: 32,
            borderTop: "1px solid token(colors.separator)",
          })}
        >
          <h2 className={css({ fontSize: 22, fontWeight: 600 })}>
            Go Slow Foundation
          </h2>
          <p className={css({ color: "contentAlt", lineHeight: 1.6, fontSize: 14 })}>
            A venture studio building decentralized stablecoins and the
            infrastructure they rely on. Go Slow Foundation holds exclusive
            Liquity licenses to deploy on multiple EVM chains.
          </p>
          <div className={css({ display: "flex", gap: 16 })}>
            {([
              { icon: <IconX size={18} />, href: "https://x.com/NeriteOrg" },
              { icon: <IconDiscord size={18} />, href: "https://discord.gg/5h3avBYxcn" },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                ),
                href: "https://github.com/NeriteOrg/nerite",
              },
            ] as const).map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={css({
                  display: "flex",
                  alignItems: "center",
                  color: "content",
                  _hover: { opacity: 0.8 },
                  _active: { translate: "0 1px" },
                  _focusVisible: { outline: "2px solid token(colors.focused)" },
                })}
              >
                {link.icon}
              </a>
            ))}
          </div>
        </section>
      </Screen>
    </div>
  );
}

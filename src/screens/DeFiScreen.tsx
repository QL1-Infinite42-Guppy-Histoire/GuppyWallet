import { useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import BridgeSection from "../components/BridgeSection";
import FlukeSection from "../components/FlukeSection";
import { SegmentedTabs } from "../components/controls";
import { Screen } from "../components/ui";
import { useI18n } from "../context/LanguageContext";
import StakingScreen from "./StakingScreen";
import SwapScreen from "./SwapScreen";

type DeFiSection = "swap" | "lp" | "staking" | "bridge" | "fluke";

/**
 * DeFi tab: one segmented home for everything that used to be spread
 * across the Swap / Staking tabs and the More screen — Swap | LP |
 * Staking (42 + st42) | Bridge | Fluke. All sections are the existing
 * working implementations, unchanged.
 */
export default function DeFiScreen() {
  const { t } = useI18n();
  const route = useRoute<any>();
  const [tab, setTab] = useState<DeFiSection>(
    (route.params?.section as DeFiSection) ?? "swap",
  );
  /** chain preselected from Home's chain toggle (navigation param) */
  const [presetChain, setPresetChain] = useState<string | undefined>(
    route.params?.chain as string | undefined,
  );

  useEffect(() => {
    const s = route.params?.section as DeFiSection | undefined;
    if (s) setTab(s);
  }, [route.params?.section]);

  useEffect(() => {
    const c = route.params?.chain as string | undefined;
    if (c) setPresetChain(c);
  }, [route.params?.chain]);

  return (
    <Screen>
      <SegmentedTabs
        options={[
          { key: "swap", label: t("defi.swap") },
          { key: "lp", label: t("defi.lp") },
          { key: "staking", label: t("defi.staking") },
          { key: "bridge", label: t("defi.bridge") },
          { key: "fluke", label: t("defi.fluke") },
        ]}
        value={tab}
        onChange={(k) => setTab(k as DeFiSection)}
      />
      {tab === "swap" ? (
        <SwapScreen view="swap" embedded initialChainKey={presetChain} />
      ) : null}
      {tab === "lp" ? (
        <SwapScreen view="lp" embedded initialChainKey={presetChain} />
      ) : null}
      {tab === "staking" ? <StakingScreen embedded /> : null}
      {tab === "bridge" ? <BridgeSection /> : null}
      {tab === "fluke" ? <FlukeSection /> : null}
    </Screen>
  );
}

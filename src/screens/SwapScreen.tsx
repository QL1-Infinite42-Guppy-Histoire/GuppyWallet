import { Contract, formatUnits, parseUnits } from "ethers";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTxFlow, type TxJob } from "../components/ConfirmTx";
import {
  Body,
  ChipPicker,
  DisabledButton,
  Field,
  Heading,
  InfoRow,
  PercentChips,
  PrimaryButton,
} from "../components/controls";
import { Card, Screen, Title, TokenIcon, colors } from "../components/ui";
import { CHAINS, type ChainConfig } from "../config/chains";
import { useI18n } from "../context/LanguageContext";
import { useWallet } from "../context/WalletContext";
import { useBalances } from "../context/BalancesContext";
import type { TokenBalance } from "../lib/onchain";
import {
  PAIR_ABI,
  applySlippage,
  deadline20Min,
  dexConfig,
  dexTokens,
  fetchLpPositions,
  fetchSwapQuote,
  getPairAddress,
  getRouter,
  type DexToken,
  type LpPosition,
  type SwapQuote,
} from "../lib/dex";
import { fetchUsdJpy } from "../lib/fx";
import { priceOf } from "../lib/prices";
import {
  getProvider,
  nativeGasReserve,
  percentOfBalance,
  prettyAmount,
} from "../lib/onchain";
import {
  estimateOrFallback,
  gasCostNative,
  planExactApproval,
  sendAndWait,
} from "../lib/tx";

const SLIPPAGE_PRESETS = ["0.1", "0.5", "1"] as const;

export default function SwapScreen({
  view = "swap",
  embedded,
  initialChainKey,
}: {
  /** "swap" renders the swap card; "lp" renders the LP card + your
   *  liquidity. All state/logic is shared — this only selects the
   *  visible section. */
  view?: "swap" | "lp";
  embedded?: boolean;
  /** chain preselected by the caller (e.g. Home's chain toggle via DeFi) */
  initialChainKey?: string;
} = {}) {
  const wallet = useWallet();
  const { t } = useI18n();
  const balances = useBalances();
  const { startTx, modal } = useTxFlow();

  const [chainKey, setChainKey] = useState<string>(
    initialChainKey ?? "infinite",
  );
  // Follow external preselection (Home chain toggle → DeFi → here).
  useEffect(() => {
    if (initialChainKey && initialChainKey !== chainKey) {
      setChainKey(initialChainKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChainKey]);
  const chain: ChainConfig =
    CHAINS.find((c) => c.key === chainKey) ?? CHAINS[0];
  const tokens = useMemo(() => dexTokens(chain), [chain]);

  const [fromKey, setFromKey] = useState<string>("");
  const [toKey, setToKey] = useState<string>("");
  const fromToken =
    tokens.find((t) => t.address === fromKey) ?? tokens[0];
  const toToken =
    tokens.find((t) => t.address === toKey && t.address !== fromToken.address) ??
    tokens.find((t) => t.address !== fromToken.address) ??
    tokens[1];
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [selectorSide, setSelectorSide] = useState<"from" | "to" | null>(null);

  // LP form
  const [lpAKey, setLpAKey] = useState<string>("");
  const [lpBKey, setLpBKey] = useState<string>("");
  const lpA = tokens.find((t) => t.address === lpAKey) ?? tokens[0];
  const lpB =
    tokens.find((t) => t.address === lpBKey && t.address !== lpA.address) ??
    tokens.find((t) => t.address !== lpA.address) ??
    tokens[1];
  const [lpAmountA, setLpAmountA] = useState("");
  const [lpAmountB, setLpAmountB] = useState("");
  const [lpBalance, setLpBalance] = useState<string | null>(null);
  const [lpRemoveAmount, setLpRemoveAmount] = useState("");
  const [lpError, setLpError] = useState<string | null>(null);

  // Your own LP positions on the selected chain's DEX (read-only scan:
  // factory.getPair + LP balanceOf for every listed-token pair).
  const [lpPositions, setLpPositions] = useState<LpPosition[] | null>(null);
  const [lpJpyRate, setLpJpyRate] = useState<number | null>(null);
  const loadLpPositions = useCallback(async () => {
    const address = wallet.info?.evmAddress;
    if (!address) {
      setLpPositions([]);
      return;
    }
    const [positions, rate] = await Promise.all([
      fetchLpPositions(chain, address).catch(() => [] as LpPosition[]),
      fetchUsdJpy().catch(() => null),
    ]);
    setLpPositions(positions);
    setLpJpyRate(rate);
  }, [chain, wallet.info?.evmAddress]);

  useEffect(() => {
    if (view === "lp") {
      setLpPositions(null);
      loadLpPositions().catch(() => setLpPositions([]));
    }
  }, [view, loadLpPositions]);

  /** JPY estimate for one LP position, when both sides are priced. */
  const lpPositionJpy = (p: LpPosition): number | null => {
    const priceMap = chain.key === "infinite" ? balances.prices : balances.ql1Prices;
    if (!priceMap || !lpJpyRate) return null;
    const priceA = priceOf(priceMap, p.tokenA.isNative && chain.key === "infinite" ? null : p.tokenA.address);
    const priceB = priceOf(priceMap, p.tokenB.isNative && chain.key === "infinite" ? null : p.tokenB.address);
    if (!priceA.reliable || priceA.usd === null || !priceB.reliable || priceB.usd === null)
      return null;
    const usd =
      Number(p.amountAFormatted) * priceA.usd +
      Number(p.amountBFormatted) * priceB.usd;
    return usd * lpJpyRate;
  };

  const slippageBps = useMemo(() => {
    const pct = Number(slippage);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) return 100;
    return Math.round(pct * 100);
  }, [slippage]);

  /** Own-wallet balance entry for a DEX token (null while unknown). */
  const balanceEntry = (token: DexToken): TokenBalance | null => {
    const list = balances.tokenResults;
    if (!list) return null;
    const entry = list.find((t) => {
      if (!t.ok || t.balance.chainKey !== chain.key) return false;
      if (token.isNative) return t.balance.address === null;
      return (
        t.balance.address?.toLowerCase() === token.address.toLowerCase()
      );
    });
    return entry && entry.ok ? entry.balance : null;
  };
  const fromBalance = balanceEntry(fromToken);

  // ------------------------------------------------------------ quoting
  const quoteSeq = useRef(0);
  const runQuote = async () => {
    const seq = ++quoteSeq.current;
    setQuoting(true);
    setQuoteError(null);
    try {
      const q = await fetchSwapQuote(chain, fromToken, toToken, amount);
      if (quoteSeq.current === seq) {
        setQuote(q);
        setQuoting(false);
      }
    } catch (e) {
      if (quoteSeq.current === seq) {
        setQuote(null);
        setQuoteError(e instanceof Error ? e.message : String(e));
        setQuoting(false);
      }
    }
  };

  const amountValid = useMemo(() => {
    const n = Number(amount);
    return amount.trim() !== "" && Number.isFinite(n) && n > 0;
  }, [amount]);

  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (!amountValid) {
      setQuoting(false);
      quoteSeq.current += 1;
      return;
    }
    setQuoting(true);
    const t = setTimeout(runQuote, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, fromToken, toToken, amount]);

  const flip = () => {
    setFromKey(toToken.address);
    setToKey(fromToken.address);
  };

  const pickToken = (token: DexToken) => {
    if (selectorSide === "from") {
      if (token.address === toToken.address) setToKey(fromToken.address);
      setFromKey(token.address);
    } else if (selectorSide === "to") {
      if (token.address === fromToken.address) setFromKey(toToken.address);
      setToKey(token.address);
    }
    setSelectorSide(null);
  };

  const setPercent = async (pct: number) => {
    if (!fromBalance) return;
    // MAX on the native coin keeps an estimated swap-gas reserve back,
    // so the swap itself does not fail for lack of gas money.
    const reserve =
      pct === 100 && fromToken.isNative
        ? await nativeGasReserve(chain, 400000n)
        : 0n;
    setAmount(percentOfBalance(fromBalance.raw, pct, fromToken.decimals, reserve));
  };

  const setLpPercent = async (
    side: "A" | "B",
    token: DexToken,
    pct: number,
  ) => {
    const bal = balanceEntry(token);
    if (!bal) return;
    const reserve =
      pct === 100 && token.isNative
        ? await nativeGasReserve(chain, 500000n)
        : 0n;
    const value = percentOfBalance(bal.raw, pct, token.decimals, reserve);
    if (side === "A") setLpAmountA(value);
    else setLpAmountB(value);
  };

  // ------------------------------------------------------------ swap tx
  const handleSwap = () => {
    if (!quote) return;
    const { router: routerAddress } = dexConfig(chain);
    const minOut = applySlippage(quote.amountOut, slippageBps);
    const path = quote.path.map((t) => t.address);
    const job: TxJob = {
      title: "通貨の交換",
      chain,
      lines: [
        { label: "アクション", value: "通貨の交換" },
        { label: "経路", value: quote.routeLabel },
        {
          label: "入力",
          value: `${formatUnits(quote.amountIn, fromToken.decimals)} ${fromToken.symbol}`,
        },
        {
          label: "もらえる量（目安）",
          value: `${quote.amountOutFormatted} ${toToken.symbol}`,
        },
        {
          label: "最悪でももらえる量",
          value: `${formatUnits(minOut, toToken.decimals)} ${toToken.symbol}（価格のずれ ${slippage}% まで）`,
        },
        { label: "コントラクト", value: routerAddress },
      ],
      prepare: async (signer) => {
        const to = await signer.getAddress();
        const router = getRouter(chain, signer);
        const senders: (() => Promise<string>)[] = [];
        let approvalGas = 0n;
        if (!fromToken.isNative) {
          const approval = await planExactApproval(
            signer,
            fromToken.address,
            routerAddress,
            quote.amountIn,
          );
          if (approval.needed) {
            approvalGas = approval.estimate;
            senders.push(approval.send);
          }
        }
        let swapTx: any;
        if (fromToken.isNative) {
          swapTx = {
            to: routerAddress,
            value: quote.amountIn,
            data: router.interface.encodeFunctionData("swapExactETHForTokens", [
              minOut,
              path,
              to,
              deadline20Min(),
            ]),
          };
        } else if (toToken.isNative) {
          swapTx = {
            to: routerAddress,
            data: router.interface.encodeFunctionData("swapExactTokensForETH", [
              quote.amountIn,
              minOut,
              path,
              to,
              deadline20Min(),
            ]),
          };
        } else {
          swapTx = {
            to: routerAddress,
            data: router.interface.encodeFunctionData(
              "swapExactTokensForTokens",
              [quote.amountIn, minOut, path, to, deadline20Min()],
            ),
          };
        }
        const swapGas = await estimateOrFallback(signer, swapTx, 400000n);
        senders.push(() => sendAndWait(signer, swapTx));
        return {
          gasEstimateText: await gasCostNative(
            signer,
            approvalGas + swapGas,
            chain.nativeSymbol,
          ),
          send: async () => {
            const hashes: string[] = [];
            for (const send of senders) hashes.push(await send());
            return hashes;
          },
        };
      },
    };
    startTx(job);
  };

  // ------------------------------------------------------------ LP
  const lpNativeBlocked = chain.key === "infinite" && (lpA.isNative || lpB.isNative);

  const fetchLpBalance = async () => {
    setLpError(null);
    const address = wallet.info?.evmAddress ?? null;
    if (!address) {
      setLpError("ウォレットが未設定です（作成／インポートしてください）。");
      return;
    }
    const pair = await getPairAddress(chain, lpA.address, lpB.address);
    if (!pair) {
      setLpBalance(null);
      setLpError("このペアは存在しません。");
      return;
    }
    try {
      const pairContract = new Contract(pair, PAIR_ABI, getProvider(chain)) as any;
      const bal: bigint = await pairContract.balanceOf(address);
      setLpBalance(formatUnits(bal, 18));
    } catch (e) {
      setLpError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleAddLiquidity = () => {
    setLpError(null);
    let amountA: bigint;
    let amountB: bigint;
    try {
      amountA = parseUnits(lpAmountA, lpA.decimals);
      amountB = parseUnits(lpAmountB, lpB.decimals);
      if (amountA <= 0n || amountB <= 0n) throw new Error("zero");
    } catch {
      setLpError("数量を確認してください。");
      return;
    }
    const { router: routerAddress } = dexConfig(chain);
    const minA = applySlippage(amountA, slippageBps);
    const minB = applySlippage(amountB, slippageBps);
    const job: TxJob = {
      title: "流動性を預ける",
      chain,
      lines: [
        { label: "アクション", value: "流動性を預ける" },
        { label: "ペア", value: `${lpA.symbol} / ${lpB.symbol}` },
        { label: "数量A", value: `${lpAmountA} ${lpA.symbol}` },
        { label: "数量B", value: `${lpAmountB} ${lpB.symbol}` },
        { label: "コントラクト", value: routerAddress },
      ],
      prepare: async (signer) => {
        const to = await signer.getAddress();
        const router = getRouter(chain, signer);
        const senders: (() => Promise<string>)[] = [];
        let gas = 0n;
        for (const [token, amt] of [
          [lpA, amountA],
          [lpB, amountB],
        ] as [DexToken, bigint][]) {
          if (token.isNative) continue;
          const approval = await planExactApproval(
            signer,
            token.address,
            routerAddress,
            amt,
          );
          if (approval.needed) {
            gas += approval.estimate;
            senders.push(approval.send);
          }
        }
        let lpTx: any;
        if (lpA.isNative || lpB.isNative) {
          // QL1 only: native side goes through addLiquidityETH.
          const tokenSide = lpA.isNative ? lpB : lpA;
          const tokenAmount = lpA.isNative ? amountB : amountA;
          const tokenMin = lpA.isNative ? minB : minA;
          const ethMin = lpA.isNative ? minA : minB;
          const ethAmount = lpA.isNative ? amountA : amountB;
          lpTx = {
            to: routerAddress,
            value: ethAmount,
            data: router.interface.encodeFunctionData("addLiquidityETH", [
              tokenSide.address,
              tokenAmount,
              tokenMin,
              ethMin,
              to,
              deadline20Min(),
            ]),
          };
        } else {
          lpTx = {
            to: routerAddress,
            data: router.interface.encodeFunctionData("addLiquidity", [
              lpA.address,
              lpB.address,
              amountA,
              amountB,
              minA,
              minB,
              to,
              deadline20Min(),
            ]),
          };
        }
        gas += await estimateOrFallback(signer, lpTx, 500000n);
        senders.push(() => sendAndWait(signer, lpTx));
        return {
          gasEstimateText: await gasCostNative(signer, gas, chain.nativeSymbol),
          send: async () => {
            const hashes: string[] = [];
            for (const send of senders) hashes.push(await send());
            return hashes;
          },
        };
      },
    };
    startTx(job);
  };

  const handleRemoveLiquidity = async () => {
    setLpError(null);
    const pair = await getPairAddress(chain, lpA.address, lpB.address);
    if (!pair) {
      setLpError("このペアは存在しません。");
      return;
    }
    let liquidity: bigint;
    try {
      liquidity = parseUnits(lpRemoveAmount, 18);
      if (liquidity <= 0n) throw new Error("zero");
    } catch {
      setLpError("数量を確認してください。");
      return;
    }
    const { router: routerAddress } = dexConfig(chain);
    const job: TxJob = {
      title: "流動性を引き出す",
      chain,
      lines: [
        { label: "アクション", value: "流動性を引き出す" },
        { label: "ペア", value: `${lpA.symbol} / ${lpB.symbol}` },
        { label: "量", value: lpRemoveAmount },
        { label: "ペアコントラクト", value: pair },
        { label: "コントラクト", value: routerAddress },
      ],
      prepare: async (signer) => {
        const to = await signer.getAddress();
        const router = getRouter(chain, signer);
        const senders: (() => Promise<string>)[] = [];
        let gas = 0n;
        const approval = await planExactApproval(
          signer,
          pair,
          routerAddress,
          liquidity,
        );
        if (approval.needed) {
          gas += approval.estimate;
          senders.push(approval.send);
        }
        let lpTx: any;
        if (lpA.isNative || lpB.isNative) {
          const tokenSide = lpA.isNative ? lpB : lpA;
          lpTx = {
            to: routerAddress,
            data: router.interface.encodeFunctionData("removeLiquidityETH", [
              tokenSide.address,
              liquidity,
              0,
              0,
              to,
              deadline20Min(),
            ]),
          };
        } else {
          lpTx = {
            to: routerAddress,
            data: router.interface.encodeFunctionData("removeLiquidity", [
              lpA.address,
              lpB.address,
              liquidity,
              0,
              0,
              to,
              deadline20Min(),
            ]),
          };
        }
        gas += await estimateOrFallback(signer, lpTx, 500000n);
        senders.push(() => sendAndWait(signer, lpTx));
        return {
          gasEstimateText: await gasCostNative(signer, gas, chain.nativeSymbol),
          send: async () => {
            const hashes: string[] = [];
            for (const send of senders) hashes.push(await send());
            return hashes;
          },
        };
      },
    };
    startTx(job);
  };

  // ------------------------------------------------------------ action state
  const noPair =
    quoteError !== null &&
    (quoteError.includes("この組み合わせでは交換できません") ||
      quoteError.includes("在庫が足りない"));
  let actionLabel = "交換する";
  let actionEnabled = false;
  if (!wallet.info) {
    actionLabel = "ウォレットを作成／インポートしてください";
  } else if (!amountValid) {
    actionLabel = "金額を入力";
  } else if (quoting) {
    actionLabel = "見積もり取得中…";
  } else if (noPair) {
    actionLabel = "ペアがありません";
  } else if (quoteError) {
    actionLabel = "見積もりを取得できません";
  } else if (quote) {
    actionLabel = "交換する";
    actionEnabled = true;
  }

  const minReceived = quote
    ? formatUnits(applySlippage(quote.amountOut, slippageBps), toToken.decimals)
    : null;

  const tokenChip = (token: DexToken, side: "from" | "to") => (
    <Pressable style={styles.tokenChip} onPress={() => setSelectorSide(side)}>
      <TokenIcon symbol={token.symbol} size={24} />
      <Text style={styles.tokenChipText}>
        {token.symbol}
        {token.isNative ? " ⦿" : ""} ▾
      </Text>
    </Pressable>
  );

  const lpPositionsPanel = (
    <Card>
      <Heading>{t("defi.yourLiquidity")}</Heading>
      {!wallet.info ? (
        <Body>
          ウォレットを作ると、預けている分がここに表示されます。
        </Body>
      ) : lpPositions === null ? (
        <Body>{t("common.loading")}</Body>
      ) : lpPositions.length === 0 ? (
        <Body>{t("defi.noLiquidity")}</Body>
      ) : (
        <>
          <Body>{t("defi.yourLiquidityNote")}</Body>
          {lpPositions.map((p) => {
            const jpy = lpPositionJpy(p);
            return (
              <View key={p.pairAddress} style={styles.lpPosition}>
                <Text style={styles.lpPairName}>
                  {p.tokenA.symbol} / {p.tokenB.symbol}
                </Text>
                <InfoRow
                  label="プールの割合"
                  value={
                    p.sharePct > 0 && p.sharePct < 0.01
                      ? "0.01%未満"
                      : `${p.sharePct.toFixed(2)}%`
                  }
                />
                <InfoRow
                  label={p.tokenA.symbol}
                  value={prettyAmount(p.amountAFormatted)}
                />
                <InfoRow
                  label={p.tokenB.symbol}
                  value={prettyAmount(p.amountBFormatted)}
                />
                <InfoRow
                  label="預けた分量"
                  value={prettyAmount(p.lpFormatted)}
                />
                {jpy !== null ? (
                  <InfoRow
                    label="円での目安"
                    value={`約 ¥${Math.round(jpy).toLocaleString("ja-JP")}`}
                  />
                ) : null}
              </View>
            );
          })}
        </>
      )}
      {wallet.info ? (
        <PrimaryButton label={t("common.refresh")} onPress={loadLpPositions} />
      ) : null}
    </Card>
  );

  return (
    <Screen embedded={embedded}>
      {embedded ? null : <Title>Swap</Title>}
      {modal}

      {/* chain segmented control */}
      <View style={styles.segmented}>
        {CHAINS.map((c) => {
          const active = c.key === chain.key;
          return (
            <Pressable
              key={c.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setChainKey(c.key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {c.displayName}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.dexCaption}>
        {chain.key === "infinite"
          ? "Don't Panic で交換します"
          : "QomSwap で交換します"}
      </Text>

      {/* ------- Uniswap-style swap card ------- */}
      {view === "swap" ? (
      <View style={styles.swapCard}>
        {/* pay panel */}
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>払う</Text>
          <View style={styles.panelRow}>
            <TextInput
              style={styles.bigInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.0"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              autoCorrect={false}
            />
            {tokenChip(fromToken, "from")}
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceText}>
              残高:{" "}
              {fromBalance
                ? `${prettyAmount(fromBalance.formatted)} ${fromToken.symbol}`
                : wallet.info
                  ? "読み込み中"
                  : "—"}
            </Text>
            <PercentChips onSelect={setPercent} disabled={!fromBalance} />
          </View>
        </View>

        {/* flip */}
        <Pressable style={styles.flipButton} onPress={flip}>
          <Text style={styles.flipText}>⇅</Text>
        </Pressable>

        {/* receive panel */}
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>もらえる（目安）</Text>
          <View style={styles.panelRow}>
            <Text
              style={[
                styles.bigOutput,
                quoting && styles.dimmed,
                !quote && styles.placeholderText,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {quote ? prettyAmount(quote.amountOutFormatted, 10) : "0.0"}
            </Text>
            {tokenChip(toToken, "to")}
          </View>
          <Text style={styles.balanceText}>
            {quote
              ? `1 ${fromToken.symbol} ≈ ${quote.rate.toPrecision(6)} ${toToken.symbol}`
              : " "}
          </Text>
        </View>

        {/* settings: slippage */}
        <View style={styles.settingsRow}>
          <Text style={styles.settingsLabel}>スリッページ許容</Text>
          <View style={styles.pctRow}>
            {SLIPPAGE_PRESETS.map((p) => {
              const active = slippage === p;
              return (
                <Pressable
                  key={p}
                  style={[styles.pctChip, active && styles.pctChipActive]}
                  onPress={() => setSlippage(p)}
                >
                  <Text
                    style={[
                      styles.pctChipText,
                      active && styles.pctChipTextActive,
                    ]}
                  >
                    {p}%
                  </Text>
                </Pressable>
              );
            })}
            <TextInput
              style={styles.slippageInput}
              value={slippage}
              onChangeText={setSlippage}
              keyboardType="decimal-pad"
              autoCorrect={false}
            />
            <Text style={styles.settingsLabel}>%</Text>
          </View>
        </View>

        <Text style={styles.finePrint}>
          スリッページは「価格のずれの許容範囲」です。大きすぎると損をすることがあります。
        </Text>

        {/* details */}
        {quote ? (
          <View style={styles.details}>
            <InfoRow label="経路" value={quote.routeLabel} />
            <InfoRow
              label="レート"
              value={`1 ${fromToken.symbol} ≈ ${quote.rate.toPrecision(6)} ${toToken.symbol}`}
            />
            {quote.spotRate !== null ? (
              <InfoRow
                label="今の相場"
                value={`1 ${fromToken.symbol} ≈ ${quote.spotRate.toPrecision(6)} ${toToken.symbol}`}
              />
            ) : null}
            {quote.priceImpactPct !== null ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>価格への影響</Text>
                <Text
                  style={[
                    styles.infoValue,
                    quote.priceImpactPct > 10
                      ? styles.impactDanger
                      : quote.priceImpactPct > 3
                        ? styles.impactWarn
                        : null,
                  ]}
                >
                  {quote.priceImpactPct.toFixed(2)}%
                </Text>
              </View>
            ) : null}
            <InfoRow
              label="最悪でももらえる量"
              value={`${minReceived} ${toToken.symbol}`}
            />
            <Pressable onPress={runQuote}>
              <Text style={styles.refreshLink}>見積もりを更新 ↻</Text>
            </Pressable>
          </View>
        ) : null}
        {quoteError ? (
          <Text style={styles.errorText}>{quoteError}</Text>
        ) : null}

        {/* action */}
        <Pressable
          style={[
            styles.actionButton,
            {
              backgroundColor: actionEnabled
                ? colors.primary
                : colors.panel,
            },
          ]}
          disabled={!actionEnabled}
          onPress={handleSwap}
        >
          {quoting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={[
                styles.actionText,
                !actionEnabled && styles.actionTextDisabled,
              ]}
            >
              {actionLabel}
            </Text>
          )}
        </Pressable>
        <Text style={styles.finePrint}>
          交換の前に、確認画面で金額と手数料を必ず確認してください。
        </Text>
      </View>
      ) : null}

      {/* ------- LP (unchanged flows, restyled container) ------- */}
      {view === "lp" ? (
        <>
          {lpPositionsPanel}
          <Card>
        <Heading>流動性を提供</Heading>
        <Body>2つの通貨を預けて、交換の手数料をもらえます。</Body>
        <Body>トークンA</Body>
        <ChipPicker
          options={tokens.map((t) => ({
            key: t.address,
            label: t.symbol,
          }))}
          value={lpA.address}
          onChange={setLpAKey}
        />
        <Body>トークンB</Body>
        <ChipPicker
          options={tokens
            .filter((t) => t.address !== lpA.address)
            .map((t) => ({
              key: t.address,
              label: t.symbol,
            }))}
          value={lpB.address}
          onChange={setLpBKey}
        />
        {lpNativeBlocked ? (
          <>
            <Body>
              42を含む組み合わせは、預ける方法がまだ確認できていないため
              使えません。トークン同士の組み合わせは使えます。
            </Body>
            <DisabledButton label="この組み合わせは準備中" />
          </>
        ) : (
          <>
            <Field
              value={lpAmountA}
              onChangeText={setLpAmountA}
              placeholder={`数量A（${lpA.symbol}）`}
              keyboardType="decimal-pad"
            />
            <PercentChips
              onSelect={(pct) => setLpPercent("A", lpA, pct)}
              disabled={!balanceEntry(lpA)}
            />
            <Field
              value={lpAmountB}
              onChangeText={setLpAmountB}
              placeholder={`数量B（${lpB.symbol}）`}
              keyboardType="decimal-pad"
            />
            <PercentChips
              onSelect={(pct) => setLpPercent("B", lpB, pct)}
              disabled={!balanceEntry(lpB)}
            />
            <PrimaryButton label="預ける" onPress={handleAddLiquidity} />
          </>
        )}
        <PrimaryButton label="預けた量を確認" onPress={fetchLpBalance} />
        {lpBalance !== null ? (
          <InfoRow label="あなたが預けた量" value={lpBalance} />
        ) : null}
        {!lpNativeBlocked ? (
          <>
            <Field
              value={lpRemoveAmount}
              onChangeText={setLpRemoveAmount}
              placeholder="引き出す量"
              keyboardType="decimal-pad"
            />
            <PrimaryButton
              label="引き出す"
              onPress={handleRemoveLiquidity}
            />
            <Body>
              戻ってくる量は、そのときの相場で変わります。
              確認画面でよく確認してください。
            </Body>
          </>
        ) : null}
        {lpError ? <Text style={styles.errorText}>{lpError}</Text> : null}
        {!wallet.info ? (
          <Body>預けたり引き出したりには、ウォレットの作成／インポートが必要です。</Body>
        ) : null}
          </Card>
        </>
      ) : null}

      {/* ------- token selector modal ------- */}
      <Modal
        visible={selectorSide !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectorSide(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectorSide(null)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>トークンを選択</Text>
            <ScrollView>
              {tokens.map((t) => {
                const bal = balanceEntry(t);
                const selected =
                  (selectorSide === "from" ? fromToken : toToken).address ===
                  t.address;
                return (
                  <Pressable
                    key={`${t.address}-${t.isNative ? "native" : "erc20"}`}
                    style={[styles.tokenRow, selected && styles.tokenRowSelected]}
                    onPress={() => pickToken(t)}
                  >
                    <View style={styles.tokenRowLeft}>
                      <TokenIcon symbol={t.symbol} size={36} />
                      <View>
                        <Text style={styles.tokenRowSymbol}>
                          {t.symbol}
                        </Text>
                        {t.isNative ? (
                          <Text style={styles.tokenRowAddr}>
                            このチェーンの通貨
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.tokenRowBalance}>
                      {bal ? prettyAmount(bal.formatted) : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  lpPosition: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 10,
    gap: 2,
  },
  lpPairName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.glassChip,
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: "center",
    overflow: "hidden",
  },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  segmentActive: { backgroundColor: colors.primary },
  segmentTextActive: { color: "#FFFFFF", fontWeight: "800" },
  dexCaption: { color: colors.onSpaceMuted, fontSize: 12, textAlign: "center" },
  swapCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    gap: 0,
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  panelLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  panelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bigInput: {
    flex: 1,
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
    paddingVertical: 4,
    minWidth: 0,
  },
  bigOutput: {
    flex: 1,
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
    paddingVertical: 4,
    minWidth: 0,
  },
  placeholderText: { color: colors.muted },
  dimmed: { opacity: 0.45 },
  tokenChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tokenChipText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  balanceText: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  pctRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  pctChip: {
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pctChipActive: { backgroundColor: colors.gradStart, borderColor: colors.gradStart },
  pctChipText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  pctChipTextActive: { color: "#FFFFFF" },
  flipButton: {
    alignSelf: "center",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderColor: colors.panelBorder,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: -13,
    zIndex: 2,
    elevation: 3,
  },
  flipText: { color: colors.accent, fontSize: 19, fontWeight: "800" },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    gap: 8,
  },
  settingsLabel: { color: colors.muted, fontSize: 12 },
  slippageInput: {
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 12,
    minWidth: 46,
    textAlign: "center",
  },
  details: { marginTop: 12, gap: 2 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 2,
  },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  impactWarn: { color: colors.accentWarm },
  impactDanger: { color: colors.dangerText },
  refreshLink: { color: colors.accent, fontSize: 12, marginTop: 4 },
  actionButton: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 14,
    overflow: "hidden",
  },
  actionText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  actionTextDisabled: { color: colors.muted },
  finePrint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.glassSheet,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 16,
    maxHeight: "72%",
    gap: 6,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  tokenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  tokenRowSelected: { backgroundColor: colors.panel },
  tokenRowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  tokenRowSymbol: { color: colors.text, fontSize: 15, fontWeight: "700" },
  tokenRowAddr: { color: colors.muted, fontSize: 11 },
  tokenRowBalance: { color: colors.muted, fontSize: 13 },
});

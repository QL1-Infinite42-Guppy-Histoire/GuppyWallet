import { Contract, formatUnits, parseUnits } from "ethers";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";
import { CHAINS, type ChainConfig } from "../config/chains";
import { useWallet } from "../context/WalletContext";
import { useBalances } from "../context/BalancesContext";
import type { TokenBalance } from "../lib/onchain";
import {
  PAIR_ABI,
  applySlippage,
  deadline20Min,
  dexConfig,
  dexTokens,
  fetchSwapQuote,
  getPairAddress,
  getRouter,
  type DexToken,
  type SwapQuote,
} from "../lib/dex";
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

export default function SwapScreen() {
  const wallet = useWallet();
  const balances = useBalances();
  const { startTx, modal } = useTxFlow();

  const [chainKey, setChainKey] = useState<string>("infinite");
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
      title: "スワップ",
      chain,
      lines: [
        { label: "アクション", value: "Swap（DEX）" },
        { label: "ルート", value: quote.routeLabel },
        {
          label: "入力",
          value: `${formatUnits(quote.amountIn, fromToken.decimals)} ${fromToken.symbol}`,
        },
        {
          label: "見積出力",
          value: `${quote.amountOutFormatted} ${toToken.symbol}`,
        },
        {
          label: "最小受取",
          value: `${formatUnits(minOut, toToken.decimals)} ${toToken.symbol}（スリッページ ${slippage}%）`,
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
      setLpError("LP数量を確認してください。");
      return;
    }
    const { router: routerAddress } = dexConfig(chain);
    const minA = applySlippage(amountA, slippageBps);
    const minB = applySlippage(amountB, slippageBps);
    const job: TxJob = {
      title: "流動性を追加",
      chain,
      lines: [
        { label: "アクション", value: "LP追加" },
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
      setLpError("LP数量を確認してください。");
      return;
    }
    const { router: routerAddress } = dexConfig(chain);
    const job: TxJob = {
      title: "流動性を解除",
      chain,
      lines: [
        { label: "アクション", value: "LP解除" },
        { label: "ペア", value: `${lpA.symbol} / ${lpB.symbol}` },
        { label: "LP数量", value: lpRemoveAmount },
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
    (quoteError.includes("ルートが見つかりません") ||
      quoteError.includes("流動性不足"));
  let actionLabel = "スワップする";
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
    actionLabel = "スワップする";
    actionEnabled = true;
  }

  const minReceived = quote
    ? formatUnits(applySlippage(quote.amountOut, slippageBps), toToken.decimals)
    : null;

  const tokenChip = (token: DexToken, side: "from" | "to") => (
    <Pressable style={styles.tokenChip} onPress={() => setSelectorSide(side)}>
      <Text style={styles.tokenChipText}>
        {token.symbol}
        {token.isNative ? " ⦿" : ""} ▾
      </Text>
    </Pressable>
  );

  return (
    <Screen>
      <Title>Swap</Title>
      <PrototypeWarning />
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
                {c.key === "infinite" ? "Infinite" : "QL1"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.dexCaption}>
        {chain.key === "infinite"
          ? "DEX: Don't Panic / Nutri-Matic（Uniswap V2方式）"
          : "DEX: QomSwap（Uniswap V2方式）"}
      </Text>

      {/* ------- Uniswap-style swap card ------- */}
      <View style={styles.swapCard}>
        {/* pay panel */}
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>支払い（You pay）</Text>
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
                  ? "取得中／未取得"
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
          <Text style={styles.panelLabel}>受取（You receive・見積）</Text>
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

        {/* details */}
        {quote ? (
          <View style={styles.details}>
            <InfoRow label="ルート" value={quote.routeLabel} />
            <InfoRow
              label="レート"
              value={`1 ${fromToken.symbol} ≈ ${quote.rate.toPrecision(6)} ${toToken.symbol}`}
            />
            {quote.spotRate !== null ? (
              <InfoRow
                label="スポットレート"
                value={`1 ${fromToken.symbol} ≈ ${quote.spotRate.toPrecision(6)} ${toToken.symbol}`}
              />
            ) : null}
            {quote.priceImpactPct !== null ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>価格インパクト（手数料込み）</Text>
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
              label="最小受取"
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
          style={[styles.actionButton, !actionEnabled && styles.actionDisabled]}
          disabled={!actionEnabled}
          onPress={handleSwap}
        >
          {quoting ? (
            <ActivityIndicator color="#0B0F19" />
          ) : (
            <Text style={styles.actionText}>{actionLabel}</Text>
          )}
        </Pressable>
        <Text style={styles.finePrint}>
          実行時は正確な数量分だけ承認（approve）してから交換します。
          最終確認は確認画面（ガス代・最小受取つき）で行います。
        </Text>
      </View>

      {/* ------- LP (unchanged flows, restyled container) ------- */}
      <Card>
        <Heading>流動性提供（LP）</Heading>
        <Body>トークンA</Body>
        <ChipPicker
          options={tokens.map((t) => ({
            key: t.address,
            label: t.isNative ? `${t.symbol}（ネイティブ）` : t.symbol,
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
              label: t.isNative ? `${t.symbol}（ネイティブ）` : t.symbol,
            }))}
          value={lpB.address}
          onChange={setLpBKey}
        />
        {lpNativeBlocked ? (
          <>
            <Body>
              Infiniteではネイティブ（42）を含むペアのLP追加・解除は、
              プレースホルダ方式での実績が確認できていないため無効化しています
              （情報不足／TODO）。トークン同士のペアは利用できます。
            </Body>
            <DisabledButton label="LP追加（このペアは準備中）" />
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
            <PrimaryButton label="流動性を追加" onPress={handleAddLiquidity} />
          </>
        )}
        <PrimaryButton label="LP残高を取得" onPress={fetchLpBalance} />
        {lpBalance !== null ? (
          <InfoRow label="あなたのLP残高" value={lpBalance} />
        ) : null}
        {!lpNativeBlocked ? (
          <>
            <Field
              value={lpRemoveAmount}
              onChangeText={setLpRemoveAmount}
              placeholder="解除するLP数量"
              keyboardType="decimal-pad"
            />
            <PrimaryButton
              label="流動性を解除"
              onPress={handleRemoveLiquidity}
            />
            <Body>
              解除時の最小受取は0に設定しています（プロトタイプ）。実行前に
              ペアの状態をエクスプローラーで確認してください。
            </Body>
          </>
        ) : null}
        {lpError ? <Text style={styles.errorText}>{lpError}</Text> : null}
        {!wallet.info ? (
          <Body>LP操作にはウォレットの作成／インポートが必要です。</Body>
        ) : null}
      </Card>

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
                    <View>
                      <Text style={styles.tokenRowSymbol}>
                        {t.symbol}
                        {t.isNative ? "（ネイティブ）" : ""}
                      </Text>
                      <Text style={styles.tokenRowAddr}>
                        {t.isNative && chain.key === "infinite"
                          ? "ネイティブコイン"
                          : `${t.address.slice(0, 10)}…${t.address.slice(-6)}`}
                      </Text>
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
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.panel,
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
  },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  segmentTextActive: { color: "#0B0F19", fontWeight: "800" },
  dexCaption: { color: colors.muted, fontSize: 12, textAlign: "center" },
  swapCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    gap: 0,
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
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
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
  pctChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pctChipText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  pctChipTextActive: { color: "#0B0F19" },
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
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 14,
  },
  actionDisabled: { opacity: 0.45 },
  actionText: { color: "#0B0F19", fontSize: 16, fontWeight: "800" },
  finePrint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,4,10,0.72)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.card,
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
  tokenRowSymbol: { color: colors.text, fontSize: 15, fontWeight: "700" },
  tokenRowAddr: { color: colors.muted, fontSize: 11 },
  tokenRowBalance: { color: colors.muted, fontSize: 13 },
});

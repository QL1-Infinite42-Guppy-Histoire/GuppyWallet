import { formatUnits, parseUnits } from "ethers";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useTxFlow, type TxJob } from "../components/ConfirmTx";
import {
  Body,
  ChipPicker,
  DisabledButton,
  Field,
  Heading,
  InfoRow,
  PrimaryButton,
} from "../components/controls";
import { Card, PrototypeWarning, Screen, Title, colors } from "../components/ui";
import { CHAINS, type ChainConfig } from "../config/chains";
import { useWallet } from "../context/WalletContext";
import { useWatchAddress } from "../context/WatchAddressContext";
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
import { getProvider } from "../lib/onchain";
import {
  estimateOrFallback,
  gasCostNative,
  planExactApproval,
  sendAndWait,
} from "../lib/tx";
import { Contract } from "ethers";

export default function SwapScreen() {
  const wallet = useWallet();
  const watch = useWatchAddress();
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

  const resetQuote = () => setQuote(null);

  const handleQuote = async () => {
    setQuoteError(null);
    setQuoting(true);
    try {
      setQuote(await fetchSwapQuote(chain, fromToken, toToken, amount));
    } catch (e) {
      setQuote(null);
      setQuoteError(e instanceof Error ? e.message : String(e));
    } finally {
      setQuoting(false);
    }
  };

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
        const steps: { tx: any; fallback: bigint }[] = [];
        const senders: (() => Promise<string>)[] = [];
        if (!fromToken.isNative) {
          const approval = await planExactApproval(
            signer,
            fromToken.address,
            routerAddress,
            quote.amountIn,
          );
          if (approval.needed) {
            steps.push({ tx: null, fallback: approval.estimate });
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
        const totalGas =
          steps.reduce((acc, s) => acc + s.fallback, 0n) + swapGas;
        senders.push(() => sendAndWait(signer, swapTx));
        return {
          gasEstimateText: await gasCostNative(
            signer,
            totalGas,
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

  const lpNativeBlocked = chain.key === "infinite" && (lpA.isNative || lpB.isNative);

  const fetchLpBalance = async () => {
    setLpError(null);
    const address = watch.effectiveAddress;
    if (!address) {
      setLpError("アドレス（ウォレットまたはウォッチ）が未設定です。");
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

  return (
    <Screen>
      <Title>Swap</Title>
      <PrototypeWarning />
      {modal}
      <Card>
        <Heading>チェーン</Heading>
        <ChipPicker
          options={CHAINS.map((c) => ({ key: c.key, label: c.displayName }))}
          value={chainKey}
          onChange={(k) => {
            setChainKey(k);
            resetQuote();
          }}
        />
        <Body>
          {chain.key === "infinite"
            ? "DEX: Don't Panic / Nutri-Matic（Uniswap V2方式）"
            : "DEX: QomSwap（Uniswap V2方式）"}
        </Body>
      </Card>

      <Card>
        <Heading>スワップ見積もり・実行</Heading>
        <Body>交換元</Body>
        <ChipPicker
          options={tokens.map((t) => ({
            key: t.address,
            label: t.isNative ? `${t.symbol}（ネイティブ）` : t.symbol,
          }))}
          value={fromToken.address}
          onChange={(k) => {
            setFromKey(k);
            resetQuote();
          }}
        />
        <Body>交換先</Body>
        <ChipPicker
          options={tokens
            .filter((t) => t.address !== fromToken.address)
            .map((t) => ({
              key: t.address,
              label: t.isNative ? `${t.symbol}（ネイティブ）` : t.symbol,
            }))}
          value={toToken.address}
          onChange={(k) => {
            setToKey(k);
            resetQuote();
          }}
        />
        <Field
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            resetQuote();
          }}
          placeholder={`数量（${fromToken.symbol}）`}
          keyboardType="decimal-pad"
        />
        <Field
          value={slippage}
          onChangeText={setSlippage}
          placeholder="スリッページ許容（%）"
          keyboardType="decimal-pad"
        />
        <PrimaryButton
          label="見積もりを取得"
          onPress={handleQuote}
          loading={quoting}
        />
        {quoteError ? <Text style={styles.errorText}>{quoteError}</Text> : null}
        {quote ? (
          <>
            <InfoRow label="ルート" value={quote.routeLabel} />
            <InfoRow
              label="見積出力"
              value={`${quote.amountOutFormatted} ${toToken.symbol}`}
            />
            <InfoRow
              label="レート"
              value={`1 ${fromToken.symbol} ≈ ${quote.rate.toPrecision(6)} ${toToken.symbol}`}
            />
            <PrimaryButton label="スワップを実行" onPress={handleSwap} />
            <Body>
              実行時は正確な数量分だけ承認（approve）してから交換します。
              最終確認は確認画面で行います。
            </Body>
          </>
        ) : null}
      </Card>

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
            <Field
              value={lpAmountB}
              onChangeText={setLpAmountB}
              placeholder={`数量B（${lpB.symbol}）`}
              keyboardType="decimal-pad"
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
});

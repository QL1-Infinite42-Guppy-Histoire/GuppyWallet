import { useCallback, useEffect, useMemo, useState } from "react";
import { INFINITE, QL1, INFINITE_TOKENS, type ChainConfig } from "../../src/config/chains";
import { fetchUsdJpy } from "../../src/lib/fx";
import {
  fetchChainBalances,
  prettyAmount,
  type TokenBalance,
} from "../../src/lib/onchain";
import {
  fetchInfinitePrices,
  fetchQl1Prices,
  priceOf,
  type TokenPrice,
} from "../../src/lib/prices";
import {
  currentAddress,
  deleteVault,
  hasVault,
  isValidMnemonic,
  lock,
  setupImportedWallet,
  setupNewWallet,
  unlock,
} from "./vault";
import FlukeScreen from "./FlukeScreen";
import ReceiveScreen from "./ReceiveScreen";
import SendScreen from "./SendScreen";

type Stage =
  | { kind: "loading" }
  | { kind: "welcome" }
  | { kind: "create" } // shows the new mnemonic once
  | { kind: "import" }
  | { kind: "unlock" }
  | { kind: "home" };

type Tab = "home" | "send" | "receive" | "fluke";

const CHAINS: ChainConfig[] = [INFINITE, QL1];

function tokenColor(symbol: string): string {
  const map: Record<string, string> = {
    "42": "#B8860B", QOM: "#7A5CFF", USDT: "#26A17B", USDC: "#2775CA",
    FISH: "#30A8FF", ZAP: "#E35D9C", WQOM: "#7A5CFF",
  };
  return map[symbol] ?? "#5A7DFF";
}

export default function App() {
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("home");
  const [address, setAddress] = useState<string | null>(null);
  const [chain, setChain] = useState<ChainConfig>(INFINITE);
  const [balances, setBalances] = useState<TokenBalance[] | null>(null);
  const [prices, setPrices] = useState<Map<string, TokenPrice> | null>(null);
  const [usdJpy, setUsdJpy] = useState<number | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    (async () => {
      setStage((await hasVault()) ? { kind: "unlock" } : { kind: "welcome" });
    })();
  }, []);

  const enter = useCallback((addr: string) => {
    setAddress(addr);
    setStage({ kind: "home" });
    setTab("home");
  }, []);

  const loadBalances = useCallback(async () => {
    if (!address) return;
    setLoadErr(null);
    try {
      const [bals, infPrices, fx] = await Promise.all([
        fetchChainBalances(chain, address),
        fetchInfinitePrices(),
        fetchUsdJpy(),
      ]);
      const ok = bals.filter((r) => r.ok).map((r) => (r as { balance: TokenBalance }).balance);
      setBalances(ok);
      setUsdJpy(fx);
      if (chain.key === "infinite") {
        setPrices(infPrices);
      } else {
        const qom = INFINITE_TOKENS.find((t) => t.symbol === "QOM");
        const qomUsd = qom ? priceOf(infPrices, qom.address).usd : null;
        setPrices(await fetchQl1Prices(qomUsd));
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e));
    }
  }, [address, chain]);

  useEffect(() => {
    if (stage.kind === "home" && tab === "home") void loadBalances();
  }, [stage, tab, chain, address, refreshTick, loadBalances]);

  const totalJpy = useMemo(() => {
    if (!balances || !prices || !usdJpy) return null;
    let sum = 0;
    let any = false;
    for (const b of balances) {
      const p = priceOf(prices, b.address);
      if (p.usd !== null && p.reliable) {
        sum += Number(b.formatted) * p.usd * usdJpy;
        any = true;
      }
    }
    return any ? sum : null;
  }, [balances, prices, usdJpy]);

  if (stage.kind === "loading") {
    return (
      <div className="app">
        <div className="head"><h1 className="logo">GuppyWallet</h1><span className="panic">DON'T PANIC</span></div>
        <p className="sub">読み込み中…</p>
      </div>
    );
  }

  if (stage.kind === "welcome") {
    return (
      <div className="app">
        <div className="head"><h1 className="logo">GuppyWallet</h1><span className="panic">DON'T PANIC</span></div>
        <p className="sub">42 Chain と QL1 のためのウォレットです。スマホアプリ版と同じ復旧フレーズで、同じウォレットが開けます。</p>
        <div className="card">
          <h2>はじめる</h2>
          <p>新しく作るか、アプリで使っている復旧フレーズを取り込んでください。</p>
          <button className="btn" onClick={() => setStage({ kind: "create" })}>新しく作る</button>
          <button className="btn ghost" onClick={() => setStage({ kind: "import" })}>復旧フレーズで取り込む</button>
        </div>
        <div className="foot"><span className="mini">拡張機能版 v0.1.0</span></div>
      </div>
    );
  }

  if (stage.kind === "create") {
    return <CreateFlow onDone={enter} onBack={() => setStage({ kind: "welcome" })} />;
  }
  if (stage.kind === "import") {
    return <ImportFlow onDone={enter} onBack={() => setStage({ kind: "welcome" })} />;
  }
  if (stage.kind === "unlock") {
    return <UnlockFlow onDone={enter} />;
  }

  // home shell
  return (
    <div className="app">
      <div className="head">
        <h1 className="logo">GuppyWallet</h1>
        <span className="panic">DON'T PANIC</span>
      </div>
      {tab === "home" && (
        <>
          <div className="hero">
            <div className="who">{address}</div>
            <div className="total">
              {totalJpy !== null ? `¥${Math.round(totalJpy).toLocaleString("ja-JP")}` : "—"}
            </div>
            <div className="acts">
              <button onClick={() => setTab("send")}>送る</button>
              <button className="ghost" onClick={() => setTab("receive")}>受け取る</button>
              <button className="ghost" onClick={() => setTab("fluke")}>Guide発行</button>
            </div>
          </div>
          <div className="seg">
            {CHAINS.map((c) => (
              <button key={c.key} className={chain.key === c.key ? "on" : ""} onClick={() => setChain(c)}>
                {c.displayName}
              </button>
            ))}
          </div>
          <div className="card">
            {loadErr ? <p className="err">{loadErr}</p> : null}
            {balances === null ? (
              <p>読み込み中…</p>
            ) : (
              balances.map((b) => {
                const p = priceOf(prices, b.address);
                const jpy =
                  p.usd !== null && p.reliable && usdJpy
                    ? `¥${Math.round(Number(b.formatted) * p.usd * usdJpy).toLocaleString("ja-JP")}`
                    : "—";
                return (
                  <div className="tok" key={`${b.chainKey}-${b.address ?? "native"}`}>
                    <div className="tic" style={{ background: tokenColor(b.symbol) }}>
                      {b.symbol.slice(0, 4)}
                    </div>
                    <div className="nm">{b.symbol}</div>
                    <div className="rt">
                      <div className="a">{prettyAmount(b.formatted)}</div>
                      <div className="j">{jpy}</div>
                    </div>
                  </div>
                );
              })
            )}
            <button className="btn ghost" onClick={() => setRefreshTick((n) => n + 1)}>更新する</button>
          </div>
        </>
      )}
      {tab === "send" && address && (
        <SendScreen chain={chain} balances={balances ?? []} onBack={() => setTab("home")} />
      )}
      {tab === "receive" && address && (
        <ReceiveScreen address={address} onBack={() => setTab("home")} />
      )}
      {tab === "fluke" && address && (
        <FlukeScreen address={address} onBack={() => setTab("home")} />
      )}
      <div className="foot">
        <span className="mini">{chain.displayName}</span>
        <button
          className="link"
          onClick={() => {
            lock();
            setAddress(null);
            setStage({ kind: "unlock" });
          }}
        >
          ロックする
        </button>
      </div>
    </div>
  );
}

function CreateFlow({ onDone, onBack }: { onDone: (a: string) => void; onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setErr(null);
    if (password.length < 8) return setErr("パスワードは8文字以上にしてください。");
    if (password !== password2) return setErr("パスワードが一致しません。");
    setBusy(true);
    try {
      const { mnemonic: m } = await setupNewWallet(password);
      setMnemonic(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (mnemonic) {
    return (
      <div className="app">
        <div className="head"><h1 className="logo">復旧フレーズ</h1></div>
        <div className="warn">
          この12の言葉が、ウォレットを取り戻す唯一の鍵です。紙に書いて、誰にも見せない場所に保管してください。スクリーンショットやクラウド保存は危険です。
        </div>
        <div className="card">
          <div className="mnemonic">{mnemonic}</div>
          <button className="btn" onClick={() => onDone(currentAddress()!)}>書き留めました</button>
        </div>
      </div>
    );
  }
  return (
    <div className="app">
      <div className="head"><h1 className="logo">新しく作る</h1></div>
      <div className="card">
        <h2>パスワードを決めてください</h2>
        <p>この拡張機能を開くときのパスワードです。復旧フレーズとは別物です。</p>
        <input type="password" placeholder="パスワード（8文字以上）" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input type="password" placeholder="もう一度入力" value={password2} onChange={(e) => setPassword2(e.target.value)} />
        {err ? <p className="err">{err}</p> : null}
        <button className="btn" disabled={busy} onClick={create}>ウォレットを作る</button>
        <button className="btn ghost" onClick={onBack}>もどる</button>
      </div>
    </div>
  );
}

function ImportFlow({ onDone, onBack }: { onDone: (a: string) => void; onBack: () => void }) {
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setErr(null);
    if (!isValidMnemonic(phrase)) return setErr("復旧フレーズの形式が正しくありません（12語）。");
    if (password.length < 8) return setErr("パスワードは8文字以上にしてください。");
    if (password !== password2) return setErr("パスワードが一致しません。");
    setBusy(true);
    try {
      const { address } = await setupImportedWallet(phrase, password);
      onDone(address);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="head"><h1 className="logo">取り込む</h1></div>
      <div className="card">
        <h2>復旧フレーズで取り込む</h2>
        <p>スマホアプリ版と同じフレーズを入れると、同じウォレットが開きます。フレーズはこのブラウザの中だけで使われ、暗号化して保存されます。</p>
        <textarea rows={3} placeholder="12の言葉をスペース区切りで" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
        <input type="password" placeholder="パスワード（8文字以上）" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input type="password" placeholder="もう一度入力" value={password2} onChange={(e) => setPassword2(e.target.value)} />
        {err ? <p className="err">{err}</p> : null}
        <button className="btn" disabled={busy} onClick={run}>取り込む</button>
        <button className="btn ghost" onClick={onBack}>もどる</button>
      </div>
    </div>
  );
}

function UnlockFlow({ onDone }: { onDone: (a: string) => void }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { address } = await unlock(password);
      onDone(address);
    } catch {
      setErr("パスワードが違うか、金庫を開けませんでした。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="head"><h1 className="logo">GuppyWallet</h1><span className="panic">DON'T PANIC</span></div>
      <div className="card">
        <h2>ロック解除</h2>
        <p>パスワードを入力してください。</p>
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void run(); }}
        />
        {err ? <p className="err">{err}</p> : null}
        <button className="btn" disabled={busy} onClick={run}>開く</button>
        <button
          className="btn danger"
          onClick={async () => {
            if (confirm("金庫を消しますか？復旧フレーズがあれば作り直せます。フレーズを失っている場合は二度と開けません。")) {
              await deleteVault();
              location.reload();
            }
          }}
        >
          金庫を消して最初から
        </button>
      </div>
    </div>
  );
}

import { Contract, isAddress, parseUnits } from "ethers";
import { useMemo, useState } from "react";
import type { ChainConfig } from "../../src/config/chains";
import {
  ERC20_WRITE_ABI,
  nativeGasReserve,
  percentOfBalance,
  prettyAmount,
  type TokenBalance,
} from "../../src/lib/onchain";
import { signerFor } from "./vault";

type Phase =
  | { kind: "form" }
  | { kind: "confirm" }
  | { kind: "sending" }
  | { kind: "done"; hash: string }
  | { kind: "error"; message: string };

export default function SendScreen({
  chain,
  balances,
  onBack,
}: {
  chain: ChainConfig;
  balances: TokenBalance[];
  onBack: () => void;
}) {
  const usable = useMemo(
    () => balances.filter((b) => b.chainKey === chain.key),
    [balances, chain],
  );
  const [tokenKey, setTokenKey] = useState<string>("native");
  const token =
    usable.find((b) => (b.address ?? "native") === tokenKey) ?? usable[0];
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [formErr, setFormErr] = useState<string | null>(null);

  const setPct = async (pct: number) => {
    if (!token) return;
    let reserve = 0n;
    if (token.address === null && pct >= 100) {
      reserve = await nativeGasReserve(chain, 21000n);
    }
    setAmount(percentOfBalance(token.raw, pct, token.decimals, reserve));
  };

  const validate = (): boolean => {
    setFormErr(null);
    if (!token) return setFormErr("残高を読み込めていません。ホームで更新してください。"), false;
    if (!isAddress(to)) return setFormErr("送り先アドレスの形式が正しくありません。"), false;
    let raw: bigint;
    try {
      raw = parseUnits(amount || "0", token.decimals);
    } catch {
      return setFormErr("金額の形式が正しくありません。"), false;
    }
    if (raw <= 0n) return setFormErr("金額を入力してください。"), false;
    if (raw > token.raw) return setFormErr("残高が足りません。"), false;
    return true;
  };

  const send = async () => {
    if (!token) return;
    const signer = signerFor(chain);
    if (!signer) {
      setPhase({ kind: "error", message: "ロックされています。開き直してください。" });
      return;
    }
    setPhase({ kind: "sending" });
    try {
      const raw = parseUnits(amount, token.decimals);
      let hash: string;
      if (token.address === null) {
        const res = await signer.sendTransaction({ to, value: raw });
        await res.wait(1);
        hash = res.hash;
      } else {
        const c = new Contract(token.address, ERC20_WRITE_ABI, signer) as any;
        const res = await c.transfer(to, raw);
        await res.wait(1);
        hash = res.hash;
      }
      setPhase({ kind: "done", hash });
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <>
      <div className="card">
        <h2>送る（{chain.displayName}）</h2>
        {phase.kind === "done" ? (
          <>
            <p className="ok">送りました。</p>
            <div className="row">
              <span className="k">取引</span>
              <a
                className="v"
                style={{ color: "#2B7FFF", fontSize: 12 }}
                href={`${chain.explorerUrl}/tx/${phase.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                エクスプローラーで見る
              </a>
            </div>
            <button className="btn" onClick={onBack}>ホームへ</button>
          </>
        ) : phase.kind === "confirm" || phase.kind === "sending" || phase.kind === "error" ? (
          <>
            <div className="row"><span className="k">通貨</span><span className="v">{token?.symbol}</span></div>
            <div className="row"><span className="k">金額</span><span className="v">{amount} {token?.symbol}</span></div>
            <div className="row"><span className="k">送り先</span><span className="v" style={{ fontSize: 11, wordBreak: "break-all", textAlign: "right" }}>{to}</span></div>
            <div className="row"><span className="k">チェーン</span><span className="v">{chain.displayName}</span></div>
            {phase.kind === "error" ? <p className="err">{phase.message}</p> : null}
            {phase.kind === "sending" ? <p>送信中…（チェーンの確認を待っています）</p> : null}
            <button className="btn" disabled={phase.kind === "sending"} onClick={send}>
              この内容で送る
            </button>
            <button className="btn ghost" disabled={phase.kind === "sending"} onClick={() => setPhase({ kind: "form" })}>
              もどる
            </button>
          </>
        ) : (
          <>
            <select value={tokenKey} onChange={(e) => setTokenKey(e.target.value)}>
              {usable.map((b) => (
                <option key={b.address ?? "native"} value={b.address ?? "native"}>
                  {b.symbol}（残高 {prettyAmount(b.formatted)}）
                </option>
              ))}
            </select>
            <input placeholder="送り先アドレス（0x…）" value={to} onChange={(e) => setTo(e.target.value)} />
            <input placeholder={`金額（${token?.symbol ?? ""}）`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <div className="chips">
              {[25, 50, 75, 100].map((p) => (
                <button key={p} onClick={() => void setPct(p)}>{p === 100 ? "MAX" : `${p}%`}</button>
              ))}
            </div>
            {formErr ? <p className="err">{formErr}</p> : null}
            <button
              className="btn"
              onClick={() => {
                if (validate()) setPhase({ kind: "confirm" });
              }}
            >
              確認する
            </button>
            <button className="btn ghost" onClick={onBack}>もどる</button>
          </>
        )}
      </div>
    </>
  );
}

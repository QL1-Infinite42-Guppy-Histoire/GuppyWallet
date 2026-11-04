import { Contract, Interface } from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";
import { INFINITE } from "../../src/config/chains";
import { getProvider, prettyAmount } from "../../src/lib/onchain";
import { planExactApproval, sendAndWait } from "../../src/lib/tx";
import {
  FLUKE_CORE_ABI,
  FLUKE_CORE_ADDRESS,
  ZAP_ADDRESS,
  fetchFlukeRecord,
  fetchFlukeState,
  fetchGuideArt,
  fetchGuideItem,
  fetchMintedGuideId,
  fetchSettleSignature,
  type FlukeRecord,
  type FlukeState,
  type GuideArt,
  type GuideItemState,
} from "../../src/lib/zaphod";
import { signerFor } from "./vault";

const COMMIT_EVENT = new Interface([
  "event Commit(uint256 indexed id, address indexed who, uint64 rn)",
]);

type Pending = "commit" | "reveal" | "settle" | null;

function svgToImgUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

export default function FlukeScreen({
  address,
  onBack,
}: {
  address: string;
  onBack: () => void;
}) {
  const [fluke, setFluke] = useState<FlukeState | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [recordIdText, setRecordIdText] = useState("");
  const [record, setRecord] = useState<FlukeRecord | null>(null);
  const [recordErr, setRecordErr] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [sigState, setSigState] = useState<"idle" | "fetching" | "found" | "missing">("idle");
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ item: GuideItemState; art: GuideArt | null } | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      setFluke(await fetchFlukeState(address));
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e));
    }
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  const lookupRecord = useCallback(
    async (idText: string) => {
      setRecordErr(null);
      setRecord(null);
      setSignature(null);
      setSigState("idle");
      let id: bigint;
      try {
        id = BigInt(idText.trim());
        if (id < 0n) throw new Error("negative");
      } catch {
        setRecordErr("参加番号は数字で入力してください。");
        return;
      }
      try {
        setRecord(await fetchFlukeRecord(id, address));
      } catch (e) {
        setRecordErr(e instanceof Error ? e.message : String(e));
      }
    },
    [address],
  );

  const signer = () => signerFor(INFINITE);

  const doCommit = async () => {
    const s = signer();
    if (!s || !fluke) return;
    setBusy("commit");
    setActionErr(null);
    try {
      const approval = await planExactApproval(s, ZAP_ADDRESS, FLUKE_CORE_ADDRESS, fluke.priceRaw);
      if (approval.needed) await approval.send();
      const core = new Contract(FLUKE_CORE_ADDRESS, FLUKE_CORE_ABI, s) as any;
      const data: string = core.interface.encodeFunctionData("commit", [fluke.priceRaw]);
      const hash = await sendAndWait(s, { to: FLUKE_CORE_ADDRESS, data });
      // The Commit event's indexed id is the new record number.
      const receipt = await getProvider(INFINITE).getTransactionReceipt(hash);
      let newId: string | null = null;
      if (receipt) {
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== FLUKE_CORE_ADDRESS.toLowerCase()) continue;
          try {
            const parsed = COMMIT_EVENT.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed?.name === "Commit") {
              newId = (parsed.args.id as bigint).toString();
              break;
            }
          } catch {
            // not the Commit log
          }
        }
      }
      setNotice(
        newId
          ? `参加しました。あなたの参加番号は ${newId} です。`
          : "参加しました。参加番号は取引履歴から確認できます。",
      );
      if (newId) {
        setRecordIdText(newId);
        await lookupRecord(newId);
      }
      await load();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  const doReveal = async () => {
    const s = signer();
    if (!s || !fluke || !record) return;
    setBusy("reveal");
    setActionErr(null);
    try {
      const core = new Contract(FLUKE_CORE_ADDRESS, FLUKE_CORE_ABI, s) as any;
      const data: string = core.interface.encodeFunctionData("reveal", [
        BigInt(record.item),
        fluke.revealPriceRaw,
      ]);
      await sendAndWait(s, { to: FLUKE_CORE_ADDRESS, data });
      setNotice("めくりました。少し待つと合言葉が公開されます。");
      await load();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  const doSettle = async () => {
    const s = signer();
    if (!s || !record || !signature) return;
    setBusy("settle");
    setActionErr(null);
    try {
      const core = new Contract(FLUKE_CORE_ADDRESS, FLUKE_CORE_ABI, s) as any;
      const data: string = core.interface.encodeFunctionData("settle", [
        BigInt(record.id),
        signature,
      ]);
      const hash = await sendAndWait(s, { to: FLUKE_CORE_ADDRESS, data });
      setRecord((prev) => (prev ? { ...prev, settled: true } : prev));
      // Oripa time: find the Guide this settle just minted.
      try {
        const mintedId = await fetchMintedGuideId(hash, address);
        if (mintedId) {
          const id = BigInt(mintedId);
          const [item, art] = await Promise.all([
            fetchGuideItem(id, address),
            fetchGuideArt(id),
          ]);
          setReveal({ item, art });
        } else {
          setNotice("確定しました。新しいGuideが発行されています。");
        }
      } catch {
        setNotice("確定しました。新しいGuideが発行されています。");
      }
      await load();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  const fetchSig = async () => {
    if (!record) return;
    setSigState("fetching");
    const sig = await fetchSettleSignature(record.rn);
    if (sig) {
      setSignature(sig);
      setSigState("found");
    } else {
      setSigState("missing");
    }
  };

  return (
    <>
      <div className="card">
        <h2>Fluke（Guideの新規発行）</h2>
        <p>参加して、めくって、確定すると、新しいGuideが発行されてあなたのものになります。確定には「合言葉」（公開の乱数ネットワークが自動で出す署名）が必要です。</p>
        {loadErr ? <p className="err">{loadErr}</p> : null}
        {fluke ? (
          <>
            <div className="row"><span className="k">状態</span><span className="v">{fluke.paused ? "停止中" : "開催中"}</span></div>
            <div className="row"><span className="k">参加費</span><span className="v">{prettyAmount(fluke.priceFormatted)} ZAP</span></div>
            <div className="row"><span className="k">めくる費用</span><span className="v">{prettyAmount(fluke.revealPriceFormatted)} [42]</span></div>
            <div className="row"><span className="k">あなたのZAP</span><span className="v">{fluke.zapBalanceFormatted !== null && fluke.zapBalanceFormatted !== undefined ? prettyAmount(fluke.zapBalanceFormatted) : "—"}</span></div>
            <div className="row"><span className="k">あなたのGuide</span><span className="v">{fluke.guideBalance ?? "—"} 個</span></div>
          </>
        ) : (
          <p>読み込み中…</p>
        )}
        {notice ? <p className="ok" style={{ color: "#0E7A4E" }}>{notice}</p> : null}
        {actionErr ? <p className="err">{actionErr}</p> : null}
        {pending === "commit" ? (
          <>
            <p>参加費 {fluke ? prettyAmount(fluke.priceFormatted) : "—"} ZAP を払って参加します。よろしいですか？</p>
            <button className="btn" disabled={busy !== null} onClick={doCommit}>参加する（実行）</button>
            <button className="btn ghost" disabled={busy !== null} onClick={() => setPending(null)}>やめる</button>
          </>
        ) : (
          <button className="btn" disabled={!fluke || !!fluke?.paused} onClick={() => setPending("commit")}>
            参加する（{fluke ? prettyAmount(fluke.priceFormatted) : "—"} ZAP）
          </button>
        )}
      </div>

      <div className="card">
        <h2>確定して受け取る</h2>
        <p>参加番号（レコードID）を入れると、めくる／確定の操作ができます。</p>
        <input placeholder="参加番号（レコードID）" value={recordIdText} onChange={(e) => setRecordIdText(e.target.value)} inputMode="numeric" />
        <button className="btn ghost" onClick={() => void lookupRecord(recordIdText)}>レコードを確認</button>
        {recordErr ? <p className="err">{recordErr}</p> : null}
        {record ? (
          record.exists ? (
            <>
              <div className="row"><span className="k">対象のGuide</span><span className="v">#{record.item}</span></div>
              <div className="row"><span className="k">状態</span><span className="v">{record.settled ? "確定済み" : "未確定"}</span></div>
              {!record.settled && record.mine ? (
                <>
                  {pending === "reveal" ? (
                    <>
                      <p>Guide #{record.item} をめくります（{fluke ? prettyAmount(fluke.revealPriceFormatted) : "—"} [42]）。よろしいですか？</p>
                      <button className="btn" disabled={busy !== null} onClick={doReveal}>めくる（実行）</button>
                      <button className="btn ghost" disabled={busy !== null} onClick={() => setPending(null)}>やめる</button>
                    </>
                  ) : (
                    <button className="btn ghost" disabled={busy !== null} onClick={() => setPending("reveal")}>めくる</button>
                  )}
                  <button className="btn ghost" onClick={fetchSig} disabled={sigState === "fetching"}>
                    {sigState === "fetching" ? "合言葉を確認中…" : "合言葉を受け取る"}
                  </button>
                  {sigState === "missing" ? (
                    <p className="err">まだ合言葉が公開されていません。参加・めくってから少し時間が経つと公開されます。少し待ってもう一度試してください。</p>
                  ) : null}
                  {sigState === "found" && signature ? (
                    pending === "settle" ? (
                      <>
                        <p>確定すると、新しいGuideが発行されてあなたのものになります。よろしいですか？</p>
                        <button className="btn gold" disabled={busy !== null} onClick={doSettle}>確定して受け取る（実行）</button>
                        <button className="btn ghost" disabled={busy !== null} onClick={() => setPending(null)}>やめる</button>
                      </>
                    ) : (
                      <button className="btn gold" onClick={() => setPending("settle")}>確定して受け取る</button>
                    )
                  ) : null}
                </>
              ) : !record.settled ? (
                <p>このレコードはあなたのウォレットのものではありません。</p>
              ) : null}
            </>
          ) : (
            <p>その番号のレコードは見つかりませんでした。</p>
          )
        ) : null}
        <button className="btn ghost" onClick={onBack}>もどる</button>
      </div>

      {reveal ? (
        <OripaOverlay
          item={reveal.item}
          art={reveal.art}
          onClose={() => setReveal(null)}
        />
      ) : null}
    </>
  );
}

const RAINBOW = ["#FFD700", "#FF5CA8", "#30DFFF", "#9B35FF", "#F5C542"];

function OripaOverlay({
  item,
  art,
  onClose,
}: {
  item: GuideItemState;
  art: GuideArt | null;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"sealed" | "burst" | "revealed">("sealed");
  const tier = item.tier ?? 0;
  const glowClass = tier >= 3 ? "glow3" : tier === 2 ? "glow2" : tier === 1 ? "glow1" : "glow0";
  const glowColor = tier >= 3 ? "#FFD700" : tier === 2 ? "#F5C542" : tier === 1 ? "#9FD8FF" : "#FFFFFF";

  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2 + (i % 3) * 0.21;
        const dist = 110 + ((i * 47) % 130);
        return {
          dx: `${Math.cos(angle) * dist}px`,
          dy: `${Math.sin(angle) * dist}px`,
          size: 5 + ((i * 29) % 8),
          color: tier >= 3 ? RAINBOW[i % RAINBOW.length] : i % 3 === 0 ? glowColor : "#FFFFFF",
          delay: `${(i % 5) * 0.03}s`,
        };
      }),
    [tier, glowColor],
  );

  const open = () => {
    if (phase !== "sealed") return;
    setPhase("burst");
    try {
      navigator.vibrate?.([70, 40, 120]);
    } catch {
      // vibration is decorative only
    }
    setTimeout(() => setPhase("revealed"), 850);
  };

  const artUrl = art?.svg ? svgToImgUrl(art.svg) : art?.imageUrl ?? null;

  return (
    <div className="oripa">
      {phase === "sealed" ? (
        <>
          <div className="pack" onClick={open}>
            <div className="seal">✦</div>
            <div className="qm">?</div>
            <div className="pt">GUIDE PACK</div>
            <div className="ps">あなたの新しいGuideが入っています</div>
          </div>
          <div className="tapHint">タップして開封</div>
        </>
      ) : (
        <>
          {phase === "burst" ? <div className="flash" /> : null}
          {particles.map((p, i) => (
            <span
              key={i}
              className="particle"
              style={
                {
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  animationDelay: p.delay,
                  "--dx": p.dx,
                  "--dy": p.dy,
                } as React.CSSProperties
              }
            />
          ))}
          {phase === "revealed" ? (
            <>
              <div className={`gcard ${glowClass}`}>
                <div className="inner">
                  <div className="got">新しいGuideを手に入れました！</div>
                  {artUrl ? (
                    <img className="art" src={artUrl} alt={art?.name ?? `Guide #${item.id}`} />
                  ) : null}
                  <div className="gname">{art?.name ?? `Guide #${item.id}`}</div>
                  <div className="stats">
                    <div className="stat"><div className="l">ティア</div><div className="n">{item.tier !== null ? item.tier : "—"}</div></div>
                    <div className="stat"><div className="l">スコア</div><div className="n">{item.scoreFormatted ? prettyAmount(item.scoreFormatted) : "—"}</div></div>
                    <div className="stat"><div className="l">エンブレム</div><div className="n">{item.currentEmblem ?? "—"}</div></div>
                  </div>
                </div>
              </div>
              <button className="btn" style={{ width: 220 }} onClick={onClose}>閉じる</button>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

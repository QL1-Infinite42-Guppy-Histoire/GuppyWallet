import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function ReceiveScreen({
  address,
  onBack,
}: {
  address: string;
  onBack: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(address, { width: 360, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [address]);

  return (
    <div className="card">
      <h2>受け取る</h2>
      <p>このアドレスは 42 Chain / QL1 共通です（同じウォレット）。他のチェーンから直接送ると届かないことがあるので、送り元が対応しているか確認してください。</p>
      {qr ? <img className="qr" src={qr} alt="QR" /> : null}
      <p className="addr">{address}</p>
      <button
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
          } catch {
            // clipboard unavailable — the address stays visible to copy manually
          }
        }}
      >
        {copied ? "コピーしました" : "アドレスをコピー"}
      </button>
      <button className="btn ghost" onClick={onBack}>もどる</button>
    </div>
  );
}

# ABI 調査メモ（2026-10-30）

## Zaphod Swap（app.zaphod.one）
- 結論: ルーター／アグリゲーター本体のコントラクトアドレスと公開ABIは、Swap UI、zaphod.one のリンク先、エクスプローラーのいずれでも確認できなかった。Docs／GitHub へのリンクもサイト内に無し。
- 画面文言はアグリゲーター型: 「BEST PRICE ACROSS EVERY VENUE ON 42CHAIN」
- Swap UIのネットワーク選択: 42chain（既定）、Base、BNB、Ethereum、Arbitrum、Monad、Robinhood。チェーンID表示は無し（42chain = Infinite 421018 とは画面証拠だけでは断定しない）。
- 42chain側トークンリスト表示: ZAP と USDT のみ。
- → ルーターのアドレス＋ABIは MT から直接もらう必要がある（依頼済みチェックリスト項目）。

## 公開ABIが確認できたもの（ルーターではない）
- ZAP（Infinite）: 0x89195Ca5C954b6f99b78f4A2Aa5435A75Dc5B256
  Blockscoutで検証済み（Exact Match、Zap.sol、v0.8.23）。ABIタブあり。
- ZAP（QL1/QOM）: 0x6041B64618434B9D0a9558B5975C5c1DEb45CEE6
  エクスプローラーは scan.qom.network。検証は Partial Match で、バイトコード不一致の警告あり — 利用時は要注意。
- ZAP/42 プール（Infinite、Don't Panic DEX）: 0xB647ce2aa7d436CCE95dc961D066Ef610CA451B7
  未検証（Verify & publish 表示）。公開ABIなし。バイトコード内に Nutri-Matic V2 / UniswapV2 系の文字列があるが、ルーター特定の根拠にはならない。

## MTへの追加確認（推奨文・英語、そのまま貼れる版）
Hi MT, quick follow-up on the swap integration.

I'm wiring the Swap screen of the wallet to Zaphod Swap (app.zaphod.one). I checked the UI, zaphod.one, and the explorers first, but I couldn't find a published router/aggregator contract address or ABI for it.

Could you share:
1. the swap router/aggregator contract address + ABI for each chain, or
2. if it routes through another DEX under the hood, which router it calls (e.g. Don't Panic on Infinite)?

I only need the interface (address + ABI) to call it from the wallet — no source code or anything sensitive. If you'd rather verify the contract on the explorer so I can pull the ABI from there, that works perfectly too.

This is the last piece blocking the Swap screen on my side. Thanks!

### 短い版（チャットで軽く聞く用）
Hi MT, one quick thing — is there a public router address + ABI for Zaphod Swap? I couldn't find one published anywhere. I just need the interface to integrate it into the wallet. If it routes via another DEX's router, that address/ABI is fine too. Thanks!

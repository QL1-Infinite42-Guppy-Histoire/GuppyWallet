# Infinite Drivechain / QL1 専用ウォレット — Android版 設計書 v0.1
作成: 2026-10-30
決定事項: スマホアプリ / **Android先行**（iPhoneは後から同じコードで追加） / 基盤は開発者MTの既存開発を再利用し、UIは独自に作る

## 1. 作るもの
QL1とInfinite Drivechain専用のノンカストディアル・ウォレットアプリ。
既存のdAppをサイトごとに開く体験をやめ、1つのアプリ内に全機能を統合する。

搭載機能（ユーザー指定）:
| 機能 | 内容 | 統合方式（案） |
|---|---|---|
| ウォレット | 42・QOM・各種トークン管理、送金/受取 | ネイティブ |
| Dashboard | 資産総額・運用状況 | ネイティブ |
| Swap | トークン交換 | ネイティブ（MTのルーター/コントラクト呼出） |
| 流動性提供 | LP追加・解除・報酬確認 | ネイティブ |
| ステーキング | 42・QOMの委任・解除 | ネイティブ（Cosmos側処理が必須） |
| st42 | リキッドステーキング | ネイティブ |
| Bridge | QL1・Infinite間などの資産移動 | まずアプリ内dAppブラウザ → 後でネイティブ |
| NFT | GuideなどのNFT管理 | まずアプリ内dAppブラウザ → 後でネイティブ |
| QNS | .qomドメイン管理 | まずアプリ内dAppブラウザ → 後でネイティブ |

参照サービス: app.zaphod.one (Swap), fluke.zaphod.one (Guide), nft.zaphod.one,
bridge.zaphod.one, dontpanic.finance (Infinite DEX), fishdisk.com

## 2. 技術構成（Android先行）
- React Native + Expo (TypeScript) — 1コードベースで将来iPhoneも出せる
- EVM: ethers.js v6 （QL1: Chain ID 766 / Infinite: Chain ID 421018）
- Cosmos: CosmJS （ステーキング、委任、unbonding。両チェーンとも Cosmos SDK + EVM）
- 鍵: BIP-39 ニーモニック → BIP-44 HD派生。`0x...` と bech32 `qom1... / infinite1...` の両方を導出
- 鍵保管: Android Keystore 連携の SecureStore。平文・通常ストレージ・サーバーには絶対に置かない
- 認証: 生体認証（指紋）+ PIN。署名時のみ鍵をメモリに展開
- dApp連携: WalletConnect v2 + アプリ内dAppブラウザ（プロバイダー注入）
- ビルド/配布（テスト期）: EAS Build で APK を作り直接配布 = Google Play費用ゼロで開始
- 公開期: Google Play $25（一回のみ）。個人の新規アカウントは公開前に12人・14日間のクローズドテストが必要

## 3. チェーン設定（確認済み / 要MT確認を明記）
### Infinite Drive (Infinite Improbability Drive)
- EVM Chain ID: 421018 / Cosmos Chain ID: infinite_421018-1
- ネイティブ通貨: 42（18 decimals想定、要確認）
- EVM RPC（コミュニティ）: https://evm-rpc.infinitepanda.xyz
- Comet RPC: https://comet-rpc.infinitedrive.xyz / gRPC: grpc.infinitedrive.xyz
- Explorer: scan.infinitedrive.xyz / bech32 prefix: infinite

### QL1 (QOM Layer One)
- EVM Chain ID: 766
- ネイティブ通貨: QOM
- EVM RPC（コミュニティ AYC）: https://evm-rpc-ql1.mschihuahua.org
- Explorer: scan.qom.one / bech32 prefix: qom
- Cosmos Chain ID、公式RPC、decimals は **MTに要確認**（推測で埋めない）

## 4. 開発フェーズ
- Phase 0: 土台 — ウォレット作成/復元、鍵保管、生体認証、残高表示（42/QOM）、送金/受取
- Phase 1: Dashboard（資産総額、ステーキング状況）、トークン一覧、履歴
- Phase 2: Swap、LP、ステーキング/委任解除、st42
- Phase 3: Bridge、NFT、QNS をネイティブ化
- Phase 4: Google Play公開準備、iPhone版（同じコード）

## 5. MTさんから受け取るものチェックリスト ★これが揃うと開発が一気に進む
- [ ] 全コントラクトアドレス一覧（Swapルーター、LP/ファクトリー、ステーキング、st42、Bridge、NFT、QNS）チェーン別
- [ ] 各コントラクトの ABI（またはソース/リポジトリ）
- [ ] MTが使っている公式RPC / REST / gRPC エンドポイント（QL1・Infinite両方）
- [ ] QL1の Cosmos Chain ID、通貨の最小単位と decimals（aqom等）
- [ ] ステーキングの実装方式（Cosmos tx か、EVMプリコンパイル 0x0800番台か）
- [ ] Bridgeの仕組み（ロック/ミントか、流動性方式か）と手数料、所要時間
- [ ] テスト用アカウント/テストトークン、テストネットの有無
- [ ] dontpanic.finance / zaphod系のAPI仕様（価格取得、quote取得）があればその資料
- [ ] ロゴ・トークンアイコン等の素材（なければこちらで作成）

## 6. セキュリティ方針（譲らない線）
- ノンカストディアル: 運営側サーバーが鍵に触れる設計はしない
- ニーモニック表示は作成時と確認時のみ。スクリーンショット警告を出す
- 署名前に送金先・金額・コントラクト・手数料を必ず人間が読める形で確認画面に出す
- 公開前に第三者監査 or 最低でも別開発者レビューを通す（実資金が動くため）

# Infinite / QL1 専用ウォレット（試作版 / Prototype）

QL1（QOM）と Infinite Drivechain（42）専用のウォレットアプリの土台です。
Android 先行で、React Native + Expo + TypeScript で作っています（iPhone版は後から同じコードで追加予定）。
設計の全体像は [BLUEPRINT.md](./BLUEPRINT.md) を見てください。

> ⚠️ **未監査の試作版です。本物の資金・本物のニーモニックは絶対に使わないでください。**
> 現在のアプリに署名・送金機能はありません。できるのは公開アドレスの残高照会だけです。

## 動かし方

```bash
npm install
npx expo start        # または: npm start
```

- 実機（Android）で試す場合：開発ビルドか Expo Go を使い、表示される QR コードを読み取ります。
  ただし `expo-secure-store` / `expo-local-authentication` はネイティブモジュールのため、
  正式な確認は後述の開発ビルド（EAS）で行ってください。
- 型チェック：`npm run typecheck`（`tsc --noEmit`）

## Android の APK テストビルド（EAS Build）

Google Play に出さず仲間内だけに配る段階の手順です（この段階ではストア費用ゼロ）。

```bash
npm install -g eas-cli
eas login
eas build:configure        # eas.json を生成（初回のみ）
eas build -p android --profile preview   # APK がクラウドでビルドされる
```

完成した APK のリンクを EAS のダッシュボードから共有できます。
`app.json` の Android package id は `one.zaphod.wallet.prototype` という
**プレースホルダー** です。公開前に正式な ID を決めて差し替えてください。

## フォルダ構成

```
App.tsx                       タブナビゲーション（入口）
index.ts                      Expo のエントリ（生成のまま）
app.json                      Expo 設定（Android package id はプレースホルダー）
BLUEPRINT.md                  設計書 v0.1
src/
  config/chains.ts            チェーン定義（検証済みの値のみ。TODO_MT は未確認項目）
  lib/balances.ts             ethers v6 で RPC から残高を読む（読み取り専用）
  lib/walletStore.ts          鍵保管のスタブ（SecureStore＋生体認証、作成機能は無効化中）
  context/WatchAddressContext.tsx  ウォッチ用アドレスと残高の共有状態
  components/                 共通 UI（試作警告バナー、残高カード等）
  screens/                    Dashboard / Wallet / Swap / Staking / More
```

## 実装済み（実データで動く）と、スタブ・未実装の線引き

実装済み：
- タブ画面構成（Dashboard／ウォレット／Swap／ステーキング／その他）
- ウォッチアドレス入力 → Infinite（42）と QL1（QOM）のネイティブ残高を
  `src/config/chains.ts` の RPC から実際に取得して表示。失敗時はチェーン名・RPC・
  エラー内容を表示
- 「その他」タブから Bridge／NFT／Fluke／DontPanic 等へのリンク（chains.ts の URL のみ使用）

スタブ／未実装（正直に未実装と画面に表示しています）：
- ウォレット作成／インポート：`WALLET_CREATION_ENABLED = false` で無効化。
  SecureStore と生体認証の土台だけ用意。監査前は有効化しない
- 署名・送金：**意図的に実装していません**
- Swap／LP／ステーキング／st42：計画フローと TODO_MT を表示する試作画面のみ。
  架空のコントラクト呼出やダミー数値は入れていません
- Dashboard の資産総額（価格換算）とステーキング状況：価格・ステーキング情報源が未受領のため未表示
- アプリ内ブラウザ（プロバイダー注入）：未実装。現状は外部ブラウザで開きます

## Phase 2 を塞いでいる MT 受領待ち項目（抜粋、全量は BLUEPRINT.md §5）

- コントラクトアドレス一覧と ABI（Swap ルーター、LP、ステーキング、st42、Bridge、NFT、QNS／チェーン別）
- MT が使う公式 RPC / REST / gRPC エンドポイント
- QL1 の Cosmos Chain ID、最小単位（aqom 等）と decimals
- ステーキング方式（Cosmos tx か EVM プリコンパイルか）
- 価格／quote の取得方法（オンチェーンか MT 側 API か）

これらが揃い次第、Swap とステーキングから順に実接続していきます。

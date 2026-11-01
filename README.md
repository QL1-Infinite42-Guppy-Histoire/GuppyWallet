# GuppyWallet — 42 Chain（Infinite）/ QL1 専用ウォレット

![build](https://github.com/nepicobsv-hash/GuppyWallet/actions/workflows/build-apk.yml/badge.svg)

42 Chain（旧 Infinite Drivechain）と QL1 の専用ウォレットアプリです。
Android 先行で、React Native + Expo + TypeScript で作っています（iPhone版は後から同じコードで追加予定）。
設計の全体像は [BLUEPRINT.md](./BLUEPRINT.md) を見てください。

> ⚠️ **未監査の開発版です。** 署名・送金機能は実装済みですが、第三者監査は受けていません。
> 実資金で使う場合は自己責任で、必ず少額から試してください。

## 開発状況（2026-11-01 時点）

- **現在版： v0.1.0** — APK は [Releases](https://github.com/nepicobsv-hash/GuppyWallet/releases) からダウンロード可能
- **ビルド：** GitHub Actions が標準経路。master へ push するたびに APK がビルドされ、成果物（Artifacts）に上がります（署名は EAS 管理のものと同一＝上書き更新可能）
- **状態：** 主要機能は実装済みでメインネット動作。最新ビルド（改名＋グッピーマスコット）は端末での最終確認待ち
- **残タスク：** MT 回答待ち4件（下記セクション）と、既知の制約の解消

## できること（実装済み・メインネットで動作）

- ウォレット作成／インポート（BIP-39 24語、鍵は端末の SecureStore 内のみ、生体認証ロック）
- 残高表示：42 Chain / QL1 の切替表示、円・ドル換算の合計、取引履歴
- 送金／受取（QRコード表示・読み取り対応）
- Swap / LP：42 Chain は Don't Panic（Nutri-Matic V2）、QL1 は QomSwap で実際に交換・流動性提供が可能
- ステーキング：42 Chain のプリコンパイル経由で委任・解除・報酬請求。st42（流動性ステーキング）も対応
- Bridge：42 Chain → QL1 / Ethereum / BSC、および BSC / Ethereum → 42 Chain（Hyperlane 方式）
- NFT / The Guide / Starlight（Guide登録と報酬請求）、Fluke（参加・めくる）
- QNS（.qom）は保有ドメインの表示のみ（新規登録はサービス側で終了）
- 日本語／英語の切替、銀河×ガラスの UI

## MT 受領待ち項目の現状（2026-11-01 更新）

当初リストアップしていた確認事項は、**ほとんどが MT の返信を待たずに解決しました**
（オンチェーン検証と公式サイトのフロントコード解析による）。全量は BLUEPRINT.md §5。

解決済み：コントラクトアドレス一覧と ABI、公式 RPC の要否、QL1 の Cosmos Chain ID・
最小単位（aqom）・decimals、ステーキング方式、価格／quote の取得方法（DEX のプール残高から算出）。

**実際にまだ MT の回答待ちなのは、次の4件だけです：**

- Fluke の精算（settle）に必要な署名の発行方法（公式 API が現在署名を配っていない）
- QL1 → 42 Chain ブリッジの実配送が稼働しているかの確認（公式統計で QL1 発の配送が 0 件のため、アプリ側は QL1 発の送信を止めています）
- QL1 での ZAP の交換ルート（QomSwap に直接ペアが無い）
- テストネット／テストトークンの有無

## 既知の制約（正直に）

- 価格は DEX プールの残高から算出する目安です。流動性の薄いトークンでは大きくずれることがあり、信頼できない価格のトークンは合計から除外しています
- Fluke の精算（settle）は公式の署名が得られた場合のみ実行できます（上記 MT 待ち項目）
- Android の package id は `one.zaphod.wallet.prototype`（プレースホルダー）です。ストア公開前に正式な ID を決めます

## 動かし方

```bash
npm install
npx expo start        # または: npm start
```

- 型チェック：`npm run typecheck`（`tsc --noEmit`）
- APK ビルド：**GitHub Actions**（`.github/workflows/build-apk.yml`）が標準です。
  master への push、または Actions 画面からの手動実行（workflow_dispatch）で、
  ランナー上で EAS のローカルビルド（preview プロファイル）を実行し、
  APK が artifact「guppy-wallet-apk」として保存されます。
  署名は EAS 管理のキーストアのまま（`EXPO_TOKEN` は GitHub Secrets で管理）。
- フォールバックとして、従来どおり EAS クラウドでのビルドも使えます：

```bash
eas build -p android --profile preview
```

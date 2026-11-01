# 入金プロキシ（ChangeNOW 連携用）

GuppyWallet の「他のチェーンから入金」機能のための、小さな中継サーバーです。
Cloudflare Workers（無料枠）で動きます。

やることは3つだけです：

1. ChangeNOW の API キーを、アプリの代わりに保持する（キーはアプリにもこのリポジトリにも入れません）
2. 使える組み合わせを XLM / SOL → BNB（BSC）だけに絞る
3. 注文の作成・見積もり・状態確認を ChangeNOW API へそのまま中継する

お金がここを通ることはありません。資金の流れは「利用者の XLM/SOL ウォレット → ChangeNOW → 利用者自身の BSC アドレス」で、このプロキシは注文と状態だけを扱います。データベースは無く、アドレスや注文内容の記録も残しません。

## デプロイ手順

前提：

- Cloudflare の無料アカウント
- ChangeNOW for Business の API キー（無料で発行できます）

手順：

```bash
cd proxy

# 1) Cloudflare にログイン（初回のみ、ブラウザが開きます）
npx wrangler login

# 2) API キーをシークレットとして登録（入力したキーはコードにも
#    リポジトリにも残りません）
npx wrangler secret put CHANGENOW_API_KEY

# 3) デプロイ
npx wrangler deploy
```

デプロイが終わると `https://guppy-deposit-proxy.<あなたのサブドメイン>.workers.dev` のような URL が表示されます。

## アプリ側の有効化

1. `src/config/deposit.ts` の `PROXY_BASE_URL` に、上記の URL を設定する
2. コミット → push（GitHub Actions で APK がビルドされます）
3. 新しい Release を出す

`PROXY_BASE_URL` が空の間、アプリ側の入金機能は「準備中」表示になり、注文は作れません。

## 止めたいとき（キルスイッチ）

`wrangler.toml` の `KILL_SWITCH` を `"1"` にして `npx wrangler deploy` するか、Cloudflare のダッシュボードで同じ変数を変更すると、全ルートが 503 を返すようになります（アプリの再リリースは不要です）。

## ルート一覧

| ルート | 内容 |
|---|---|
| `GET /` | 死活確認（キー情報は含みません） |
| `POST /create` | 注文作成。`{fromCurrency, fromNetwork, toCurrency, toNetwork, fromAmount, payoutAddress}` |
| `GET /status/:id` | 注文の状態確認 |
| `GET /estimate?from=xlm&to=bnbbsc&amount=30` | 見積もり |
| `GET /range?from=xlm` | 最低額・上限 |

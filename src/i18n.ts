/**
 * JA/EN dictionary for app chrome: tab labels, screen titles, primary
 * buttons, section headings and common labels. Long legalistic notes
 * (prototype warnings, contract explanations) stay JA-only by design —
 * they are content, not chrome.
 */

export type Lang = "ja" | "en";

const ja = {
  "tab.home": "ホーム",
  "tab.defi": "DeFi",
  "tab.explore": "Explore",
  "tab.nft": "NFT",
  "tab.settings": "設定",

  "common.loading": "読み込み中…",
  "common.refresh": "更新",
  "common.notAvailable": "未取得",
  "common.unavailable": "取得不可",
  "common.estimated": "推定",
  "common.viewAll": "すべて見る",
  "common.address": "アドレス",
  "common.balance": "残高",
  "common.close": "閉じる",
  "common.dontPanicSub": "慌てないで。タオルと、このガイドがあれば大丈夫。",
  "common.noWallet": "ウォレットがありません",
  "common.noWalletBody":
    "「設定」タブでウォレットを作成／インポートすると、ここに表示されます。",
  "common.fetchFailed": "取得に失敗しました",

  "home.catchphrase": "ひとつのウォレットに、無限の可能性を。",
  "home.totalBalance": "総資産（推定）",
  "home.send": "送金",
  "home.receive": "受取",
  "home.swap": "Swap",
  "home.tokens": "トークン",
  "home.history": "最近の取引",
  "home.historyEmpty": "取引履歴はまだありません。",
  "home.historyNote":
    "履歴は各チェーンのエクスプローラーAPIから取得しています。",
  "home.priceUnavailable": "価格未取得",
  "home.change24h": "24h変動",
  "home.stakingStatus": "運用状況（ステーキング）",
  "home.stakingStatusBody":
    "Infinite側はステーキングプリコンパイル（0x0800）が稼働中です。バリデータ一覧・委任・st42は「DeFi」タブのステーキングで確認できます。",
  "home.chains": "対応チェーン",
  "home.network": "ネットワーク",

  "tokens.title": "トークン一覧",
  "tokens.searchPlaceholder": "トークンを検索（名前・シンボル）",
  "tokens.all": "すべて",
  "tokens.addCustom": "カスタムトークンを追加",
  "tokens.addCustomNote":
    "コントラクトアドレスを貼ると、そのチェーンのRPCから名前・シンボル・小数桁を読み取って追加します。",
  "tokens.contractPlaceholder": "コントラクトアドレス 0x…",
  "tokens.add": "追加する",
  "tokens.remove": "このトークンを削除",
  "tokens.custom": "カスタム",
  "tokens.empty": "該当するトークンがありません。",
  "tokens.detail": "詳細",

  "send.title": "送金",

  "defi.swap": "Swap",
  "defi.lp": "LP",
  "defi.staking": "ステーキング",
  "defi.bridge": "Bridge",
  "defi.fluke": "Fluke",
  "defi.lpPairs": "主要ペアの存在確認（オンチェーン）",
  "defi.lpPairExists": "ペアあり",
  "defi.lpPairNone": "ペアなし",

  "explore.chainStatus": "チェーン状態",
  "explore.links": "エコシステム",
  "explore.block": "ブロック",
  "explore.explorer": "エクスプローラーで見る ↗",
  "explore.qnsEnded": "QNSの新規登録（ミント）は終了しています。",
  "explore.linkWarning":
    "外部サイトで秘密鍵やニーモニックの入力を求められたら、絶対に入力しないでください。",

  "nft.tabNft": "NFT",
  "nft.tabGuide": "Guide",
  "nft.tabQns": "QNS",
  "nft.collections": "コレクション（Infinite）",
  "nft.ownedCount": "あなたの保有数",
  "nft.totalSupply": "総供給",
  "nft.yourTokens": "保有トークン",
  "nft.none": "保有トークンは見つかりませんでした。",
  "nft.apiNote":
    "保有トークンの一覧はエクスプローラーAPIから取得しています。取得できない場合は保有数のみ表示します。",
  "guide.score": "スコア",
  "guide.tier": "ティア",
  "guide.emblem": "エンブレム",
  "guide.text": "刻まれたテキスト",
  "guide.starlight": "Starlight",
  "guide.registered": "登録済み",
  "guide.notRegistered": "未登録",
  "guide.earned": "獲得見込み",
  "guide.burned": "バーン済み",
  "guide.forms": "フォーム数",
  "qns.ownedTitle": "保有ドメイン（.qom）",
  "qns.ownedNone":
    "このアドレスが所有する .qom ドメインは見つかりませんでした。",
  "qns.lookupTitle": "ドメインを調べる",
  "qns.lookupNote":
    "名前（例: startup）から所有者と状態をオンチェーンで確認します。新規登録は終了しています。",
  "qns.lookupPlaceholder": "名前（.qom は不要）",
  "qns.lookup": "調べる",
  "qns.owner": "所有者",
  "qns.expires": "有効期限",
  "qns.permanent": "永久（期限なし）",
  "qns.available": "未登録の名前です（新規登録は終了しています）",
  "qns.yours": "あなたのドメインです",
  "qns.enumerateNote":
    "一覧はQL1エクスプローラーAPIから取得しています。",

  "settings.wallet": "ウォレット管理",
  "settings.language": "言語 / Language",
  "settings.customTokens": "カスタムトークン",
  "settings.noCustomTokens": "カスタムトークンはまだありません。",
  "settings.about": "このアプリについて",
  "settings.catchphrase": "One Wallet. Infinite Possibilities.",
  "settings.version": "バージョン",
  "settings.security": "セキュリティ",
  "settings.securityBody":
    "秘密鍵・リカバリーフレーズは端末の安全領域（SecureStore）にのみ保存され、外部に送信されることはありません。未監査のプロトタイプですので、利用は少額からにしてください。",
} as const;

export type I18nKey = keyof typeof ja;

const en: Record<I18nKey, string> = {
  "tab.home": "Home",
  "tab.defi": "DeFi",
  "tab.explore": "Explore",
  "tab.nft": "NFT",
  "tab.settings": "Settings",

  "common.loading": "Loading…",
  "common.refresh": "Refresh",
  "common.notAvailable": "N/A",
  "common.unavailable": "Unavailable",
  "common.estimated": "est.",
  "common.viewAll": "View all",
  "common.address": "Address",
  "common.balance": "Balance",
  "common.close": "Close",
  "common.dontPanicSub": "Don't panic. A towel and this guide are all you need.",
  "common.noWallet": "No wallet yet",
  "common.noWalletBody":
    "Create or import a wallet in the Settings tab and it will appear here.",
  "common.fetchFailed": "Failed to fetch",

  "home.catchphrase": "One Wallet. Infinite Possibilities.",
  "home.totalBalance": "Total Balance (estimated)",
  "home.send": "Send",
  "home.receive": "Receive",
  "home.swap": "Swap",
  "home.tokens": "Tokens",
  "home.history": "Recent Activity",
  "home.historyEmpty": "No transactions yet.",
  "home.historyNote": "History is loaded from each chain's explorer API.",
  "home.priceUnavailable": "Price N/A",
  "home.change24h": "24h",
  "home.stakingStatus": "Staking Status",
  "home.stakingStatusBody":
    "The Infinite staking precompile (0x0800) is live. Validators, delegation and st42 live under DeFi → Staking.",
  "home.chains": "Networks",
  "home.network": "Network",

  "tokens.title": "Tokens",
  "tokens.searchPlaceholder": "Search tokens (name or symbol)",
  "tokens.all": "All",
  "tokens.addCustom": "Add Custom Token",
  "tokens.addCustomNote":
    "Paste a contract address and the app reads its name, symbol and decimals from that chain's RPC.",
  "tokens.contractPlaceholder": "Contract address 0x…",
  "tokens.add": "Add",
  "tokens.remove": "Remove this token",
  "tokens.custom": "Custom",
  "tokens.empty": "No matching tokens.",
  "tokens.detail": "Details",

  "send.title": "Send",

  "defi.swap": "Swap",
  "defi.lp": "LP",
  "defi.staking": "Staking",
  "defi.bridge": "Bridge",
  "defi.fluke": "Fluke",
  "defi.lpPairs": "Major pair check (on-chain)",
  "defi.lpPairExists": "Pair exists",
  "defi.lpPairNone": "No pair",

  "explore.chainStatus": "Chain Status",
  "explore.links": "Ecosystem",
  "explore.block": "Block",
  "explore.explorer": "View in explorer ↗",
  "explore.qnsEnded": "New QNS registrations (minting) have ended.",
  "explore.linkWarning":
    "Never enter your private key or recovery phrase on an external site.",

  "nft.tabNft": "NFT",
  "nft.tabGuide": "Guide",
  "nft.tabQns": "QNS",
  "nft.collections": "Collections (Infinite)",
  "nft.ownedCount": "You own",
  "nft.totalSupply": "Total supply",
  "nft.yourTokens": "Your tokens",
  "nft.none": "No tokens found.",
  "nft.apiNote":
    "Token lists come from the explorer API; if unavailable, only counts are shown.",
  "guide.score": "Score",
  "guide.tier": "Tier",
  "guide.emblem": "Emblem",
  "guide.text": "Inscribed text",
  "guide.starlight": "Starlight",
  "guide.registered": "Registered",
  "guide.notRegistered": "Not registered",
  "guide.earned": "Earned (est.)",
  "guide.burned": "Burned",
  "guide.forms": "Forms",
  "qns.ownedTitle": "Your domains (.qom)",
  "qns.ownedNone": "No .qom domains owned by this address were found.",
  "qns.lookupTitle": "Look up a domain",
  "qns.lookupNote":
    "Check a name's owner and status on-chain (e.g. “startup”). New registrations have ended.",
  "qns.lookupPlaceholder": "Name (without .qom)",
  "qns.lookup": "Look up",
  "qns.owner": "Owner",
  "qns.expires": "Expires",
  "qns.permanent": "Permanent (no expiry)",
  "qns.available": "Unregistered name (registration has ended)",
  "qns.yours": "This is your domain",
  "qns.enumerateNote": "The list is loaded from the QL1 explorer API.",

  "settings.wallet": "Wallet Management",
  "settings.language": "言語 / Language",
  "settings.customTokens": "Custom Tokens",
  "settings.noCustomTokens": "No custom tokens yet.",
  "settings.about": "About",
  "settings.catchphrase": "One Wallet. Infinite Possibilities.",
  "settings.version": "Version",
  "settings.security": "Security",
  "settings.securityBody":
    "Private keys and recovery phrases are stored only in the device's secure storage (SecureStore) and are never transmitted. This is an unaudited prototype — start with small amounts.",
};

export const DICT: Record<Lang, Record<I18nKey, string>> = { ja, en };

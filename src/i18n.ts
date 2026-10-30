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
  "home.account": "アカウント",
  "home.totalBalance": "総資産",
  "home.send": "送金",
  "home.receive": "受取",
  "home.swap": "Swap",
  "home.tokens": "トークン",
  "home.history": "最近の取引",
  "home.historyEmpty": "取引履歴はまだありません。",
  "home.historyNote": "履歴は自動で取得しています。",
  "home.priceUnavailable": "価格未取得",
  "home.change24h": "24h変動",
  "home.stakingStatus": "ステーキング",
  "home.stakingStatusBody":
    "42を預けて報酬をもらえます。預けたり引き出したりは「DeFi」タブのステーキングからできます。",
  "home.chains": "対応チェーン",
  "home.network": "ネットワーク",

  "tokens.title": "トークン一覧",
  "tokens.searchPlaceholder": "トークンを検索（名前・シンボル）",
  "tokens.all": "すべて",
  "tokens.addCustom": "カスタムトークンを追加",
  "tokens.addCustomNote":
    "トークンのアドレス（0x…）を貼ると、名前などを自動で読み取って追加します。",
  "tokens.contractPlaceholder": "トークンのアドレス 0x…",
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
  "defi.yourLiquidity": "あなたの流動性",
  "defi.noLiquidity": "まだ流動性を提供していません",
  "defi.yourLiquidityNote":
    "取引の場に預けている通貨の一覧です。取り出すときは、下のフォームからどうぞ。",


  "explore.chainStatus": "チェーン状態",
  "explore.links": "エコシステム",
  "explore.block": "ブロック",
  "explore.explorer": "エクスプローラーで見る ↗",
  "explore.qnsEnded": "QNS（.qomドメイン）の新規登録は終了しています。",
  "explore.linkWarning":
    "外部サイトで秘密鍵やニーモニックの入力を求められたら、絶対に入力しないでください。",

  "nft.tabNft": "NFT",
  "nft.tabGuide": "Guide",
  "nft.tabQns": "QNS",
  "nft.collections": "コレクション（42 Chain）",
  "nft.ownedCount": "あなたの保有数",
  "nft.totalSupply": "総供給",
  "nft.yourTokens": "保有トークン",
  "nft.none": "保有トークンは見つかりませんでした。",
  "nft.apiNote": "一覧は自動で取得しています。取得できない場合は、個数だけ表示します。",
  "guide.score": "スコア",
  "guide.tier": "ティア",
  "guide.emblem": "エンブレム",
  "guide.text": "刻まれたテキスト",
  "guide.starlight": "Starlight",
  "guide.registered": "登録済み",
  "guide.notRegistered": "未登録",
  "guide.earned": "ためた報酬",
  "guide.burned": "消した分",
  "guide.forms": "フォーム数",
  "qns.ownedTitle": "保有ドメイン（.qom）",
  "qns.ownedNone":
    "このアドレスが所有する .qom ドメインは見つかりませんでした。",
  "qns.lookupTitle": "ドメインを調べる",
  "qns.lookupNote":
    "名前（例: startup）を入れると、持ち主を調べられます。新規登録は終了しています。",
  "qns.lookupPlaceholder": "名前（.qom は不要）",
  "qns.lookup": "調べる",
  "qns.owner": "所有者",
  "qns.expires": "有効期限",
  "qns.permanent": "永久（期限なし）",
  "qns.available": "未登録の名前です（新規登録は終了しています）",
  "qns.yours": "あなたのドメインです",
  "qns.enumerateNote": "一覧は自動で取得しています。",

  "settings.wallet": "ウォレット管理",
  "settings.language": "言語 / Language",
  "settings.customTokens": "カスタムトークン",
  "settings.noCustomTokens": "カスタムトークンはまだありません。",
  "settings.about": "このアプリについて",
  "settings.catchphrase": "One Wallet. Infinite Possibilities.",
  "settings.version": "バージョン",
  "settings.details": "詳細情報",
  "settings.detailsNote":
    "ふだんは見なくて大丈夫な、接続先などの技術情報です。",
  "settings.priceNote":
    "価格は取引所の相場から自動で計算しています。実際の取引額と異なることがあります。",
  "settings.security": "セキュリティ",
  "settings.securityBody":
    "秘密鍵とリカバリーフレーズ（復旧用の言葉）は、あなたのスマホの中の安全な場所にだけ保存され、外部に送られることはありません。このアプリは開発中のテスト版です。大事な資産は入れず、少額でお試しください。",
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
  "home.account": "Account",
  "home.totalBalance": "Total Balance",
  "home.send": "Send",
  "home.receive": "Receive",
  "home.swap": "Swap",
  "home.tokens": "Tokens",
  "home.history": "Recent Activity",
  "home.historyEmpty": "No transactions yet.",
  "home.historyNote": "History loads automatically.",
  "home.priceUnavailable": "Price N/A",
  "home.change24h": "24h",
  "home.stakingStatus": "Staking Status",
  "home.stakingStatusBody":
    "Stake 42 to earn rewards. Deposit and withdraw under DeFi → Staking.",
  "home.chains": "Networks",
  "home.network": "Network",

  "tokens.title": "Tokens",
  "tokens.searchPlaceholder": "Search tokens (name or symbol)",
  "tokens.all": "All",
  "tokens.addCustom": "Add Custom Token",
  "tokens.addCustomNote":
    "Paste a token's address (0x…) and the app reads its name and details automatically.",
  "tokens.contractPlaceholder": "Token address 0x…",
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
  "defi.yourLiquidity": "Your liquidity",
  "defi.noLiquidity": "You haven't provided liquidity yet",
  "defi.yourLiquidityNote":
    "The tokens you've supplied to the markets. Use the form below to withdraw.",


  "explore.chainStatus": "Chain Status",
  "explore.links": "Ecosystem",
  "explore.block": "Block",
  "explore.explorer": "View in explorer ↗",
  "explore.qnsEnded": "New QNS (.qom domain) registrations have ended.",
  "explore.linkWarning":
    "Never enter your private key or recovery phrase on an external site.",

  "nft.tabNft": "NFT",
  "nft.tabGuide": "Guide",
  "nft.tabQns": "QNS",
  "nft.collections": "Collections (42 Chain)",
  "nft.ownedCount": "You own",
  "nft.totalSupply": "Total supply",
  "nft.yourTokens": "Your tokens",
  "nft.none": "No tokens found.",
  "nft.apiNote":
    "The list loads automatically; if it can't, only counts are shown.",
  "guide.score": "Score",
  "guide.tier": "Tier",
  "guide.emblem": "Emblem",
  "guide.text": "Inscribed text",
  "guide.starlight": "Starlight",
  "guide.registered": "Registered",
  "guide.notRegistered": "Not registered",
  "guide.earned": "Rewards earned",
  "guide.burned": "Burned",
  "guide.forms": "Forms",
  "qns.ownedTitle": "Your domains (.qom)",
  "qns.ownedNone": "No .qom domains owned by this address were found.",
  "qns.lookupTitle": "Look up a domain",
  "qns.lookupNote":
    "Enter a name (e.g. “startup”) to see who owns it. New registrations have ended.",
  "qns.lookupPlaceholder": "Name (without .qom)",
  "qns.lookup": "Look up",
  "qns.owner": "Owner",
  "qns.expires": "Expires",
  "qns.permanent": "Permanent (no expiry)",
  "qns.available": "Unregistered name (registration has ended)",
  "qns.yours": "This is your domain",
  "qns.enumerateNote": "The list loads automatically.",

  "settings.wallet": "Wallet Management",
  "settings.language": "言語 / Language",
  "settings.customTokens": "Custom Tokens",
  "settings.noCustomTokens": "No custom tokens yet.",
  "settings.about": "About",
  "settings.catchphrase": "One Wallet. Infinite Possibilities.",
  "settings.version": "Version",
  "settings.details": "Details",
  "settings.detailsNote":
    "Technical connection details — you don't need these day to day.",
  "settings.priceNote":
    "Prices are calculated automatically from market data and may differ from actual trade amounts.",
  "settings.security": "Security",
  "settings.securityBody":
    "Your private key and recovery phrase are stored only in a safe place on your phone and are never sent anywhere. This app is a test build — please don't keep important assets in it, and start with small amounts.",
};

export const DICT: Record<Lang, Record<I18nKey, string>> = { ja, en };

// Placeholder content for The Square preview.
// Everything here is illustrative — replace with real data once the backend exists.

export type Stance = "bull" | "bear" | null;

export type Author = {
  id?: string;
  name: string;
  handle: string;
  initials: string;
  image?: string | null;
  verified?: boolean;
  role?: string;
};

export type PollOption = {
  id?: string;
  label: string;
  votes: number;
  stance?: Stance;
};

export type Poll = {
  question?: string;
  totalVotes?: number;
  myOptionId?: string | null;
  options: PollOption[];
};

export type QuotedPost = {
  id: string;
  author: Author;
  body: string;
  stance: Stance;
  tickers: string[];
  createdAt?: string;
  time?: string;
};

export type SentimentCounts = { bulls: number; bears: number };

export type SentimentWindows = {
  session: SentimentCounts;
  week: SentimentCounts;
  month: SentimentCounts;
};

export type PriceAlert = {
  symbol: string;
  thresholdPct: number;
  direction: "up" | "down" | "either";
};

export type ReportReason = "spam" | "harassment" | "misinformation" | "other";

export type Post = {
  id: string;
  author: Author;
  time: string;
  createdAt?: string;
  body: string;
  stance: Stance;
  tickers: string[];
  replies: number;
  reposts: number;
  likes: number;
  bookmarks?: number;
  likedByMe?: boolean;
  repostedByMe?: boolean;
  bookmarkedByMe?: boolean;
  parentId?: string | null;
  replyTo?: Author | null;
  quote?: QuotedPost | null;
  poll?: Poll | null;
  room?: { title: string; analyst: string };
};

export type Profile = Author & {
  id: string;
  joinedAt: string;
  posts: number;
  replies: number;
  reposts: number;
  likes: number;
  followers: number;
  following: number;
  followedByMe: boolean;
  mutedByMe?: boolean;
  blockedByMe?: boolean;
  blockedMe?: boolean;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  banner?: string | null;
  title?: string | null;
  titleLockedUntil?: string | null;
};

export type NotificationType = "like" | "follow" | "reply" | "repost" | "quote" | "alert" | "disclosure";

export type SquareNotification = {
  id: string;
  type: NotificationType;
  read: boolean;
  time: string;
  actor: Author;
  post: { id: string; body: string } | null;
  symbol?: string | null;
  summary?: string | null;
  href?: string | null;
};

const NGX_FILING = /^https:\/\/([a-z0-9-]+\.)*ngxgroup\.com\//i;

export function notificationLink(item: Pick<SquareNotification, "type" | "href" | "symbol" | "post" | "actor">): {
  href: string;
  external: boolean;
} {
  if (item.type === "disclosure" && item.href && NGX_FILING.test(item.href)) {
    return { href: item.href, external: true };
  }
  if ((item.type === "alert" || item.type === "disclosure") && item.symbol) {
    return { href: `/square/${item.symbol}`, external: false };
  }
  if (item.post) return { href: `/square/post/${item.post.id}`, external: false };
  if (item.actor.id) return { href: `/square/u/${item.actor.id}`, external: false };
  return { href: "/square/notifications", external: false };
}

export type TickerSummary = {
  symbol: string;
  name: string | null;
  sector: string | null;
  subSector?: string | null;
  marketClassification?: string | null;
  about?: string | null;
  natureOfBusiness?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  internationalSecId?: string | null;
  sharesOutstanding?: number | null;
  dateListed?: string | null;
  dateIncorporated?: string | null;
  industry?: string | null;
  country?: string | null;
  foundedYear?: number | null;
  employees?: number | null;
  ceo?: string | null;
  executives?: string | null;
  listingExchange?: string | null;
  fiscalYear?: string | null;
  reportingCurrency?: string | null;
  sicCode?: string | null;
  postCount: number;
  watchedByMe?: boolean;
  bulls?: number;
  bears?: number;
  sentiment?: SentimentWindows;
};

export const ME: Author = { name: "Nonso", handle: "nonso", initials: "NO" };

const A = {
  analyst1: { name: "Adesuwa O.", handle: "ade_equities", initials: "AO", verified: true, role: "Equity Research" },
  fund: { name: "Tunde Capital", handle: "tunde_cap", initials: "TC", verified: true, role: "Asset Management" },
  retail: { name: "Chinedu M.", handle: "chinedu_invests", initials: "CM" },
  newbie: { name: "Bisi Ola", handle: "bisiola_89", initials: "BO" },
  macro: { name: "Dr. Kalu", handle: "kalu_macro", initials: "DK", verified: true, role: "Economist" },
  trader: { name: "Femi Trades", handle: "femi_floor", initials: "FT" },
  analyst2: { name: "Ngozi E.", handle: "ngozi_fx", initials: "NE", verified: true, role: "FX Strategist" },
  institutional: { name: "Lagos Partners", handle: "lagos_partners", initials: "LP", verified: true, role: "Institutional" },
} satisfies Record<string, Author>;

export const AUTHORS = A;

export const POSTS: Post[] = [
  {
    id: "p1",
    author: A.analyst1,
    time: "2m",
    body: "Watching $DANGCEM into earnings this Friday. Volumes picking up nicely on the NGX. The price action suggests institutions are front-running a dividend surprise. I'll share my full thesis in the room tonight. What's everyone's read?",
    stance: "bull",
    tickers: ["DANGCEM"],
    replies: 24,
    reposts: 11,
    likes: 186,
  },
  {
    id: "p2",
    author: A.macro,
    time: "14m",
    body: "CBN rate decision this week. If the MPC holds at current levels, banks like $GTCO and $ZENITHBANK should keep their NIM (Net Interest Margin) story intact. If we see another hike, watch the tier-2 names struggle with NPLs.",
    stance: null,
    tickers: ["GTCO", "ZENITHBANK"],
    replies: 41,
    reposts: 32,
    likes: 302,
  },
  {
    id: "p3",
    author: A.trader,
    time: "22m",
    body: "Taking some profits on $OANDO. The rally was beautiful but RSI is heavily overbought. Will look to re-enter if it drops below ₦60.",
    stance: "bear",
    tickers: ["OANDO"],
    replies: 15,
    reposts: 4,
    likes: 67,
  },
  {
    id: "p4",
    author: A.retail,
    time: "38m",
    body: "Quick poll for the floor 👇 Where is the telecom sector heading?",
    stance: null,
    tickers: ["MTNN", "AIRTELAFRI"],
    replies: 12,
    reposts: 3,
    likes: 57,
    poll: {
      question: "$MTNN over the next quarter?",
      options: [
        { label: "Bullish - FX impact is priced in", votes: 412, stance: "bull" },
        { label: "Bearish - Margins will keep shrinking", votes: 198, stance: "bear" },
        { label: "Just watching for now", votes: 140, stance: null },
      ],
    },
  },
  {
    id: "p5",
    author: A.fund,
    time: "1h",
    body: "New deep dive is up for subscribers — covering the banking sector recapitalisation exercise and who's best positioned to survive without extreme dilution.",
    stance: "bull",
    tickers: ["ACCESSCORP", "FBNH"],
    replies: 17,
    reposts: 21,
    likes: 244,
    room: { title: "Banking Sector: Recapitalisation Deep Dive", analyst: "Tunde Capital" },
  },
  {
    id: "p6",
    author: A.trader,
    time: "2h",
    body: "Not convinced on $SEPLAT here. Crude has been choppy and I'd rather wait for a cleaner technical setup. Happy to be proven wrong.",
    stance: "bear",
    tickers: ["SEPLAT"],
    replies: 33,
    reposts: 6,
    likes: 98,
  },
  {
    id: "p7",
    author: A.newbie,
    time: "3h",
    body: "First time investing in the Nigerian market — is it better to start with mutual funds or go straight into blue-chip NGX stocks like $NESTLE? Appreciate any honest advice 🙏",
    stance: null,
    tickers: ["NESTLE"],
    replies: 62,
    reposts: 4,
    likes: 131,
  },
  {
    id: "p8",
    author: A.analyst2,
    time: "4h",
    body: "Naira finding some stability at the parallel market. This could ease the FX loss burden for consumer goods giants like $BUAFOODS and $NB in Q3. Keep an eye on their import substitution efforts.",
    stance: "bull",
    tickers: ["BUAFOODS", "NB"],
    replies: 28,
    reposts: 15,
    likes: 112,
  },
  {
    id: "p9",
    author: A.institutional,
    time: "5h",
    body: "$TRANSCORP power generation volumes look solid for the quarter. The turnaround story continues to execute flawlessly. Long and strong.",
    stance: "bull",
    tickers: ["TRANSCORP"],
    replies: 8,
    reposts: 9,
    likes: 204,
  },
  {
    id: "p10",
    author: A.retail,
    time: "6h",
    body: "Why is no one talking about $UBA? The dividend yield is insane at these price levels.",
    stance: "bull",
    tickers: ["UBA"],
    replies: 45,
    reposts: 22,
    likes: 350,
  }
];

export const SUGGESTED: Author[] = [A.fund, A.macro, A.analyst1, A.institutional, A.analyst2];

export const TICKER_RE = /(\$[A-Z]{2,12})/g;

export function extractTickers(text: string): string[] {
  return Array.from(new Set((text.match(TICKER_RE) ?? []).map((t) => t.slice(1))));
}

export function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}


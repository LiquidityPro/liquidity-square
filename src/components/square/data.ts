// Placeholder content for The Square preview.
// Everything here is illustrative — replace with real data once the backend exists.
// Note: no share prices are shown anywhere, matching the landing page's "tickers only" rule.

export type Stance = "bull" | "bear" | null;

export type Author = {
  name: string;
  handle: string;
  initials: string;
  verified?: boolean;
  role?: string;
};

export type Poll = {
  question: string;
  options: { label: string; votes: number }[];
};

export type Post = {
  id: string;
  author: Author;
  time: string;
  body: string;
  stance: Stance;
  tickers: string[];
  replies: number;
  reposts: number;
  likes: number;
  poll?: Poll;
  room?: { title: string; analyst: string };
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
        { label: "Bullish - FX impact is priced in", votes: 412 },
        { label: "Bearish - Margins will keep shrinking", votes: 198 },
        { label: "Just watching for now", votes: 140 },
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

export type Trend = { ticker: string; sector: string; posts: string; bull: number };

// `bull` is an illustrative bullish share (0–100).
export const TRENDING: Trend[] = [
  { ticker: "DANGCEM", sector: "Industrials", posts: "2.4K posts", bull: 64 },
  { ticker: "GTCO", sector: "Banking", posts: "1.8K posts", bull: 71 },
  { ticker: "MTNN", sector: "Telecoms", posts: "1.2K posts", bull: 45 },
  { ticker: "OANDO", sector: "Oil & gas", posts: "954 posts", bull: 32 },
  { ticker: "BUAFOODS", sector: "Consumer goods", posts: "812 posts", bull: 59 },
  { ticker: "TRANSCORP", sector: "Conglomerates", posts: "640 posts", bull: 85 },
  { ticker: "ZENITHBANK", sector: "Banking", posts: "590 posts", bull: 68 },
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

// Mock company fundamentals for the RightRail
export type CompanyFundamentals = {
  price: number;
  change: number; // Percentage
  marketCap: string;
  peRatio: number;
  volume: string;
  news: { headline: string; source: string; time: string }[];
};

export const TICKER_FUNDS: Record<string, CompanyFundamentals> = {
  DANGCEM: {
    price: 645.50,
    change: 1.2,
    marketCap: "₦11.0T",
    peRatio: 18.4,
    volume: "1.2M",
    news: [
      { headline: "Dangote Cement Q3 Revenue surges on Pan-African exports", source: "BusinessDay", time: "2h ago" },
      { headline: "Analysts maintain BUY rating for DANGCEM", source: "Nairametrics", time: "5h ago" }
    ]
  },
  GTCO: {
    price: 45.20,
    change: -0.5,
    marketCap: "₦1.3T",
    peRatio: 3.1,
    volume: "15.4M",
    news: [
      { headline: "GTCO completes transition to holding company structure", source: "Proshare", time: "1d ago" },
      { headline: "FX revaluation gains boost banking sector Q2 profit", source: "Nairametrics", time: "1d ago" }
    ]
  },
  MTNN: {
    price: 210.00,
    change: -2.4,
    marketCap: "₦4.2T",
    peRatio: 12.8,
    volume: "5.1M",
    news: [
      { headline: "MTN Nigeria faces margin pressure from Naira devaluation", source: "BusinessDay", time: "3h ago" },
      { headline: "Telecom operators push for tariff hike", source: "Punch", time: "6h ago" }
    ]
  }
};

export function getTickerData(ticker: string): CompanyFundamentals {
  // Provide a default fallback if the ticker isn't in our mock data
  return TICKER_FUNDS[ticker] || {
    price: Math.floor(Math.random() * 500) + 10,
    change: parseFloat((Math.random() * 10 - 5).toFixed(2)),
    marketCap: `₦${(Math.random() * 5 + 0.1).toFixed(1)}T`,
    peRatio: parseFloat((Math.random() * 20 + 2).toFixed(1)),
    volume: `${(Math.random() * 10 + 0.5).toFixed(1)}M`,
    news: [
      { headline: `Market buzz surrounds ${ticker} ahead of earnings`, source: "Liquidity News", time: "1h ago" },
      { headline: `${ticker} volume spikes as investors position`, source: "Proshare", time: "4h ago" }
    ]
  };
}

export const TOP_MOVERS = {
  gainers: [
    { ticker: "OANDO", change: 9.8, price: 14.50 },
    { ticker: "TRANSCORP", change: 8.4, price: 7.20 },
    { ticker: "UBA", change: 5.2, price: 21.05 },
  ],
  losers: [
    { ticker: "NESTLE", change: -9.9, price: 950.00 },
    { ticker: "MTNN", change: -4.5, price: 205.50 },
    { ticker: "STANBIC", change: -3.1, price: 62.00 },
  ]
};

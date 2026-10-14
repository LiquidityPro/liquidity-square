import { AUTHORS, type Author } from "./data";

export type SampleNote = {
  id: string;
  author: Author;
  time: string;
  body: string;
};

export type ProRoom = {
  slug: string;
  title: string;
  summary: string;
  host: Author;
  tickers: string[];
  listeners: number;
  status: "live" | "scheduled" | "replay";
  when: string;
  /** The featured room stays readable. Others open after Preview. */
  sampleOpen: boolean;
  notes: SampleNote[];
};

export const PRO_ROOMS: ProRoom[] = [
  {
    slug: "banking-recap",
    title: "Banking Sector: Recapitalisation Deep Dive",
    summary:
      "Who can raise capital without blowing up existing shareholders, and which tier-1 names still have a dividend path.",
    host: AUTHORS.fund,
    tickers: ["GTCO", "ZENITHBANK", "UBA", "ACCESSCORP", "FBNH"],
    listeners: 128,
    status: "live",
    when: "Live now",
    sampleOpen: true,
    notes: [
      {
        id: "n1",
        author: AUTHORS.fund,
        time: "12m",
        body: "Opening frame: recapitalisation is a sorting mechanism. $GTCO and $ZENITHBANK can raise from strength. The dilution risk sits with names that need the full raise just to stay in the tier-1 conversation.",
      },
      {
        id: "n2",
        author: AUTHORS.macro,
        time: "9m",
        body: "If the MPC holds, NIMs stay the story. A surprise hike makes the weaker capital ratios look worse, not better. I'm using $UBA as the dividend-yield check against $FBNH.",
      },
      {
        id: "n3",
        author: AUTHORS.analyst1,
        time: "4m",
        body: "Sample note, not a recommendation: I'd rather own the bank that can fund growth after the raise than the one whose entire bull case is 'they survived'. $ACCESSCORP is the debate name in this room.",
      },
    ],
  },
  {
    slug: "dangcem-close",
    title: "Dangote Cement into the print",
    summary: "Volumes, Pan-African pricing, and whether Friday's print is already in the tape.",
    host: AUTHORS.analyst1,
    tickers: ["DANGCEM"],
    listeners: 86,
    status: "live",
    when: "Live now",
    sampleOpen: false,
    notes: [
      {
        id: "d1",
        author: AUTHORS.analyst1,
        time: "20m",
        body: "Watching $DANGCEM into Friday. The bid looks institutional, but I want the volume to stay bid after the first hour, not just the open.",
      },
      {
        id: "d2",
        author: AUTHORS.institutional,
        time: "11m",
        body: "Export tonnes are the line I'll read first. Domestic price is already in the consensus.",
      },
    ],
  },
  {
    slug: "naira-brief",
    title: "Naira desk: consumer FX",
    summary: "What a quieter parallel market does to import-heavy consumer names this quarter.",
    host: AUTHORS.analyst2,
    tickers: ["BUAFOODS", "NB"],
    listeners: 64,
    status: "scheduled",
    when: "Today · 8:00pm",
    sampleOpen: false,
    notes: [
      {
        id: "f1",
        author: AUTHORS.analyst2,
        time: "1h",
        body: "If the parallel rate stays calm, $BUAFOODS and $NB get a quarter where FX losses stop doing the talking. That's the whole brief.",
      },
    ],
  },
  {
    slug: "power-hour",
    title: "Transcorp power check",
    summary: "A replay of the generation-volume note from the conglomerate desk.",
    host: AUTHORS.institutional,
    tickers: ["TRANSCORP"],
    listeners: 41,
    status: "replay",
    when: "Replay",
    sampleOpen: false,
    notes: [
      {
        id: "p1",
        author: AUTHORS.institutional,
        time: "Yesterday",
        body: "$TRANSCORP generation volumes are doing the work. The turnaround is in the operating line, not the headline multiple.",
      },
    ],
  },
];

export function roomBySlug(slug: string) {
  return PRO_ROOMS.find((room) => room.slug === slug) ?? null;
}

export function roomHref(title: string) {
  const match = PRO_ROOMS.find((room) => room.title === title);
  return match ? `/square/rooms/${match.slug}` : "/square/rooms";
}

export type SquareList = {
  slug: string;
  name: string;
  description: string;
  owner: Author;
  mine?: boolean;
  followers: number;
  members: Author[];
};

export const LISTS: SquareList[] = [
  {
    slug: "ngx-banks",
    name: "NGX Banks",
    description: "Voices tracking recapitalisation, NIMs, and dividend names.",
    owner: AUTHORS.fund,
    mine: true,
    followers: 240,
    members: [AUTHORS.fund, AUTHORS.macro, AUTHORS.institutional, AUTHORS.analyst1],
  },
  {
    slug: "dividend-desk",
    name: "Dividend desk",
    description: "Yield hunters and the names they keep coming back to.",
    owner: AUTHORS.retail,
    mine: true,
    followers: 96,
    members: [AUTHORS.retail, AUTHORS.fund, AUTHORS.analyst2],
  },
  {
    slug: "macro-watch",
    name: "Macro watch",
    description: "CBN, FX, and the prints that move the whole board.",
    owner: AUTHORS.macro,
    followers: 410,
    members: [AUTHORS.macro, AUTHORS.analyst2, AUTHORS.fund],
  },
];

export function listBySlug(slug: string) {
  return LISTS.find((list) => list.slug === slug) ?? null;
}

export type Community = {
  slug: string;
  name: string;
  description: string;
  members: number;
  topic: string;
  posts: SampleNote[];
};

export const COMMUNITIES: Community[] = [
  {
    slug: "the-floor",
    name: "The Floor",
    description: "The open pit. Calls, fades, and what the tape is actually doing.",
    members: 1840,
    topic: "NGX",
    posts: [
      {
        id: "c1",
        author: AUTHORS.trader,
        time: "22m",
        body: "Taking some off $OANDO. Beautiful rally, terrible RSI. I'll say it again under ₦60.",
      },
      {
        id: "c2",
        author: AUTHORS.retail,
        time: "1h",
        body: "Why is $UBA this quiet with that dividend yield? The floor usually finds these.",
      },
    ],
  },
  {
    slug: "first-trades",
    name: "First trades",
    description: "A slower room for people making their first NGX allocation.",
    members: 620,
    topic: "Newcomers",
    posts: [
      {
        id: "c3",
        author: AUTHORS.newbie,
        time: "3h",
        body: "Starting with mutual funds or a blue chip like $NESTLE? I want the honest version, not the brochure.",
      },
      {
        id: "c4",
        author: AUTHORS.analyst1,
        time: "2h",
        body: "Start with a name you can explain without notes. $NESTLE qualifies. A fund qualifies too. A basket of tips does not.",
      },
    ],
  },
  {
    slug: "fx-desk",
    name: "FX desk",
    description: "Naira, imports, and the consumer names that feel every tick.",
    members: 980,
    topic: "FX",
    posts: [
      {
        id: "c5",
        author: AUTHORS.analyst2,
        time: "4h",
        body: "A calmer parallel market is the Q3 gift for $BUAFOODS and $NB. Watch import substitution, not just the headline rate.",
      },
    ],
  },
];

export function communityBySlug(slug: string) {
  return COMMUNITIES.find((community) => community.slug === slug) ?? null;
}

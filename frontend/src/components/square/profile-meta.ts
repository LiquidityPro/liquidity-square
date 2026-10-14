export const BANNERS = [
  {
    id: "ember",
    label: "Ember",
    className:
      "bg-[radial-gradient(circle_at_20%_120%,color-mix(in_oklch,var(--primary)_45%,transparent),transparent_60%),radial-gradient(circle_at_90%_-20%,color-mix(in_oklch,var(--bear)_35%,transparent),transparent_55%)] bg-card",
  },
  {
    id: "lagoon",
    label: "Lagoon",
    className:
      "bg-[radial-gradient(circle_at_10%_80%,oklch(0.45_0.08_200),transparent_55%),radial-gradient(circle_at_90%_10%,oklch(0.55_0.12_175),transparent_50%)] bg-card",
  },
  {
    id: "ink",
    label: "Ink",
    className: "bg-[linear-gradient(135deg,oklch(0.25_0.02_260),oklch(0.18_0.03_260)_60%,oklch(0.32_0.04_200))]",
  },
  {
    id: "forest",
    label: "Forest",
    className:
      "bg-[radial-gradient(circle_at_30%_20%,oklch(0.45_0.1_145),transparent_50%),linear-gradient(160deg,oklch(0.28_0.05_150),oklch(0.2_0.04_160))]",
  },
  {
    id: "dusk",
    label: "Dusk",
    className:
      "bg-[radial-gradient(circle_at_80%_0%,oklch(0.55_0.14_40),transparent_45%),linear-gradient(180deg,oklch(0.32_0.06_280),oklch(0.22_0.04_250))]",
  },
] as const;

export type BannerId = (typeof BANNERS)[number]["id"];

export function bannerClass(id?: string | null) {
  return BANNERS.find((banner) => banner.id === id)?.className ?? BANNERS[0].className;
}

export function websiteHref(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export function websiteLabel(website: string) {
  return website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

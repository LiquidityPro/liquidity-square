const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const BASE = "https://api.ngnmarket.com/v1";

function clean(value) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text || null;
}

function day(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(path) {
  const res = await fetch(BASE + path, {
    headers: { Authorization: `Bearer ${process.env.NGN_MARKET_API_KEY}`, Accept: "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const key = process.env.NGN_MARKET_API_KEY;
  if (!key) throw new Error("NGN_MARKET_API_KEY missing");

  const ours = new Set((await prisma.ticker.findMany({ select: { symbol: true } })).map((row) => row.symbol));
  const listed = await api("/companies/identifiers");
  const rows = Array.isArray(listed.body.data) ? listed.body.data : listed.body.data?.data;
  if (!listed.body.success || !Array.isArray(rows)) {
    console.error("identifiers failed", listed.status, listed.body?.error?.code || "");
    process.exitCode = 1;
    return;
  }

  const bySymbol = new Map(rows.map((row) => [String(row.symbol || "").toUpperCase(), row]));
  const missing = [...bySymbol.keys()].filter((symbol) => symbol && !ours.has(symbol)).sort();
  console.log(`NGN_NOT_IN_DB ${missing.length}`);
  console.log(missing.join(","));

  const symbols = [...ours].sort();
  let updated = 0;
  let skipped = 0;
  const failed = [];

  for (const symbol of symbols) {
    const synced = await prisma.$queryRaw`
      SELECT "profileSyncedAt" FROM tickers WHERE symbol = ${symbol} LIMIT 1
    `;
    if (Array.isArray(synced) && synced[0]?.profileSyncedAt) {
      skipped += 1;
      continue;
    }

    let saved = false;
    for (let attempt = 0; attempt < 4 && !saved; attempt += 1) {
      const res = await api(`/companies/${encodeURIComponent(symbol)}`);
      const code = res.body?.error?.code;
      if (res.status === 429 || code === "RATE_LIMITED") {
        await sleep(8000);
        continue;
      }
      if (code === "PLAN_REQUIRED") {
        console.error("PLAN_REQUIRED");
        await applyIdentifiers(ours, bySymbol);
        console.log(JSON.stringify({ updated, skipped, failed, planRequired: true }));
        return;
      }
      if (!res.body.success) {
        failed.push(`${symbol}:${code || res.status}`);
        break;
      }
      const row = res.body.data;
      const name = clean(row.name);
      const sector = clean(row.sector);
      const shares = Number(row.shares_outstanding);
      const safeName = name && name.toUpperCase() !== symbol ? name : null;
      await prisma.$executeRaw`
        UPDATE tickers SET
          name = COALESCE(${safeName}, name),
          sector = COALESCE(${sector}, sector),
          "subSector" = ${clean(row.sub_sector)},
          "marketClassification" = ${clean(row.market_classification)},
          about = ${clean(row.about)},
          "natureOfBusiness" = ${clean(row.nature_of_business)},
          website = ${clean(row.website)},
          email = ${clean(row.email)},
          phone = ${clean(row.phone)},
          address = ${clean(row.address)},
          "logoUrl" = ${clean(row.logo_url)},
          "internationalSecId" = ${clean(row.international_sec_id)},
          "sharesOutstanding" = ${Number.isFinite(shares) ? BigInt(Math.round(shares)) : null},
          "dateListed" = ${day(row.date_listed)},
          "dateIncorporated" = ${day(row.date_incorporated)},
          "profileSyncedAt" = ${new Date()}
        WHERE symbol = ${symbol}
      `;
      updated += 1;
      saved = true;
      if (updated % 10 === 0) console.log(`updated ${updated}`);
    }
    await sleep(2100);
  }

  console.log(JSON.stringify({ updated, skipped, failed }));
}

async function applyIdentifiers(ours, bySymbol) {
  let named = 0;
  for (const symbol of ours) {
    const row = bySymbol.get(symbol);
    if (!row) continue;
    const name = clean(row.name);
    const safeName = name && name.toUpperCase() !== symbol ? name : null;
    await prisma.$executeRaw`
      UPDATE tickers SET
        name = COALESCE(${safeName}, name),
        "logoUrl" = ${clean(row.logo_url)},
        "internationalSecId" = ${clean(row.international_sec_id)}
      WHERE symbol = ${symbol}
    `;
    named += 1;
  }
  console.log(`identifiers_applied ${named}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

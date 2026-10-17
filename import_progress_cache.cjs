const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function text(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function year(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(parsed) && parsed > 1800 && parsed < 2100 ? parsed : null;
}

function employees(value) {
  const parsed = Number.parseInt(String(value || "").replace(/,/g, "").trim(), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

async function main() {
  const file = path.resolve(__dirname, "../../progress_cache.json");
  const cache = JSON.parse(fs.readFileSync(file, "utf8"));
  const symbols = await prisma.ticker.findMany({ select: { symbol: true, name: true } });
  const known = new Map(symbols.map((row) => [row.symbol, row.name]));
  let updated = 0;
  const missing = [];

  for (const [symbol, row] of Object.entries(cache)) {
    if (!known.has(symbol)) {
      missing.push(symbol);
      continue;
    }
    const company = text(row["Company Name"]);
    const safeName = company && company.toUpperCase() !== symbol ? company : null;
    const currentName = known.get(symbol);
    const name = safeName && (!currentName || currentName.toUpperCase() === symbol) ? safeName : safeName || null;
    const sector = text(row.Sector);
    await prisma.$executeRaw`
      UPDATE tickers SET
        name = COALESCE(${name}, name),
        sector = COALESCE(${sector}, sector),
        industry = ${text(row.Industry)},
        country = ${text(row.Country)},
        "foundedYear" = ${year(row.Founded)},
        employees = ${employees(row.Employees)},
        ceo = ${text(row.CEO)},
        executives = ${text(row["Key Executives"])},
        website = COALESCE(${text(row.Website)}, website),
        phone = COALESCE(${text(row.Phone)}, phone),
        address = COALESCE(${text(row.Address)}, address),
        "listingExchange" = ${text(row.Exchange)},
        "fiscalYear" = ${text(row["Fiscal Year"])},
        "reportingCurrency" = ${text(row["Reporting Currency"])},
        "internationalSecId" = COALESCE(${text(row.ISIN)}, "internationalSecId"),
        "sicCode" = ${text(row["SIC Code"])}
      WHERE symbol = ${symbol}
    `;
    updated += 1;
  }

  console.log(JSON.stringify({ cache: Object.keys(cache).length, updated, missing }));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

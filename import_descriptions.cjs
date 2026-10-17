const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables from backend/.env if available
const backendEnv = path.resolve(__dirname, "backend/.env");
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else {
  dotenv.config();
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function cleanDescription(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function main() {
  const filePath = path.resolve(__dirname, "progress_cache.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const cache = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const tickersInDb = await prisma.ticker.findMany({ select: { symbol: true } });
  const knownSymbols = new Set(tickersInDb.map((t) => t.symbol));

  let updatedCount = 0;
  let emptyDescriptionCount = 0;
  const missingInDb = [];

  for (const [symbol, data] of Object.entries(cache)) {
    if (!knownSymbols.has(symbol)) {
      missingInDb.push(symbol);
      continue;
    }

    const description = cleanDescription(data && data.Description);
    if (!description) {
      emptyDescriptionCount++;
      continue;
    }

    await prisma.$executeRaw`
      UPDATE tickers
      SET about = ${description}
      WHERE symbol = ${symbol}
    `;

    updatedCount++;
  }

  console.log(
    JSON.stringify(
      {
        totalCacheEntries: Object.keys(cache).length,
        updatedCount,
        emptyDescriptionCount,
        missingInDbCount: missingInDb.length,
        missingInDb,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error("Error updating descriptions:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

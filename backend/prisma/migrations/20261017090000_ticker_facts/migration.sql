-- AlterTable
ALTER TABLE "tickers" ADD COLUMN "industry" TEXT,
ADD COLUMN "country" TEXT,
ADD COLUMN "foundedYear" INTEGER,
ADD COLUMN "employees" INTEGER,
ADD COLUMN "ceo" TEXT,
ADD COLUMN "executives" TEXT,
ADD COLUMN "listingExchange" TEXT,
ADD COLUMN "fiscalYear" TEXT,
ADD COLUMN "reportingCurrency" TEXT,
ADD COLUMN "sicCode" TEXT;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN "sessionId" INTEGER;

-- AlterTable
ALTER TABLE "ShardLedger" ADD COLUMN "sessionId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_sessionId_key" ON "Quiz"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ShardLedger_sessionId_key" ON "ShardLedger"("sessionId");

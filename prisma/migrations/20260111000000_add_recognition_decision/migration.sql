-- CreateEnum
CREATE TYPE "RecognitionDecision" AS ENUM ('GYM_ACCEPT', 'GLOBAL_ACCEPT', 'REJECT');

-- AlterTable
ALTER TABLE "RecognitionAttempt"
ADD COLUMN "decision" "RecognitionDecision" NOT NULL DEFAULT 'REJECT';
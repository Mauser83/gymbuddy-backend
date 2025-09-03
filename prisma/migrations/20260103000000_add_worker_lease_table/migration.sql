-- CreateTable WorkerLease
CREATE TABLE "WorkerLease" (
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "leaseUntil" TIMESTAMPTZ NOT NULL,
    "heartbeatAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "WorkerLease_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "WorkerLease_leaseUntil_idx" ON "WorkerLease"("leaseUntil");
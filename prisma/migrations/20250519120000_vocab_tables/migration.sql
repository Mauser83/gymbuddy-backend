-- CreateTable
CREATE TABLE "AngleType" (
    "id" SMALLSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AngleType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeightType" (
    "id" SMALLSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeightType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LightingType" (
    "id" SMALLSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LightingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MirrorType" (
    "id" SMALLSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MirrorType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistanceType" (
    "id" SMALLSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistanceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceType" (
    "id" SMALLSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitType" (
    "id" SMALLSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AngleType_key_key" ON "AngleType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "HeightType_key_key" ON "HeightType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "LightingType_key_key" ON "LightingType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "MirrorType_key_key" ON "MirrorType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DistanceType_key_key" ON "DistanceType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SourceType_key_key" ON "SourceType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SplitType_key_key" ON "SplitType"("key");

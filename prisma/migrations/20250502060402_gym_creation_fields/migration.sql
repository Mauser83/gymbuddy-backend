/*
  Warnings:

  - You are about to drop the column `location` on the `Gym` table. All the data in the column will be lost.
  - Added the required column `city` to the `Gym` table without a default value. This is not possible if the table is not empty.
  - Added the required column `country` to the `Gym` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Gym_location_idx";

-- AlterTable
ALTER TABLE "Gym" DROP COLUMN "location",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "creatorId" INTEGER,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "stateCode" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

-- CreateIndex
CREATE INDEX "Gym_city_idx" ON "Gym"("city");

-- CreateIndex
CREATE INDEX "Gym_country_idx" ON "Gym"("country");

-- CreateIndex
CREATE INDEX "Gym_latitude_longitude_idx" ON "Gym"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "Gym" ADD CONSTRAINT "Gym_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

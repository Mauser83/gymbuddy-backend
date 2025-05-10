/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'PREMIUM_USER';
ALTER TYPE "Role" ADD VALUE 'PERSONAL_TRAINER';
ALTER TYPE "Role" ADD VALUE 'MODERATOR';
ALTER TYPE "Role" ADD VALUE 'GYM_MODERATOR';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "baseRole" "Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "UserGymRole" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gymId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGymRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGymRole_userId_gymId_key" ON "UserGymRole"("userId", "gymId");

-- AddForeignKey
ALTER TABLE "UserGymRole" ADD CONSTRAINT "UserGymRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGymRole" ADD CONSTRAINT "UserGymRole_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

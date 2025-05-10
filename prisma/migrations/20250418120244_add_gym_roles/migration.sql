/*
  Warnings:

  - You are about to drop the column `adminId` on the `Gym` table. All the data in the column will be lost.
  - You are about to drop the column `baseRole` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `UserGymRole` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `gymId` to the `ExerciseLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'PREMIUM_USER', 'PERSONAL_TRAINER');

-- CreateEnum
CREATE TYPE "GymRole" AS ENUM ('GYM_MODERATOR', 'GYM_ADMIN');

-- DropForeignKey
ALTER TABLE "Gym" DROP CONSTRAINT "Gym_adminId_fkey";

-- DropForeignKey
ALTER TABLE "UserGymRole" DROP CONSTRAINT "UserGymRole_gymId_fkey";

-- DropForeignKey
ALTER TABLE "UserGymRole" DROP CONSTRAINT "UserGymRole_userId_fkey";

-- AlterTable
ALTER TABLE "ExerciseLog" ADD COLUMN     "gymId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Gym" DROP COLUMN "adminId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "baseRole",
ADD COLUMN     "appRole" "AppRole",
ADD COLUMN     "userRole" "UserRole" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "UserGymRole";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "GymManagementRole" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gymId" INTEGER NOT NULL,
    "role" "GymRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GymManagementRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymTrainer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gymId" INTEGER NOT NULL,

    CONSTRAINT "GymTrainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymChatMember" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "gymId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActive" TIMESTAMP(3),
    "isBanned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GymChatMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GymManagementRole_userId_gymId_key" ON "GymManagementRole"("userId", "gymId");

-- CreateIndex
CREATE UNIQUE INDEX "GymTrainer_userId_gymId_key" ON "GymTrainer"("userId", "gymId");

-- CreateIndex
CREATE UNIQUE INDEX "GymChatMember_userId_gymId_key" ON "GymChatMember"("userId", "gymId");

-- AddForeignKey
ALTER TABLE "GymManagementRole" ADD CONSTRAINT "GymManagementRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymManagementRole" ADD CONSTRAINT "GymManagementRole_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymTrainer" ADD CONSTRAINT "GymTrainer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymTrainer" ADD CONSTRAINT "GymTrainer_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymChatMember" ADD CONSTRAINT "GymChatMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymChatMember" ADD CONSTRAINT "GymChatMember_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLog" ADD CONSTRAINT "ExerciseLog_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

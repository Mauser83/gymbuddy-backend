/*
  Warnings:

  - You are about to alter the column `name` on the `Equipment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `description` on the `Equipment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - You are about to alter the column `equipmentType` on the `Equipment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `muscleGroup` on the `Equipment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `category` on the `Equipment` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `name` on the `Exercise` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `sets` on the `Exercise` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.
  - You are about to alter the column `reps` on the `Exercise` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `SmallInt`.
  - You are about to alter the column `weight` on the `Exercise` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(5,2)`.
  - You are about to alter the column `email` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `password` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `username` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(30)`.
  - You are about to alter the column `name` on the `WorkoutPlan` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.

*/
-- AlterTable
ALTER TABLE "Equipment" ALTER COLUMN "name" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "description" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "equipmentType" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "muscleGroup" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "category" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "Exercise" ALTER COLUMN "name" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "sets" SET DEFAULT 3,
ALTER COLUMN "sets" SET DATA TYPE SMALLINT,
ALTER COLUMN "reps" SET DEFAULT 10,
ALTER COLUMN "reps" SET DATA TYPE SMALLINT,
ALTER COLUMN "weight" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "password" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "username" SET DATA TYPE VARCHAR(30);

-- AlterTable
ALTER TABLE "WorkoutPlan" ALTER COLUMN "name" SET DATA TYPE VARCHAR(100);

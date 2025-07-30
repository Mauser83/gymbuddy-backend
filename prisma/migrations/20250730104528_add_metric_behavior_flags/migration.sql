-- AlterTable
ALTER TABLE "Metric" ADD COLUMN     "minOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "useInPlanning" BOOLEAN NOT NULL DEFAULT true;

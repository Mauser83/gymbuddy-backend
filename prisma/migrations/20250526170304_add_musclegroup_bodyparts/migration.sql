-- CreateTable
CREATE TABLE "_MuscleGroupBodyParts" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_MuscleGroupBodyParts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_MuscleGroupBodyParts_B_index" ON "_MuscleGroupBodyParts"("B");

-- AddForeignKey
ALTER TABLE "_MuscleGroupBodyParts" ADD CONSTRAINT "_MuscleGroupBodyParts_A_fkey" FOREIGN KEY ("A") REFERENCES "BodyPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MuscleGroupBodyParts" ADD CONSTRAINT "_MuscleGroupBodyParts_B_fkey" FOREIGN KEY ("B") REFERENCES "MuscleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

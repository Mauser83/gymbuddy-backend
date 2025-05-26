-- CreateTable
CREATE TABLE "_SharedPrograms" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_SharedPrograms_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_SharedPrograms_B_index" ON "_SharedPrograms"("B");

-- AddForeignKey
ALTER TABLE "_SharedPrograms" ADD CONSTRAINT "_SharedPrograms_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SharedPrograms" ADD CONSTRAINT "_SharedPrograms_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkoutProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

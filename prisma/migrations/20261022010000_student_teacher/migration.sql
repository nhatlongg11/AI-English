ALTER TABLE "Student" ADD COLUMN "teacherId" TEXT;
CREATE INDEX "Student_teacherId_idx" ON "Student"("teacherId");

ALTER TABLE "AttendanceLesson" ADD COLUMN "reportClassName" TEXT;
ALTER TABLE "AttendanceLesson" ADD COLUMN "vocabularyTotal" INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN "homeworkStatus" TEXT NOT NULL DEFAULT 'unmarked';
ALTER TABLE "AttendanceRecord" ADD COLUMN "vocabularyKnown" INTEGER;
ALTER TABLE "AttendanceRecord" ADD COLUMN "miniTestScore" REAL;
ALTER TABLE "AttendanceRecord" ADD COLUMN "reportedBy" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "reportedAt" DATETIME;

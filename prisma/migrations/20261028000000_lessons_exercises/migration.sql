ALTER TABLE "Student" ADD COLUMN "displayName" TEXT;
CREATE TABLE "AttendanceLesson" (
  "id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "heldOn" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AttendanceLesson_createdBy_heldOn_idx" ON "AttendanceLesson"("createdBy", "heldOn");
CREATE TABLE "AttendanceRecord" (
  "lessonId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'unmarked',
  "markedBy" TEXT, "markedAt" DATETIME,
  PRIMARY KEY ("lessonId", "studentId"),
  FOREIGN KEY ("lessonId") REFERENCES "AttendanceLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Exercise" (
  "id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "instructions" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "publishedAt" DATETIME
);
CREATE INDEX "Exercise_createdBy_createdAt_idx" ON "Exercise"("createdBy", "createdAt");
CREATE TABLE "ExerciseQuestion" (
  "exerciseId" TEXT NOT NULL, "questionId" TEXT NOT NULL, "position" INTEGER NOT NULL,
  PRIMARY KEY ("exerciseId", "questionId"),
  FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExerciseQuestion_exerciseId_position_key" ON "ExerciseQuestion"("exerciseId", "position");
CREATE TABLE "ExerciseRecipient" (
  "exerciseId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  PRIMARY KEY ("exerciseId", "studentId"),
  FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "SelectionDecision" ADD COLUMN "exerciseId" TEXT REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "SelectionDecision_exerciseId_studentId_questionId_key" ON "SelectionDecision"("exerciseId", "studentId", "questionId");

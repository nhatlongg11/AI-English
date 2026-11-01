CREATE TABLE "AiSupportCache" (
  "key" TEXT NOT NULL PRIMARY KEY, "operation" TEXT NOT NULL,
  "studentId" TEXT, "staffId" TEXT, "result" TEXT NOT NULL, "context" TEXT NOT NULL,
  "model" TEXT NOT NULL, "provenance" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AiSupportCache_studentId_operation_createdAt_idx" ON "AiSupportCache"("studentId", "operation", "createdAt");
CREATE INDEX "AiSupportCache_staffId_operation_createdAt_idx" ON "AiSupportCache"("staffId", "operation", "createdAt");

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "acceptanceCriteria" TEXT,
ADD COLUMN     "actualResult" TEXT,
ADD COLUMN     "expectedResult" TEXT,
ADD COLUMN     "reporterId" TEXT,
ADD COLUMN     "stepsToReproduce" TEXT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


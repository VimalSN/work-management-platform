-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskDependency" DROP CONSTRAINT "TaskDependency_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskDependency" DROP CONSTRAINT "TaskDependency_relatedTaskId_fkey";

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_relatedTaskId_fkey" FOREIGN KEY ("relatedTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;


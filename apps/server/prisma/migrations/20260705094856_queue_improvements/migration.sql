-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "repeatQueue" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "QueueItem_roomId_videoId_idx" ON "QueueItem"("roomId", "videoId");

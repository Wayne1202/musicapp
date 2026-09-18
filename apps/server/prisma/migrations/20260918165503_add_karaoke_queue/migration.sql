-- CreateTable
CREATE TABLE "KaraokeQueueItem" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KaraokeQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KaraokeQueueItem_roomId_position_idx" ON "KaraokeQueueItem"("roomId", "position");

-- AddForeignKey
ALTER TABLE "KaraokeQueueItem" ADD CONSTRAINT "KaraokeQueueItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "KaraokeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

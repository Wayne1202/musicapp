-- CreateEnum
CREATE TYPE "KaraokeRoomStatus" AS ENUM ('WAITING', 'SINGING', 'ENDED');

-- CreateEnum
CREATE TYPE "KaraokeRole" AS ENUM ('SINGER', 'LISTENER');

-- CreateTable
CREATE TABLE "KaraokeRoom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "KaraokeRoomStatus" NOT NULL DEFAULT 'WAITING',
    "singerMemberId" TEXT,
    "currentVideoId" TEXT,
    "currentTitle" TEXT,
    "currentThumbnail" TEXT,
    "currentDuration" INTEGER NOT NULL DEFAULT 0,
    "currentTimestamp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "micOn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "KaraokeRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaraokeMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "KaraokeRole" NOT NULL DEFAULT 'LISTENER',
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KaraokeMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KaraokeRoom_code_key" ON "KaraokeRoom"("code");

-- CreateIndex
CREATE INDEX "KaraokeRoom_code_idx" ON "KaraokeRoom"("code");

-- CreateIndex
CREATE INDEX "KaraokeMember_roomId_idx" ON "KaraokeMember"("roomId");

-- CreateIndex
CREATE INDEX "KaraokeMember_roomId_isOnline_idx" ON "KaraokeMember"("roomId", "isOnline");

-- AddForeignKey
ALTER TABLE "KaraokeMember" ADD CONSTRAINT "KaraokeMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "KaraokeRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

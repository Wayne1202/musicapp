-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "QueueAddPermission" AS ENUM ('ANYONE', 'HOST_ONLY');

-- CreateEnum
CREATE TYPE "SkipMode" AS ENUM ('ANYONE', 'HOST_ONLY', 'VOTE');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RoomEventType" AS ENUM ('JOINED', 'LEFT', 'HOST_TRANSFERRED', 'QUEUE_LOCKED', 'QUEUE_UNLOCKED', 'VOTE_SKIP_PASSED', 'ROOM_ENDED');

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "type" "ChatMessageType" NOT NULL DEFAULT 'USER',
ALTER COLUMN "sessionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "allowGuestReorder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoShuffle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hostSessionId" TEXT,
ADD COLUMN     "queueAddPermission" "QueueAddPermission" NOT NULL DEFAULT 'ANYONE',
ADD COLUMN     "queueLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reactionsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "skipMode" "SkipMode" NOT NULL DEFAULT 'ANYONE',
ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "RoomEvent" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" "RoomEventType" NOT NULL,
    "actorName" TEXT,
    "targetName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomEvent_roomId_createdAt_idx" ON "RoomEvent"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoomEvent" ADD CONSTRAINT "RoomEvent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

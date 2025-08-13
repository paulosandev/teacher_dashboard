/*
  Warnings:

  - You are about to drop the column `moodleToken` on the `UserMoodleToken` table. All the data in the column will be lost.
  - Added the required column `token` to the `UserMoodleToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."UserMoodleToken" DROP COLUMN "moodleToken",
ADD COLUMN     "token" TEXT NOT NULL;

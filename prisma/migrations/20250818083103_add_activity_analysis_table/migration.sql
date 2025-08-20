/*
  Warnings:

  - You are about to drop the column `activityId` on the `AnalysisResult` table. All the data in the column will be lost.
  - You are about to drop the column `forumId` on the `AnalysisResult` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `AnalysisResult` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the `Activity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Forum` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserMoodleToken` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `analyzedBy` to the `AnalysisResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `moodleCourseId` to the `AnalysisResult` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Activity" DROP CONSTRAINT "Activity_courseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnalysisResult" DROP CONSTRAINT "AnalysisResult_activityId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AnalysisResult" DROP CONSTRAINT "AnalysisResult_forumId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Course" DROP CONSTRAINT "Course_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Forum" DROP CONSTRAINT "Forum_courseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserMoodleToken" DROP CONSTRAINT "UserMoodleToken_userId_fkey";

-- DropIndex
DROP INDEX "public"."AnalysisResult_activityId_idx";

-- DropIndex
DROP INDEX "public"."AnalysisResult_forumId_idx";

-- DropIndex
DROP INDEX "public"."Course_userId_idx";

-- AlterTable
ALTER TABLE "public"."AnalysisResult" DROP COLUMN "activityId",
DROP COLUMN "forumId",
DROP COLUMN "userId",
ADD COLUMN     "activitiesCount" INTEGER,
ADD COLUMN     "analyzedBy" TEXT NOT NULL,
ADD COLUMN     "analyzedByName" TEXT,
ADD COLUMN     "forumsCount" INTEGER,
ADD COLUMN     "moodleCourseId" TEXT NOT NULL,
ADD COLUMN     "moodleGroupId" TEXT,
ADD COLUMN     "overallHealth" TEXT,
ADD COLUMN     "recommendations" JSONB,
ADD COLUMN     "studentsAnalyzed" INTEGER,
ADD COLUMN     "studentsAtRisk" TEXT;

-- AlterTable
ALTER TABLE "public"."Course" DROP COLUMN "userId",
ADD COLUMN     "lastAnalyzedBy" TEXT;

-- AlterTable
ALTER TABLE "public"."JobLog" ADD COLUMN     "analyzedBy" TEXT;

-- DropTable
DROP TABLE "public"."Activity";

-- DropTable
DROP TABLE "public"."Forum";

-- DropTable
DROP TABLE "public"."Session";

-- DropTable
DROP TABLE "public"."User";

-- DropTable
DROP TABLE "public"."UserMoodleToken";

-- CreateTable
CREATE TABLE "public"."ActivityAnalysis" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moodleCourseId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "activityName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "positives" JSONB NOT NULL,
    "alerts" JSONB NOT NULL,
    "insights" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "forumAnalysis" JSONB,
    "assignAnalysis" JSONB,
    "activityData" JSONB NOT NULL,
    "llmResponse" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ActivityAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityAnalysis_courseId_idx" ON "public"."ActivityAnalysis"("courseId");

-- CreateIndex
CREATE INDEX "ActivityAnalysis_activityId_idx" ON "public"."ActivityAnalysis"("activityId");

-- CreateIndex
CREATE INDEX "ActivityAnalysis_activityType_idx" ON "public"."ActivityAnalysis"("activityType");

-- CreateIndex
CREATE INDEX "ActivityAnalysis_generatedAt_idx" ON "public"."ActivityAnalysis"("generatedAt");

-- CreateIndex
CREATE INDEX "ActivityAnalysis_lastUpdated_idx" ON "public"."ActivityAnalysis"("lastUpdated");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityAnalysis_courseId_activityId_activityType_key" ON "public"."ActivityAnalysis"("courseId", "activityId", "activityType");

-- CreateIndex
CREATE INDEX "AnalysisResult_courseId_idx" ON "public"."AnalysisResult"("courseId");

-- CreateIndex
CREATE INDEX "AnalysisResult_moodleCourseId_idx" ON "public"."AnalysisResult"("moodleCourseId");

-- CreateIndex
CREATE INDEX "AnalysisResult_analyzedBy_idx" ON "public"."AnalysisResult"("analyzedBy");

-- CreateIndex
CREATE INDEX "AnalysisResult_analysisType_idx" ON "public"."AnalysisResult"("analysisType");

-- CreateIndex
CREATE INDEX "Course_lastAnalyzedBy_idx" ON "public"."Course"("lastAnalyzedBy");

-- CreateIndex
CREATE INDEX "Group_moodleGroupId_idx" ON "public"."Group"("moodleGroupId");

-- CreateIndex
CREATE INDEX "JobLog_analyzedBy_idx" ON "public"."JobLog"("analyzedBy");

-- AddForeignKey
ALTER TABLE "public"."AnalysisResult" ADD CONSTRAINT "AnalysisResult_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

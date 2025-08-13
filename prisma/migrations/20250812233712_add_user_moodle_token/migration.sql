-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Course" (
    "id" TEXT NOT NULL,
    "moodleCourseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Group" (
    "id" TEXT NOT NULL,
    "moodleGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Activity" (
    "id" TEXT NOT NULL,
    "moodleActivityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Forum" (
    "id" TEXT NOT NULL,
    "moodleForumId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Forum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnalysisResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "groupId" TEXT,
    "activityId" TEXT,
    "forumId" TEXT,
    "analysisType" TEXT NOT NULL,
    "strengths" JSONB NOT NULL,
    "alerts" JSONB NOT NULL,
    "nextStep" TEXT NOT NULL,
    "rawData" JSONB,
    "llmResponse" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "courseId" TEXT,
    "groupId" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserMoodleToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moodleToken" TEXT NOT NULL,
    "moodleUserId" INTEGER,
    "moodleUsername" TEXT,
    "capabilities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserMoodleToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_matricula_key" ON "public"."User"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_moodleCourseId_key" ON "public"."Course"("moodleCourseId");

-- CreateIndex
CREATE INDEX "Course_userId_idx" ON "public"."Course"("userId");

-- CreateIndex
CREATE INDEX "Course_moodleCourseId_idx" ON "public"."Course"("moodleCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_moodleGroupId_key" ON "public"."Group"("moodleGroupId");

-- CreateIndex
CREATE INDEX "Group_courseId_idx" ON "public"."Group"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_moodleActivityId_key" ON "public"."Activity"("moodleActivityId");

-- CreateIndex
CREATE INDEX "Activity_courseId_idx" ON "public"."Activity"("courseId");

-- CreateIndex
CREATE INDEX "Activity_isOpen_idx" ON "public"."Activity"("isOpen");

-- CreateIndex
CREATE UNIQUE INDEX "Forum_moodleForumId_key" ON "public"."Forum"("moodleForumId");

-- CreateIndex
CREATE INDEX "Forum_courseId_idx" ON "public"."Forum"("courseId");

-- CreateIndex
CREATE INDEX "Forum_isOpen_idx" ON "public"."Forum"("isOpen");

-- CreateIndex
CREATE INDEX "AnalysisResult_groupId_idx" ON "public"."AnalysisResult"("groupId");

-- CreateIndex
CREATE INDEX "AnalysisResult_activityId_idx" ON "public"."AnalysisResult"("activityId");

-- CreateIndex
CREATE INDEX "AnalysisResult_forumId_idx" ON "public"."AnalysisResult"("forumId");

-- CreateIndex
CREATE INDEX "AnalysisResult_isLatest_idx" ON "public"."AnalysisResult"("isLatest");

-- CreateIndex
CREATE INDEX "AnalysisResult_processedAt_idx" ON "public"."AnalysisResult"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobLog_jobId_key" ON "public"."JobLog"("jobId");

-- CreateIndex
CREATE INDEX "JobLog_status_idx" ON "public"."JobLog"("status");

-- CreateIndex
CREATE INDEX "JobLog_createdAt_idx" ON "public"."JobLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserMoodleToken_userId_key" ON "public"."UserMoodleToken"("userId");

-- CreateIndex
CREATE INDEX "UserMoodleToken_userId_idx" ON "public"."UserMoodleToken"("userId");

-- CreateIndex
CREATE INDEX "UserMoodleToken_moodleUserId_idx" ON "public"."UserMoodleToken"("moodleUserId");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Course" ADD CONSTRAINT "Course_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Group" ADD CONSTRAINT "Group_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Forum" ADD CONSTRAINT "Forum_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnalysisResult" ADD CONSTRAINT "AnalysisResult_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnalysisResult" ADD CONSTRAINT "AnalysisResult_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnalysisResult" ADD CONSTRAINT "AnalysisResult_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "public"."Forum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserMoodleToken" ADD CONSTRAINT "UserMoodleToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `Course` (
    `id` VARCHAR(191) NOT NULL,
    `moodleCourseId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NULL,
    `lastAnalyzedBy` VARCHAR(191) NULL,
    `lastSync` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Course_moodleCourseId_key`(`moodleCourseId`),
    INDEX `Course_moodleCourseId_idx`(`moodleCourseId`),
    INDEX `Course_lastAnalyzedBy_idx`(`lastAnalyzedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Group` (
    `id` VARCHAR(191) NOT NULL,
    `moodleGroupId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Group_moodleGroupId_key`(`moodleGroupId`),
    INDEX `Group_courseId_idx`(`courseId`),
    INDEX `Group_moodleGroupId_idx`(`moodleGroupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisResult` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `moodleCourseId` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NULL,
    `moodleGroupId` VARCHAR(191) NULL,
    `analyzedBy` VARCHAR(191) NOT NULL,
    `analyzedByName` VARCHAR(191) NULL,
    `analysisType` VARCHAR(191) NOT NULL,
    `strengths` JSON NOT NULL,
    `alerts` JSON NOT NULL,
    `recommendations` JSON NULL,
    `nextStep` VARCHAR(191) NOT NULL,
    `overallHealth` VARCHAR(191) NULL,
    `studentsAtRisk` VARCHAR(191) NULL,
    `rawData` JSON NULL,
    `llmResponse` JSON NULL,
    `studentsAnalyzed` INTEGER NULL,
    `activitiesCount` INTEGER NULL,
    `forumsCount` INTEGER NULL,
    `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isLatest` BOOLEAN NOT NULL DEFAULT true,
    `confidence` DOUBLE NULL,

    INDEX `AnalysisResult_courseId_idx`(`courseId`),
    INDEX `AnalysisResult_groupId_idx`(`groupId`),
    INDEX `AnalysisResult_moodleCourseId_idx`(`moodleCourseId`),
    INDEX `AnalysisResult_analyzedBy_idx`(`analyzedBy`),
    INDEX `AnalysisResult_isLatest_idx`(`isLatest`),
    INDEX `AnalysisResult_processedAt_idx`(`processedAt`),
    INDEX `AnalysisResult_analysisType_idx`(`analysisType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityAnalysis` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `moodleCourseId` VARCHAR(191) NOT NULL,
    `activityId` VARCHAR(191) NOT NULL,
    `activityType` VARCHAR(191) NOT NULL,
    `activityName` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `positives` JSON NOT NULL,
    `alerts` JSON NOT NULL,
    `insights` JSON NOT NULL,
    `recommendation` TEXT NOT NULL,
    `fullAnalysis` TEXT NULL,
    `forumAnalysis` JSON NULL,
    `assignAnalysis` JSON NULL,
    `activityData` JSON NOT NULL,
    `llmResponse` JSON NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUpdated` DATETIME(3) NOT NULL,
    `isValid` BOOLEAN NOT NULL DEFAULT true,

    INDEX `ActivityAnalysis_courseId_idx`(`courseId`),
    INDEX `ActivityAnalysis_activityId_idx`(`activityId`),
    INDEX `ActivityAnalysis_activityType_idx`(`activityType`),
    INDEX `ActivityAnalysis_generatedAt_idx`(`generatedAt`),
    INDEX `ActivityAnalysis_lastUpdated_idx`(`lastUpdated`),
    UNIQUE INDEX `ActivityAnalysis_courseId_activityId_activityType_key`(`courseId`, `activityId`, `activityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobLog` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `jobType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NULL,
    `groupId` VARCHAR(191) NULL,
    `analyzedBy` VARCHAR(191) NULL,
    `error` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `JobLog_jobId_key`(`jobId`),
    INDEX `JobLog_status_idx`(`status`),
    INDEX `JobLog_createdAt_idx`(`createdAt`),
    INDEX `JobLog_analyzedBy_idx`(`analyzedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseCache` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `activities` JSON NOT NULL,
    `analysisResults` JSON NOT NULL,
    `activitiesSummary` JSON NULL,
    `courseAnalysisId` VARCHAR(191) NULL,
    `lastFetched` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `CourseCache_expiresAt_idx`(`expiresAt`),
    INDEX `CourseCache_lastFetched_idx`(`lastFetched`),
    INDEX `CourseCache_isActive_idx`(`isActive`),
    UNIQUE INDEX `CourseCache_courseId_key`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisQueue` (
    `id` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `activityId` VARCHAR(191) NOT NULL,
    `activityType` VARCHAR(191) NOT NULL,
    `activityName` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `activityData` JSON NOT NULL,
    `analysisResult` JSON NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `lastError` VARCHAR(191) NULL,
    `requestedBy` VARCHAR(191) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `AnalysisQueue_status_idx`(`status`),
    INDEX `AnalysisQueue_priority_idx`(`priority`),
    INDEX `AnalysisQueue_requestedAt_idx`(`requestedAt`),
    INDEX `AnalysisQueue_courseId_idx`(`courseId`),
    UNIQUE INDEX `AnalysisQueue_courseId_activityId_activityType_key`(`courseId`, `activityId`, `activityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Aula` (
    `id` VARCHAR(191) NOT NULL,
    `aulaId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `baseUrl` VARCHAR(191) NOT NULL,
    `apiUrl` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastSync` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Aula_aulaId_key`(`aulaId`),
    INDEX `Aula_aulaId_idx`(`aulaId`),
    INDEX `Aula_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AulaCourse` (
    `id` VARCHAR(191) NOT NULL,
    `aulaId` VARCHAR(191) NOT NULL,
    `courseId` INTEGER NOT NULL,
    `courseName` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NULL,
    `categoryName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `teacherIds` JSON NULL,
    `teacherNames` JSON NULL,
    `enrollmentCount` INTEGER NULL,
    `rawData` JSON NOT NULL,
    `lastSync` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AulaCourse_aulaId_idx`(`aulaId`),
    INDEX `AulaCourse_courseId_idx`(`courseId`),
    INDEX `AulaCourse_isActive_idx`(`isActive`),
    INDEX `AulaCourse_lastSync_idx`(`lastSync`),
    UNIQUE INDEX `AulaCourse_aulaId_courseId_key`(`aulaId`, `courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseActivity` (
    `id` VARCHAR(191) NOT NULL,
    `aulaId` VARCHAR(191) NOT NULL,
    `courseId` INTEGER NOT NULL,
    `activityId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `dueDate` DATETIME(3) NULL,
    `cutoffDate` DATETIME(3) NULL,
    `openDate` DATETIME(3) NULL,
    `closeDate` DATETIME(3) NULL,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `url` VARCHAR(191) NULL,
    `forumData` JSON NULL,
    `assignmentData` JSON NULL,
    `quizData` JSON NULL,
    `rawData` JSON NOT NULL,
    `lastDataSync` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `needsAnalysis` BOOLEAN NOT NULL DEFAULT true,
    `analysisCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CourseActivity_aulaId_idx`(`aulaId`),
    INDEX `CourseActivity_courseId_idx`(`courseId`),
    INDEX `CourseActivity_activityId_idx`(`activityId`),
    INDEX `CourseActivity_type_idx`(`type`),
    INDEX `CourseActivity_dueDate_idx`(`dueDate`),
    INDEX `CourseActivity_needsAnalysis_idx`(`needsAnalysis`),
    INDEX `CourseActivity_lastDataSync_idx`(`lastDataSync`),
    UNIQUE INDEX `CourseActivity_aulaId_courseId_activityId_type_key`(`aulaId`, `courseId`, `activityId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BatchAnalysis` (
    `id` VARCHAR(191) NOT NULL,
    `aulaId` VARCHAR(191) NOT NULL,
    `courseId` INTEGER NOT NULL,
    `activityId` INTEGER NULL,
    `activityType` VARCHAR(191) NULL,
    `analysisType` VARCHAR(191) NOT NULL,
    `analysisScope` VARCHAR(191) NOT NULL,
    `analysisText` TEXT NOT NULL,
    `summary` TEXT NULL,
    `keyInsights` JSON NULL,
    `recommendations` JSON NULL,
    `alertFlags` JSON NULL,
    `sections` JSON NULL,
    `inputData` JSON NOT NULL,
    `llmPrompt` TEXT NULL,
    `llmResponse` TEXT NULL,
    `processingTime` INTEGER NULL,
    `confidence` DOUBLE NULL,
    `dataCompleteness` DOUBLE NULL,
    `studentsAnalyzed` INTEGER NULL,
    `batchJobId` VARCHAR(191) NULL,
    `isLatest` BOOLEAN NOT NULL DEFAULT true,
    `expiresAt` DATETIME(3) NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BatchAnalysis_aulaId_idx`(`aulaId`),
    INDEX `BatchAnalysis_courseId_idx`(`courseId`),
    INDEX `BatchAnalysis_activityId_idx`(`activityId`),
    INDEX `BatchAnalysis_analysisType_idx`(`analysisType`),
    INDEX `BatchAnalysis_isLatest_idx`(`isLatest`),
    INDEX `BatchAnalysis_expiresAt_idx`(`expiresAt`),
    INDEX `BatchAnalysis_generatedAt_idx`(`generatedAt`),
    INDEX `BatchAnalysis_batchJobId_idx`(`batchJobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BatchJob` (
    `id` VARCHAR(191) NOT NULL,
    `jobType` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `targetAulas` JSON NULL,
    `targetCourses` JSON NULL,
    `status` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `totalSteps` INTEGER NULL,
    `currentStep` INTEGER NULL,
    `processedAulas` INTEGER NOT NULL DEFAULT 0,
    `processedCourses` INTEGER NOT NULL DEFAULT 0,
    `processedActivities` INTEGER NOT NULL DEFAULT 0,
    `generatedAnalyses` INTEGER NOT NULL DEFAULT 0,
    `successCount` INTEGER NOT NULL DEFAULT 0,
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `errors` JSON NULL,
    `summary` JSON NULL,
    `scheduledFor` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `duration` INTEGER NULL,
    `triggeredBy` VARCHAR(191) NULL,
    `requestedBy` VARCHAR(191) NULL,
    `maxRetries` INTEGER NOT NULL DEFAULT 3,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BatchJob_status_idx`(`status`),
    INDEX `BatchJob_jobType_idx`(`jobType`),
    INDEX `BatchJob_priority_idx`(`priority`),
    INDEX `BatchJob_scheduledFor_idx`(`scheduledFor`),
    INDEX `BatchJob_startedAt_idx`(`startedAt`),
    INDEX `BatchJob_createdAt_idx`(`createdAt`),
    INDEX `BatchJob_triggeredBy_idx`(`triggeredBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Group` ADD CONSTRAINT `Group_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnalysisResult` ADD CONSTRAINT `AnalysisResult_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnalysisResult` ADD CONSTRAINT `AnalysisResult_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AulaCourse` ADD CONSTRAINT `AulaCourse_aulaId_fkey` FOREIGN KEY (`aulaId`) REFERENCES `Aula`(`aulaId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseActivity` ADD CONSTRAINT `CourseActivity_aulaId_fkey` FOREIGN KEY (`aulaId`) REFERENCES `Aula`(`aulaId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseActivity` ADD CONSTRAINT `CourseActivity_aulaId_courseId_fkey` FOREIGN KEY (`aulaId`, `courseId`) REFERENCES `AulaCourse`(`aulaId`, `courseId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchAnalysis` ADD CONSTRAINT `BatchAnalysis_aulaId_fkey` FOREIGN KEY (`aulaId`) REFERENCES `Aula`(`aulaId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchAnalysis` ADD CONSTRAINT `BatchAnalysis_aulaId_courseId_fkey` FOREIGN KEY (`aulaId`, `courseId`) REFERENCES `AulaCourse`(`aulaId`, `courseId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchAnalysis` ADD CONSTRAINT `BatchAnalysis_aulaId_courseId_activityId_activityType_fkey` FOREIGN KEY (`aulaId`, `courseId`, `activityId`, `activityType`) REFERENCES `CourseActivity`(`aulaId`, `courseId`, `activityId`, `type`) ON DELETE CASCADE ON UPDATE CASCADE;

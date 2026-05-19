-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "companyName" TEXT NOT NULL DEFAULT 'ItsNotTechy',
    "defaultSenderName" TEXT NOT NULL DEFAULT 'ItsNotTechy Careers',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- RenameIndex
ALTER INDEX "uniq_referral_per_employee_candidate_job" RENAME TO "Referral_referringUserId_jobId_candidateEmail_key";

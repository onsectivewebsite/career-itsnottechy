-- CreateIndex
CREATE UNIQUE INDEX "uniq_referral_per_employee_candidate_job" ON "Referral"("referringUserId", "jobId", "candidateEmail");

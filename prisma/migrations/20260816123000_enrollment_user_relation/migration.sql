-- ربط التسجيل بالمستخدم — يتيح عرض اسم المتعلم في قوائم المدرب والإدارة
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

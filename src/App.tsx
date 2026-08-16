import { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import Home from './pages/Home'
import Verify from './pages/Verify'
import StaticPage from './pages/Static'
import Catalog from './pages/Catalog'
import StoriesPage from './pages/Stories'
import Trainers from './pages/Trainers'
import Business from './pages/Business'
import Contact from './pages/Contact'
import Auth from './pages/Auth'
import NotFound from './pages/NotFound'

/* محرك التشخيص وصفحة المسار ثقيلان — يُحمَّلان عند الطلب */
const Methodology = lazy(() => import('./pages/Methodology'))
const Diagnostic = lazy(() => import('./pages/Diagnostic'))
const PathwayPage = lazy(() => import('./pages/Pathway'))

/* البوابات الداخلية تُحمَّل عند الطلب فقط — لا تبطئ الصفحات العامة */
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'))
const MyPathway = lazy(() => import('./pages/student/MyPathway'))
const CourseView = lazy(() => import('./pages/student/CourseView'))
const Project = lazy(() => import('./pages/student/Project'))
const Certificates = lazy(() => import('./pages/student/Certificates'))
const MyLearning = lazy(() => import('./pages/student/MyLearning'))
const AdvisorDashboard = lazy(() => import('./pages/advisor/AdvisorDashboard'))
const AdvisorReviews = lazy(() => import('./pages/advisor/Reviews'))
const StudentCard = lazy(() => import('./pages/advisor/StudentCard'))
const TrainerDashboard = lazy(() => import('./pages/trainer/TrainerDashboard'))
const GradingQueue = lazy(() => import('./pages/trainer/GradingQueue'))
const CohortView = lazy(() => import('./pages/trainer/CohortView'))
const Earnings = lazy(() => import('./pages/trainer/Earnings'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminCohorts = lazy(() => import('./pages/admin/AdminCohorts'))
const AdminTrainerApps = lazy(() => import('./pages/admin/TrainerApplications'))
const JoinTrainer = lazy(() => import('./pages/JoinTrainer'))
const JoinTrainerComplete = lazy(() => import('./pages/JoinTrainerComplete'))
const TrainerAcceptInvite = lazy(() => import('./pages/TrainerAcceptInvite'))
const TrainerProposals = lazy(() => import('./pages/trainer/Proposals'))
const CohortBoard = lazy(() => import('./pages/trainer/CohortBoard'))
const Exceptions = lazy(() => import('./pages/admin/Exceptions'))
const ContentWorkflow = lazy(() => import('./pages/admin/ContentWorkflow'))
const CatalogAdmin = lazy(() => import('./pages/admin/CatalogAdmin'))
const PublishingBoard = lazy(() => import('./pages/admin/PublishingBoard'))
const DiagnosticQuality = lazy(() => import('./pages/admin/DiagnosticQuality'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      {/* رابط تجاوز إلى المحتوى — أول ما يصل إليه مستخدم لوحة المفاتيح */}
      <a href="#main-content" className="skip-link">
        تجاوز إلى المحتوى الرئيسي
      </a>
      <ScrollToTop />
      <main id="main-content" tabIndex={-1}>
        <Suspense fallback={
          <div dir="rtl" className="min-h-screen bg-[#0D0D0D] px-5 py-10" aria-busy="true" aria-label="جاري التحميل">
            <div className="mx-auto max-w-3xl animate-pulse space-y-6">
              <div className="mx-auto h-6 w-44 rounded-full bg-white/10" />
              <div className="mx-auto h-10 w-3/4 rounded-2xl bg-white/10" />
              <div className="mx-auto h-4 w-1/2 rounded-full bg-white/5" />
              <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
                <div className="h-2 w-24 rounded-full bg-white/10" />
                <div className="h-8 w-5/6 rounded-xl bg-white/10" />
                <div className="h-14 rounded-2xl bg-white/5" />
                <div className="h-14 rounded-2xl bg-white/5" />
                <div className="h-14 rounded-2xl bg-white/5" />
              </div>
            </div>
          </div>
        }>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/diagnostic" element={<Diagnostic />} />
          <Route path="/pathways" element={<Catalog kind="pathways" />} />
          <Route path="/courses" element={<Catalog kind="courses" />} />
          <Route path="/pathways/:id" element={<PathwayPage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/trainers" element={<Trainers />} />
          <Route path="/join-trainer" element={<JoinTrainer />} />
          <Route path="/join-trainer/complete" element={<JoinTrainerComplete />} />
          <Route path="/for-business" element={<Business kind="business" />} />
          <Route path="/for-government" element={<Business kind="government" />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/p/contact" element={<Contact />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/verify/:number" element={<Verify />} />
          <Route path="/p/:slug" element={<StaticPage />} />
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/pathway" element={<MyPathway />} />
          <Route path="/student/course/:courseId" element={<CourseView />} />
          <Route path="/student/project" element={<Project />} />
          <Route path="/student/certificates" element={<Certificates />} />
          <Route path="/student/learning" element={<MyLearning />} />
          <Route path="/advisor" element={<AdvisorDashboard />} />
          <Route path="/advisor/reviews" element={<AdvisorReviews />} />
          <Route path="/advisor/student/:id" element={<StudentCard />} />
          <Route path="/trainer" element={<TrainerDashboard />} />
          <Route path="/trainer/grading" element={<GradingQueue />} />
          <Route path="/trainer/cohort/:id" element={<CohortView />} />
          <Route path="/trainer/earnings" element={<Earnings />} />
          <Route path="/trainer/proposals" element={<TrainerProposals />} />
          <Route path="/trainer/board" element={<CohortBoard />} />
          <Route path="/trainer/accept-invite" element={<TrainerAcceptInvite />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/cohorts" element={<AdminCohorts />} />
          <Route path="/admin/exceptions" element={<Exceptions />} />
          <Route path="/admin/content" element={<ContentWorkflow />} />
          <Route path="/admin/trainers" element={<AdminTrainerApps />} />
          <Route path="/admin/catalog" element={<CatalogAdmin />} />
          <Route path="/admin/publishing" element={<PublishingBoard />} />
          <Route path="/admin/quality" element={<DiagnosticQuality />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
    </>
  )
}

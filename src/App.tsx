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
const Diagnostic = lazy(() => import('./pages/Diagnostic'))
const PathwayPage = lazy(() => import('./pages/Pathway'))

/* البوابات الداخلية تُحمَّل عند الطلب فقط — لا تبطئ الصفحات العامة */
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'))
const MyPathway = lazy(() => import('./pages/student/MyPathway'))
const CourseView = lazy(() => import('./pages/student/CourseView'))
const Project = lazy(() => import('./pages/student/Project'))
const Certificates = lazy(() => import('./pages/student/Certificates'))
const AdvisorDashboard = lazy(() => import('./pages/advisor/AdvisorDashboard'))
const AdvisorReviews = lazy(() => import('./pages/advisor/Reviews'))
const StudentCard = lazy(() => import('./pages/advisor/StudentCard'))
const TrainerDashboard = lazy(() => import('./pages/trainer/TrainerDashboard'))
const GradingQueue = lazy(() => import('./pages/trainer/GradingQueue'))
const CohortView = lazy(() => import('./pages/trainer/CohortView'))
const Earnings = lazy(() => import('./pages/trainer/Earnings'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminCohorts = lazy(() => import('./pages/admin/AdminCohorts'))
const Exceptions = lazy(() => import('./pages/admin/Exceptions'))
const ContentWorkflow = lazy(() => import('./pages/admin/ContentWorkflow'))

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
        <Suspense fallback={<div dir="rtl" className="grid min-h-screen place-items-center bg-[#0D0D0D] text-sm text-white/50">لحظات…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/diagnostic" element={<Diagnostic />} />
          <Route path="/pathways" element={<Catalog kind="pathways" />} />
          <Route path="/courses" element={<Catalog kind="courses" />} />
          <Route path="/pathways/:id" element={<PathwayPage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/trainers" element={<Trainers />} />
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
          <Route path="/advisor" element={<AdvisorDashboard />} />
          <Route path="/advisor/reviews" element={<AdvisorReviews />} />
          <Route path="/advisor/student/:id" element={<StudentCard />} />
          <Route path="/trainer" element={<TrainerDashboard />} />
          <Route path="/trainer/grading" element={<GradingQueue />} />
          <Route path="/trainer/cohort/:id" element={<CohortView />} />
          <Route path="/trainer/earnings" element={<Earnings />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/cohorts" element={<AdminCohorts />} />
          <Route path="/admin/exceptions" element={<Exceptions />} />
          <Route path="/admin/content" element={<ContentWorkflow />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
    </>
  )
}

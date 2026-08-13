import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import Home from './pages/Home'
import Diagnostic from './pages/Diagnostic'
import PathwayPage from './pages/Pathway'
import Verify from './pages/Verify'
import StaticPage from './pages/Static'
import StudentDashboard from './pages/student/Dashboard'
import MyPathway from './pages/student/MyPathway'
import CourseView from './pages/student/CourseView'
import Project from './pages/student/Project'
import Certificates from './pages/student/Certificates'
import AdvisorDashboard from './pages/advisor/AdvisorDashboard'
import Reviews from './pages/advisor/Reviews'
import StudentCard from './pages/advisor/StudentCard'
import TrainerDashboard from './pages/trainer/TrainerDashboard'
import GradingQueue from './pages/trainer/GradingQueue'
import CohortView from './pages/trainer/CohortView'
import Earnings from './pages/trainer/Earnings'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCohorts from './pages/admin/AdminCohorts'
import Exceptions from './pages/admin/Exceptions'
import ContentWorkflow from './pages/admin/ContentWorkflow'

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/diagnostic" element={<Diagnostic />} />
          <Route path="/pathways/:id" element={<PathwayPage />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/verify/:number" element={<Verify />} />
          <Route path="/p/:slug" element={<StaticPage />} />
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/pathway" element={<MyPathway />} />
          <Route path="/student/course/:courseId" element={<CourseView />} />
          <Route path="/student/project" element={<Project />} />
          <Route path="/student/certificates" element={<Certificates />} />
          <Route path="/advisor" element={<AdvisorDashboard />} />
          <Route path="/advisor/reviews" element={<Reviews />} />
          <Route path="/advisor/student/:id" element={<StudentCard />} />
          <Route path="/trainer" element={<TrainerDashboard />} />
          <Route path="/trainer/grading" element={<GradingQueue />} />
          <Route path="/trainer/cohort/:id" element={<CohortView />} />
          <Route path="/trainer/earnings" element={<Earnings />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/cohorts" element={<AdminCohorts />} />
          <Route path="/admin/exceptions" element={<Exceptions />} />
          <Route path="/admin/content" element={<ContentWorkflow />} />
        </Routes>
      </main>
    </>
  )
}

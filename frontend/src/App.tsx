import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthContext, useAuthState } from '@/hooks/useAuth';
import { Toaster } from '@/components/ui/toaster';
import { Navbar } from '@/components/layout/Navbar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Public pages
import LandingPage from '@/pages/LandingPage';
import RegisterPage from '@/pages/RegisterPage';
import QuizPage from '@/pages/QuizPage';
import ResultPage from '@/pages/ResultPage';
import SkillReportPage from '@/pages/SkillReportPage';
import SuccessPage from '@/pages/SuccessPage';

// Admin pages
import AdminLoginPage from '@/pages/admin/LoginPage';
import AdminDashboardPage from '@/pages/admin/DashboardPage';
import AdminStudentsPage from '@/pages/admin/StudentsPage';
import AdminLeadsPage from '@/pages/admin/LeadsPage';
import AdminDomainsPage from '@/pages/admin/DomainsPage';
import AdminQuestionsPage from '@/pages/admin/QuestionsPage';
import AdminAnalyticsPage from '@/pages/admin/AnalyticsPage';
import AdminSettingsPage from '@/pages/admin/SettingsPage';

// Public layout (Navbar)
function PublicLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </>
  );
}

// Quiz layout (no footer during quiz)
function QuizLayout() {
  return (
    <main>
      <Outlet />
    </main>
  );
}

function App() {
  const authState = useAuthState();

  return (
    <AuthContext.Provider value={authState}>
      <ErrorBoundary>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            {/* Admin Login & Aliases */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/damin" element={<Navigate to="/admin" replace />} />
            <Route path="/damin/*" element={<Navigate to="/admin" replace />} />

            {/* Student Portal routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/home" element={<LandingPage />} />
              <Route path="/assessment" element={<LandingPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/domains" element={<Navigate to="/" replace />} />
              <Route path="/report/:resultId" element={<SkillReportPage />} />
              <Route path="/bootcamp/register" element={<Navigate to="/success" replace />} />
              <Route path="/bootcamp/register/:bootcampId" element={<Navigate to="/success" replace />} />
              <Route path="/success" element={<SuccessPage />} />
            </Route>

            {/* Quiz & Result routes (no navbar / no footer) */}
            <Route element={<QuizLayout />}>
              <Route path="/quiz/:domainSlug" element={<QuizPage />} />
              <Route path="/result/:attemptId" element={<ResultPage />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminDashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/students" element={
              <ProtectedRoute requireAdmin>
                <AdminStudentsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/leads" element={<Navigate to="/admin/students" replace />} />
            <Route path="/admin/domains" element={
              <ProtectedRoute requireAdmin>
                <AdminDomainsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/questions" element={
              <ProtectedRoute requireAdmin>
                <AdminQuestionsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/campaigns" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/analytics" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/analytics/*" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/settings" element={
              <ProtectedRoute requireAdmin>
                <AdminSettingsPage />
              </ProtectedRoute>
            } />

            {/* 404 fallback */}
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-6xl font-display font-bold text-gray-900 mb-4">404</h1>
                  <p className="text-gray-500 mb-6">Page not found</p>
                  <a href="/" className="text-brand-600 hover:text-brand-700 font-medium">← Go Home</a>
                </div>
              </div>
            } />
          </Routes>

          <Toaster />
        </BrowserRouter>
      </ErrorBoundary>
    </AuthContext.Provider>
  );
}

export default App;

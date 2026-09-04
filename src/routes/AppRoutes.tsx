import { Routes, Route } from 'react-router-dom';

// Pages
import Index from '@/pages/Index';
import AdminLogin from '@/pages/AdminLogin';
  import StaffLogin from '@/pages/StaffLogin';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminCandidates from '@/pages/admin/AdminCandidates';
import AdminVoters from '@/pages/admin/AdminVoters';
import AdminResults from '@/pages/admin/AdminResults';
import AdminSettings from '@/pages/admin/AdminSettings';
import CandidateDetailPage from '@/pages/student/CandidateDetailPage';
import CandidateComparePage from '@/pages/student/CandidateComparePage';
import StudentResults from '@/pages/student/StudentResults';
import StudentAttendancePage from '@/pages/student/StudentAttendancePage';
import CandidateDashboard from '@/pages/candidate/CandidateDashboard';
import StaffDashboard from '@/pages/staff/StaffDashboard';
import NotFound from '@/pages/NotFound';
import VerifyVote from '@/pages/VerifyVote';

// Blockchain voting pages
import BlockchainStudentLogin from '@/pages/student/BlockchainStudentLogin';
import StudentRegister from '@/pages/student/StudentRegister';
import BlockchainVotingDashboard from '@/pages/student/BlockchainVotingDashboardWithWallet';

// Attendance pages
import AttendanceEventsPage from '@/pages/attendance/AttendanceEventsPage';
import AttendanceScannerPage from '@/pages/attendance/AttendanceScannerPage';

// Route protection
import ProtectedRoute from './ProtectedRoute';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Index />} />
      <Route path="/login/admin" element={<AdminLogin />} />
      <Route path="/login/student" element={<BlockchainStudentLogin />} />
      <Route path="/login/staff" element={<StaffLogin />} />
      <Route path="/student/login" element={<BlockchainStudentLogin />} />
      <Route path="/student/register" element={<StudentRegister />} />
      <Route path="/student/blockchain-voting" element={<BlockchainVotingDashboard />} />
      <Route path="/verify-vote" element={<VerifyVote />} />


      {/* Admin routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/candidates"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminCandidates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/voters"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminVoters />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/results"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminResults />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminSettings />
          </ProtectedRoute>
        }
      />
      {/* Student routes */}
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <BlockchainVotingDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/candidate/:id"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <CandidateDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/compare"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <CandidateComparePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/results"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentResults />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/attendance"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentAttendancePage />
          </ProtectedRoute>
        }
      />

      {/* Candidate routes */}
      <Route
        path="/candidate/dashboard"
        element={
          <ProtectedRoute allowedRoles={['candidate']}>
            <CandidateDashboard />
          </ProtectedRoute>
        }
      />

      {/* Staff routes */}
      <Route
        path="/staff/dashboard"
        element={
          <ProtectedRoute allowedRoles={['staff']}>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />

      {/* Attendance routes */}
      <Route
        path="/attendance"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AttendanceEventsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance/event/:eventId"
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <AttendanceScannerPage />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;

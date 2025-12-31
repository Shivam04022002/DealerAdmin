// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import PendingFiles from "./pages/PendingFiles";
import ApplicationView from "./pages/ApplicationView";
import ApprovedFiles from "./pages/ApprovedFiles";
import RejectedFiles from "./pages/RejectedFiles";
import ApprovedApplicationView from "./pages/ApprovedApplicationView";
import RejectedApplicationView from "./pages/RejectedApplicationView";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";


const App = () => {
  return (
    <Routes>
      {/*  Auth & Dashboard */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<Dashboard />} />

      {/*  Pending Applications */}
      <Route path="/pending" element={<PendingFiles />} />
      <Route path="/pending/:id" element={<ApplicationView />} />

      {/*  Application direct link (for universal navigation or older URLs) */}
      <Route path="/application/:id" element={<ApplicationView />} />

      {/*  Approved Applications */}
      <Route path="/approved" element={<ApprovedFiles />} />
      <Route path="/approved/:id" element={<ApprovedApplicationView />} />

      {/*  Rejected Applications */}
      <Route path="/rejected" element={<RejectedFiles />} />
      <Route path="/rejected/:id" element={<RejectedApplicationView />} />

      {/*  Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />

      <Route path="/superadmin-dashboard" element={<SuperAdminDashboard />} />
    </Routes>
  );
};

export default App;


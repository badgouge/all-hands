import { Navigate, Route, Routes } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import { AccountabilityProvider } from './app/state/AccountabilityProvider';
import { AuthenticatedLayout } from './presentation/components/AppShell';
import { AuditPage } from './presentation/pages/AuditPage';
import { DashboardPage } from './presentation/pages/DashboardPage';
import { FamilyAccountPage, FamilyHistoryPage, FamilyPage, FamilyPreparednessPage, FamilyReviewPage } from './presentation/pages/FamilyPages';
import { MusterHistoryPage, MusterPage } from './presentation/pages/MusterPages';
import { NotificationPage } from './presentation/pages/NotificationPage';
import { SnivDetailPage, SnivFormPage, SnivListPage } from './presentation/pages/SnivPages';
import { ApprovalsPage, RosterDetailPage, RosterPage, TeamPage } from './presentation/pages/TeamPages';

export default function App() {
  return (
    <AccountabilityProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/sign-in" element={<Navigate to="/accountability" replace />} />
          <Route element={<AuthenticatedLayout />}>
            <Route path="/" element={<Navigate to="/accountability" replace />} />
            <Route path="/accountability" element={<DashboardPage />} />
            <Route path="/muster" element={<MusterPage />} />
            <Route path="/muster/history" element={<MusterHistoryPage />} />
            <Route path="/family" element={<FamilyPage />} />
            <Route path="/family/account" element={<FamilyAccountPage />} />
            <Route path="/family/preparedness" element={<FamilyPreparednessPage />} />
            <Route path="/family/history" element={<FamilyHistoryPage />} />
            <Route path="/family/review" element={<FamilyReviewPage />} />
            <Route path="/requests" element={<SnivListPage />} />
            <Route path="/requests/new" element={<SnivFormPage />} />
            <Route path="/requests/:id/edit" element={<SnivFormPage />} />
            <Route path="/requests/:id" element={<SnivDetailPage />} />
            <Route path="/notifications" element={<NotificationPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/team/roster" element={<RosterPage />} />
            <Route path="/team/roster/:sailorId" element={<RosterDetailPage />} />
            <Route path="/team/approvals" element={<ApprovalsPage />} />
            <Route path="/audit/:entityType/:entityId" element={<AuditPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/accountability" replace />} />
        </Routes>
      </BrowserRouter>
    </AccountabilityProvider>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";

import { PageHeader } from "../components/layout/PageHeader.jsx";
import { AgentWorkspacePage } from "../features/agent-workspace/AgentWorkspacePage.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { ProtectedRoute } from "../features/auth/ProtectedRoute.jsx";
import { useSession } from "../features/auth/use-session.js";
import { SkillRegistryPage } from "../features/skill-registry/SkillRegistryPage.jsx";
import { SqlWorkbenchPage } from "../features/sql-workbench/SqlWorkbenchPage.jsx";

function RootRedirect() {
  const session = useSession();

  if (session.isPending) {
    return <PageHeader title="会话读取中" />;
  }

  if (session.isError || !session.data.authenticated) {
    return <Navigate replace to="/login" />;
  }

  return <Navigate replace to="/agent" />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<RootRedirect />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <ProtectedRoute>
            <AgentWorkspacePage />
          </ProtectedRoute>
        }
        path="/agent"
      />
      <Route
        element={
          <ProtectedRoute>
            <SkillRegistryPage />
          </ProtectedRoute>
        }
        path="/skills"
      />
      <Route
        element={
          <ProtectedRoute>
            <SqlWorkbenchPage />
          </ProtectedRoute>
        }
        path="/sql"
      />
      <Route element={<Navigate replace to="/login" />} path="*" />
    </Routes>
  );
}

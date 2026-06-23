import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell.jsx";
import { WorkspacePageFrame } from "../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../components/layout/WorkspaceStatusBar.jsx";
import { Card } from "../components/primitives/Card.jsx";
import { AgentWorkspacePage } from "../features/agent-workspace/AgentWorkspacePage.jsx";
import { AuditRecordsPage } from "../features/audit-records/AuditRecordsPage.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { OverviewPage } from "../features/overview/OverviewPage.jsx";
import { QuickLinksPage } from "../features/quick-links/QuickLinksPage.jsx";
import { RagQuestionPage } from "../features/rag-question/RagQuestionPage.jsx";
import { SkillRegistryPage } from "../features/skill-registry/SkillRegistryPage.jsx";
import { SqlWorkbenchPage } from "../features/sql-workbench/SqlWorkbenchPage.jsx";
import { WorkflowEventsPage } from "../features/workflow-events/WorkflowEventsPage.jsx";

/**
 * @param {{title: string, description: string}} props
 */
function ProtectedPlaceholder({ title, description }) {
  return (
    <AppShell>
      <WorkspacePageFrame>
        <WorkspaceStatusBar title={title} />
        <Card ariaLabel={`${title}内容`}>
          <h2>{title}入口</h2>
          <p>{description}</p>
          <p>当前页面只展示 P1 只读范围内的占位入口，后续任务再接入真实接口。</p>
        </Card>
      </WorkspacePageFrame>
    </AppShell>
  );
}

const legacyAgentViewRoutes = {
  audit: "/audit",
  overview: "/overview",
  rag: "/rag",
  workflow: "/workflow-events",
};

function AgentRoute() {
  const location = useLocation();
  const currentView = new URLSearchParams(location.search).get("view");

  if (currentView && Object.hasOwn(legacyAgentViewRoutes, currentView)) {
    return (
      <Navigate
        replace
        to={legacyAgentViewRoutes[/** @type {keyof typeof legacyAgentViewRoutes} */ (currentView)]}
      />
    );
  }

  return <AgentWorkspacePage />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/login" />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <AppShell>
            <OverviewPage />
          </AppShell>
        }
        path="/overview"
      />
      <Route
        element={
          <AppShell>
            <AgentRoute />
          </AppShell>
        }
        path="/agent"
      />
      <Route
        element={
          <AppShell>
            <RagQuestionPage />
          </AppShell>
        }
        path="/rag"
      />
      <Route
        element={
          <AppShell>
            <WorkflowEventsPage />
          </AppShell>
        }
        path="/workflow-events"
      />
      <Route
        element={
          <AppShell>
            <AuditRecordsPage />
          </AppShell>
        }
        path="/audit"
      />
      <Route
        element={
          <AppShell>
            <SkillRegistryPage />
          </AppShell>
        }
        path="/skills"
      />
      <Route
        element={
          <ProtectedPlaceholder
            description="会议录音、纪要总结和文件归档入口，后续接入受控接口。"
            title="会议录制纪要"
          />
        }
        path="/meeting-notes"
      />
      <Route
        element={
          <ProtectedPlaceholder
            description="AS400 JT400 DDL 快速改表与建表入口，受控变更阶段再接入审批和执行链路。"
            title="AS400改建表"
          />
        }
        path="/as400-ddl"
      />
      <Route
        element={
          <AppShell>
            <QuickLinksPage />
          </AppShell>
        }
        path="/quick-links"
      />
      <Route
        element={
          <AppShell>
            <SqlWorkbenchPage />
          </AppShell>
        }
        path="/sql"
      />
      <Route element={<Navigate replace to="/login" />} path="*" />
    </Routes>
  );
}

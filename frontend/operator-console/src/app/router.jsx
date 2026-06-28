import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { WorkspacePageFrame } from "../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../components/layout/WorkspaceStatusBar.jsx";
import { Card } from "../components/primitives/Card.jsx";
import { AgentWorkspacePage } from "../features/agent-workspace/AgentWorkspacePage.jsx";
import { AuditRecordsPage } from "../features/audit-records/AuditRecordsPage.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { MeetingDraftEditorPage } from "../features/meeting-notes/MeetingDraftEditorPage.jsx";
import { MeetingNoteDetailPage } from "../features/meeting-notes/MeetingNoteDetailPage.jsx";
import { MeetingNotesPage } from "../features/meeting-notes/MeetingNotesPage.jsx";
import { RecordingSettingsPage } from "../features/meeting-notes/RecordingSettingsPage.jsx";
import { RecordingWizardPage } from "../features/meeting-notes/RecordingWizardPage.jsx";
import { ModelSettingsPage } from "../features/model-settings/ModelSettingsPage.jsx";
import { ProtectedRoute } from "../features/auth/ProtectedRoute.jsx";
import { OverviewPage } from "../features/overview/OverviewPage.jsx";
import { QuickLinksPage } from "../features/quick-links/QuickLinksPage.jsx";
import { RagQuestionPage } from "../features/rag-question/RagQuestionPage.jsx";
import { SkillRegistryPage } from "../features/skill-registry/SkillRegistryPage.jsx";
import { SqlWorkbenchPage } from "../features/sql-workbench/SqlWorkbenchPage.jsx";
import { WorkflowEventsPage } from "../features/workflow-events/WorkflowEventsPage.jsx";

/**
 * 尚未接入真实后端能力的受保护占位页。
 *
 * 占位页仍必须放在 ProtectedRoute 内，避免未登录用户看到内部导航或误以为这些后续能力已经开放。
 *
 * @param {{title: string, description: string}} props
 */
function ProtectedPlaceholder({ title, description }) {
  return (
    <WorkspacePageFrame>
      <WorkspaceStatusBar title={title} />
      <Card ariaLabel={`${title}内容`}>
        <h2>{title}入口</h2>
        <p>{description}</p>
        <p>当前页面只展示 P1 只读范围内的占位入口，后续任务再接入真实接口。</p>
      </Card>
    </WorkspacePageFrame>
  );
}

const legacyAgentViewRoutes = {
  audit: "/audit",
  overview: "/overview",
  rag: "/rag",
  workflow: "/workflow-events",
};

/**
 * 兼容旧版 `/agent?view=...` 链接。
 *
 * 历史原型把多个工作区挂在 Agent 查询参数下；当前路由已拆成顶层页面，这里只做导航迁移，不承载权限判断。
 */
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

/**
 * 操作台顶层路由表。
 *
 * 除登录页外，所有工作区都必须经过 ProtectedRoute。前端只做会话门禁，具体 API 调用仍由控制面的认证、
 * 策略授权和审计过滤器作为唯一权限决策点。
 */
export function AppRouter() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/login" />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <ProtectedRoute>
            <OverviewPage />
          </ProtectedRoute>
        }
        path="/overview"
      />
      <Route
        element={
          <ProtectedRoute>
            <AgentRoute />
          </ProtectedRoute>
        }
        path="/agent"
      />
      <Route
        element={
          <ProtectedRoute>
            <RagQuestionPage />
          </ProtectedRoute>
        }
        path="/rag"
      />
      <Route
        element={
          <ProtectedRoute>
            <WorkflowEventsPage />
          </ProtectedRoute>
        }
        path="/workflow-events"
      />
      <Route
        element={
          <ProtectedRoute>
            <AuditRecordsPage />
          </ProtectedRoute>
        }
        path="/audit"
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
            <MeetingNotesPage />
          </ProtectedRoute>
        }
        path="/meeting-notes"
      />
      <Route
        element={
          <ProtectedRoute>
            <RecordingWizardPage />
          </ProtectedRoute>
        }
        path="/meeting-notes/record/new"
      />
      <Route
        element={
          <ProtectedRoute>
            <RecordingSettingsPage />
          </ProtectedRoute>
        }
        path="/meeting-notes/recording-settings"
      />
      <Route
        element={
          <ProtectedRoute>
            <MeetingDraftEditorPage />
          </ProtectedRoute>
        }
        path="/meeting-notes/:noteId/edit"
      />
      <Route
        element={
          <ProtectedRoute>
            <MeetingNoteDetailPage />
          </ProtectedRoute>
        }
        path="/meeting-notes/:noteId"
      />
      <Route
        element={
          <ProtectedRoute>
            <ProtectedPlaceholder
              description="AS400 JT400 DDL 快速改表与建表入口，受控变更阶段再接入审批和执行链路。"
              title="AS400改建表"
            />
          </ProtectedRoute>
        }
        path="/as400-ddl"
      />
      <Route
        element={
          <ProtectedRoute>
            <QuickLinksPage />
          </ProtectedRoute>
        }
        path="/quick-links"
      />
      <Route
        element={
          <ProtectedRoute>
            <SqlWorkbenchPage />
          </ProtectedRoute>
        }
        path="/sql"
      />
      <Route
        element={
          <ProtectedRoute>
            <ModelSettingsPage />
          </ProtectedRoute>
        }
        path="/model-settings"
      />
      <Route element={<Navigate replace to="/login" />} path="*" />
    </Routes>
  );
}

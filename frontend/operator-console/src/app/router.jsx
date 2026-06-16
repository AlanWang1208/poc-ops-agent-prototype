import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell.jsx";
import { PageHeader } from "../components/layout/PageHeader.jsx";
import { Card } from "../components/primitives/Card.jsx";
import { AgentWorkspacePage } from "../features/agent-workspace/AgentWorkspacePage.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { SqlWorkbenchPage } from "../features/sql-workbench/SqlWorkbenchPage.jsx";

/**
 * @param {{title: string, description: string}} props
 */
function ProtectedPlaceholder({ title, description }) {
  return (
    <AppShell>
      <PageHeader description={description} title={title} />
      <Card ariaLabel={`${title}内容`}>
        <p>页面将在后续任务中接入真实接口。</p>
      </Card>
    </AppShell>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/login" />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <AppShell>
            <AgentWorkspacePage />
          </AppShell>
        }
        path="/agent"
      />
      <Route
        element={
          <ProtectedPlaceholder
            description="浏览已注册并发布的只读 Skill。"
            title="Skill 注册中心"
          />
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
          <ProtectedPlaceholder
            description="集中放置常用系统、数据库、工单和运维工具快捷入口。"
            title="快捷连接"
          />
        }
        path="/quick-links"
      />
      <Route
        element={<SqlWorkbenchPage />}
        path="/sql"
      />
      <Route element={<Navigate replace to="/login" />} path="*" />
    </Routes>
  );
}

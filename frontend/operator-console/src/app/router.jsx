import { Navigate, Route, Routes } from "react-router-dom";

import { PageHeader } from "../components/layout/PageHeader.jsx";
import { Card } from "../components/primitives/Card.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { ProtectedRoute } from "../features/auth/ProtectedRoute.jsx";
import { useSession } from "../features/auth/use-session.js";

/**
 * @param {{title: string, description: string}} props
 */
function ProtectedPlaceholder({ title, description }) {
  return (
    <>
      <PageHeader description={description} title={title} />
      <Card ariaLabel={`${title}内容`}>
        <p>页面将在后续任务中接入真实接口。</p>
      </Card>
    </>
  );
}

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
            <ProtectedPlaceholder
              description="查看只读 Skill 候选与可审计计划摘要。"
              title="Agent 工作台"
            />
          </ProtectedRoute>
        }
        path="/agent"
      />
      <Route
        element={
          <ProtectedRoute>
            <ProtectedPlaceholder
              description="浏览已注册并发布的只读 Skill。"
              title="Skill 注册中心"
            />
          </ProtectedRoute>
        }
        path="/skills"
      />
      <Route
        element={
          <ProtectedRoute>
            <ProtectedPlaceholder
              description="校验开发与测试环境中的 SQL。"
              title="SQL 工作台"
            />
          </ProtectedRoute>
        }
        path="/sql"
      />
      <Route element={<Navigate replace to="/login" />} path="*" />
    </Routes>
  );
}

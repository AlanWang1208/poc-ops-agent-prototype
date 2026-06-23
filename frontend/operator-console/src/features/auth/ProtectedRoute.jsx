import { Navigate, useLocation } from "react-router-dom";

import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { AppShell } from "../../components/layout/AppShell.jsx";
import { useSession } from "./use-session.js";

/**
 * @typedef {object} ProtectedRouteProps
 * @property {import("react").ReactNode} children 通过浏览器会话校验后才渲染的受保护页面内容。
 */

/**
 * 受保护页面的统一入口。
 *
 * 该组件只负责读取控制面会话并决定是否跳转登录页，不在浏览器中计算业务授权。具体动作能否执行仍以服务端
 * M02 策略决策和审计链路为准，避免前端角色判断成为权限事实源。
 *
 * @param {ProtectedRouteProps} props
 */
export function ProtectedRoute({ children }) {
  const location = useLocation();
  const session = useSession();

  if (session.isPending) {
    return (
      <AppShell>
        <FeedbackState
          message="正在确认浏览器会话。"
          state="loading"
          title="会话校验中"
        />
      </AppShell>
    );
  }

  if (session.isError) {
    return (
      <AppShell>
        <FeedbackState
          message="控制面返回的会话契约无法被操作台安全解析。"
          state="error"
          title="会话状态暂不可用"
        />
      </AppShell>
    );
  }

  if (!session.data.authenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <AppShell session={session.data}>{children}</AppShell>;
}

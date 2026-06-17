import { Navigate, useLocation } from "react-router-dom";

import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { AppShell } from "../../components/layout/AppShell.jsx";
import { useSession } from "./use-session.js";

/**
 * @typedef {object} ProtectedRouteProps
 * @property {import("react").ReactNode} children
 */

/**
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


import { NavLink } from "react-router-dom";

import { getLogoutUrl } from "../../api/auth-api.js";
import styles from "./AppShell.module.css";

const navigation = [
  { label: "Agent 工作台", to: "/agent" },
  { label: "Skill 注册中心", to: "/skills" },
  { label: "SQL 工作台", to: "/sql" },
];

/**
 * @typedef {object} AppShellProps
 * @property {import("react").ReactNode} children
 * @property {import("../../schemas/auth-schemas.js").BrowserSession} [session]
 */

/**
 * @param {AppShellProps} props
 */
export function AppShell({ children, session }) {
  const username = session?.authenticated ? session.username : null;
  const initials = username ? username.slice(0, 2).toUpperCase() : "OP";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <NavLink aria-label="企业智能 Agent 首页" className={styles.brand} to="/agent">
          <span aria-hidden="true" className={styles.logo}>
            EA
          </span>
          <span>
            <strong>企业智能 Agent</strong>
            <small>Operator Console</small>
          </span>
        </NavLink>

        <nav aria-label="主导航" className={styles.nav}>
          {navigation.map((item, index) => (
            <NavLink
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
              key={item.to}
              to={item.to}
            >
              <span aria-hidden="true" className={styles.navIcon}>
                {String(index + 1).padStart(2, "0")}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.safety}>
            <span aria-hidden="true" className={styles.safetyIndicator} />
            <span>
              <strong>安全模式</strong>
              <small>P1 只读控制面</small>
            </span>
          </div>
          <div aria-label="当前会话" className={styles.session}>
            <span aria-hidden="true" className={styles.avatar}>
              {initials}
            </span>
            <span>
              <strong>{username ?? "当前会话"}</strong>
              <small>
                {username && session
                  ? `已认证：${session.authenticationType}`
                  : "会话信息将在登录后接入"}
              </small>
            </span>
          </div>
          {username ? (
            <a className={styles.logoutLink} href={getLogoutUrl()}>
              退出登录
            </a>
          ) : null}
        </div>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}

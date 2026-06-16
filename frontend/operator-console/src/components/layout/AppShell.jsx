import {
  Bot,
  Boxes,
  CircleDot,
  FileClock,
  Network,
  SearchCheck,
  Workflow,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import styles from "./AppShell.module.css";

const navigation = [
  {
    icon: CircleDot,
    label: "总览",
    tone: "accent",
    to: "/agent?view=overview",
    view: "overview",
  },
  { icon: Bot, label: "Agent 工作区", tone: "info", to: "/agent" },
  { icon: Network, label: "RAG 问答", tone: "teal", to: "/agent?view=rag", view: "rag" },
  { icon: SearchCheck, label: "诊断工作台", tone: "deep", to: "/sql" },
  { icon: Boxes, label: "Skill 注册中心", tone: "warning", to: "/skills" },
  { icon: Workflow, label: "工作流事件", tone: "green", to: "/agent?view=workflow", view: "workflow" },
  { icon: FileClock, label: "审计记录", tone: "slate", to: "/agent?view=audit", view: "audit" },
];

/**
 * @param {(typeof navigation)[number]} item
 * @param {ReturnType<typeof useLocation>} location
 * @param {string | null} currentView
 */
function isNavigationItemActive(item, location, currentView) {
  return item.view
    ? location.pathname === "/agent" && currentView === item.view
    : location.pathname === item.to && !currentView;
}

/**
 * @typedef {object} AppShellProps
 * @property {import("react").ReactNode} children
 */

/**
 * @param {AppShellProps} props
 */
export function AppShell({ children }) {
  const location = useLocation();
  const currentView = new URLSearchParams(location.search).get("view");

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <nav aria-label="主导航" className={styles.nav}>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = isNavigationItemActive(item, location, currentView);

            return (
              <Link
                className={`${styles.navLink} ${styles[`navTone${item.tone}`]} ${
                  isActive ? styles.active : ""
                }`}
                key={item.to}
                to={item.to}
              >
                <span aria-hidden="true" className={styles.navIcon}>
                  <span className={styles.navSymbol} />
                  <Icon className={styles.navGlyph} strokeWidth={2.25} />
                </span>
                {item.label}
                <span aria-hidden="true" className={styles.navPulse} />
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div aria-hidden="true" className={styles.sidebarPreview}>
            <span className={styles.sidebarPreviewOrbit}>
              {navigation.map((item) => {
                const isPreviewActive = isNavigationItemActive(item, location, currentView);

                return (
                  <span
                    className={`${styles.sidebarPreviewMenuNode} ${
                      styles[`navTone${item.tone}`]
                    } ${isPreviewActive ? styles.sidebarPreviewMenuNodeActive : ""}`}
                    key={`preview-${item.to}`}
                  />
                );
              })}
            </span>
            <span className={styles.sidebarPreviewCore} />
          </div>
          <div className={styles.sidebarSearch}>搜索服务 / 数据库 / 工单</div>
          <div className={styles.sidebarActions}>
            <button className={styles.safetyAction} type="button">
              安全模式
            </button>
            <button className={styles.sessionAction} type="button">
              新建任务
            </button>
          </div>
        </div>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}

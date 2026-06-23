import { ExternalLink, ShieldCheck, Workflow } from "lucide-react";

import { WorkspacePageFrame } from "../../components/layout/WorkspacePageFrame.jsx";
import { WorkspaceStatusBar } from "../../components/layout/WorkspaceStatusBar.jsx";
import styles from "./QuickLinksPage.module.css";

/**
 * 快捷连接禁用页。
 *
 * 外部系统跳转会产生可审计的目标系统访问意图，不能只靠前端链接开放。后端契约、服务端策略动作、
 * 参数校验和审计事件完成前，本页面只展示禁用状态，并且不请求尚未定稿的 Quick Links API。
 */
export function QuickLinksPage() {
  return (
    <WorkspacePageFrame className={styles.quickLinksCanvas}>
      <WorkspaceStatusBar title="快捷连接" />

      <main className={styles.workspaceBody}>
        <header className={styles.title}>
          <p className={styles.workspaceTitle}>快捷连接</p>
          <p>受控外部跳转能力未开放</p>
        </header>

        <section aria-label="快捷连接未开放" className={styles.disabledPanel}>
          <span aria-hidden="true" className={styles.disabledIcon}>
            <ExternalLink size={24} strokeWidth={2.3} />
          </span>
          <div className={styles.disabledContent}>
            <h2>能力未开放</h2>
            <p>后端契约、策略授权和审计链路完成前不会开放外部跳转。</p>
            <div className={styles.disabledList}>
              <span>
                <ShieldCheck aria-hidden="true" size={16} />
                需要版本化契约、服务端参数校验和策略动作。
              </span>
              <span>
                <Workflow aria-hidden="true" size={16} />
                启动动作必须记录审计事件和目标 URL hash。
              </span>
            </div>
          </div>
        </section>
      </main>
    </WorkspacePageFrame>
  );
}

import { Navigate } from "react-router-dom";

import { getLoginUrl } from "../../api/auth-api.js";
import { FeedbackState } from "../../components/feedback/FeedbackState.jsx";
import { useSession } from "./use-session.js";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const session = useSession();

  if (session.isPending) {
    return (
      <main className={styles.page}>
        <section className={styles.brandPanel}>
          <BrandHeader />
          <HeroCopy />
          <StatusStrip />
        </section>
        <section className={styles.loginPanel}>
          <div className={styles.loginCard}>
            <FeedbackState
              message="正在读取控制面浏览器会话。"
              state="loading"
              title="会话读取中"
            />
          </div>
        </section>
      </main>
    );
  }

  if (session.isError) {
    return (
      <main className={styles.page}>
        <section className={styles.brandPanel}>
          <BrandHeader />
          <HeroCopy />
          <StatusStrip />
        </section>
        <section className={styles.loginPanel}>
          <div className={styles.loginCard}>
            <div className={styles.feedback}>
              <FeedbackState
                message="控制面返回的会话契约无法被操作台安全解析。"
                state="error"
                title="会话状态暂不可用"
              />
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (session.data.authenticated) {
    return <Navigate replace to="/agent" />;
  }

  return (
    <main className={styles.page}>
      <section className={styles.brandPanel}>
        <BrandHeader />
        <HeroCopy />
        <StatusStrip />
      </section>
      <section aria-labelledby="login-title" className={styles.loginPanel}>
        <div className={styles.loginCard}>
          <span className="badge badge--info">P1 只读诊断 MVP</span>
          <h2 id="login-title">操作员登录</h2>
          <p>
            登录后可进入只读操作台，查看受控 Skill、候选路由和 SQL 校验结果。
            操作台只读取控制面返回的会话和策略状态。
          </p>
          <a className={styles.loginAction} href={getLoginUrl()}>
            使用控制面登录
          </a>
          <ul className={styles.boundaryList}>
            <li>浏览器不承载授权决策。</li>
            <li>生产写执行与任意脚本执行在 P1 保持关闭。</li>
            <li>所有外部响应必须通过契约校验后进入页面。</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function BrandHeader() {
  return (
    <div className={styles.brandMark}>
      <span aria-hidden="true" className={styles.brandIcon}>
        EA
      </span>
      <span>企业智能 Agent 开放底座</span>
    </div>
  );
}

function HeroCopy() {
  return (
    <div className={styles.hero}>
      <span className={styles.eyebrow}>Operator Console</span>
      <h1>只读运维控制面</h1>
      <p>
        面向内部运维团队的诊断入口。会话、策略、审计和执行事实均由服务端控制面提供，
        页面只呈现经过验证的状态。
      </p>
    </div>
  );
}

function StatusStrip() {
  return (
    <div className={styles.statusStrip} aria-label="安全边界">
      <div className={styles.statusCard}>
        <strong>身份</strong>
        <span>读取浏览器会话</span>
      </div>
      <div className={styles.statusCard}>
        <strong>策略</strong>
        <span>服务端唯一决策</span>
      </div>
      <div className={styles.statusCard}>
        <strong>执行</strong>
        <span>P1 只读诊断</span>
      </div>
    </div>
  );
}


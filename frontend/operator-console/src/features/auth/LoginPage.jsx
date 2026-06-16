import { redirectToLogin } from "../../api/auth-api.js";
import styles from "./LoginPage.module.css";

const safetyModes = ["P1 只读模式", "服务端策略授权", "全程审计留痕"];
const nodeIonSpecs = [
  { emphasis: "", path: "identityDot", route: "identity", size: "nodeIonSmall" },
  { emphasis: "", path: "policyDot", route: "policy", size: "nodeIonSmall" },
  { emphasis: "primary", path: "skillDot", route: "skill", size: "nodeIonPrimary" },
  { emphasis: "", path: "workerDot", route: "worker", size: "nodeIonSmall" },
];
const screenIonSpecs = [
  ["screenIonTiny", "screenIonBlue", "screenIonLaneOne"],
  ["screenIonSmall", "screenIonRed", "screenIonLaneTwo"],
  ["screenIonMedium", "screenIonGreen", "screenIonLaneThree"],
  ["screenIonTiny", "screenIonGold", "screenIonLaneFour"],
  ["screenIonSmall", "screenIonBlue", "screenIonLaneFive"],
  ["screenIonTiny", "screenIonGreen", "screenIonLaneSix"],
  ["screenIonMedium", "screenIonRed", "screenIonLaneSeven"],
  ["screenIonSmall", "screenIonGold", "screenIonLaneEight"],
  ["screenIonTiny", "screenIonBlue", "screenIonLaneNine"],
  ["screenIonSmall", "screenIonGreen", "screenIonLaneTen"],
  ["screenIonTiny", "screenIonRed", "screenIonLaneEleven"],
  ["screenIonMedium", "screenIonBlue", "screenIonLaneTwelve"],
  ["screenIonMedium", "screenIonBlue", "screenIonLaneThirteen", "screenIonGlow"],
  ["screenIonSmall", "screenIonRed", "screenIonLaneFourteen", "screenIonHalo"],
  ["screenIonTiny", "screenIonGreen", "screenIonLaneFifteen", "screenIonGlow"],
  ["screenIonSmall", "screenIonGold", "screenIonLaneSixteen", "screenIonHalo"],
];

/**
 * Latest prototype-driven login page.
 */
export function LoginPage() {
  return (
    <main className={styles.board}>
      <section className={styles.screen}>
        <div aria-hidden="true" className={styles.screenIonField}>
          {screenIonSpecs.map(([size, tone, lane, variant], index) => (
            <i
              aria-hidden="true"
              className={[
                styles.screenIon,
                styles[size],
                styles[tone],
                styles[lane],
                variant ? styles[variant] : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-screen-ion=""
              key={`${lane}-${index}`}
            />
          ))}
        </div>

        <div aria-hidden="true" className={styles.loginHeroEffect}>
          <div className={styles.effectOrbitOne} />
          <div className={styles.effectOrbitTwo} />
          <div className={styles.effectCore} />
          <div className={`${styles.taskCard} ${styles.taskCardCode}`}>
            <strong>研发排障</strong>
          </div>
          <div className={`${styles.taskCard} ${styles.taskCardDb}`}>
            <strong>DBA 巡检</strong>
          </div>
          <div className={`${styles.taskCard} ${styles.taskCardAlert}`}>
            <strong>告警分析</strong>
          </div>
          <div className={styles.capabilityFlow}>
            <span>提任务</span>
            <i />
            <span>选 Skill</span>
            <i />
            <span>执行</span>
            <i />
            <span>留痕</span>
          </div>
        </div>

        <div className={styles.loginShell}>
          <span aria-hidden="true" className={styles.frameIonTail} />
          <div className={styles.loginCopy}>
            <span className={styles.loginKicker}>SECURE OPERATOR ENTRY</span>
            <h1>企业智能运维工作台</h1>
            <p>
              面向研发、DBA 与运维团队，通过受控的只读诊断链路定位服务、数据库与基础设施问题。
            </p>
            <div aria-label="平台安全能力" className={styles.loginModeStrip}>
              {safetyModes.map((mode) => (
                <span key={mode}>{mode}</span>
              ))}
            </div>

            <div className={styles.opsVisual}>
              <div className={`${styles.agentCore} ${styles.opsAgentCore}`}>
                <span />
              </div>
              <div className={`${styles.opsNode} ${styles.identityNode}`}>
                <strong>Identity</strong>
                会话确权
              </div>
              <div className={`${styles.opsNode} ${styles.policyNode}`}>
                <strong>Policy</strong>
                服务端授权
              </div>
              <div className={`${styles.opsNode} ${styles.skillNode}`}>
                <strong>Skill</strong>
                只读候选
              </div>
              <div className={`${styles.opsNode} ${styles.workerNode}`}>
                <strong>Worker</strong>
                受限执行
              </div>
              {nodeIonSpecs.map(({ emphasis, path, route, size }) => (
                <i
                  aria-hidden="true"
                  className={`${styles.opsOrbitDot} ${styles[path]} ${styles[size]}`}
                  data-ion-emphasis={emphasis}
                  data-node-ion={route}
                  key={route}
                />
              ))}
              <div className={styles.opsCaption}>
                <strong>受控诊断链路</strong>
                Operator → Agent → Policy → Skill → Worker → Event Stream
              </div>
            </div>
          </div>

          <form className={styles.loginCard}>
            <h2>操作员登录</h2>
            <div className={styles.loginField}>
              <input
                className={styles.loginInput}
                id="operator-account"
                defaultValue="ops.reader@company.internal"
              />
            </div>
            <div className={styles.loginOptions}>
              <div className={styles.loginOption}>
                <span aria-hidden="true" className={styles.loginOptionIcon} />
                <span className={styles.loginOptionCopy}>
                  <strong>企业单点登录</strong>
                  <span>身份确认后，权限仍由服务端策略独立判定。</span>
                </span>
              </div>
            </div>
            <button
              className={`${styles.button} ${styles.loginButton} ${styles.primaryEntry}`}
              onClick={redirectToLogin}
              type="button"
            >
              <span className={styles.entryText}>使用企业 SSO 登录</span>
              <span aria-hidden="true" className={styles.entryPulse} />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

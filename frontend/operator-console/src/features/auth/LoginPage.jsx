import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, LockKeyhole, SearchCheck, ServerCog, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { loginWithPassword } from "../../api/auth-api.js";
import { ApiError } from "../../api/client.js";
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
 * 基于已批准原型实现的当前登录页。
 */
export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loginError, setLoginError] = useState("");
  const loginMutation = useMutation({
    mutationFn: loginWithPassword,
    onMutate: () => {
      setLoginError("");
    },
    onSuccess: async (result) => {
      if (result.passwordChangeRequired) {
        setLoginError("当前账号需要先完成密码修改。");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["browser-session"] });
      navigate("/overview", { replace: true });
    },
    onError: (error) => {
      setLoginError(readLoginErrorMessage(error));
    },
  });

  /**
   * @param {import("react").FormEvent<HTMLFormElement>} event
   */
  function handleSubmit(event) {
    event.preventDefault();
    loginMutation.mutate({
      username: username.trim(),
      password,
    });
  }

  const loginCardClassName = [
    styles.loginCard,
    loginError ? styles.loginCardWithError : "",
  ]
    .filter(Boolean)
    .join(" ");

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
        </div>

        <div className={styles.loginShell}>
          <div className={styles.loginCopy}>
            <span className={styles.loginKicker}>SECURE OPERATOR ENTRY</span>
            <h1>企业智能运维工作台</h1>
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
                <span
                  aria-hidden="true"
                  className={`${styles.nodeIcon} ${styles.identityIcon}`}
                  data-node-icon="identity"
                >
                  <ShieldCheck className={styles.nodeIconGlyph} size={28} strokeWidth={2.2} />
                </span>
                会话确权
              </div>
              <div className={`${styles.opsNode} ${styles.policyNode}`}>
                <span
                  aria-hidden="true"
                  className={`${styles.nodeIcon} ${styles.policyIcon}`}
                  data-node-icon="policy"
                >
                  <ServerCog className={styles.nodeIconGlyph} size={28} strokeWidth={2.2} />
                </span>
                服务端授权
              </div>
              <div className={`${styles.opsNode} ${styles.skillNode}`}>
                <span
                  aria-hidden="true"
                  className={`${styles.nodeIcon} ${styles.skillIcon}`}
                  data-node-icon="skill"
                >
                  <SearchCheck className={styles.nodeIconGlyph} size={28} strokeWidth={2.2} />
                </span>
                只读候选
              </div>
              <div className={`${styles.opsNode} ${styles.workerNode}`}>
                <span
                  aria-hidden="true"
                  className={`${styles.nodeIcon} ${styles.workerIcon}`}
                  data-node-icon="worker"
                >
                  <LockKeyhole className={styles.nodeIconGlyph} size={28} strokeWidth={2.2} />
                </span>
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

          <form className={loginCardClassName} onSubmit={handleSubmit}>
            <h2>用户登录</h2>
            {loginError ? (
              <p aria-label="登录失败" className={styles.loginError} role="alert">
                {loginError}
              </p>
            ) : null}
            <div className={styles.loginField}>
              <label className={styles.loginLabel} htmlFor="operator-account">
                用户名
              </label>
              <input
                aria-label="用户名"
                autoComplete="username"
                className={styles.loginInput}
                id="operator-account"
                onChange={(event) => setUsername(event.target.value)}
                required
                value={username}
              />
            </div>
            <div className={styles.loginField}>
              <label className={styles.loginLabel} htmlFor="operator-password">
                密码
              </label>
              <span className={styles.passwordInputShell}>
                <input
                  aria-label="密码"
                  autoComplete="current-password"
                  className={`${styles.loginInput} ${styles.passwordInput}`}
                  id="operator-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type={isPasswordVisible ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={isPasswordVisible ? "隐藏密码" : "显示密码"}
                  aria-pressed={isPasswordVisible}
                  className={styles.passwordToggle}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                  type="button"
                >
                  {isPasswordVisible ? (
                    <EyeOff aria-hidden="true" size={17} strokeWidth={2.3} />
                  ) : (
                    <Eye aria-hidden="true" size={17} strokeWidth={2.3} />
                  )}
                </button>
              </span>
            </div>
            <button
              className={`${styles.button} ${styles.loginButton} ${styles.primaryEntry}`}
              disabled={loginMutation.isPending}
              type="submit"
            >
              <span className={styles.entryText}>
                {loginMutation.isPending ? "登录中" : "登录"}
              </span>
              <span aria-hidden="true" className={styles.entryPulse} />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

/**
 * @param {unknown} error
 */
function readLoginErrorMessage(error) {
  if (error instanceof ApiError && error.status === 401) {
    return "用户名或密码不正确";
  }
  if (error instanceof ApiError && error.status === 423) {
    return "账号已被锁定，请联系管理员处理。";
  }
  if (error instanceof ApiError && [0, 502, 503, 504].includes(error.status)) {
    return "控制面服务暂时不可用，请确认后端服务已启动后再重试。";
  }
  if (error instanceof ApiError && [404, 405].includes(error.status)) {
    return "当前后端没有启用账号密码登录，请用 built-in 模式启动控制面。";
  }
  if (error instanceof ApiError && error.status >= 500) {
    return "控制面登录接口出错，请查看后端日志后再重试。";
  }
  if (error instanceof ApiError && error.kind === "contract") {
    return "登录响应格式不一致，请检查前后端版本是否匹配。";
  }
  return "登录失败，请检查用户名、密码和后端服务状态。";
}

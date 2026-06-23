# M07 Worker Transport Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 P1 控制面到独立 Worker 的只读执行调用增加可自动化验证的应用层签名认证。

**Architecture:** 在 contracts 模块放置共享签名头常量和 canonical payload/HMAC 工具，控制面 `WebClientWorkerGateway` 按配置注入签名头，Worker Controller 在进入执行器前验证签名。Worker 非回环绑定且未启用认证时启动失败，生产隔离细节由 ADR 和运行手册承接。

**Tech Stack:** Java 21、Spring Boot WebFlux、Maven 多模块、JUnit 5、WebTestClient、HMAC-SHA256。

---

### Task 1: 共享签名契约

**Files:**
- Create: `backend/contracts/src/main/java/com/company/opsagent/contracts/workflow/WorkerTransportHeaders.java`
- Create: `backend/contracts/src/main/java/com/company/opsagent/contracts/workflow/WorkerRequestSignature.java`
- Create: `backend/contracts/src/test/java/com/company/opsagent/contracts/WorkerRequestSignatureTest.java`

- [ ] **Step 1: Write the failing tests**

新增测试断言：

- 相同请求、Key ID 和时间戳生成相同 canonical payload 与签名。
- 修改参数 JSON 后签名发生变化。
- 缺少密钥时签名方法抛出 `IllegalArgumentException`。

- [ ] **Step 2: Run tests to verify failure**

Run: `.\mvnw.cmd -pl contracts -Dtest=WorkerRequestSignatureTest test`

Expected: compilation fails because `WorkerRequestSignature` does not exist.

- [ ] **Step 3: Implement shared contract helpers**

实现：

- `WorkerTransportHeaders` 只包含三个 header 常量。
- `WorkerRequestSignature.canonicalPayload(...)` 返回版本化、换行分隔 payload。
- `WorkerRequestSignature.sign(...)` 返回 Base64 HMAC-SHA256。
- `WorkerRequestSignature.matches(...)` 使用常量时间比较。

- [ ] **Step 4: Run tests to verify pass**

Run: `.\mvnw.cmd -pl contracts -Dtest=WorkerRequestSignatureTest test`

Expected: PASS.

### Task 2: Worker HTTP 边界验签

**Files:**
- Create: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerTransportAuthProperties.java`
- Create: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerTransportAuthenticator.java`
- Modify: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/ExecutionWorkerConfiguration.java`
- Modify: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerExecutionController.java`
- Modify: `backend/execution-worker/src/main/resources/application.yaml`
- Modify: `backend/execution-worker/src/test/java/com/company/opsagent/executionworker/WorkerExecutionControllerTest.java`

- [ ] **Step 1: Write failing HTTP boundary tests**

在 `WorkerExecutionControllerTest` 中启用 `ops-agent.worker.transport-auth.enabled=true`，增加：

- 合法签名请求返回 `200`。
- 无签名请求返回 `401`。
- 错误签名返回 `401`。
- 时间戳超出 `max-clock-skew` 返回 `401`。

- [ ] **Step 2: Run tests to verify failure**

Run: `.\mvnw.cmd -pl execution-worker -Dtest=WorkerExecutionControllerTest test`

Expected: compilation or assertion failure because Worker has no auth support.

- [ ] **Step 3: Implement authenticator**

实现：

- `WorkerTransportAuthProperties` 使用 `@ConfigurationProperties("ops-agent.worker.transport-auth")`。
- `WorkerTransportAuthenticator.authenticate(...)` 在禁用时放行，在启用时校验 header、Key ID、时间漂移和签名。
- `WorkerExecutionController` 接收 `@RequestHeader HttpHeaders` 并在执行前调用 authenticator。
- 认证失败抛出 `ResponseStatusException(HttpStatus.UNAUTHORIZED, ...)`。

- [ ] **Step 4: Run focused tests**

Run: `.\mvnw.cmd -pl execution-worker -Dtest=WorkerExecutionControllerTest test`

Expected: PASS.

### Task 3: 非回环绑定启动保护

**Files:**
- Create: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/WorkerBindingSafetyGuard.java`
- Create: `backend/execution-worker/src/test/java/com/company/opsagent/executionworker/WorkerBindingSafetyGuardTest.java`
- Modify: `backend/execution-worker/src/main/java/com/company/opsagent/executionworker/ExecutionWorkerConfiguration.java`

- [ ] **Step 1: Write failing guard tests**

断言：

- `127.0.0.1` 且认证禁用允许启动。
- `localhost` 且认证禁用允许启动。
- `0.0.0.0` 且认证禁用拒绝启动。
- `0.0.0.0` 且认证启用允许启动。

- [ ] **Step 2: Run tests to verify failure**

Run: `.\mvnw.cmd -pl execution-worker -Dtest=WorkerBindingSafetyGuardTest test`

Expected: compilation fails because guard does not exist.

- [ ] **Step 3: Implement guard**

实现一个 `ApplicationRunner` 或小型 guard bean，读取 `server.address` 与认证配置；非回环且未启用认证时抛出 `IllegalStateException`。

- [ ] **Step 4: Run focused tests**

Run: `.\mvnw.cmd -pl execution-worker -Dtest=WorkerBindingSafetyGuardTest test`

Expected: PASS.

### Task 4: 控制面签名头注入

**Files:**
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/config/WorkerProperties.java`
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/config/WorkflowConfiguration.java`
- Modify: `backend/control-plane/bootstrap/src/main/java/com/company/opsagent/controlplane/bootstrap/service/WebClientWorkerGateway.java`
- Create: `backend/control-plane/bootstrap/src/test/java/com/company/opsagent/controlplane/bootstrap/service/WebClientWorkerGatewayTest.java`

- [ ] **Step 1: Write failing gateway test**

用本地 mock HTTP server 或 `ExchangeFunction` 捕获请求，断言启用认证时存在三个签名 header，禁用时不发送签名 header。

- [ ] **Step 2: Run test to verify failure**

Run: `.\mvnw.cmd -pl control-plane/bootstrap -Dtest=WebClientWorkerGatewayTest test`

Expected: compilation or assertion failure because gateway has no signing support.

- [ ] **Step 3: Implement signing injection**

扩展 `WorkerProperties`，新增 `transportAuth` 嵌套配置；`WebClientWorkerGateway` 在启用时使用共享签名工具生成当前时间戳和签名头。

- [ ] **Step 4: Run focused test**

Run: `.\mvnw.cmd -pl control-plane/bootstrap -Dtest=WebClientWorkerGatewayTest test`

Expected: PASS.

### Task 5: ADR、运行手册和进度事实源

**Files:**
- Create: `docs/adr/0008-m07-worker-transport-auth-and-deployment-isolation.md`
- Create: `docs/runbooks/m07-worker-transport-auth.md`
- Modify: `backend/execution-worker/README.md`
- Modify: `docs/standards/p1-threat-model.md`
- Modify: `docs/planning/project-plan.md`
- Modify: `docs/planning/p1-read-only-vertical-slice-evidence.md`

- [ ] **Step 1: Document decision**

ADR 记录应用层签名是 P1 最小传输认证，不替代 mTLS、私有网络、服务账号、短期凭据和 Windows 隔离。

- [ ] **Step 2: Document operations**

运行手册记录配置、启用顺序、时间同步、密钥轮换、失败排障和回滚。

- [ ] **Step 3: Update progress**

项目计划中 M07 进度提高，剩余条件改为 mTLS/网络出口/短期凭据/部署隔离演练。

### Task 6: Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused module tests**

Run:

```powershell
.\mvnw.cmd -pl contracts,execution-worker,control-plane/bootstrap -Dtest=WorkerRequestSignatureTest,WorkerExecutionControllerTest,WorkerBindingSafetyGuardTest,WebClientWorkerGatewayTest test
```

- [ ] **Step 2: Run backend verify**

Run:

```powershell
.\mvnw.cmd -f .\pom.xml -B -ntp verify
```

- [ ] **Step 3: Run repository checks**

Run:

```powershell
git diff --check
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\ci\check-repository.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\ci\check-contracts.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\ci\scan-secrets.ps1
```

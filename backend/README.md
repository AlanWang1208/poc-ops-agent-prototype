# 后端

本目录保存后端相关内容：

- `pom.xml`、`.mvn/`、`mvnw`、`mvnw.cmd`：Maven 多模块构建根
- `control-plane/`：控制面聚合模块与业务子模块
- `execution-worker/`：独立 Worker 模块
- `execution-worker-sqlworkbench/`：SQL 工作台 Worker 侧受限执行适配模块，作为同一 Worker 部署的运行时依赖加载
- `contracts/`：共享 API、事件、Skill 和工作流契约
- `skills/`：运维 Skill 定义与测试素材
- `deploy/`：部署与运维配置

本地构建命令：

```powershell
.\mvnw.cmd -f .\pom.xml -B -ntp verify
```

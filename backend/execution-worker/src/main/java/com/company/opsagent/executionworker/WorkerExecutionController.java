package com.company.opsagent.executionworker;

import com.company.opsagent.contracts.workflow.WorkerExecutionRequest;
import com.company.opsagent.contracts.workflow.WorkerExecutionResult;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/**
 * 独立 Worker 的只读执行入口。
 *
 * <p>P1 开发配置仅绑定回环地址；生产传输认证和网络出口策略必须在部署 ADR 后落地。
 */
@RestController
@RequestMapping("/internal/executions")
public class WorkerExecutionController {

  private final RestrictedReadOnlyExecutionWorker worker;
  private final WorkerTransportAuthenticator authenticator;

  public WorkerExecutionController(
      RestrictedReadOnlyExecutionWorker worker,
      WorkerTransportAuthenticator authenticator) {
    this.worker = worker;
    this.authenticator = authenticator;
  }

  /**
   * 接收已授权、带版本且短期有效的只读执行请求。
   */
  @PostMapping("/read-only")
  public Mono<WorkerExecutionResult> execute(
      @RequestHeader HttpHeaders headers,
      @RequestBody WorkerExecutionRequest request) {
    return Mono.fromSupplier(() -> {
      authenticator.authenticate(headers, request);
      return worker.execute(request);
    });
  }
}

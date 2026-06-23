package com.company.opsagent.contracts.workflow;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Worker 执行请求的应用层传输签名工具。
 *
 * <p>该工具只负责跨控制面和 Worker 共享的 canonical payload 与 HMAC 计算规则，不负责授权决策。
 */
public final class WorkerRequestSignature {

  private static final String SIGNATURE_VERSION = "ops-agent-worker-signature-v1";
  private static final String HMAC_ALGORITHM = "HmacSHA256";

  private WorkerRequestSignature() {
  }

  /**
   * 构造版本化 canonical payload。
   *
   * <p>payload 绑定请求核心字段与参数摘要，使签名能够覆盖执行请求身份、生命周期和主要执行内容。
   */
  public static String canonicalPayload(String keyId, String timestamp, WorkerExecutionRequest request) {
    requireText(keyId, "keyId");
    requireText(timestamp, "timestamp");
    if (request == null) {
      throw new IllegalArgumentException("request is required");
    }
    ReadOnlyCommandEnvelope command = request.command();
    SkillReference skill = command.skill();
    OperatorContext operator = command.operator();
    PolicyDecisionReference policyDecision = command.policyDecision();
    TraceContext trace = command.trace();
    return String.join("\n",
        SIGNATURE_VERSION,
        keyId,
        timestamp,
        request.contractVersion(),
        request.executionRequestId(),
        request.authorizedAt().toString(),
        request.expiresAt().toString(),
        command.contractVersion(),
        command.commandId(),
        command.workflowId(),
        command.idempotencyKey(),
        command.operationClass(),
        command.targetEnvironment(),
        skill.skillId(),
        skill.version(),
        skill.parameterSchemaId(),
        skill.outputSchemaId(),
        operator.operatorId(),
        String.join(",", operator.roles()),
        policyDecision.decisionId(),
        policyDecision.policyVersion(),
        policyDecision.decision(),
        trace.traceId(),
        trace.requestId(),
        sha256Hex(command.parameters().toString()));
  }

  /**
   * 使用 HMAC-SHA256 对 canonical payload 签名，返回 Base64 字符串。
   */
  public static String sign(String sharedSecret, String canonicalPayload) {
    requireText(sharedSecret, "sharedSecret");
    requireText(canonicalPayload, "canonicalPayload");
    try {
      Mac mac = Mac.getInstance(HMAC_ALGORITHM);
      mac.init(new SecretKeySpec(sharedSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
      return Base64.getEncoder().encodeToString(mac.doFinal(canonicalPayload.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception exception) {
      throw new IllegalStateException("failed to sign worker request", exception);
    }
  }

  /**
   * 常量时间比较签名，避免通过比较耗时泄露签名细节。
   */
  public static boolean matches(String expected, String actual) {
    if (expected == null || actual == null) {
      return false;
    }
    return MessageDigest.isEqual(
        expected.getBytes(StandardCharsets.UTF_8),
        actual.getBytes(StandardCharsets.UTF_8));
  }

  private static String sha256Hex(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder builder = new StringBuilder(bytes.length * 2);
      for (byte current : bytes) {
        builder.append(String.format("%02x", current));
      }
      return builder.toString();
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is not available", exception);
    }
  }

  private static void requireText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
  }
}

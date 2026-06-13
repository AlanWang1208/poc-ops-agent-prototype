package com.company.opsagent.controlplane.modules.identity;

import java.util.List;

/**
 * 系统内部统一的操作人身份模型。
 *
 * @param subject 身份主体唯一标识，通常来自 JWT `sub`
 * @param username 便于展示和审计的用户名
 * @param roles 经过标准化处理后的角色列表
 */
public record OperatorIdentity(
    String subject,
    String username,
    List<String> roles) {

  /**
   * 防御性复制角色列表，避免外部修改内部状态。
   */
  public OperatorIdentity {
    roles = List.copyOf(roles);
  }
}

package com.company.opsagent.controlplane.bootstrap.api;

import java.util.List;

/**
 * 浏览器登录会话信息响应模型。
 *
 * @param authenticated 当前浏览器是否已完成登录
 * @param subject 当前登录主体标识
 * @param username 当前登录用户名
 * @param roles 当前登录角色列表
 * @param authenticationType 当前认证类型说明
 */
public record BrowserSessionResponse(
    boolean authenticated,
    String subject,
    String username,
    List<String> roles,
    String authenticationType) {
}

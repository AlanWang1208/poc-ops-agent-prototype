package com.company.opsagent.controlplane.modules.identity;

/**
 * Team Workspace 的 POC 默认值。
 *
 * <p>在正式管理接口落地前，系统使用默认工作空间承载既有只读诊断链路。
 */
public final class TeamWorkspaceConstants {

  public static final String DEFAULT_WORKSPACE_ID = "workspace-default";
  public static final String DEFAULT_WORKSPACE_CODE = "default";
  public static final String DEFAULT_WORKSPACE_NAME = "默认工作空间";

  private TeamWorkspaceConstants() {
  }
}

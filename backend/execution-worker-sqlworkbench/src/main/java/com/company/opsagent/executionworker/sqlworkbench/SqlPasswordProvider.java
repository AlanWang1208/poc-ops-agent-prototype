package com.company.opsagent.executionworker.sqlworkbench;

/**
 * Worker 根据受控凭据别名读取数据库密码的边界。
 */
public interface SqlPasswordProvider {

  char[] password(String credentialAlias);
}

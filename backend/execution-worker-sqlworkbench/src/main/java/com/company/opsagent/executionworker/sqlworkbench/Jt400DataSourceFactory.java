package com.company.opsagent.executionworker.sqlworkbench;

import com.ibm.as400.access.AS400JDBCDataSource;
import javax.sql.DataSource;

/**
 * Db2 for i 的 JTOpen JDBC 数据源工厂。
 *
 * <p>调用方必须从受控 KeyStore 解锁凭据，不得把密码写入配置或日志。
 */
public class Jt400DataSourceFactory {

  public DataSource create(String systemName, String username, char[] password) {
    AS400JDBCDataSource dataSource = new AS400JDBCDataSource(systemName);
    dataSource.setUser(username);
    dataSource.setPassword(new String(password));
    return dataSource;
  }
}

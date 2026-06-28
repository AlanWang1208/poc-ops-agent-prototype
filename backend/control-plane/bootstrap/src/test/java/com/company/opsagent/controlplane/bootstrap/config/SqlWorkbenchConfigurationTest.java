package com.company.opsagent.controlplane.bootstrap.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SqlWorkbenchConfigurationTest {

  @Test
  void defaultSqlConnectionCatalogStartsEmpty() {
    SqlWorkbenchConfiguration configuration = new SqlWorkbenchConfiguration();

    assertTrue(configuration.sqlConnectionCatalog().list().isEmpty());
  }
}

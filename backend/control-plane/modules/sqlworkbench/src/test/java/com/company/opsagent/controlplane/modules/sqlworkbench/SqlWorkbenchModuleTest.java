package com.company.opsagent.controlplane.modules.sqlworkbench;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class SqlWorkbenchModuleTest {

  @Test
  void belongsToOperatorConsoleModule() {
    assertEquals("M09", SqlWorkbenchModule.moduleId());
  }
}

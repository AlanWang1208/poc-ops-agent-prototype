package com.company.opsagent.executionworker;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.company.opsagent.contracts.sqlworkbench.SqlResultColumn;
import com.company.opsagent.contracts.sqlworkbench.SqlResultPage;
import com.fasterxml.jackson.databind.node.TextNode;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class InMemorySqlResultStoreTest {

  @Test
  void removesExpiredResults() {
    Clock clock = Clock.fixed(Instant.parse("2026-06-12T00:00:00Z"), ZoneOffset.UTC);
    InMemorySqlResultStore store = new InMemorySqlResultStore(clock);
    store.save(new SqlResultPage(
        "1.0",
        "result-1",
        List.of(new SqlResultColumn("STATUS", "VARCHAR", false)),
        List.of(List.of(TextNode.valueOf("READY"))),
        null,
        false,
        OffsetDateTime.now(clock).minusSeconds(1)));

    assertTrue(store.find("result-1").isEmpty());
  }
}

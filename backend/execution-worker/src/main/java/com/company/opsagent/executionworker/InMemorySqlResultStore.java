package com.company.opsagent.executionworker;

import com.company.opsagent.contracts.sqlworkbench.SqlResultPage;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * P1 开发切片的短期结果存储；过期结果读取时自动删除。
 */
public class InMemorySqlResultStore implements SqlResultStore {

  private final ConcurrentMap<String, SqlResultPage> pages = new ConcurrentHashMap<>();
  private final Clock clock;

  public InMemorySqlResultStore(Clock clock) {
    this.clock = clock;
  }

  @Override
  public void save(SqlResultPage page) {
    pages.put(page.resultId(), page);
  }

  @Override
  public Optional<SqlResultPage> find(String resultId) {
    SqlResultPage page = pages.get(resultId);
    if (page == null) {
      return Optional.empty();
    }
    if (!page.expiresAt().isAfter(OffsetDateTime.now(clock))) {
      pages.remove(resultId, page);
      return Optional.empty();
    }
    return Optional.of(page);
  }
}

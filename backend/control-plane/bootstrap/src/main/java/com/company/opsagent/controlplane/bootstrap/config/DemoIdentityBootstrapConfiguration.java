package com.company.opsagent.controlplane.bootstrap.config;

import com.company.opsagent.controlplane.modules.identity.domain.Account;
import com.company.opsagent.controlplane.modules.identity.domain.AccountStatus;
import com.company.opsagent.controlplane.modules.identity.domain.MfaRequirement;
import com.company.opsagent.controlplane.modules.identity.domain.PasswordState;
import com.company.opsagent.controlplane.modules.identity.infrastructure.AccountRepository;
import com.company.opsagent.controlplane.modules.identity.infrastructure.PasswordCredentialRepository;
import com.company.opsagent.controlplane.modules.identity.infrastructure.PasswordHasher;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.r2dbc.core.DatabaseClient;

/**
 * Demo-only identity seed for local walkthroughs.
 */
@Configuration
@Profile("demo")
@EnableConfigurationProperties(DemoIdentityBootstrapConfiguration.DemoIdentitySeedProperties.class)
public class DemoIdentityBootstrapConfiguration {

  private static final String DEMO_ACCOUNT_ID = "demo-admin";

  @Bean
  @ConditionalOnProperty(
      prefix = "ops-agent.demo.identity-seed",
      name = "enabled",
      havingValue = "true")
  public ApplicationRunner demoIdentitySeedRunner(
      DemoIdentitySeedProperties properties,
      AccountRepository accountRepository,
      PasswordCredentialRepository passwordCredentialRepository,
      PasswordHasher passwordHasher,
      DatabaseClient databaseClient,
      Clock builtInIdentityClock) {
    return args -> {
      if (!properties.enabled() || accountRepository.findByUsername(properties.username()).isPresent()) {
        return;
      }
      accountRepository.save(new Account(
          DEMO_ACCOUNT_ID,
          properties.username(),
          AccountStatus.ACTIVE,
          PasswordState.ACTIVE,
          MfaRequirement.NOT_REQUIRED,
          List.of(),
          0,
          null));
      seedRoles(databaseClient, DEMO_ACCOUNT_ID, properties.roles(), builtInIdentityClock);
      passwordCredentialRepository.save(passwordHasher.hash(
          DEMO_ACCOUNT_ID,
          properties.password(),
          1L,
          false));
    };
  }

  private void seedRoles(
      DatabaseClient databaseClient,
      String accountId,
      List<String> roles,
      Clock clock) {
    OffsetDateTime now = OffsetDateTime.now(clock);
    for (String role : roles) {
      databaseClient.sql("""
              insert into identity_account_role_grant (
                grant_id,
                account_id,
                role_code,
                grant_source,
                effective_from,
                created_by,
                created_at
              ) values (
                :grantId,
                :accountId,
                :roleCode,
                'DEMO_SEED',
                :effectiveFrom,
                'demo-profile',
                :createdAt
              )
              """)
          .bind("grantId", "demo-admin-" + role)
          .bind("accountId", accountId)
          .bind("roleCode", role)
          .bind("effectiveFrom", now.minusMinutes(1))
          .bind("createdAt", now)
          .fetch()
          .rowsUpdated()
          .block();
    }
  }

  @ConfigurationProperties(prefix = "ops-agent.demo.identity-seed")
  public record DemoIdentitySeedProperties(
      boolean enabled,
      String username,
      String password,
      List<String> roles) {

    public DemoIdentitySeedProperties {
      username = requireText(username, "username");
      password = requireText(password, "password");
      roles = distinctRoles(roles);
    }

    private static String requireText(String value, String name) {
      if (value == null || value.isBlank()) {
        throw new IllegalArgumentException("demo identity seed " + name + " must not be blank");
      }
      return value;
    }

    private static List<String> distinctRoles(List<String> roles) {
      if (roles == null || roles.isEmpty()) {
        return List.of();
      }
      List<String> normalizedRoles = new ArrayList<>();
      for (String role : new LinkedHashSet<>(roles)) {
        if (role != null && !role.isBlank()) {
          normalizedRoles.add(role);
        }
      }
      return List.copyOf(normalizedRoles);
    }
  }
}

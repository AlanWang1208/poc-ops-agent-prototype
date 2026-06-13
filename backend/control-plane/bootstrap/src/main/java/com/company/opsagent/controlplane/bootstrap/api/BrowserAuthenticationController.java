package com.company.opsagent.controlplane.bootstrap.api;

import com.company.opsagent.contracts.identity.PasswordChangeRequest;
import com.company.opsagent.contracts.identity.PasswordLoginRequest;
import com.company.opsagent.contracts.identity.PasswordLoginResponse;
import com.company.opsagent.controlplane.bootstrap.config.BuiltInIdentityProperties;
import com.company.opsagent.controlplane.bootstrap.config.SecurityProperties;
import com.company.opsagent.controlplane.bootstrap.security.AuthenticatedPrincipalOperatorIdentityResolver;
import com.company.opsagent.controlplane.modules.identity.OperatorIdentity;
import com.company.opsagent.controlplane.modules.identity.api.IdentityAuthenticationService;
import com.company.opsagent.controlplane.modules.identity.api.IdentityPasswordManagementService;
import com.company.opsagent.controlplane.modules.identity.api.IdentitySessionManagementService;
import com.company.opsagent.controlplane.modules.identity.api.IdentitySessionQueryService;
import com.company.opsagent.controlplane.modules.identity.application.IdentityAuthenticationResult;
import com.company.opsagent.controlplane.modules.identity.application.PasswordChangeCommand;
import com.company.opsagent.controlplane.modules.identity.application.PasswordLoginCommand;
import java.net.URI;
import java.security.Principal;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * 浏览器登录、会话查询、改密与退出入口。
 */
@RestController
@RequestMapping("/auth")
public class BrowserAuthenticationController {

  private final SecurityProperties securityProperties;
  private final BuiltInIdentityProperties builtInIdentityProperties;
  private final AuthenticatedPrincipalOperatorIdentityResolver identityResolver;
  private final IdentityAuthenticationService identityAuthenticationService;
  private final IdentitySessionQueryService identitySessionQueryService;
  private final IdentityPasswordManagementService identityPasswordManagementService;
  private final IdentitySessionManagementService identitySessionManagementService;

  public BrowserAuthenticationController(
      SecurityProperties securityProperties,
      ObjectProvider<BuiltInIdentityProperties> builtInIdentityPropertiesProvider,
      AuthenticatedPrincipalOperatorIdentityResolver identityResolver,
      ObjectProvider<IdentityAuthenticationService> identityAuthenticationServiceProvider,
      ObjectProvider<IdentitySessionQueryService> identitySessionQueryServiceProvider,
      ObjectProvider<IdentityPasswordManagementService> identityPasswordManagementServiceProvider,
      ObjectProvider<IdentitySessionManagementService> identitySessionManagementServiceProvider) {
    this.securityProperties = securityProperties;
    this.builtInIdentityProperties = builtInIdentityPropertiesProvider.getIfAvailable(BuiltInIdentityProperties::new);
    this.identityResolver = identityResolver;
    this.identityAuthenticationService = identityAuthenticationServiceProvider.getIfAvailable();
    this.identitySessionQueryService = identitySessionQueryServiceProvider.getIfAvailable();
    this.identityPasswordManagementService = identityPasswordManagementServiceProvider.getIfAvailable();
    this.identitySessionManagementService = identitySessionManagementServiceProvider.getIfAvailable();
  }

  @GetMapping("/login")
  public Mono<ResponseEntity<Void>> login() {
    if (isBuiltInMode()) {
      return Mono.just(ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).build());
    }
    if (!securityProperties.browserLoginEnabled()) {
      return Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
    return Mono.just(ResponseEntity.status(HttpStatus.FOUND)
        .location(URI.create("/oauth2/authorization/" + registrationId()))
        .build());
  }

  @PostMapping("/login")
  public Mono<ResponseEntity<PasswordLoginResponse>> passwordLogin(@RequestBody PasswordLoginRequest request) {
    if (!isBuiltInMode() || identityAuthenticationService == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
    return Mono.fromCallable(() -> identityAuthenticationService.authenticate(
            new PasswordLoginCommand(request.username(), request.password())))
        .subscribeOn(Schedulers.boundedElastic())
        .map(result -> ResponseEntity.ok()
            .header("Set-Cookie", sessionCookie(requiredSessionId(result)).toString())
            .body(new PasswordLoginResponse(
                true,
                result.identity().subject(),
                result.identity().username(),
                result.identity().roles(),
                result.passwordChangeRequired())));
  }

  @GetMapping("/session")
  public Mono<ResponseEntity<BrowserSessionResponse>> session(ServerWebExchange exchange) {
    if (isBuiltInMode() && identitySessionQueryService != null) {
      return Mono.justOrEmpty(readBuiltInSessionId(exchange))
          .flatMap(sessionId -> Mono.fromCallable(() -> identitySessionQueryService.findSessionStatusBySessionId(sessionId))
              .subscribeOn(Schedulers.boundedElastic())
              .flatMap(Mono::justOrEmpty))
          .map(status -> ResponseEntity.ok(new BrowserSessionResponse(
              true,
              status.identity().subject(),
              status.identity().username(),
              status.identity().roles(),
              status.authenticationType())))
          .defaultIfEmpty(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
              .body(new BrowserSessionResponse(false, null, null, List.of(), "anonymous")));
    }
    return identityResolver.resolve(exchange)
        .zipWith(exchange.getPrincipal().cast(Principal.class))
        .map(tuple -> ResponseEntity.ok(toResponse(tuple.getT1(), tuple.getT2())))
        .defaultIfEmpty(ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(new BrowserSessionResponse(false, null, null, List.of(), "anonymous")));
  }

  @GetMapping("/logout")
  public Mono<ResponseEntity<Void>> logout(ServerWebExchange exchange) {
    if (isBuiltInMode()) {
      Mono<Void> revoke = Mono.empty();
      String sessionId = readBuiltInSessionId(exchange).orElse(null);
      if (sessionId != null && identitySessionManagementService != null) {
        revoke = Mono.fromRunnable(() -> identitySessionManagementService.logout(sessionId))
            .subscribeOn(Schedulers.boundedElastic())
            .then();
      }
      return revoke.thenReturn(ResponseEntity.status(HttpStatus.FOUND)
          .header("Set-Cookie", expiredSessionCookie().toString())
          .location(URI.create("/"))
          .build());
    }
    return Mono.just(ResponseEntity.status(HttpStatus.FOUND)
        .location(URI.create("/logout"))
        .build());
  }

  @PostMapping("/password")
  public Mono<ResponseEntity<PasswordLoginResponse>> changePassword(
      ServerWebExchange exchange,
      @RequestBody PasswordChangeRequest request) {
    if (!isBuiltInMode() || identityPasswordManagementService == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
    String sessionId = readBuiltInSessionId(exchange).orElse(null);
    if (sessionId == null) {
      return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }
    return Mono.fromCallable(() -> identityPasswordManagementService.changePassword(
            sessionId,
            new PasswordChangeCommand(request.currentPassword(), request.newPassword())))
        .subscribeOn(Schedulers.boundedElastic())
        .map(result -> ResponseEntity.ok()
            .header("Set-Cookie", sessionCookie(requiredSessionId(result)).toString())
            .body(new PasswordLoginResponse(
                true,
                result.identity().subject(),
                result.identity().username(),
                result.identity().roles(),
                result.passwordChangeRequired())));
  }

  private BrowserSessionResponse toResponse(OperatorIdentity identity, Principal principal) {
    return new BrowserSessionResponse(
        true,
        identity.subject(),
        identity.username(),
        identity.roles(),
        principal.getClass().getSimpleName());
  }

  private String registrationId() {
    String configured = securityProperties.browserRegistrationId();
    return configured == null || configured.isBlank() ? "ops-agent" : configured;
  }

  private boolean isBuiltInMode() {
    return "built-in".equalsIgnoreCase(securityProperties.authMode());
  }

  private Optional<String> readBuiltInSessionId(ServerWebExchange exchange) {
    var cookie = exchange.getRequest().getCookies().getFirst(builtInIdentityProperties.getSessionCookieName());
    if (cookie == null || cookie.getValue() == null || cookie.getValue().isBlank()) {
      return Optional.empty();
    }
    return Optional.of(cookie.getValue());
  }

  private ResponseCookie sessionCookie(String sessionId) {
    return ResponseCookie.from(builtInIdentityProperties.getSessionCookieName(), sessionId)
        .httpOnly(true)
        .path("/")
        .secure(builtInIdentityProperties.isSessionCookieSecure())
        .sameSite(builtInIdentityProperties.getSessionCookieSameSite())
        .maxAge(resolveCookieMaxAge())
        .build();
  }

  private ResponseCookie expiredSessionCookie() {
    return ResponseCookie.from(builtInIdentityProperties.getSessionCookieName(), "")
        .httpOnly(true)
        .path("/")
        .secure(builtInIdentityProperties.isSessionCookieSecure())
        .sameSite(builtInIdentityProperties.getSessionCookieSameSite())
        .maxAge(Duration.ZERO)
        .build();
  }

  private String requiredSessionId(IdentityAuthenticationResult result) {
    if (result.sessionId() == null || result.sessionId().isBlank()) {
      throw new IllegalStateException("built-in authentication result is missing session id");
    }
    return result.sessionId();
  }

  private Duration resolveCookieMaxAge() {
    Duration configured = builtInIdentityProperties.getSessionCookieMaxAge();
    return configured == null || configured.isNegative() ? Duration.ofHours(8) : configured;
  }
}

---
tier: 2
load_when: ["webdesk-growth-dashboard", "backend-active", "code-production", "scaffold"]
description: "NestJS adaptation of the base skill's Express-shaped examples — controller/service/repository mapping, middleware order, validation pipes wired to shared Zod schemas, exception filters, and cold-start-aware bootstrap for Vercel Functions."
---

# 03 — NestJS on Vercel

> NestJS is a schema-anticipated alternative (`_contracts/project-json.schema.json` `tech_stack.framework` enum includes `nest`), not an unlisted framework. This file translates the base skill's Express-shaped worked examples into their Nest equivalents, and covers the one thing neither the base skill nor a generic Nest guide addresses: running Nest inside Vercel Functions rather than a persistent process.

---

## Layering — unchanged rule, Nest-native mechanism

| Base-skill rule                                              | Express shape (`nodejs/knowledge/01-coding-standards.md`) | NestJS shape (same rule)                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controllers HTTP-only, no business logic                     | Express route handler                                     | `@Controller()` class — Nest's own convention already separates controllers from providers, making this _easier_ to hold than in Express                                                                                                                                                                                                                                        |
| Business logic in services, no `req`/`res`                   | plain service module                                      | `@Injectable()` service, injected via Nest's DI container                                                                                                                                                                                                                                                                                                                       |
| Repository-only DB access (NODE-003, FG-004)                 | `repositories/*.js`                                       | Nest repository provider wrapping a `packages/database` Sequelize model; injected the same way as any other provider                                                                                                                                                                                                                                                            |
| Validate all external input at the boundary (NODE-005)       | `zod.parse()` in the controller                           | `ValidationPipe` wired to the **same Zod schemas** from `packages/validation` (via a Zod-aware pipe, e.g. wrapping `schema.safeParse()` in a custom `PipeTransform`) — never a parallel `class-validator` DTO                                                                                                                                                                   |
| Centralized error handling, typed errors (NODE-006/007)      | 4-arg Express middleware, mounted last                    | Nest exception filters (`@Catch()` + a global `APP_FILTER` provider)                                                                                                                                                                                                                                                                                                            |
| Middleware order incl. raw-body-before-JSON for webhook HMAC | explicit `app.use()` ordering                             | Nest middleware/guards/interceptors execution order — **the raw-body-before-parsing requirement still applies** for any GitHub webhook route (`integrations/github/`); configure Nest's raw-body option (`rawBody: true` in `NestFactory.create`, or a route-specific raw-body middleware) so the signature is verified over the exact bytes received, not a re-serialized body |
| Health endpoints                                             | `app.get('/healthz', ...)`                                | Nest controller equivalent, same liveness/readiness/dependencies three-tier split (`08_API_and_Integration_Contracts.md §12`: `/health/live`, `/health/ready`, `/health/dependencies`)                                                                                                                                                                                          |

Architecture-fitness enforcement (no DB access outside repositories) applies to `apps/dashboard-api`'s Nest module graph exactly as it would to an Express app — dependency-cruiser doesn't care which framework wires the routes, only which files import Sequelize models.

---

## Validation: one schema, two consumers

`packages/validation` is the single Zod schema source (`knowledge/02-turborepo-boundaries.md`). NestJS pipes validate against these schemas directly:

```ts
// packages/validation/src/schemas/create-user.schema.ts
export const CreateUserSchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid(),
});

// apps/dashboard-api/src/lib/zod-validation.pipe.ts
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new UnprocessableEntityException(result.error.flatten());
    return result.data;
  }
}

// apps/dashboard-api/src/controllers/user.controller.ts
@Post()
@UsePipes(new ZodValidationPipe(CreateUserSchema))
createUser(@Body() body: z.infer<typeof CreateUserSchema>) { ... }
```

This keeps `dashboard-web`'s `React Hook Form + zodResolver` client-side validation and `dashboard-api`'s server-side validation on exactly the same schema (`nodejs/knowledge/frontend/01-react-next-standards.md`'s dual-validation pattern, extended to a third consumer per `docs/implementation/architecture-validation.md` §8).

---

## Cold-start and bootstrap on Vercel Functions

Nest's dependency-injection container bootstraps its full module graph on application start. On a persistent process, this cost is paid once. On Vercel Functions, a cold-started invocation pays it **per cold start** — this is the one place where the execution model genuinely changes the engineering, not just the deployment mechanics.

Mitigations to apply, in order of impact:

1. **Cache the Nest application instance across invocations** within the same Function execution context (module-level singleton, not re-created per request) — Vercel Functions can reuse a warm execution context between invocations; a naive `NestFactory.create()` call inside the request handler defeats this.
2. **Keep `apps/dashboard-api`'s module graph as flat and small as practical** — avoid importing unrelated feature modules into every request path; Nest's lazy-loading module support can defer module instantiation for routes that aren't hit on every cold start.
3. **Database connection pooling must be serverless-aware** — a Sequelize connection pool sized for a persistent process (e.g., `pool: { max: 10 }`) is wrong for a Functions model, where many concurrent cold starts can each try to open a pool. Use a Vercel/Postgres-provider-recommended pooling approach (e.g., a connection pooler in front of Postgres, or a serverless-specific Sequelize pool configuration with a small `max` and short `idle`) — the exact mechanism depends on which Vercel Marketplace Postgres provider is selected (`knowledge/01-approved-architecture.md` §"Database"), so this is finalized once that provider is chosen, not guessed now.
4. **Config validation still fails fast** (`nodejs/knowledge/security/03-secrets-and-config.md`'s `requireEnv` pattern) — just evaluated once per cold start rather than once per process lifetime; the fail-fast _behavior_ (missing required env → immediate error, not a runtime surprise) is unchanged.

---

## What does not carry over from the base skill's persistent-process guidance

`nodejs/knowledge/backend/01-runtime-and-frameworks.md`'s graceful-shutdown sequence ("stop scheduler, drain queue workers, close DB pool, then exit" on `SIGTERM`/`SIGINT`) **does not apply to `apps/dashboard-api` running as Vercel Functions** — there is no long-lived process to signal, and no in-flight-request draining to perform beyond what the platform already does per-invocation. Do not port this shutdown-sequence code into the Nest bootstrap; it has no Vercel Functions equivalent and would be dead code. The equivalent operational concern (don't lose in-flight work) is handled entirely by the job-execution model in `knowledge/04-serverless-queues-workflows-and-cron.md` — idempotency and durable job state substitute for graceful-shutdown draining in this architecture.

---

## What this file does not cover

- The job/queue/worker execution model itself (this file covers only the request-serving API app) → `knowledge/04-serverless-queues-workflows-and-cron.md`.
- GitHub webhook signature verification specifics → `integrations/github/`.

# AGENTS.md — arcana-cloud-nodejs

Instructions for any AI coding agent (Claude Code, Codex, Cursor, Copilot, Gemini…) working
in this repository **or in any product created from it**. `CLAUDE.md`, `GEMINI.md` and
`.github/copilot-instructions.md` all point here; this file is the single source.

> **You MUST NOT report a task as done until `tools/arch-check.sh` exits 0 and the CI lane
> (§5) is green.** Breaking the layering costs a red build: the pre-commit hook
> (`tools/githooks/pre-commit`) rejects new files outside the layer directories and `*Impl`
> imports outside the DI container, and Jenkins stage "Architecture Qube" fails the merge
> below score 90.

## 0. First command in a fresh clone

Run `tools/install-hooks.sh` once. Git does not install hooks on clone; until you run it the
pre-commit check does not exist and only CI catches a flat layout — after the work is
written. `tools/new-app.sh` runs it for you.

## 1. Starting something new

| Situation | Do this | Never do this |
|---|---|---|
| New service product | `tools/new-app.sh <name> <dest-dir>` — copies the whole repo, renames the npm package, image, Jenkins/Sonar/CI container, kind cluster and database names, resets the version, installs the hook | `npm init` and copy a few `src/` folders into it |
| New business feature (entity + CRUD API) | `tools/new-feature.sh <Name>` — one vertical slice: model, Prisma model, DAO contract + Prisma impl, repository interface + impl, service interface + impl, zod schemas, controller, TOKENS + Inversify bindings, route, unit tests | Put Prisma calls in a controller, or add `src/foo.ts` |
| Feature in layered / microservice deployment | After `new-feature.sh`, mirror the User feature by hand: add methods to `src/communication/interfaces.ts` and its `impl/{direct,http,grpc}.impl.ts`, the proto in `src/grpc/protos/`, handlers in `src/grpc/grpc-server.ts`; then the controller calls `ServiceCommunication` instead of the service token | Call a DAO or Prisma from the gRPC server |

Copying parts instead of `new-app.sh` loses this file, the hook and the CI gate, so nothing
tells the next agent the rules exist.

## 2. Layers — where a file goes

Naming trap: `src/repositories/` (plural) holds the **DAO** layer; `src/repository/`
(singular) holds the **repository** layer. Keep it that way — the DI tokens say which is
which (`TOKENS.UserDao` vs `TOKENS.UserRepository`).

| Layer | Path | Contains | May depend on |
|---|---|---|---|
| Entry + DI | `src/index.ts`, `src/app.ts`, `src/di/container.ts`, `src/di/tokens.ts`, `src/di/index.ts` | startup, Express app + route mounting, Inversify bindings, `TOKENS` symbols | everything; `src/di/container.ts` is the only file that imports `*Impl` classes |
| Controller (boundary) | `src/controllers/<x>.controller.ts`, `src/middleware/`, `src/schemas/<x>.schema.ts` | Express routers: auth/validation middleware → call service (or `ServiceCommunication`) → `successResponse` / `paginatedResponse`; zod request schemas | service interfaces via `resolve(TOKENS.X)`, `communication/interfaces.ts`, models, schemas, utils |
| Communication | `src/communication/interfaces.ts` + `impl/{direct,http,grpc}.impl.ts`, `factory.ts`; `src/grpc/grpc-server.ts`, `src/grpc/protos/` | deployment-mode bridge (monolithic / layered / microservices) used by the User and Auth controllers | service and repository interfaces, models |
| Service | interface `src/services/<x>.service.interface.ts`; impl `src/services/impl/<x>.service.impl.ts` | business rules, validation, events | repository interfaces (`src/repository/`), models, events, utils |
| Repository | interface `src/repository/<x>.repository.ts` (extends `base.repository.ts`); impl `src/repository/impl/<x>.repository.impl.ts` | domain data access, coordinates DAOs | DAO interfaces, models |
| DAO | contract `src/repositories/<x>.repository.interface.ts` (re-exported as `src/dao/<x>.dao.ts`); Prisma impl `src/repositories/impl/<x>.repository.impl.ts`; schema `prisma/schema.prisma` | one Prisma model per impl | `PrismaClient`, models |
| Model | `src/models/<x>.model.ts` | entity interfaces, enums, `Create…Data` / `Update…Data`, public views (`UserPublic`) | nothing in `src/` |
| Cross-cutting | `src/events/`, `src/tasks/`, `src/utils/`, `src/types/`, `src/config.ts` | event bus/store, BullMQ jobs, logger/exceptions/responses, env config | models, utils |

Direction is one way: controller → service → repository → DAO → Prisma. A lower layer never
imports a higher one. There is no separate DTO/mapper layer: request shapes are zod schemas,
response shapes are model interfaces (strip secrets in the service, as `UserServiceImpl`
does with `UserPublic`). `src/container.ts` is a deprecated re-export shim — do not extend it.

## 3. Rules

| # | Rule | Enforced by |
|---|---|---|
| R1 | Every service, repository and DAO is an interface implemented by an `@injectable()` `XServiceImpl` / `XRepositoryImpl` class in an `impl/` directory next to it, with `@inject(TOKENS.X)` constructor parameters typed as the interface. | arch-qube "Interface/Impl Colocation", "Implementation Naming Convention" |
| R2 | Only `src/di/container.ts` imports a concrete `*Impl` class or anything from an `impl/` directory. Everyone else depends on the interface and resolves by `TOKENS`. `export … from` re-exports in `index.ts` and tests are the only other allowed mentions. | arch-qube "Only DI Container Imports Impl"; pre-commit hook |
| R3 | Controllers call services (or `ServiceCommunication`) only; services call repositories only; only DAOs (`src/repositories/impl/`) touch `PrismaClient`. Transactions live in services. | arch-qube "Backend Layer Chain", "Controller Cannot Use DAO", "Service Cannot Access DB Directly", "Repository Cannot Call Service", "Transaction at Service Layer Only", "Layer Direction Enforcement" |
| R4 | A route handler only extracts, delegates and wraps; validation is a zod schema via `validateSchema`, errors go to `next(error)` as `APIException` subclasses from `src/utils/exceptions.ts`. | arch-qube "No Business Logic in Boundary" |
| R5 | Every new binding gets a symbol in `src/di/tokens.ts` and is bound in **both** `createContainer()` and `resetContainer()` in `src/di/container.ts`. | `tests/unit/di/container*.test.ts`; `new-feature.sh` does it |
| R6 | No new file directly under `src/` and none outside the layer directories of §2. | pre-commit hook |
| R7 | Every new DAO, repository, service and controller has a vitest test under `tests/` that runs without a database (mocked Prisma / interface fakes, as `new-feature.sh` generates). DB tests go in `tests/database/` (excluded from the CI unit lane). | arch-qube "Test Coverage Threshold"; SonarQube quality gate (Jenkins stage "SonarQube Analysis") |
| R8 | ES modules: relative imports end in `.js`. Schema changes go in `prisma/schema.prisma`, followed by `npx prisma generate`. | `tsc` in the CI image build (Jenkins stage "Docker Compose Build") |

## 4. Architecture check (arch-qube)

arch-qube (https://github.com/jrjohn/arcana-arch-qube) scans the source for layer-direction,
DI and naming violations and scores it; usage guide:
https://github.com/jrjohn/arcana-skills/tree/main/arch-qube-skill. The version is pinned in
`tools/arch-qube.version`, read by both `tools/arch-check.sh` and the Jenkinsfile.

- Run: `tools/arch-check.sh` — Docker image `arcana.boo/arcana/arch-qube:<version>`, same
  `--framework nodejs`, `--threshold 90` and exclusions as Jenkins stage "Architecture Qube".
  Exit 0 = pass, 1 = fail, 2 = could not run (no Docker / image) — 2 is **not** a pass.
- Without Docker: `pipx install "git+https://github.com/jrjohn/arcana-arch-qube@v0.5.5"`
  then, on a tree without `node_modules/` and `dist/`,
  `arch-qube scan . --framework nodejs --no-ai --ci --format json,markdown -o arch-qube-reports --threshold 90`.
- Report: `arch-qube-reports/arch-qube.md` (summary) and `arch-qube.json` (per rule:
  `files_checked`, violations). Read it rule by rule: the score alone is not enough. A rule
  under "Not evaluated" is not a pass for a layer you touched; a rule with `files_checked: 0`
  checked nothing; an unlayered project scores 0 on "Layer Direction Enforcement".
- False positive: open an issue on arcana-arch-qube with the report attached. Never lower
  `--threshold`, add exclusions, or move code to dodge a rule.

## 5. Before you say "done"

Run these, in this order, and paste the last line of each into your summary:

```bash
tools/arch-check.sh                                    # must print "arch-check: PASS"
npx prisma generate && npx tsc --noEmit                # the typecheck the CI image build (tsc --build) runs
npx vitest run --coverage                              # Jenkins "Unit Tests" (docker-compose.test.yml)
npm run lint                                           # eslint; not a CI stage, keep it clean anyway
```

Without a local Node toolchain, run the identical lanes in Docker:
`docker compose -f docker-compose.test.yml run --build --rm test` (tests) and
`docker compose -f docker-compose.ci.yml build` (compile). CI also runs the layered-HTTP,
layered-gRPC and kind integration stages, which you cannot run locally.

## 6. Reference

- Optional detail: `arcana-nodejs-developer-skill`
  (https://github.com/jrjohn/arcana-skills/tree/main/arcana-nodejs-developer-skill).
  This file is the source of truth: if the skill and this file disagree, this file wins.

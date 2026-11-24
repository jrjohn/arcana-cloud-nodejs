#!/usr/bin/env bash
# Generate ONE vertical feature slice the way the template's User feature is built:
#
#   model (src/models) → Prisma model (prisma/schema.prisma)
#   → DAO contract (src/repositories/<x>.repository.interface.ts, re-exported by src/dao/)
#     + Prisma DAO impl (src/repositories/impl/)
#   → repository interface (src/repository/) + impl (src/repository/impl/)
#   → service interface (src/services/) + impl (src/services/impl/)
#   → zod schemas (src/schemas/) → Express controller (src/controllers/)
#   → TOKENS + Inversify bindings (src/di/) + route in src/app.ts
#   + vitest unit tests for DAO, repository, service and controller.
#
#   tools/new-feature.sh Invoice            # PascalCase, singular
#   tools/new-feature.sh PurchaseOrder
#
# Fields: the slice starts with `name` + `description`. Add fields afterwards in the order
# prisma model → model interfaces → zod schema → tests (tsc walks you through the rest).
# The slice is monolithic: the controller resolves the service by its TOKENS symbol. Exposing
# it through the deployment-mode communication layer (layered / microservices) is a manual step
# (AGENTS.md §1): mirror the User feature in src/communication/ and src/grpc/.
set -euo pipefail

[ $# -eq 1 ] || { echo "usage: $0 <FeatureName>   (PascalCase, singular, e.g. Invoice)" >&2; exit 1; }
P="$1"
[[ "$P" =~ ^[A-Z][a-zA-Z0-9]*$ ]] || { echo "FeatureName must be PascalCase (e.g. Invoice, PurchaseOrder)" >&2; exit 1; }
c="$(printf '%s' "$P" | perl -pe 's/^([A-Z])/lc($1)/e')"                          # purchaseOrder
k="$(printf '%s' "$P" | perl -pe 's/(?<=[a-z0-9])([A-Z])/-$1/g; $_=lc')"            # purchase-order
TABLE="$(printf '%s' "$k" | tr '-' '_')s"                                           # purchase_orders
URL="${k}s"                                                                         # purchase-orders
case "$k" in user|auth|health|public|o-auth-token|audit-log) echo "'$P' collides with a template feature" >&2; exit 1 ;; esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

for f in src/di/tokens.ts src/di/container.ts src/app.ts src/controllers/index.ts src/models/index.ts \
         prisma/schema.prisma src/repository/base.repository.ts src/repositories/user.repository.interface.ts; do
    [ -f "$f" ] || { echo "new-feature: anchor file $f missing — template layout changed, slice NOT generated" >&2; exit 1; }
done
[ ! -e "src/services/${k}.service.interface.ts" ] || { echo "feature '$P' already exists (src/services/${k}.service.interface.ts)" >&2; exit 1; }

render() {
    mkdir -p "$(dirname "$1")"
    sed -e "s/__P__/$P/g" -e "s/__c__/$c/g" -e "s/__k__/$k/g" -e "s/__TABLE__/$TABLE/g" -e "s/__URL__/$URL/g" > "$1"
    echo "  + $1"
}
# insert_after <file> <perl-regex anchor> <text>: fails loudly when the anchor is missing,
# so a template change breaks this script instead of silently skipping a registration.
insert_after() {
    local f="$1" anchor="$2" text="$3"
    ANCHOR="$anchor" TEXT="$text" perl -0777 -i -pe '
        BEGIN { $n = 0 }
        $n += s/($ENV{ANCHOR})/$1$ENV{TEXT}/s;
        END { exit($n ? 0 : 3) }' "$f" \
        || { echo "new-feature: anchor not found in $f: $anchor — registration NOT done" >&2; exit 1; }
    echo "  ~ $f"
}

echo "new-feature: $P (files ${k}.*, table ${TABLE}, route /api/v1/${URL})"

# ---------------------------------------------------------------- model
render "src/models/${k}.model.ts" <<'EOT'
export interface __P__ {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Create__P__Data {
  name: string;
  description?: string;
}

export interface Update__P__Data {
  name?: string;
  description?: string;
}
EOT
insert_after src/models/index.ts "export \\* from './user\\.model\\.js';\\n" "export * from './${k}.model.js';
"

# ---------------------------------------------------------------- prisma model
cat >> prisma/schema.prisma <<EOT

model ${P} {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(255)
  description String?  @db.Text
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("${TABLE}")
}
EOT
echo "  ~ prisma/schema.prisma"

# ---------------------------------------------------------------- DAO contract + Prisma impl
render "src/repositories/${k}.repository.interface.ts" <<'EOT'
import { __P__, Create__P__Data, Update__P__Data } from '../models/__k__.model.js';
import { PaginationParams, PaginatedResult } from './user.repository.interface.js';

/** DAO contract for __P__ persistence (bound to TOKENS.__P__Dao). */
export interface I__P__Repository {
  create(data: Create__P__Data): Promise<__P__>;
  getById(id: number): Promise<__P__ | null>;
  update(id: number, data: Update__P__Data): Promise<__P__>;
  delete(id: number): Promise<boolean>;
  getAll(params: PaginationParams): Promise<PaginatedResult<__P__>>;
  getCount(): Promise<number>;
}
EOT
render "src/dao/${k}.dao.ts" <<'EOT'
/**
 * __P__Dao — DAO layer interface for __c__ persistence.
 * The Prisma-backed implementation lives in repositories/impl/.
 */
export type { I__P__Repository } from '../repositories/__k__.repository.interface.js';
EOT
render "src/repositories/impl/${k}.repository.impl.ts" <<'EOT'
import { PrismaClient } from '@prisma/client';
import { injectable, inject } from 'inversify';
import { I__P__Repository } from '../__k__.repository.interface.js';
import { PaginationParams, PaginatedResult } from '../user.repository.interface.js';
import { __P__, Create__P__Data, Update__P__Data } from '../../models/__k__.model.js';
import { TOKENS } from '../../di/tokens.js';

@injectable()
export class __P__RepositoryImpl implements I__P__Repository {
  constructor(@inject(TOKENS.PrismaClient) private readonly prisma: PrismaClient) {}

  async create(data: Create__P__Data): Promise<__P__> {
    return this.prisma.__c__.create({
      data: { name: data.name, description: data.description }
    }) as unknown as __P__;
  }

  async getById(id: number): Promise<__P__ | null> {
    return this.prisma.__c__.findUnique({ where: { id } }) as unknown as __P__ | null;
  }

  async update(id: number, data: Update__P__Data): Promise<__P__> {
    return this.prisma.__c__.update({ where: { id }, data }) as unknown as __P__;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.__c__.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async getAll(params: PaginationParams): Promise<PaginatedResult<__P__>> {
    const { page, perPage } = params;
    const [items, total] = await Promise.all([
      this.prisma.__c__.findMany({ skip: (page - 1) * perPage, take: perPage, orderBy: { id: 'asc' } }),
      this.prisma.__c__.count()
    ]);
    return {
      items: items as unknown as __P__[],
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
    };
  }

  async getCount(): Promise<number> {
    return this.prisma.__c__.count();
  }
}
EOT

# ---------------------------------------------------------------- repository
render "src/repository/${k}.repository.ts" <<'EOT'
import { BaseRepository } from './base.repository.js';
import { __P__, Create__P__Data, Update__P__Data } from '../models/__k__.model.js';
import { PaginationParams, PaginatedResult } from '../repositories/user.repository.interface.js';

/** Domain repository for __P__ (bound to TOKENS.__P__Repository, called by services). */
export interface __P__Repository extends BaseRepository<__P__, number> {
  save(data: Create__P__Data): Promise<__P__>;
  update(id: number, data: Update__P__Data): Promise<__P__>;
  findAllPaginated(params: PaginationParams): Promise<PaginatedResult<__P__>>;
}
EOT
render "src/repository/impl/${k}.repository.impl.ts" <<'EOT'
import { injectable, inject } from 'inversify';
import { __P__Repository } from '../__k__.repository.js';
import { I__P__Repository } from '../../repositories/__k__.repository.interface.js';
import { PaginationParams, PaginatedResult } from '../../repositories/user.repository.interface.js';
import { __P__, Create__P__Data, Update__P__Data } from '../../models/__k__.model.js';
import { TOKENS } from '../../di/tokens.js';

@injectable()
export class __P__RepositoryImpl implements __P__Repository {
  constructor(@inject(TOKENS.__P__Dao) private readonly __c__Dao: I__P__Repository) {}

  async save(data: Create__P__Data): Promise<__P__> {
    return this.__c__Dao.create(data);
  }

  async update(id: number, data: Update__P__Data): Promise<__P__> {
    return this.__c__Dao.update(id, data);
  }

  async findById(id: number): Promise<__P__ | null> {
    return this.__c__Dao.getById(id);
  }

  async findAll(): Promise<__P__[]> {
    const result = await this.__c__Dao.getAll({ page: 1, perPage: 10_000 });
    return result.items;
  }

  async findAllPaginated(params: PaginationParams): Promise<PaginatedResult<__P__>> {
    return this.__c__Dao.getAll(params);
  }

  async count(): Promise<number> {
    return this.__c__Dao.getCount();
  }

  async deleteById(id: number): Promise<boolean> {
    return this.__c__Dao.delete(id);
  }

  async existsById(id: number): Promise<boolean> {
    return (await this.__c__Dao.getById(id)) !== null;
  }
}
EOT

# ---------------------------------------------------------------- service
render "src/services/${k}.service.interface.ts" <<'EOT'
import { __P__, Create__P__Data, Update__P__Data } from '../models/__k__.model.js';
import { PaginationParams, PaginatedResult } from '../repositories/user.repository.interface.js';

export interface I__P__Service {
  create__P__(data: Create__P__Data): Promise<__P__>;
  get__P__ById(id: number): Promise<__P__>;
  update__P__(id: number, data: Update__P__Data): Promise<__P__>;
  delete__P__(id: number): Promise<boolean>;
  get__P__s(params: PaginationParams): Promise<PaginatedResult<__P__>>;
}
EOT
render "src/services/impl/${k}.service.impl.ts" <<'EOT'
import { injectable, inject } from 'inversify';
import { I__P__Service } from '../__k__.service.interface.js';
import { __P__Repository } from '../../repository/__k__.repository.js';
import { PaginationParams, PaginatedResult } from '../../repositories/user.repository.interface.js';
import { __P__, Create__P__Data, Update__P__Data } from '../../models/__k__.model.js';
import { NotFoundError } from '../../utils/exceptions.js';
import { TOKENS } from '../../di/tokens.js';

const NOT_FOUND = '__P__ not found';

@injectable()
export class __P__ServiceImpl implements I__P__Service {
  constructor(@inject(TOKENS.__P__Repository) private readonly __c__Repository: __P__Repository) {}

  async create__P__(data: Create__P__Data): Promise<__P__> {
    return this.__c__Repository.save(data);
  }

  async get__P__ById(id: number): Promise<__P__> {
    const found = await this.__c__Repository.findById(id);
    if (!found) {
      throw new NotFoundError(NOT_FOUND);
    }
    return found;
  }

  async update__P__(id: number, data: Update__P__Data): Promise<__P__> {
    if (!(await this.__c__Repository.existsById(id))) {
      throw new NotFoundError(NOT_FOUND);
    }
    return this.__c__Repository.update(id, data);
  }

  async delete__P__(id: number): Promise<boolean> {
    if (!(await this.__c__Repository.existsById(id))) {
      throw new NotFoundError(NOT_FOUND);
    }
    return this.__c__Repository.deleteById(id);
  }

  async get__P__s(params: PaginationParams): Promise<PaginatedResult<__P__>> {
    return this.__c__Repository.findAllPaginated(params);
  }
}
EOT

# ---------------------------------------------------------------- schema + controller
render "src/schemas/${k}.schema.ts" <<'EOT'
import { z } from 'zod';

export const Create__P__Schema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(10_000).optional()
  })
});

export const Update__P__Schema = z.object({
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(10_000).optional()
  })
});

export type Create__P__Input = z.infer<typeof Create__P__Schema>['body'];
export type Update__P__Input = z.infer<typeof Update__P__Schema>['body'];
EOT
render "src/controllers/${k}.controller.ts" <<'EOT'
import { Router, Request, Response, NextFunction } from 'express';
import { tokenRequired, roleRequired } from '../middleware/auth.middleware.js';
import { validateSchema, validatePagination } from '../middleware/validation.middleware.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import { resolve, TOKENS } from '../di/index.js';
import { I__P__Service } from '../services/__k__.service.interface.js';
import { UserRole } from '../models/user.model.js';
import { Create__P__Schema, Update__P__Schema } from '../schemas/__k__.schema.js';

// Boundary only: extract → delegate to the service interface → wrap the response.
const router = Router();
const getService = () => resolve<I__P__Service>(TOKENS.__P__Service);

router.get('/',
  tokenRequired,
  validatePagination({ maxPerPage: 100 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getService().get__P__s({
        page: Number(req.query.page) || 1,
        perPage: Number(req.query.perPage) || 20
      });
      res.json(paginatedResponse(result.items, result.pagination, req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id',
  tokenRequired,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await getService().get__P__ById(Number.parseInt(req.params.id as string));
      res.json(successResponse(item, '__P__ retrieved successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.post('/',
  tokenRequired,
  validateSchema(Create__P__Schema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await getService().create__P__(req.body);
      res.status(201).json(successResponse(item, '__P__ created successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.put('/:id',
  tokenRequired,
  validateSchema(Update__P__Schema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await getService().update__P__(Number.parseInt(req.params.id as string), req.body);
      res.json(successResponse(item, '__P__ updated successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id',
  tokenRequired,
  roleRequired([UserRole.ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await getService().delete__P__(Number.parseInt(req.params.id as string));
      res.json(successResponse(null, '__P__ deleted successfully', req.requestId));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
EOT

# ---------------------------------------------------------------- DI + routing
insert_after src/di/tokens.ts "  OAuthTokenDao: Symbol\\.for\\('OAuthTokenDao'\\),\\n" "  ${P}Dao: Symbol.for('${P}Dao'),
"
insert_after src/di/tokens.ts "  OAuthTokenRepository: Symbol\\.for\\('OAuthTokenRepository'\\),\\n" "  ${P}Repository: Symbol.for('${P}Repository'),
"
insert_after src/di/tokens.ts "  AuthService: Symbol\\.for\\('AuthService'\\),\\n" "  ${P}Service: Symbol.for('${P}Service'),
"
insert_after src/di/container.ts "import \\{ AuthServiceImpl \\} from '\\.\\./services/impl/auth\\.service\\.impl\\.js';\\n" "
// ${P} feature (tools/new-feature.sh)
import { I${P}Repository } from '../repositories/${k}.repository.interface.js';
import { ${P}RepositoryImpl as ${P}DaoImpl } from '../repositories/impl/${k}.repository.impl.js';
import { ${P}Repository } from '../repository/${k}.repository.js';
import { ${P}RepositoryImpl } from '../repository/impl/${k}.repository.impl.js';
import { I${P}Service } from '../services/${k}.service.interface.js';
import { ${P}ServiceImpl } from '../services/impl/${k}.service.impl.js';
"
BIND="container.bind<I${P}Repository>(TOKENS.${P}Dao).to(${P}DaoImpl).inSingletonScope();
  container.bind<${P}Repository>(TOKENS.${P}Repository).to(${P}RepositoryImpl).inSingletonScope();
  container.bind<I${P}Service>(TOKENS.${P}Service).to(${P}ServiceImpl).inSingletonScope();
"
# createContainer() and resetContainer() each bind every feature; both must get the slice.
ANCHOR="container\\.bind<IAuthService>\\(TOKENS\\.AuthService\\)\\.to\\(AuthServiceImpl\\)\\.inSingletonScope\\(\\);\\n"
n="$(grep -c 'container.bind<IAuthService>(TOKENS.AuthService).to(AuthServiceImpl).inSingletonScope();' src/di/container.ts || true)"
[ "$n" = 2 ] || { echo "new-feature: expected 2 AuthService bindings (createContainer + resetContainer) in src/di/container.ts, found $n — NOT done" >&2; exit 1; }
ANCHOR="$ANCHOR" TEXT="  $BIND" perl -0777 -i -pe 's/($ENV{ANCHOR})/$1$ENV{TEXT}/g' src/di/container.ts
echo "  ~ src/di/container.ts (bindings x2)"
insert_after src/app.ts "import userController from '\\./controllers/user\\.controller\\.js';\\n" "import ${c}Controller from './controllers/${k}.controller.js';
"
insert_after src/app.ts "  app\\.use\\('/api/v1/users', userController\\);\\n" "  app.use('/api/v1/${URL}', ${c}Controller);
"
insert_after src/controllers/index.ts "export \\{ default as userController \\} from '\\./user\\.controller\\.js';\\n" "export { default as ${c}Controller } from './${k}.controller.js';
"

# ---------------------------------------------------------------- tests
render "tests/unit/repositories/${k}.repository.test.ts" <<'EOT'
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { __P__RepositoryImpl } from '../../../src/repositories/impl/__k__.repository.impl.js';

const row = { id: 1, name: 'n', description: null, createdAt: new Date(), updatedAt: new Date() };
const model = {
  create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), count: vi.fn()
};
const prisma = { __c__: model } as unknown as PrismaClient;

describe('__P__RepositoryImpl (DAO)', () => {
  let dao: __P__RepositoryImpl;

  beforeEach(() => {
    Object.values(model).forEach(m => m.mockReset());
    dao = new __P__RepositoryImpl(prisma);
  });

  it('create passes the fields to prisma', async () => {
    model.create.mockResolvedValue(row);
    expect(await dao.create({ name: 'n' })).toEqual(row);
    expect(model.create).toHaveBeenCalledWith({ data: { name: 'n', description: undefined } });
  });

  it('getById / update', async () => {
    model.findUnique.mockResolvedValue(row);
    model.update.mockResolvedValue(row);
    expect(await dao.getById(1)).toEqual(row);
    expect(await dao.update(1, { name: 'x' })).toEqual(row);
    expect(model.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { name: 'x' } });
  });

  it('delete returns false when prisma throws', async () => {
    model.delete.mockResolvedValueOnce(row).mockRejectedValueOnce(new Error('missing'));
    expect(await dao.delete(1)).toBe(true);
    expect(await dao.delete(2)).toBe(false);
  });

  it('getAll paginates and getCount counts', async () => {
    model.findMany.mockResolvedValue([row]);
    model.count.mockResolvedValue(21);
    const result = await dao.getAll({ page: 2, perPage: 10 });
    expect(model.findMany).toHaveBeenCalledWith({ skip: 10, take: 10, orderBy: { id: 'asc' } });
    expect(result.pagination).toEqual({ page: 2, perPage: 10, total: 21, totalPages: 3 });
    expect(await dao.getCount()).toBe(21);
  });
});
EOT
render "tests/unit/repository/${k}.repository.impl.test.ts" <<'EOT'
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __P__RepositoryImpl } from '../../../src/repository/impl/__k__.repository.impl.js';
import { I__P__Repository } from '../../../src/repositories/__k__.repository.interface.js';

const row = { id: 1, name: 'n', description: null, createdAt: new Date(), updatedAt: new Date() };
const page = { items: [row], pagination: { page: 1, perPage: 10, total: 1, totalPages: 1 } };

describe('__P__RepositoryImpl (repository layer)', () => {
  let dao: I__P__Repository;
  let repository: __P__RepositoryImpl;

  beforeEach(() => {
    dao = {
      create: vi.fn().mockResolvedValue(row),
      getById: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue(row),
      delete: vi.fn().mockResolvedValue(true),
      getAll: vi.fn().mockResolvedValue(page),
      getCount: vi.fn().mockResolvedValue(1)
    };
    repository = new __P__RepositoryImpl(dao);
  });

  it('delegates every call to the DAO', async () => {
    expect(await repository.save({ name: 'n' })).toEqual(row);
    expect(await repository.update(1, { name: 'x' })).toEqual(row);
    expect(await repository.findById(1)).toEqual(row);
    expect(await repository.findAll()).toEqual([row]);
    expect(await repository.findAllPaginated({ page: 1, perPage: 10 })).toEqual(page);
    expect(await repository.count()).toBe(1);
    expect(await repository.deleteById(1)).toBe(true);
    expect(await repository.existsById(1)).toBe(true);
    expect(dao.getAll).toHaveBeenCalledWith({ page: 1, perPage: 10_000 });
  });

  it('existsById is false when the DAO finds nothing', async () => {
    vi.mocked(dao.getById).mockResolvedValue(null);
    expect(await repository.existsById(9)).toBe(false);
  });
});
EOT
render "tests/unit/services/${k}.service.test.ts" <<'EOT'
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __P__ServiceImpl } from '../../../src/services/impl/__k__.service.impl.js';
import { __P__Repository } from '../../../src/repository/__k__.repository.js';
import { NotFoundError } from '../../../src/utils/exceptions.js';

const row = { id: 1, name: 'n', description: null, createdAt: new Date(), updatedAt: new Date() };

describe('__P__ServiceImpl', () => {
  let repository: __P__Repository;
  let service: __P__ServiceImpl;

  beforeEach(() => {
    repository = {
      save: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue(row),
      findById: vi.fn().mockResolvedValue(row),
      findAll: vi.fn(),
      findAllPaginated: vi.fn().mockResolvedValue({ items: [row], pagination: {} }),
      count: vi.fn(),
      deleteById: vi.fn().mockResolvedValue(true),
      existsById: vi.fn().mockResolvedValue(true)
    } as unknown as __P__Repository;
    service = new __P__ServiceImpl(repository);
  });

  it('creates, reads, updates, deletes and lists', async () => {
    expect(await service.create__P__({ name: 'n' })).toEqual(row);
    expect(await service.get__P__ById(1)).toEqual(row);
    expect(await service.update__P__(1, { name: 'x' })).toEqual(row);
    expect(await service.delete__P__(1)).toBe(true);
    expect((await service.get__P__s({ page: 1, perPage: 10 })).items).toEqual([row]);
  });

  it('throws NotFoundError for a missing id', async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);
    vi.mocked(repository.existsById).mockResolvedValue(false);
    await expect(service.get__P__ById(9)).rejects.toThrow(NotFoundError);
    await expect(service.update__P__(9, {})).rejects.toThrow(NotFoundError);
    await expect(service.delete__P__(9)).rejects.toThrow(NotFoundError);
  });
});
EOT
render "tests/integration/${k}.integration.test.ts" <<'EOT'
import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockService = {
  create__P__: vi.fn(),
  get__P__ById: vi.fn(),
  update__P__: vi.fn(),
  delete__P__: vi.fn(),
  get__P__s: vi.fn()
};

vi.mock('../../src/di/index.js', () => ({
  resolve: vi.fn(() => mockService),
  TOKENS: { __P__Service: Symbol('__P__Service') }
}));
vi.mock('../../src/middleware/auth.middleware.js', () => ({
  tokenRequired: (req: any, _res: any, next: any) => { req.user = { id: 1, role: 'ADMIN' }; next(); },
  roleRequired: () => (_req: any, _res: any, next: any) => next()
}));
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import __c__Controller from '../../src/controllers/__k__.controller.js';
import { errorHandler } from '../../src/middleware/error.middleware.js';
import { NotFoundError } from '../../src/utils/exceptions.js';

const row = { id: 1, name: 'n', description: null };

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/v1/__URL__', __c__Controller);
  a.use(errorHandler);
  return a;
}

describe('__P__ controller', () => {
  beforeEach(() => Object.values(mockService).forEach(m => m.mockReset()));

  it('GET / lists', async () => {
    mockService.get__P__s.mockResolvedValue({ items: [row], pagination: { page: 1, perPage: 20, total: 1, totalPages: 1 } });
    const res = await request(app()).get('/api/v1/__URL__');
    expect(res.status).toBe(200);
    expect(mockService.get__P__s).toHaveBeenCalledWith({ page: 1, perPage: 20 });
  });

  it('GET /:id returns one, 404 when missing', async () => {
    mockService.get__P__ById.mockResolvedValueOnce(row).mockRejectedValueOnce(new NotFoundError('__P__ not found'));
    expect((await request(app()).get('/api/v1/__URL__/1')).status).toBe(200);
    expect((await request(app()).get('/api/v1/__URL__/2')).status).toBe(404);
  });

  it('POST validates and creates', async () => {
    mockService.create__P__.mockResolvedValue(row);
    expect((await request(app()).post('/api/v1/__URL__').send({ name: 'n' })).status).toBe(201);
    expect((await request(app()).post('/api/v1/__URL__').send({})).status).toBe(400);
  });

  it('PUT updates and DELETE deletes', async () => {
    mockService.update__P__.mockResolvedValue(row);
    mockService.delete__P__.mockResolvedValue(true);
    expect((await request(app()).put('/api/v1/__URL__/1').send({ name: 'x' })).status).toBe(200);
    expect((await request(app()).delete('/api/v1/__URL__/1')).status).toBe(200);
  });
});
EOT

echo "new-feature: done. Next: npx prisma generate && npx tsc --noEmit && npx vitest run && tools/arch-check.sh"

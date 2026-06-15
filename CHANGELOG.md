# Changelog

## [1.2.2](https://github.com/jrjohn/arcana-cloud-nodejs/compare/v1.2.1...v1.2.2) (2026-06-14)


### Bug Fixes

* **deps:** update dependency express-rate-limit to v8 ([#38](https://github.com/jrjohn/arcana-cloud-nodejs/issues/38)) ([9b73631](https://github.com/jrjohn/arcana-cloud-nodejs/commit/9b73631018d0024c888bf20f3c0e465292660e27))

## [1.2.1](https://github.com/jrjohn/arcana-cloud-nodejs/compare/v1.2.0...v1.2.1) (2026-06-14)


### Bug Fixes

* **deps:** update dependency dotenv to v17 ([#35](https://github.com/jrjohn/arcana-cloud-nodejs/issues/35)) ([cd0fde3](https://github.com/jrjohn/arcana-cloud-nodejs/commit/cd0fde32b80b002f005d2f70eaffcf48d4a27c6a))

## [1.2.0](https://github.com/jrjohn/arcana-cloud-nodejs/compare/v1.1.0...v1.2.0) (2026-06-12)


### Features

* add 3-layer HTTP integration smoke test infrastructure ([c80bee6](https://github.com/jrjohn/arcana-cloud-nodejs/commit/c80bee6cb7ba7d703c35654ae3fcefc367f67258))
* add DAO layer following arcana-cloud-springboot pattern ([0460bbd](https://github.com/jrjohn/arcana-cloud-nodejs/commit/0460bbd2c506b5b9a83a08addab0bbfe3fa0df3e))
* add gRPC server + layered gRPC + K8s gRPC CI tests ([b41f4b7](https://github.com/jrjohn/arcana-cloud-nodejs/commit/b41f4b7d64b13bd81f84e14b5a6b9016bfaf56a2))


### Bug Fixes

* /me returns JWT user directly, Kind uses container IP for kubectl ([76a3421](https://github.com/jrjohn/arcana-cloud-nodejs/commit/76a3421a12507109868d0ac7dfb108c00a88b5c8))
* add coverage.all:true for accurate SonarQube reporting ([432d262](https://github.com/jrjohn/arcana-cloud-nodejs/commit/432d262a8b223008d2c06fbca6b97a6cfb7a4034))
* add explicit network name to CI compose (avoid project prefix) ([d15c7c9](https://github.com/jrjohn/arcana-cloud-nodejs/commit/d15c7c9f3d53611578b545f240cd6ccbfca1a82a))
* **arch-qube:** add dao/ layer directory (satisfies controller-service-repo-dao chain rule) ([98796ae](https://github.com/jrjohn/arcana-cloud-nodejs/commit/98796aee0cb613d60ae500b871b552bbcd6e783a))
* **arch-qube:** rename communication impl classes to follow impl-naming convention ([5aeeff2](https://github.com/jrjohn/arcana-cloud-nodejs/commit/5aeeff239f7f71e0fe28034a93987e3ca22177df))
* **ci:** convert nodejs fake CI gates to real blocking gates ([414b835](https://github.com/jrjohn/arcana-cloud-nodejs/commit/414b83589436e8c6d9fa13f4c2f47fc8a98495f0))
* **ci:** retry prisma db push instead of swallowing failures in layered CI compose ([dc47111](https://github.com/jrjohn/arcana-cloud-nodejs/commit/dc47111af623359501363de7462f3ad29b15948f))
* **ci:** wait for mysql in kind db-migrate initContainer ([366729c](https://github.com/jrjohn/arcana-cloud-nodejs/commit/366729c224a156e883f3e6b481597b92dc8a565d))
* connect Jenkins container to kind network for kubectl access ([28f9afd](https://github.com/jrjohn/arcana-cloud-nodejs/commit/28f9afd1b71845f2897dbccb5cfc8fdda65960c3))
* copy proto files to Docker image + sanitize smoke test username ([549e3f4](https://github.com/jrjohn/arcana-cloud-nodejs/commit/549e3f42443a5c3779343a158572a39396da1fc2))
* correct relative import paths in repository/service interfaces ([adad4f7](https://github.com/jrjohn/arcana-cloud-nodejs/commit/adad4f7970e1cee3e1aee3715fad2fee84d3f740))
* **deps:** land ioredis 5.11.1 via lockfile bump + type-only bullmq fix ([#18](https://github.com/jrjohn/arcana-cloud-nodejs/issues/18)) ([f09c010](https://github.com/jrjohn/arcana-cloud-nodejs/commit/f09c010596d813f6c4720f49653da35504c74bdb))
* exclude coverage reports from SonarQube analysis ([704a846](https://github.com/jrjohn/arcana-cloud-nodejs/commit/704a84674137ea3e762fc48d4f6556e65bb27634))
* InversifyJS v7 API — context.container.get → context.get ([3c780a4](https://github.com/jrjohn/arcana-cloud-nodejs/commit/3c780a40fd3482c219c3a7ac30f24b6e67011e76))
* K8s smoke test health check, token parsing, and DB init ([713f261](https://github.com/jrjohn/arcana-cloud-nodejs/commit/713f26124d4ddfea34fa825d69defb97b350e6ed))
* remove QueueScheduler (removed in bullmq v5) ([775b9c7](https://github.com/jrjohn/arcana-cloud-nodejs/commit/775b9c7c8765e4ba43194beaef5885184e32d7e5))
* resolve all 73 TypeScript strict mode compilation errors ([6e9168c](https://github.com/jrjohn/arcana-cloud-nodejs/commit/6e9168c116f6ac0bcb967c33d96048c0b91faaa7))
* resolve all SonarQube code smells and security hotspots ([b0afe71](https://github.com/jrjohn/arcana-cloud-nodejs/commit/b0afe71ba2bdb610f632ac1d4ad88b1bfbf6ed11))
* resolve integration test failures ([a3c7aa8](https://github.com/jrjohn/arcana-cloud-nodejs/commit/a3c7aa853520671b71fd4cc203cad8a0db00643e))
* resolve remaining integration test failures ([9b9571f](https://github.com/jrjohn/arcana-cloud-nodejs/commit/9b9571f421c5ecc90a69296dc2e95c3cdd3afa36))
* resolve TypeScript compilation errors ([e5dcd55](https://github.com/jrjohn/arcana-cloud-nodejs/commit/e5dcd5573bcd6942887b76794ebeff51a0e66343))
* S6606 use ??= operator; S6544 NOSONAR on awaited isValid checks ([169d5c6](https://github.com/jrjohn/arcana-cloud-nodejs/commit/169d5c6043fdb0667db84dad283843bbc71b3b92))
* service layer must use DirectServiceCommunication for its own requests ([b3d5a00](https://github.com/jrjohn/arcana-cloud-nodejs/commit/b3d5a0067db35a6e265dfce37603e430f6a726a4))
* **sonar:** extract duplicated 'User not found' string literal into constant ([2431d6c](https://github.com/jrjohn/arcana-cloud-nodejs/commit/2431d6c9af6137e9ec9f9fdc4be6d7b88f3515dd))
* **sonar:** resolve S6697 hardcoded MySQL password, S4325 unnecessary assertions ([5fbf82c](https://github.com/jrjohn/arcana-cloud-nodejs/commit/5fbf82c980ac77e5d25a01490913b7b11f73cdc0))
* suppress S4158 on schedulers stub (bullmq v5 compat) ([ce2bd72](https://github.com/jrjohn/arcana-cloud-nodejs/commit/ce2bd72b112cf6b56266c250321d120b27b48ec3))
* suppress S6544 on async gRPC handlers in grpc-server.ts (Promise&lt;void&gt; is safe) ([b1cb512](https://github.com/jrjohn/arcana-cloud-nodejs/commit/b1cb512be6ad766e87fd19fa538022237a6570eb))
* update 19 failing tests to match current API routes and error messages ([b89c508](https://github.com/jrjohn/arcana-cloud-nodejs/commit/b89c50846f6884ebdfa556c0bcbece8a1962b983))
* update ioredis mocks to export named Redis alongside default ([fc61818](https://github.com/jrjohn/arcana-cloud-nodejs/commit/fc61818d240b6afabca77298b854b12f1a1528a7))
* update queue tests to match current implementation ([f0c74ab](https://github.com/jrjohn/arcana-cloud-nodejs/commit/f0c74ab8c82ed71bd29c90f5eedd4a2dd51be193))
* update request middleware test assertions for pino v9 arg order ([7260289](https://github.com/jrjohn/arcana-cloud-nodejs/commit/72602899d33d001c228fba9e66def877a0bef69b))
* use 127.0.0.1 in health checks (Alpine wget resolves localhost to ::1) ([0afe225](https://github.com/jrjohn/arcana-cloud-nodejs/commit/0afe225b4274df2a78bcd019c9454e06c6d41209))
* use NODE_ENV=testing (not ci) in layered CI compose ([bd3e566](https://github.com/jrjohn/arcana-cloud-nodejs/commit/bd3e56640c10e830467f2eafcb821616945993de))
* use public API routes for inter-layer HTTP communication ([8b016ce](https://github.com/jrjohn/arcana-cloud-nodejs/commit/8b016ce2adbde34e889e7d01b2c2ef7fb8dd8e0c))
* use remote http compose/scripts + updated grpc compose with 127.0.0.1 health checks ([f50fba2](https://github.com/jrjohn/arcana-cloud-nodejs/commit/f50fba25d04664faf351026d679799f3d3619f80))
* wait for Redis healthy before starting app containers ([337435d](https://github.com/jrjohn/arcana-cloud-nodejs/commit/337435d3a93263816199461b34b246ee6a80ce01))

## [1.1.0](https://github.com/jrjohn/arcana-cloud-nodejs/compare/arcana-cloud-nodejs-v1.0.0...arcana-cloud-nodejs-v1.1.0) (2026-06-11)


### Features

* add 3-layer HTTP integration smoke test infrastructure ([c80bee6](https://github.com/jrjohn/arcana-cloud-nodejs/commit/c80bee6cb7ba7d703c35654ae3fcefc367f67258))
* add DAO layer following arcana-cloud-springboot pattern ([0460bbd](https://github.com/jrjohn/arcana-cloud-nodejs/commit/0460bbd2c506b5b9a83a08addab0bbfe3fa0df3e))
* add gRPC server + layered gRPC + K8s gRPC CI tests ([b41f4b7](https://github.com/jrjohn/arcana-cloud-nodejs/commit/b41f4b7d64b13bd81f84e14b5a6b9016bfaf56a2))


### Bug Fixes

* /me returns JWT user directly, Kind uses container IP for kubectl ([76a3421](https://github.com/jrjohn/arcana-cloud-nodejs/commit/76a3421a12507109868d0ac7dfb108c00a88b5c8))
* add coverage.all:true for accurate SonarQube reporting ([432d262](https://github.com/jrjohn/arcana-cloud-nodejs/commit/432d262a8b223008d2c06fbca6b97a6cfb7a4034))
* add explicit network name to CI compose (avoid project prefix) ([d15c7c9](https://github.com/jrjohn/arcana-cloud-nodejs/commit/d15c7c9f3d53611578b545f240cd6ccbfca1a82a))
* **arch-qube:** add dao/ layer directory (satisfies controller-service-repo-dao chain rule) ([98796ae](https://github.com/jrjohn/arcana-cloud-nodejs/commit/98796aee0cb613d60ae500b871b552bbcd6e783a))
* **arch-qube:** rename communication impl classes to follow impl-naming convention ([5aeeff2](https://github.com/jrjohn/arcana-cloud-nodejs/commit/5aeeff239f7f71e0fe28034a93987e3ca22177df))
* **ci:** convert nodejs fake CI gates to real blocking gates ([414b835](https://github.com/jrjohn/arcana-cloud-nodejs/commit/414b83589436e8c6d9fa13f4c2f47fc8a98495f0))
* **ci:** retry prisma db push instead of swallowing failures in layered CI compose ([dc47111](https://github.com/jrjohn/arcana-cloud-nodejs/commit/dc47111af623359501363de7462f3ad29b15948f))
* **ci:** wait for mysql in kind db-migrate initContainer ([366729c](https://github.com/jrjohn/arcana-cloud-nodejs/commit/366729c224a156e883f3e6b481597b92dc8a565d))
* connect Jenkins container to kind network for kubectl access ([28f9afd](https://github.com/jrjohn/arcana-cloud-nodejs/commit/28f9afd1b71845f2897dbccb5cfc8fdda65960c3))
* copy proto files to Docker image + sanitize smoke test username ([549e3f4](https://github.com/jrjohn/arcana-cloud-nodejs/commit/549e3f42443a5c3779343a158572a39396da1fc2))
* correct relative import paths in repository/service interfaces ([adad4f7](https://github.com/jrjohn/arcana-cloud-nodejs/commit/adad4f7970e1cee3e1aee3715fad2fee84d3f740))
* **deps:** land ioredis 5.11.1 via lockfile bump + type-only bullmq fix ([#18](https://github.com/jrjohn/arcana-cloud-nodejs/issues/18)) ([f09c010](https://github.com/jrjohn/arcana-cloud-nodejs/commit/f09c010596d813f6c4720f49653da35504c74bdb))
* exclude coverage reports from SonarQube analysis ([704a846](https://github.com/jrjohn/arcana-cloud-nodejs/commit/704a84674137ea3e762fc48d4f6556e65bb27634))
* InversifyJS v7 API — context.container.get → context.get ([3c780a4](https://github.com/jrjohn/arcana-cloud-nodejs/commit/3c780a40fd3482c219c3a7ac30f24b6e67011e76))
* K8s smoke test health check, token parsing, and DB init ([713f261](https://github.com/jrjohn/arcana-cloud-nodejs/commit/713f26124d4ddfea34fa825d69defb97b350e6ed))
* remove QueueScheduler (removed in bullmq v5) ([775b9c7](https://github.com/jrjohn/arcana-cloud-nodejs/commit/775b9c7c8765e4ba43194beaef5885184e32d7e5))
* resolve all 73 TypeScript strict mode compilation errors ([6e9168c](https://github.com/jrjohn/arcana-cloud-nodejs/commit/6e9168c116f6ac0bcb967c33d96048c0b91faaa7))
* resolve all SonarQube code smells and security hotspots ([b0afe71](https://github.com/jrjohn/arcana-cloud-nodejs/commit/b0afe71ba2bdb610f632ac1d4ad88b1bfbf6ed11))
* resolve integration test failures ([a3c7aa8](https://github.com/jrjohn/arcana-cloud-nodejs/commit/a3c7aa853520671b71fd4cc203cad8a0db00643e))
* resolve remaining integration test failures ([9b9571f](https://github.com/jrjohn/arcana-cloud-nodejs/commit/9b9571f421c5ecc90a69296dc2e95c3cdd3afa36))
* resolve TypeScript compilation errors ([e5dcd55](https://github.com/jrjohn/arcana-cloud-nodejs/commit/e5dcd5573bcd6942887b76794ebeff51a0e66343))
* S6606 use ??= operator; S6544 NOSONAR on awaited isValid checks ([169d5c6](https://github.com/jrjohn/arcana-cloud-nodejs/commit/169d5c6043fdb0667db84dad283843bbc71b3b92))
* service layer must use DirectServiceCommunication for its own requests ([b3d5a00](https://github.com/jrjohn/arcana-cloud-nodejs/commit/b3d5a0067db35a6e265dfce37603e430f6a726a4))
* **sonar:** extract duplicated 'User not found' string literal into constant ([2431d6c](https://github.com/jrjohn/arcana-cloud-nodejs/commit/2431d6c9af6137e9ec9f9fdc4be6d7b88f3515dd))
* **sonar:** resolve S6697 hardcoded MySQL password, S4325 unnecessary assertions ([5fbf82c](https://github.com/jrjohn/arcana-cloud-nodejs/commit/5fbf82c980ac77e5d25a01490913b7b11f73cdc0))
* suppress S4158 on schedulers stub (bullmq v5 compat) ([ce2bd72](https://github.com/jrjohn/arcana-cloud-nodejs/commit/ce2bd72b112cf6b56266c250321d120b27b48ec3))
* suppress S6544 on async gRPC handlers in grpc-server.ts (Promise&lt;void&gt; is safe) ([b1cb512](https://github.com/jrjohn/arcana-cloud-nodejs/commit/b1cb512be6ad766e87fd19fa538022237a6570eb))
* update 19 failing tests to match current API routes and error messages ([b89c508](https://github.com/jrjohn/arcana-cloud-nodejs/commit/b89c50846f6884ebdfa556c0bcbece8a1962b983))
* update ioredis mocks to export named Redis alongside default ([fc61818](https://github.com/jrjohn/arcana-cloud-nodejs/commit/fc61818d240b6afabca77298b854b12f1a1528a7))
* update queue tests to match current implementation ([f0c74ab](https://github.com/jrjohn/arcana-cloud-nodejs/commit/f0c74ab8c82ed71bd29c90f5eedd4a2dd51be193))
* update request middleware test assertions for pino v9 arg order ([7260289](https://github.com/jrjohn/arcana-cloud-nodejs/commit/72602899d33d001c228fba9e66def877a0bef69b))
* use 127.0.0.1 in health checks (Alpine wget resolves localhost to ::1) ([0afe225](https://github.com/jrjohn/arcana-cloud-nodejs/commit/0afe225b4274df2a78bcd019c9454e06c6d41209))
* use NODE_ENV=testing (not ci) in layered CI compose ([bd3e566](https://github.com/jrjohn/arcana-cloud-nodejs/commit/bd3e56640c10e830467f2eafcb821616945993de))
* use public API routes for inter-layer HTTP communication ([8b016ce](https://github.com/jrjohn/arcana-cloud-nodejs/commit/8b016ce2adbde34e889e7d01b2c2ef7fb8dd8e0c))
* use remote http compose/scripts + updated grpc compose with 127.0.0.1 health checks ([f50fba2](https://github.com/jrjohn/arcana-cloud-nodejs/commit/f50fba25d04664faf351026d679799f3d3619f80))
* wait for Redis healthy before starting app containers ([337435d](https://github.com/jrjohn/arcana-cloud-nodejs/commit/337435d3a93263816199461b34b246ee6a80ce01))

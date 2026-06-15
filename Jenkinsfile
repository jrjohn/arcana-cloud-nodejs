// Jenkinsfile — multibranch pipeline for arcana-cloud-nodejs
// Adapted from legacy node-app-pipeline (single-branch job polling SCM).
//
// Key differences from the legacy XML-embedded script:
//   * `checkout scm` (no hardcoded branch=main)        — supports every branch + every PR
//   * `pollSCM` trigger removed                        — Jenkins multibranch + GitHub webhook drive triggers
//   * "Push to Registry" gated with `when { branch 'main' }`  — PR builds keep image local
//   * Build-tagged image (build-N) pushed on EVERY branch — kind integration stage
//     needs a registry-durable copy that survives concurrent-build local cleanup
//   * SonarQube gets pullrequest.* params on PRs       — PR-decoration in Sonar UI
//   * `dir("${env.PROJECTS_DIR}/...")` blocks removed  — multibranch uses workspace root

pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '1'))
        disableConcurrentBuilds()
        timestamps()
    }

    environment {
        APP_NAME  = "node-app"
        REGISTRY  = "localhost:5000"
        IMAGE_TAG = "${REGISTRY}/arcana/${APP_NAME}"
        VERSION   = "1.0.0"
    }

    stages {
        stage("Checkout") {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
                script {
                    echo "Branch: ${env.BRANCH_NAME ?: 'unknown'}"
                    echo "PR: ${env.CHANGE_ID ?: 'no'} (target: ${env.CHANGE_TARGET ?: 'n/a'})"
                }
            }
        }

        stage("Cleanup Old Images") {
            steps {
                sh '''
                    # keep only the previous build image (layer cache); the
                    # registry holds every build-N tag durably
                    docker images --format '{{.Repository}}:{{.Tag}}' \
                        | grep -E "^${IMAGE_TAG}:build-[0-9]+$" \
                        | sed 's/.*:build-//' | sort -rn | tail -n +2 \
                        | sed "s|^|${IMAGE_TAG}:build-|" \
                        | xargs -r docker rmi 2>/dev/null || true
                    docker compose -f docker-compose.test.yml down \
                        --remove-orphans 2>/dev/null || true
                '''
            }
        }

        stage("Docker Compose Build") {
            steps {
                sh "VERSION=${VERSION} docker compose -f docker-compose.ci.yml build"
                sh "docker tag localhost:5000/arcana/${APP_NAME}:${VERSION} ${IMAGE_TAG}:build-${BUILD_NUMBER}"
            }
        }

        stage("Push Build Tag") {
            // Push the per-build tag on EVERY branch (incl. PRs). The integration
            // stages (esp. "Integration: K8s gRPC" via kind) consume build-N late
            // in the run; on the shared host a concurrent higher-numbered build's
            // cleanup (`docker rmi` all-but-current, flat build-N namespace) can
            // reap this build's LOCAL image before kind loads it. The kind helper
            // then falls back to a registry pull — which only works if build-N was
            // pushed. Pushing here makes "the registry holds every build-N tag
            // durably" (relied on by Cleanup Old Images / post self-clean) true for
            // PRs too, instead of only main. Registry growth is bounded by the
            // existing external registry GC; nothing in this pipeline keeps tags.
            steps {
                sh "docker push ${IMAGE_TAG}:build-${BUILD_NUMBER}"
            }
        }

        stage("Unit Tests") {
            steps {
                sh '''
                    docker rm -f node-app-test-${BUILD_NUMBER} 2>/dev/null || true
                    docker compose -f docker-compose.test.yml run --build --name node-app-test-${BUILD_NUMBER} test
                    RC=$?
                    mkdir -p coverage
                    docker cp node-app-test-${BUILD_NUMBER}:/app/coverage/. coverage/ 2>/dev/null || true
                    docker rm -f node-app-test-${BUILD_NUMBER} 2>/dev/null || true
                    exit $RC
                '''
            }
        }

        stage("Integration: Layered HTTP") {
            // Serialize this repo's layered-compose stage: main + PR builds share
            // static compose project/network/container names and collide when concurrent.
            options { lock('ci-nodejs-layered') }
            steps {
                sh '''
                    JENKINS_ID=$(hostname)
                    NODE_IMAGE=placeholder docker compose -p arcana-ci-node-http \
                        -f deployment/layered/docker-compose-ci-http.yml \
                        down -v --remove-orphans 2>/dev/null || true
                    NODE_IMAGE=${IMAGE_TAG}:build-${BUILD_NUMBER} \
                    docker compose -p arcana-ci-node-http \
                        -f deployment/layered/docker-compose-ci-http.yml up -d
                    docker network connect arcana-ci-node-net $JENKINS_ID 2>/dev/null || true
                    bash scripts/integration-smoke-test.sh \
                        http://arcana-ci-node-controller:3000 http-layered 300
                    docker network disconnect arcana-ci-node-net $JENKINS_ID 2>/dev/null || true
                '''
            }
            post {
                always {
                    sh '''
                        docker network disconnect arcana-ci-node-net $(hostname) 2>/dev/null || true
                        NODE_IMAGE=placeholder docker compose -p arcana-ci-node-http \
                            -f deployment/layered/docker-compose-ci-http.yml \
                            down -v --remove-orphans 2>/dev/null || true
                    '''
                }
            }
        }

        stage("Integration: Layered gRPC") {
            // Serialize this repo's layered-compose stage: main + PR builds share
            // static compose project/network/container names and collide when concurrent.
            options { lock('ci-nodejs-layered') }
            steps {
                sh '''
                    JENKINS_ID=$(hostname)
                    NODE_IMAGE=placeholder docker compose -p arcana-ci-node-grpc \
                        -f deployment/layered/docker-compose-ci-grpc.yml \
                        down -v --remove-orphans 2>/dev/null || true
                    NODE_IMAGE=${IMAGE_TAG}:build-${BUILD_NUMBER} \
                    docker compose -p arcana-ci-node-grpc \
                        -f deployment/layered/docker-compose-ci-grpc.yml up -d
                    docker network connect arcana-ci-node-grpc-net $JENKINS_ID 2>/dev/null || true
                    bash scripts/integration-smoke-test.sh \
                        http://arcana-ci-node-grpc-controller:3000 grpc-layered 300
                    docker network disconnect arcana-ci-node-grpc-net $JENKINS_ID 2>/dev/null || true
                '''
            }
            post {
                always {
                    sh '''
                        echo "=== Controller container logs ==="
                        docker logs arcana-ci-node-grpc-controller 2>&1 | tail -50 || true
                        echo "=== Service container logs ==="
                        docker logs arcana-ci-node-grpc-service 2>&1 | tail -50 || true
                        echo "=== Repository container logs ==="
                        docker logs arcana-ci-node-grpc-repository 2>&1 | tail -30 || true
                        docker network disconnect arcana-ci-node-grpc-net $(hostname) 2>/dev/null || true
                        NODE_IMAGE=placeholder docker compose -p arcana-ci-node-grpc \
                            -f deployment/layered/docker-compose-ci-grpc.yml \
                            down -v --remove-orphans 2>/dev/null || true
                    '''
                }
            }
        }

        stage("Integration: K8s gRPC") {
            // Serialize ALL kind/k8s stages host-wide: concurrent kind clusters
            // OOM-killed image imports on the 24G shared host (exit 137).
            options { lock('ci-kind-global') }
            steps {
                sh '''#!/bin/bash
                    export PATH="/var/jenkins_home/bin:${PATH}"
                    kind version || { echo "kind not found"; exit 1; }
                    bash scripts/kind-smoke-test.sh "${IMAGE_TAG}:build-${BUILD_NUMBER}" grpc 600
                '''
            }
            post {
                always {
                    sh '''#!/bin/bash
                        export PATH="/var/jenkins_home/bin:${PATH}"
                        kind get clusters 2>/dev/null | grep arcana-ci | while read cl; do
                          kind delete cluster --name "$cl" 2>/dev/null || true
                        done
                    '''
                }
            }
        }

        stage("SonarQube Analysis") {
            steps {
                sh 'npm ci --ignore-scripts --no-audit --no-fund 2>/dev/null || npm install --ignore-scripts --no-audit --no-fund 2>/dev/null || true'
                withSonarQubeEnv('SonarQube') {
                    sh """sonar-scanner \
                      -Dsonar.projectKey=node-app \
                      -Dsonar.projectName="Node App" \
                      -Dsonar.sources=src \
                      -Dsonar.exclusions=coverage/**,**/lcov-report/**,**/*.html,node_modules/**,dist/**,src/grpc/generated/** \
                      -Dsonar.coverage.exclusions=src/index.ts,src/app.ts,src/grpc/grpc-server.ts,src/grpc/generated/**,src/grpc/protos/**,src/dao/**,src/types/**,src/**/*.interface.ts,src/**/index.ts,src/models/oauth-token.model.ts \
                      -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                      -Dsonar.scm.disabled=true"""
                    sh '''
                        set -e
                        TOKEN="${SONAR_AUTH_TOKEN:-$SONAR_TOKEN}"
                        RT=.scannerwork/report-task.txt
                        [ -f "$RT" ] || { echo "report-task.txt missing"; exit 1; }
                        CE_TASK_ID=$(grep '^ceTaskId=' "$RT" | cut -d= -f2-)
                        ANALYSIS_ID=""
                        for i in $(seq 1 60); do
                            RESP=$(curl -s -u "$TOKEN:" "$SONAR_HOST_URL/api/ce/task?id=$CE_TASK_ID")
                            ST=$(echo "$RESP" | grep -o '"status":"[A-Z_]*"' | head -1 | cut -d'"' -f4)
                            echo "  CE status: ${ST:-?} (try $i)"
                            if [ "$ST" = "SUCCESS" ]; then ANALYSIS_ID=$(echo "$RESP" | grep -o '"analysisId":"[^"]*"' | head -1 | cut -d'"' -f4); break;
                            elif [ "$ST" = "FAILED" ] || [ "$ST" = "CANCELED" ]; then echo "CE $ST"; exit 1; fi
                            sleep 5
                        done
                        [ -n "$ANALYSIS_ID" ] || { echo "CE timeout"; exit 1; }
                        GATE=$(curl -s -u "$TOKEN:" "$SONAR_HOST_URL/api/qualitygates/project_status?analysisId=$ANALYSIS_ID")
                        GST=$(echo "$GATE" | grep -o '"status":"[A-Z]*"' | head -1 | cut -d'"' -f4)
                        echo "Quality gate: ${GST:-UNKNOWN}"
                        if [ "$GST" != "OK" ]; then echo "$GATE"; exit 1; fi
                    '''
                }
            }
        }

        stage("Architecture Qube") {
            steps {
                sh '''
                    docker rm -f arcana-arch-qube-node-${BUILD_NUMBER} 2>/dev/null || true
                    docker create --name arcana-arch-qube-node-${BUILD_NUMBER} --network devops_default \
                        -v /src -v /output \
                        arcana.boo/arcana/arch-qube:latest \
                        scan /src --framework nodejs --no-ai --ci \
                        --format json,markdown -o /output --threshold 90 || exit 1
                    tar --exclude=./.git --exclude=./node_modules --exclude=./arch-qube-reports -C . -cf - . \
                        | docker cp - arcana-arch-qube-node-${BUILD_NUMBER}:/src || exit 1
                    docker start -a arcana-arch-qube-node-${BUILD_NUMBER}
                    AQ_RC=$?
                    mkdir -p arch-qube-reports
                    docker cp arcana-arch-qube-node-${BUILD_NUMBER}:/output/. arch-qube-reports/ 2>/dev/null || true
                    docker rm -f arcana-arch-qube-node-${BUILD_NUMBER} 2>/dev/null || true
                    exit $AQ_RC
                '''
            }
        }

        stage("Image Info") {
            steps {
                sh "docker images --format 'table {{.Repository}}:{{.Tag}}\\t{{.Size}}' | grep ${APP_NAME} || true"
            }
        }

        stage("Push to Registry") {
            // Only push from main branch builds. PR builds keep the image local.
            when { branch 'main' }
            steps {
                sh "docker push ${IMAGE_TAG}:${VERSION}"
            }
        }

        stage("Arch Qube Metrics") {
            when { branch 'main' }
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'SUCCESS') {
                    sh "bash /data/projects/_scripts/arch-qube-metrics.sh \$(pwd) arcana-cloud-nodejs || true"
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline SUCCESS - ${APP_NAME}:${VERSION} branch=${env.BRANCH_NAME ?: '?'} pr=${env.CHANGE_ID ?: 'no'}"
            sh '''
                # self-clean: keep only THIS build's image locally; previous
                # build-N tags stay pullable from the registry
                docker images --format '{{.Repository}}:{{.Tag}}' \
                    | grep -E "^${IMAGE_TAG}:build-[0-9]+$" \
                    | grep -v ":build-${BUILD_NUMBER}$" \
                    | xargs -r docker rmi 2>/dev/null || true
            '''
        }
        failure { echo "Pipeline FAILED - branch=${env.BRANCH_NAME ?: '?'} pr=${env.CHANGE_ID ?: 'no'}" }
        always  { echo "Build number ${BUILD_NUMBER} done" }
    }
}

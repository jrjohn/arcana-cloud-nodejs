// Jenkinsfile — multibranch pipeline for arcana-cloud-nodejs
// Adapted from legacy node-app-pipeline (single-branch job polling SCM).
//
// Key differences from the legacy XML-embedded script:
//   * `checkout scm` (no hardcoded branch=main)        — supports every branch + every PR
//   * `pollSCM` trigger removed                        — Jenkins multibranch + GitHub webhook drive triggers
//   * "Push to Registry" gated with `when { branch 'main' }`  — PR builds keep image local
//   * Build-tagged image push also gated on main       — avoid polluting registry with PR tags
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
                    docker image prune -f || true
                    docker images --format '{{.Repository}}:{{.Tag}}' \
                        | grep "${APP_NAME}.*build-" \
                        | sort -t- -k2 -rn \
                        | tail -n +4 \
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
            // Push the per-build tag only from main; PR builds keep it local for integration tests.
            when { branch 'main' }
            steps {
                sh "docker push ${IMAGE_TAG}:build-${BUILD_NUMBER}"
            }
        }

        stage("Unit Tests") {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh "docker compose -f docker-compose.test.yml run --rm --build test"
                }
            }
        }

        stage("Integration: Layered HTTP") {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
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
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
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
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh '''#!/bin/bash
                        export PATH="/var/jenkins_home/bin:${PATH}"
                        kind version || { echo "kind not found"; exit 1; }
                        bash scripts/kind-smoke-test.sh "${IMAGE_TAG}:build-${BUILD_NUMBER}" grpc 480
                    '''
                }
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
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh 'npm ci --ignore-scripts --no-audit --no-fund 2>/dev/null || npm install --ignore-scripts --no-audit --no-fund 2>/dev/null || true'
                    withSonarQubeEnv('SonarQube') {
                        script {
                            def prArgs = env.CHANGE_ID ? """ \
                                -Dsonar.pullrequest.key=${env.CHANGE_ID} \
                                -Dsonar.pullrequest.branch=${env.BRANCH_NAME} \
                                -Dsonar.pullrequest.base=${env.CHANGE_TARGET}""" : ''
                            sh """sonar-scanner \
                              -Dsonar.projectKey=node-app \
                              -Dsonar.projectName="Node App" \
                              -Dsonar.sources=src \
                              -Dsonar.exclusions=coverage/**,**/lcov-report/**,**/*.html,node_modules/**,dist/**,src/grpc/generated/** \
                              -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                              -Dsonar.scm.disabled=true${prArgs}"""
                        }
                    }
                }
            }
        }

        stage("Architecture Qube") {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh '''
                        mkdir -p arch-qube-reports
                        docker run --rm \
                            --network devops_default \
                            -v $(pwd):/project \
                            -v $(pwd)/arch-qube-reports:/output \
                            arcana.boo/arcana/arch-qube:latest scan /project \
                            --framework nodejs --no-ai \
                            --ci --format json,markdown \
                            -o /output --threshold 90 || true
                    '''
                }
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
        success { echo "Pipeline SUCCESS - ${APP_NAME}:${VERSION} branch=${env.BRANCH_NAME ?: '?'} pr=${env.CHANGE_ID ?: 'no'}" }
        failure { echo "Pipeline FAILED - branch=${env.BRANCH_NAME ?: '?'} pr=${env.CHANGE_ID ?: 'no'}" }
        always  { echo "Build number ${BUILD_NUMBER} done" }
    }
}

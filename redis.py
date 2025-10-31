#!/bin/bash
set -e

echo "📦 Copying Redis binaries from GNS path..."

# 🔧 UPDATE THIS PATH TO YOUR ACTUAL GNS PATH
GNS_REDIS_PATH="/gns/area/certified/external/redis/io/redisbinary/redis-6.2.2_fixed-6.2.2_fixed/redis-6.2.2_fixed"

if [ ! -f "$GNS_REDIS_PATH/redis-server" ]; then
    echo "❌ ERROR: GNS Redis binaries not found at $GNS_REDIS_PATH"
    echo "❌ Available files in parent directory:"
    ls -la $(dirname $GNS_REDIS_PATH) || true
    exit 1
fi

# Copy binaries to current directory
cp $GNS_REDIS_PATH/redis-server .
cp $GNS_REDIS_PATH/redis-cli .
cp $GNS_REDIS_PATH/redis-benchmark .
cp $GNS_REDIS_PATH/redis-check-aof .
cp $GNS_REDIS_PATH/redis-check-rdb .

# Make them executable
chmod +x redis-*

echo "✅ Redis binaries copied successfully"
echo "📋 Files:"
ls -la redis-*




# 👇👇👇 NEW: Add Redis binaries from copy script
COPY redis-server /usr/local/bin/redis-server
COPY redis-cli /usr/local/bin/redis-cli
COPY redis-benchmark /usr/local/bin/redis-benchmark
COPY redis-check-aof /usr/local/bin/redis-check-aof
COPY redis-check-rdb /usr/local/bin/redis-check-rdb

RUN chmod +x /usr/local/bin/redis-*
# Create Redis config file
RUN echo "bind 127.0.0.1" > /etc/redis.conf && \
    echo "port 6379" >> /etc/redis.conf && \
    echo "protected-mode no" >> /etc/redis.conf && \
    echo "maxmemory 512mb" >> /etc/redis.conf && \
    echo "maxmemory-policy allkeys-lru" >> /etc/redis.conf && \
    echo "appendonly yes" >> /etc/redis.conf && \
    echo "appendfsync everysec" >> /etc/redis.conf && \
    echo "save \"\"" >> /etc/redis.conf && \
    echo "stop-writes-on-bgsave-error no" >> /etc/redis.conf && \
    echo "dir /tmp" >> /etc/redis.conf && \
    echo "logfile /tmp/redis.log" >> /etc/redis.conf

# Default command is FastAPI (for backward compatibility)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "2395"]




      containers:
      # 🔸 Redis Container (sidecar)
      - name: redis
        image: your-registry/nexus-redis-app:latest
        command: ["/usr/local/bin/redis-server", "/etc/redis.conf"]
        ports:
          - containerPort: 6379
        volumeMounts:
          - name: tmp-storage
            mountPath: /tmp
        resources:
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          exec:
            command: ["/usr/local/bin/redis-cli", "ping"]
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command: ["/usr/local/bin/redis-cli", "ping"]
          initialDelaySeconds: 5
          periodSeconds: 5



task copyRedisBinaries(type: Exec) {
    description 'Copy Redis binaries from GNS path'
    commandLine 'bash', './copy_redis_binaries.sh'
}

// Make createVirtualEnv depend on copyRedisBinaries
createVirtualEnv.dependsOn copyRedisBinaries




stages:
  - copy_binaries  # 👈 NEW: Add this stage
  - build_image
  - cloud_etech_upload
  # ... your other stages

.copy-redis-binaries:
  stage: copy_binaries
  tags: [linux]
  image: registry.aws.site.gs.com:443/dx/containers/build-image:latest
  script:
    - export VERSION=`cat commit_version`
    - cd ${CI_PROJECT_DIR}
    - ./copy_redis_binaries.sh
    - ls -la redis-server redis-cli redis-benchmark redis-check-aof redis-check-rdb
  artifacts:
    paths:
      - redis-server
      - redis-cli
      - redis-benchmark
      - redis-check-aof
      - redis-check-rdb
    expire_in: 1 hour
  only:
    - tags
    - branches

# 👇 Your existing .build-image template (updated)
.build-image: &build-image
  stage: build_image
  tags: [linux]
  image: registry.aws.site.gs.com:443/dx/containers/build-image:latest
  script:
    - export VERSION=`cat commit_version`
    - mkdir -p ${CI_PROJECT_DIR}/k8s/workspace/apps
    - cd ${CI_PROJECT_DIR}/k8s/workspace
    
  # 👇 Copy Redis binaries to images directory (where Dockerfile expects them)
    - cp ${CI_PROJECT_DIR}/redis-server ${CI_PROJECT_DIR}/k8s/images/
    - cp ${CI_PROJECT_DIR}/redis-cli ${CI_PROJECT_DIR}/k8s/images/
    - cp ${CI_PROJECT_DIR}/redis-benchmark ${CI_PROJECT_DIR}/k8s/images/
    - cp ${CI_PROJECT_DIR}/redis-check-aof ${CI_PROJECT_DIR}/k8s/images/
    - cp ${CI_PROJECT_DIR}/redis-check-rdb ${CI_PROJECT_DIR}/k8s/images/
    
    # 👇 Copy your existing Dockerfile
    - cp ${CI_PROJECT_DIR}/k8s/images/Dockerfile .
    
    # 👇 Copy your app files
    - cp -r ${CI_PROJECT_DIR}/apps/ .
    
    # 🧪 Verify files
    - ls -la
    
    # 🚀 Build and push image
    - echo "Creating image for ${env} environment"
    - if [[ "${env}" == "dev" ]]; then
        kaniko -c . -d ${CI_REGISTRY_IMAGE}/nexus-redis-app:${VERSION}-dev --build-arg version=${VERSION};
      elif [[ "${env}" == "uat" ]]; then
        kaniko -c . -d ${CI_REGISTRY_IMAGE}/nexus-redis-app:${VERSION}-uat --build-arg version=${VERSION};
      else
        kaniko -c . -d ${CI_REGISTRY_IMAGE}/nexus-redis-app:${VERSION}-prod --build-arg version=${VERSION};
      fi
    
    - echo "Image version updated ${CI_REGISTRY_IMAGE}:Nexus-${CI_COMMIT_SHA}"
  artifacts:
    paths: []
  only:
    - tags
    - branches

# 👇 Your existing buildSite job
buildSite:
  stage: cloud_etech_upload
  tags: [linux]
  script:
    - export VERSION=`cat commit_version`
    - ./buildSite.sh
  only:
    - tags
    - branches





#!/bin/bash
set -e

echo "📦 Finding and copying Redis binaries from GNS path..."

# 🔍 Try multiple possible paths
POSSIBLE_PATHS=(
    "/gns/area/certified/external/redis/io/redisbinary/redis-6.2.2_fixed-6.2.2_fixed/redis-6.2.2_fixed"
    "/gns/area/certified/external/redis/io/redisbinary/redis-6.2.2_fixed"
    "/gns/area/certified/external/redis/io/redisbinary/redis-6.2.2"
    "/gns/area/certified/com/gs/platform/redis/redis-6.2.2"
    "/gns/area/certified/external/redis/io/redisbinary/redis-6.2.2_fixed-6.2.2_fixed"
)

REDIS_PATH=""

for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -f "$path/redis-server" ]; then
        REDIS_PATH="$path"
        echo "✅ Found Redis binaries at: $path"
        break
    fi
done

if [ -z "$REDIS_PATH" ]; then
    echo "❌ ERROR: Redis binaries not found in any of the standard GNS paths"
    echo "📋 Available Redis-related directories:"
    find /gns -name "*redis*" -type d 2>/dev/null | head -20
    exit 1
fi

# Copy binaries to current directory
cp $REDIS_PATH/redis-server .
cp $REDIS_PATH/redis-cli .
cp $REDIS_PATH/redis-benchmark .
cp $REDIS_PATH/redis-check-aof .
cp $REDIS_PATH/redis-check-rdb .

# Make them executable
chmod +x redis-*

echo "✅ Redis binaries copied successfully"
echo "📋 Files:"
ls -la redis-*

# Redis Configuration for Genova AI Backend

## Local Development (Docker)

The local Redis instance uses the following configuration (from `docker-compose.yml`):

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
```

**Configuration Details:**
- `appendonly yes`: Enable AOF (Append Only File) persistence
- `maxmemory 512mb`: Limit memory usage to 512MB
- `maxmemory-policy allkeys-lru`: Evict least recently used keys when memory limit is reached

## Cloud Memorystore (Production)

Cloud Memorystore for Redis is created with the following settings:

**Basic Configuration:**
- **Tier**: Basic (no replication)
- **Memory Size**: 1GB
- **Redis Version**: 7.0
- **Region**: asia-northeast3
- **Network**: default VPC

**Redis Config:**
- `maxmemory-policy`: `allkeys-lru`

**Key Differences from Local:**

1. **Persistence**: Cloud Memorystore automatically handles persistence (RDB snapshots). No need to configure AOF.
2. **Memory**: Production instance has 1GB (vs 512MB local) to handle higher load.
3. **Network**: Private IP only, accessible via VPC connector from Cloud Run.

## Usage in Application

The application uses Redis for the following purposes:

### 1. Video Processing Status Tracking
- **Key Pattern**: `video:status:{video_id}`
- **Type**: Hash
- **Purpose**: Track real-time processing status
- **TTL**: 24 hours after completion

### 2. Distributed Locking
- **Key Pattern**: `lock:video:{video_id}`
- **Type**: String with NX (set if not exists)
- **Purpose**: Prevent duplicate processing of the same video
- **TTL**: 15 minutes (processing timeout)

### 3. Processing Metadata Cache
- **Key Pattern**: `video:metadata:{video_id}`
- **Type**: Hash
- **Purpose**: Cache video metadata during processing
- **TTL**: 1 hour

### 4. Rate Limiting (if enabled)
- **Key Pattern**: `ratelimit:{ip}:{endpoint}`
- **Type**: String (counter)
- **Purpose**: API rate limiting
- **TTL**: 1 minute (sliding window)

## Connection Configuration

### Local Development
```bash
REDIS_URL=redis://localhost:6379/0
```

### Production (Cloud Memorystore)
```bash
# Using private IP (requires VPC connector)
REDIS_URL=redis://<REDIS_HOST>:6379/0

# Example:
REDIS_URL=redis://10.0.0.3:6379/0
```

### Connection Settings (from app/core/config.py)
- `REDIS_SOCKET_TIMEOUT`: 5 seconds
- `REDIS_SOCKET_CONNECT_TIMEOUT`: 5 seconds
- `REDIS_HEALTH_CHECK_INTERVAL`: 30 seconds

## Monitoring

Cloud Memorystore provides built-in monitoring:
- Memory usage
- Operations per second
- Cache hit rate
- Connected clients

Access metrics in Google Cloud Console:
```
Memorystore > Redis > [instance] > Monitoring
```

## Scaling Considerations

### When to Upgrade:

1. **Memory Usage > 80%**: Increase memory size
2. **High Eviction Rate**: Increase memory or adjust TTLs
3. **Connection Limits**: Upgrade tier or add more instances

### Upgrade Path:

**Current**: Basic tier, 1GB
**Next**: Basic tier, 5GB (if more memory needed)
**High Availability**: Standard tier with replication (for production critical workloads)

## Backup and Recovery

Cloud Memorystore (Basic tier):
- **Snapshots**: Taken daily automatically
- **Retention**: 7 days
- **Point-in-time recovery**: Not available (only in Standard tier)

For critical data, consider:
1. Upgrading to Standard tier for replication
2. Implementing application-level backup to Cloud Storage
3. Setting appropriate TTLs to allow data rebuild from PostgreSQL

## Security

1. **Network**: Private IP only, no public access
2. **Authentication**: Optional AUTH token (not currently used)
3. **Encryption**: In-transit encryption available (can enable if needed)
4. **Access Control**: VPC firewall rules, Cloud IAM

## Additional Configuration (Optional)

If you need to add authentication:

```bash
# In GCP resource creation script:
gcloud redis instances create genova-redis \
    --redis-config requirepass=YOUR_SECURE_PASSWORD

# In application:
REDIS_URL=redis://:YOUR_SECURE_PASSWORD@<REDIS_HOST>:6379/0
```

## Redis CLI Access (for debugging)

Using Cloud SQL Proxy pattern:

```bash
# SSH into a GCE instance in the same VPC, or use Cloud Shell
redis-cli -h <REDIS_HOST> -p 6379

# Check keys
KEYS video:*

# Monitor commands
MONITOR

# Get memory stats
INFO memory
```

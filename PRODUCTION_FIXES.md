# Production Fixes Implementation Guide

## Quick Fixes for Production Deployment

### 1. Fix Hardcoded Connections

**server/index.js:**
```javascript
const queue = new Queue("file-upload-queue", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});
```

**server/worker.js:**
```javascript
{
  concurrency: 3,
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
}
```

### 2. Fix CORS

**server/index.js:**
```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : ['http://localhost:3000'],
  credentials: true,
};

app.use(cors(corsOptions));
```

### 3. Add Production Scripts

**server/package.json:**
```json
{
  "scripts": {
    "start": "node index.js",
    "start:worker": "node worker.js",
    "dev": "node --watch index.js",
    "dev:worker": "node --watch worker.js"
  }
}
```

### 4. Fix Port Configuration

**server/index.js:**
```javascript
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server started on port: ${PORT}`));
```

### 5. Add Environment Validation

Create `server/config.js`:
```javascript
export function validateEnv() {
  const required = [
    'OPENAI_API_KEY',
    'QDRANT_URL',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

### 6. Update Docker Compose

**docker-compose.yml:**
```yaml
services:
  valkey:
    image: valkey/valkey 
    ports:
      - 6379:6379
    volumes:
      - valkey-data:/data
      
  qdrant:
    image: qdrant/qdrant
    ports: 
      - 6333:6333
    volumes:
      - qdrant-data:/qdrant/storage

volumes:
  valkey-data:
  qdrant-data:
```

### 7. Add Rate Limiting

Install: `pnpm add express-rate-limit`

**server/index.js:**
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 8. Add Health Check

**server/index.js:**
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: 'unknown',
      qdrant: 'unknown',
    }
  };
  
  // Check Redis
  try {
    await queue.client.ping();
    health.services.redis = 'ok';
  } catch (e) {
    health.services.redis = 'error';
    health.status = 'degraded';
  }
  
  // Check Qdrant
  try {
    const response = await fetch(`${process.env.QDRANT_URL}/health`);
    health.services.qdrant = response.ok ? 'ok' : 'error';
  } catch (e) {
    health.services.qdrant = 'error';
    health.status = 'degraded';
  }
  
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});
```


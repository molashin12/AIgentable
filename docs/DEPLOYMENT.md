# AIgentable Deployment Guide

## 📋 Overview

This guide covers the complete deployment process for AIgentable, from local development setup to production deployment. The platform consists of a React frontend, Node.js backend, and supporting infrastructure services.

### 🎯 Deployment Readiness Status: 90% Production Ready

**✅ Completed Infrastructure (95%)**
- Docker containerization with multi-stage builds ✅
- Docker Compose for local development ✅
- Production-ready Dockerfile configurations ✅
- Environment variable management ✅
- Database migrations and seeding ✅
- Redis caching setup ✅
- ChromaDB vector database ✅
- SSL/TLS configuration ✅
- Nginx reverse proxy setup ✅
- Health check endpoints ✅
- Monitoring and logging ✅
- Backup and disaster recovery ✅

**✅ Completed Services (90%)**
- Backend API fully functional ✅
- Frontend build optimization ✅
- Database optimization ✅
- Security middleware ✅
- API rate limiting ✅
- Error handling and logging ✅
- Performance monitoring ✅
- Analytics service ✅

**🚧 In Progress (10% Remaining)**
- CI/CD pipeline automation
- Kubernetes deployment manifests
- Advanced monitoring dashboards
- Load testing automation
- Security audit completion

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  Infrastructure │
│   (React)       │◄──►│   (Node.js)     │◄──►│   Services      │
│   Port: 5173    │    │   Port: 3001    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                │                 │
                                                │ PostgreSQL:5432 │
                                                │ Redis:6379      │
                                                │ ChromaDB:8000   │
                                                └─────────────────┘
```

## 🛠️ Prerequisites

### System Requirements
- **Node.js**: v18.0.0 or higher
- **npm/pnpm**: Latest stable version
- **Docker**: v20.0.0 or higher
- **Docker Compose**: v2.0.0 or higher
- **Git**: Latest stable version

### Development Tools
- **VS Code** (recommended) with extensions:
  - TypeScript and JavaScript Language Features
  - Prisma
  - Docker
  - ESLint
  - Prettier

### External Services
- **OpenAI API Key** (for AI functionality)
- **WhatsApp Business API** (for WhatsApp integration)
- **Email Service** (SendGrid, AWS SES, etc.)
- **File Storage** (AWS S3, Cloudinary, etc.)

---

## 🚀 Local Development Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/aigentable.git
cd aigentable
```

### 2. Environment Configuration

#### Frontend Environment (.env)
```bash
# API Configuration
VITE_API_URL=http://localhost:3001/api/v1
VITE_WS_URL=ws://localhost:3001

# Environment
VITE_NODE_ENV=development

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_REAL_TIME=true

# External Services
VITE_SENTRY_DSN=your_sentry_dsn_here
```

#### Backend Environment (backend/.env)
```bash
# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/aigentable_dev"
REDIS_URL="redis://localhost:6379"

# AI Services
OPENAI_API_KEY=your_openai_api_key_here
CHROMA_URL=http://localhost:8000

# Authentication
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
REFRESH_TOKEN_EXPIRES_IN=7d

# Email Service
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@aigentable.com

# File Upload
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=pdf,docx,txt

# WhatsApp Integration
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret

# Monitoring
SENTRY_DSN=your_sentry_dsn_here
LOG_LEVEL=debug
```

### 3. Install Dependencies

#### Frontend
```bash
npm install
# or
pnpm install
```

#### Backend
```bash
cd backend
npm install
# or
pnpm install
```

### 4. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, and ChromaDB
docker-compose up -d postgres redis chromadb

# Verify services are running
docker-compose ps
```

### 5. Database Setup

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database with initial data
npx prisma db seed
```

### 6. Start Development Servers

#### Terminal 1 - Backend
```bash
cd backend
npm run dev
```

#### Terminal 2 - Frontend
```bash
npm run dev
```

### 7. Verify Setup

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api/v1/health
- **API Documentation**: http://localhost:3001/api/docs
- **Database Admin**: http://localhost:5555 (Prisma Studio)

---

## 🐳 Docker Development

### Full Stack with Docker

```bash
# Build and start all services
docker-compose up --build

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Reset everything (including volumes)
docker-compose down -v
docker-compose up --build
```

### Individual Service Management

```bash
# Start only infrastructure
docker-compose up -d postgres redis chromadb

# Start backend only
docker-compose up backend

# Start frontend only
docker-compose up frontend

# Rebuild specific service
docker-compose build backend
docker-compose up -d backend
```

### Docker Compose Override

Create `docker-compose.override.yml` for local customizations:

```yaml
version: '3.8'

services:
  backend:
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - LOG_LEVEL=debug
    ports:
      - "9229:9229"  # Debug port

  frontend:
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:3001/api/v1
```

---

## 🌐 Production Deployment

### 1. Cloud Infrastructure Options

#### Option A: AWS Deployment

**Services Used:**
- **ECS Fargate**: Container orchestration
- **RDS PostgreSQL**: Managed database
- **ElastiCache Redis**: Managed Redis
- **S3**: File storage
- **CloudFront**: CDN
- **ALB**: Load balancer
- **Route 53**: DNS
- **ACM**: SSL certificates

#### Option B: Google Cloud Platform

**Services Used:**
- **Cloud Run**: Container deployment
- **Cloud SQL**: Managed PostgreSQL
- **Memorystore**: Managed Redis
- **Cloud Storage**: File storage
- **Cloud CDN**: Content delivery
- **Cloud Load Balancing**: Load balancer

#### Option C: DigitalOcean

**Services Used:**
- **App Platform**: Container deployment
- **Managed Databases**: PostgreSQL
- **Spaces**: Object storage
- **Load Balancers**: Traffic distribution

### 2. Environment Configuration

#### Production Environment Variables

**Frontend (.env.production):**
```bash
VITE_API_URL=https://api.aigentable.com/api/v1
VITE_WS_URL=wss://api.aigentable.com
VITE_NODE_ENV=production
VITE_SENTRY_DSN=your_production_sentry_dsn
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_REAL_TIME=true
```

**Backend (.env.production):**
```bash
# Server
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://app.aigentable.com

# Database (use managed service URLs)
DATABASE_URL=postgresql://user:pass@prod-db.amazonaws.com:5432/aigentable
REDIS_URL=redis://prod-redis.amazonaws.com:6379

# AI Services
OPENAI_API_KEY=your_production_openai_key
CHROMA_URL=https://chromadb.your-domain.com

# Security
JWT_SECRET=your_super_secure_production_jwt_secret
REFRESH_TOKEN_SECRET=your_production_refresh_secret

# External Services
SENDGRID_API_KEY=your_production_sendgrid_key
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=aigentable-production-files

# Monitoring
SENTRY_DSN=your_production_sentry_dsn
LOG_LEVEL=info
```

### 3. Build Process

#### Frontend Build
```bash
# Install dependencies
npm ci

# Build for production
npm run build

# Preview build locally
npm run preview
```

#### Backend Build
```bash
cd backend

# Install dependencies
npm ci

# Generate Prisma client
npx prisma generate

# Build TypeScript
npm run build

# Start production server
npm start
```

### 4. Docker Production Images

#### Frontend Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Backend Dockerfile
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
EXPOSE 3001
CMD ["npm", "start"]
```

### 5. Database Migration Strategy

#### Production Migration Process
```bash
# 1. Backup current database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migrations
npx prisma migrate deploy

# 3. Verify migration
npx prisma db pull
npx prisma generate
```

#### Zero-Downtime Deployment
```bash
#!/bin/bash
# deploy.sh

set -e

echo "Starting deployment..."

# 1. Build new images
docker build -t aigentable/backend:$BUILD_NUMBER ./backend
docker build -t aigentable/frontend:$BUILD_NUMBER .

# 2. Run database migrations
docker run --rm --env-file .env.production \
  aigentable/backend:$BUILD_NUMBER \
  npx prisma migrate deploy

# 3. Deploy backend (rolling update)
docker service update --image aigentable/backend:$BUILD_NUMBER backend

# 4. Deploy frontend
docker service update --image aigentable/frontend:$BUILD_NUMBER frontend

echo "Deployment completed successfully!"
```

---

## ☁️ Cloud-Specific Deployments

### AWS ECS Deployment

#### Task Definition (backend)
```json
{
  "family": "aigentable-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-account.dkr.ecr.region.amazonaws.com/aigentable-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:aigentable/database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/aigentable-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### CloudFormation Template
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AIgentable Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]

Resources:
  # VPC and Networking
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-aigentable-vpc'

  # RDS PostgreSQL
  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub '${Environment}-aigentable-db'
      DBInstanceClass: db.t3.micro
      Engine: postgres
      EngineVersion: '14.9'
      AllocatedStorage: 20
      StorageType: gp2
      DBName: aigentable
      MasterUsername: postgres
      MasterUserPassword: !Ref DatabasePassword
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup
      DBSubnetGroupName: !Ref DatabaseSubnetGroup

  # ElastiCache Redis
  RedisCluster:
    Type: AWS::ElastiCache::CacheCluster
    Properties:
      CacheNodeType: cache.t3.micro
      Engine: redis
      NumCacheNodes: 1
      VpcSecurityGroupIds:
        - !Ref RedisSecurityGroup
      CacheSubnetGroupName: !Ref RedisSubnetGroup

  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub '${Environment}-aigentable'
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT

  # Application Load Balancer
  LoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub '${Environment}-aigentable-alb'
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref LoadBalancerSecurityGroup
```

### Google Cloud Run Deployment

#### Backend Service Configuration
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: aigentable-backend
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "1Gi"
        run.googleapis.com/cpu: "1"
    spec:
      containerConcurrency: 100
      timeoutSeconds: 300
      containers:
      - image: gcr.io/your-project/aigentable-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-url
              key: url
        resources:
          limits:
            cpu: "1"
            memory: "1Gi"
```

#### Deployment Script
```bash
#!/bin/bash
# deploy-gcp.sh

set -e

PROJECT_ID="your-project-id"
REGION="us-central1"
SERVICE_NAME="aigentable-backend"

# Build and push image
docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest ./backend
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars NODE_ENV=production

echo "Deployment completed!"
echo "Service URL: $(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')"
```

---

## 🔧 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy AIgentable

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install backend dependencies
      run: cd backend && npm ci
    
    - name: Run frontend tests
      run: npm run test
    
    - name: Run backend tests
      run: cd backend && npm run test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        REDIS_URL: redis://localhost:6379
    
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        REDIS_URL: redis://localhost:6379

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}
    
    - name: Build and push backend image
      uses: docker/build-push-action@v5
      with:
        context: ./backend
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
    
    - name: Build and push frontend image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to production
      run: |
        echo "Deploying to production..."
        # Add your deployment commands here
        # e.g., kubectl apply, terraform apply, etc.
```

---

## 📊 Monitoring & Observability

### Health Checks

#### Backend Health Endpoint
```typescript
// backend/src/routes/health.ts
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      chromadb: await checkChromaDB(),
      openai: await checkOpenAI()
    }
  };
  
  const isHealthy = Object.values(health.services).every(service => service.status === 'ok');
  
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### Logging Configuration

#### Winston Logger Setup
```typescript
// backend/src/utils/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'aigentable-backend',
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log'
  }));
}

export default logger;
```

### Metrics Collection

#### Prometheus Metrics
```typescript
// backend/src/middleware/metrics.ts
import prometheus from 'prom-client';

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});

// Middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  
  next();
};
```

---

## 🔒 Security Considerations

### SSL/TLS Configuration

#### Nginx Configuration
```nginx
# nginx.conf
server {
    listen 80;
    server_name app.aigentable.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.aigentable.com;
    
    ssl_certificate /etc/ssl/certs/aigentable.crt;
    ssl_certificate_key /etc/ssl/private/aigentable.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Environment Security

#### Secrets Management
```bash
# Use AWS Secrets Manager
aws secretsmanager create-secret \
  --name "aigentable/production/database" \
  --description "Production database credentials" \
  --secret-string '{"username":"postgres","password":"secure_password"}'

# Use Kubernetes secrets
kubectl create secret generic aigentable-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=jwt-secret="your-jwt-secret" \
  --from-literal=openai-api-key="your-openai-key"
```

---

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check database migrations
npx prisma migrate status

# Reset database (development only)
npx prisma migrate reset
```

#### Redis Connection Issues
```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check Redis memory usage
redis-cli -u $REDIS_URL info memory
```

#### Container Issues
```bash
# Check container logs
docker logs aigentable-backend
docker logs aigentable-frontend

# Check container resource usage
docker stats

# Restart services
docker-compose restart backend
```

### Performance Optimization

#### Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_conversations_tenant_status 
ON conversations(tenant_id, status);

CREATE INDEX CONCURRENTLY idx_messages_conversation_timestamp 
ON messages(conversation_id, created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM conversations 
WHERE tenant_id = $1 AND status = 'ACTIVE';
```

#### Application Optimization
```typescript
// Enable compression
app.use(compression());

// Add response caching
app.use('/api/analytics', cache('5 minutes'));

// Connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] SSL certificates installed
- [ ] Monitoring setup complete
- [ ] Backup strategy implemented
- [ ] Load testing completed
- [ ] Security scan passed

### Deployment
- [ ] Build images successfully
- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Verify health checks
- [ ] Monitor application metrics
- [ ] Test critical user flows

### Post-Deployment
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify integrations working
- [ ] Update documentation
- [ ] Notify stakeholders

---

**Deployment Guide Version**: 1.0.0  
**Last Updated**: December 2024  
**Support**: devops@aigentable.com
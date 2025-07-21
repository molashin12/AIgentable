# AIgentable Backend API

## 🏗️ Architecture Overview

The AIgentable backend is a robust Node.js API server built with Express and TypeScript, designed to support a multi-tenant AI agent platform. It follows a clean architecture pattern with clear separation of concerns.

### Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15 with Prisma ORM
- **Caching**: Redis 7
- **Vector Database**: ChromaDB
- **Authentication**: JWT with bcrypt
- **Real-time**: Socket.io
- **File Processing**: Multer, PDF-parse, Mammoth
- **AI Integration**: OpenAI API
- **Documentation**: Swagger/OpenAPI

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Express middleware
│   ├── routes/            # API route definitions
│   ├── services/          # Business logic layer
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   ├── config/            # Configuration files
│   └── server.ts          # Application entry point
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # Database migrations
│   └── seed.ts           # Database seeding
├── tests/                 # Test files
├── logs/                  # Application logs
├── dist/                  # Compiled JavaScript
└── package.json
```

## 🗄️ Database Schema

### Core Entities

**Users & Tenants**
- `User`: Platform users with role-based access
- `Tenant`: Multi-tenant organizations
- `Session`: User session management

**AI Agents**
- `Agent`: AI agent configurations
- `AgentAnalytics`: Performance metrics
- `Document`: Training documents

**Communication**
- `Channel`: Integration channels (WhatsApp, Facebook, etc.)
- `Conversation`: Chat conversations
- `Message`: Individual messages

**Business**
- `Subscription`: Billing and plan management
- `ApiKey`: API access management
- `Analytics`: Platform analytics

### Key Relationships
```
Tenant (1) ──── (N) User
Tenant (1) ──── (N) Agent
Tenant (1) ──── (N) Channel
Agent (1) ──── (N) Conversation
Conversation (1) ──── (N) Message
Tenant (1) ──── (N) Document
```

## 🔐 Authentication & Security

### JWT Authentication
- Access tokens (15 minutes expiry)
- Refresh tokens (7 days expiry)
- Role-based access control (RBAC)
- Tenant isolation

### Security Middleware
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API rate limiting
- **Input Validation**: Joi schema validation
- **Password Hashing**: bcrypt with salt rounds

### User Roles
```typescript
enum UserRole {
  PLATFORM_ADMIN = 'PLATFORM_ADMIN'
  TENANT_ADMIN = 'TENANT_ADMIN'
  TENANT_USER = 'TENANT_USER'
}
```

## 🛣️ API Endpoints

### Authentication
```
POST   /api/auth/register     # User registration
POST   /api/auth/login        # User login
POST   /api/auth/refresh      # Token refresh
POST   /api/auth/logout       # User logout
POST   /api/auth/forgot       # Password reset
```

### Tenant Management
```
GET    /api/tenants           # List tenants (admin)
POST   /api/tenants           # Create tenant
GET    /api/tenants/:id       # Get tenant details
PUT    /api/tenants/:id       # Update tenant
DELETE /api/tenants/:id       # Delete tenant
GET    /api/tenants/:id/users # List tenant users
POST   /api/tenants/:id/users # Invite user
```

### Agent Management
```
GET    /api/agents            # List agents
POST   /api/agents            # Create agent
GET    /api/agents/:id        # Get agent details
PUT    /api/agents/:id        # Update agent
DELETE /api/agents/:id        # Delete agent
POST   /api/agents/:id/train  # Train agent
POST   /api/agents/:id/test   # Test agent
```

### Channel Integration
```
GET    /api/channels          # List channels
POST   /api/channels          # Create channel
GET    /api/channels/:id      # Get channel details
PUT    /api/channels/:id      # Update channel
DELETE /api/channels/:id      # Delete channel
POST   /api/channels/:id/test # Test channel connection
```

### Conversation Management
```
GET    /api/conversations     # List conversations
GET    /api/conversations/:id # Get conversation details
POST   /api/conversations/:id/messages # Send message
PUT    /api/conversations/:id/assign   # Assign to agent
PUT    /api/conversations/:id/close    # Close conversation
```

### Document Management
```
GET    /api/documents         # List documents
POST   /api/documents         # Upload document
GET    /api/documents/:id     # Get document details
DELETE /api/documents/:id     # Delete document
POST   /api/documents/:id/process # Process document
```

### Analytics
```
GET    /api/analytics/dashboard    # Dashboard metrics
GET    /api/analytics/agents       # Agent performance
GET    /api/analytics/conversations # Conversation metrics
GET    /api/analytics/channels     # Channel performance
```

## 🤖 AI Integration

### OpenAI Integration
- GPT-4 for conversation generation
- Text embedding for RAG system
- Function calling for structured responses
- Streaming responses for real-time chat

### RAG System (ChromaDB)
- Document vectorization
- Semantic search
- Context retrieval
- Knowledge base management

```typescript
// Example AI service structure
class AIService {
  async generateResponse(prompt: string, context: string[]): Promise<string>
  async embedDocument(content: string): Promise<number[]>
  async searchSimilar(query: string, limit: number): Promise<Document[]>
  async trainAgent(agentId: string, documents: Document[]): Promise<void>
}
```

## 🔄 Real-time Features

### Socket.io Events
```typescript
// Client to Server
'join_conversation'     // Join conversation room
'send_message'         // Send new message
'typing_start'         // Start typing indicator
'typing_stop'          // Stop typing indicator

// Server to Client
'new_message'          // New message received
'message_status'       // Message delivery status
'agent_response'       // AI agent response
'conversation_update'  // Conversation state change
'user_typing'          // User typing indicator
```

## 📊 Monitoring & Logging

### Winston Logger
- Structured logging with multiple transports
- Daily rotating log files
- Error tracking and alerting
- Performance monitoring

### Log Levels
```typescript
logger.error('Critical errors')
logger.warn('Warning messages')
logger.info('General information')
logger.debug('Debug information')
```

## 🧪 Testing

### Test Structure
```
tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
├── e2e/              # End-to-end tests
└── fixtures/         # Test data
```

### Testing Stack
- **Jest**: Testing framework
- **Supertest**: HTTP testing
- **Test Database**: Isolated test environment

### Running Tests
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## 🚀 Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 15
- Redis 7
- Docker (optional)

### Environment Variables
```bash
# Server Configuration
PORT=3001
NODE_ENV=development
API_VERSION=v1

# Database
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/aigentable"
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# AI Services
OPENAI_API_KEY="your-openai-key"
CHROMADB_URL="http://localhost:8000"

# External APIs
WHATSAPP_TOKEN="your-whatsapp-token"
FACEBOOK_APP_SECRET="your-facebook-secret"
```

### Quick Start
```bash
# Install dependencies
npm install

# Setup database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev

# Run in production
npm run build
npm start
```

## 📈 Performance Optimization

### Database Optimization
- Connection pooling
- Query optimization
- Proper indexing
- Pagination for large datasets

### Caching Strategy
- Redis for session storage
- API response caching
- Database query caching
- Static asset caching

### Rate Limiting
```typescript
// API rate limits
const rateLimits = {
  auth: '5 requests per minute',
  api: '100 requests per minute',
  upload: '10 requests per minute'
}
```

## 🔧 Current Implementation Status

### ✅ Completed
- [x] Express server setup with TypeScript
- [x] Prisma ORM configuration
- [x] JWT authentication system
- [x] Multi-tenant architecture
- [x] Basic CRUD operations
- [x] Database schema design
- [x] Environment configuration
- [x] Error handling middleware
- [x] Input validation
- [x] Security middleware
- [x] Logging system
- [x] API documentation structure

### 🚧 In Progress
- [ ] OpenAI API integration
- [ ] ChromaDB vector database
- [ ] File upload processing
- [ ] Socket.io real-time features
- [ ] Channel webhook handlers
- [ ] Analytics data collection

### 📋 Next Steps

#### Phase 1: AI Core (1-2 weeks)
1. **OpenAI Integration**
   - Implement AI service layer
   - Add conversation generation
   - Implement function calling
   - Add streaming responses

2. **RAG System**
   - ChromaDB integration
   - Document processing pipeline
   - Vector embedding generation
   - Semantic search implementation

3. **File Processing**
   - PDF document parsing
   - DOCX document processing
   - Text extraction and chunking
   - Metadata extraction

#### Phase 2: Real-time Features (1-2 weeks)
1. **Socket.io Implementation**
   - Real-time messaging
   - Typing indicators
   - Presence management
   - Room management

2. **Webhook Handlers**
   - WhatsApp webhook processing
   - Facebook Messenger webhooks
   - Instagram Direct webhooks
   - Telegram Bot webhooks

#### Phase 3: Advanced Features (2-3 weeks)
1. **Analytics System**
   - Metrics collection
   - Performance tracking
   - Business intelligence
   - Report generation

2. **Advanced AI Features**
   - Agent personality training
   - Context management
   - Multi-turn conversations
   - Intent recognition

3. **Production Features**
   - Health checks
   - Monitoring endpoints
   - Backup systems
   - Performance optimization

## 🐛 Debugging

### Common Issues
1. **Database Connection**: Check PostgreSQL service and credentials
2. **Redis Connection**: Verify Redis server is running
3. **JWT Errors**: Validate JWT secrets and token format
4. **CORS Issues**: Check frontend URL in CORS configuration

### Debug Commands
```bash
# Check database connection
npm run db:studio

# View logs
tail -f logs/combined.log

# Test API endpoints
curl -X GET http://localhost:3001/api/health
```

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Express.js Guide](https://expressjs.com/)
- [OpenAI API Reference](https://platform.openai.com/docs/)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Socket.io Documentation](https://socket.io/docs/)

---

**Maintainer**: AIgentable Development Team  
**Last Updated**: December 2024  
**API Version**: v1.0.0
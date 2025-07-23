# AIgentable API Documentation

## 📋 Overview

The AIgentable API is a RESTful service built with Node.js, Express, and TypeScript. It provides comprehensive endpoints for managing AI agents, conversations, channels, and analytics in a multi-tenant environment.

### Base Information
- **Base URL**: `https://api.aigentable.com/api/v1` (Production)
- **Development URL**: `http://localhost:3001/api/v1`
- **API Version**: v1.0.0
- **Authentication**: JWT Bearer tokens
- **Content Type**: `application/json`
- **Rate Limiting**: Varies by endpoint (see individual sections)

### 🚦 Implementation Status

**✅ Completed Endpoints (95% Complete):**
- Authentication & Authorization ✅
- Tenant Management ✅
- User Management ✅
- Agent Management ✅
- Conversation Management ✅
- Channel Integration ✅
- Analytics & Reporting ✅
- Search Functionality ✅
- Webhook Handling ✅
- System Management ✅
- API Key Management ✅
- Document Management ✅

**🚧 In Progress:**
- Real-time Socket.io endpoints
- Advanced webhook configurations
- Bulk operations endpoints

**📊 API Coverage:** 95% Complete

### Response Format
All API responses follow a consistent format:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2024-12-01T12:00:00.000Z",
  "requestId": "req_123456789"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "timestamp": "2024-12-01T12:00:00.000Z",
  "requestId": "req_123456789"
}
```

## 🔐 Authentication

### Overview
The API uses JWT (JSON Web Tokens) for authentication with access and refresh token pattern.

### Token Types
- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

### Authentication Header
```
Authorization: Bearer <access_token>
```

### Endpoints

#### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "tenantName": "Acme Corp",
  "role": "TENANT_ADMIN"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "TENANT_ADMIN",
      "tenantId": "tenant_456"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 900
    }
  }
}
```

#### Login User
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "TENANT_ADMIN",
      "tenantId": "tenant_456"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 900
    }
  }
}
```

#### Refresh Token
```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Logout
```http
POST /auth/logout
```

**Headers:** `Authorization: Bearer <access_token>`

#### Forgot Password
```http
POST /auth/forgot-password
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### Reset Password
```http
POST /auth/reset-password
```

**Request Body:**
```json
{
  "token": "reset_token_123",
  "newPassword": "newSecurePassword123"
}
```

---

## 🏢 Tenant Management

### Endpoints

#### List Tenants (Platform Admin Only)
```http
GET /tenants
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `search` (string): Search by tenant name
- `status` (string): Filter by status (ACTIVE, INACTIVE, SUSPENDED)

**Response:**
```json
{
  "success": true,
  "data": {
    "tenants": [
      {
        "id": "tenant_123",
        "name": "Acme Corp",
        "status": "ACTIVE",
        "subscriptionPlan": "PROFESSIONAL",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "userCount": 5,
        "agentCount": 3
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

#### Get Tenant Details
```http
GET /tenants/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tenant_123",
    "name": "Acme Corp",
    "status": "ACTIVE",
    "subscriptionPlan": "PROFESSIONAL",
    "settings": {
      "timezone": "UTC",
      "language": "en",
      "branding": {
        "primaryColor": "#3b82f6",
        "logo": "https://cdn.example.com/logo.png"
      }
    },
    "usage": {
      "messagesThisMonth": 1250,
      "messagesLimit": 10000,
      "agentsUsed": 3,
      "agentsLimit": 5
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-12-01T00:00:00.000Z"
  }
}
```

#### Update Tenant
```http
PUT /tenants/:id
```

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "settings": {
    "timezone": "America/New_York",
    "language": "en",
    "branding": {
      "primaryColor": "#1e40af",
      "logo": "https://cdn.example.com/new-logo.png"
    }
  }
}
```

#### List Tenant Users
```http
GET /tenants/:id/users
```

#### Invite User to Tenant
```http
POST /tenants/:id/users
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "role": "TENANT_USER",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

---

## 🤖 Agent Management

### Endpoints

#### List Agents
```http
GET /agents
```

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by status (ACTIVE, TRAINING, DRAFT)
- `search` (string): Search by agent name

**Response:**
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": "agent_123",
        "name": "Customer Support Bot",
        "description": "Handles customer inquiries and support requests",
        "status": "ACTIVE",
        "personality": "PROFESSIONAL",
        "configuration": {
          "responseLength": "MEDIUM",
          "creativity": 0.7,
          "temperature": 0.8
        },
        "performance": {
          "totalConversations": 150,
          "averageRating": 4.2,
          "responseTime": 1.8
        },
        "createdAt": "2024-01-15T00:00:00.000Z",
        "updatedAt": "2024-12-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

#### Create Agent
```http
POST /agents
```

**Request Body:**
```json
{
  "name": "Sales Assistant",
  "description": "Helps with product inquiries and sales",
  "personality": "FRIENDLY",
  "configuration": {
    "responseLength": "MEDIUM",
    "creativity": 0.8,
    "temperature": 0.9,
    "systemPrompt": "You are a helpful sales assistant..."
  },
  "fallbackBehavior": {
    "escalateToHuman": true,
    "escalationTriggers": ["complex_query", "negative_sentiment"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agent_456",
    "name": "Sales Assistant",
    "description": "Helps with product inquiries and sales",
    "status": "DRAFT",
    "personality": "FRIENDLY",
    "configuration": {
      "responseLength": "MEDIUM",
      "creativity": 0.8,
      "temperature": 0.9,
      "systemPrompt": "You are a helpful sales assistant..."
    },
    "createdAt": "2024-12-01T12:00:00.000Z",
    "updatedAt": "2024-12-01T12:00:00.000Z"
  }
}
```

#### Get Agent Details
```http
GET /agents/:id
```

#### Update Agent
```http
PUT /agents/:id
```

#### Delete Agent
```http
DELETE /agents/:id
```

#### Train Agent
```http
POST /agents/:id/train
```

**Request Body:**
```json
{
  "documentIds": ["doc_123", "doc_456"],
  "trainingOptions": {
    "chunkSize": 1000,
    "overlap": 200,
    "embeddingModel": "text-embedding-ada-002"
  }
}
```

#### Test Agent
```http
POST /agents/:id/test
```

**Request Body:**
```json
{
  "message": "What are your business hours?",
  "context": {
    "channel": "website",
    "userId": "user_789"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "Our business hours are Monday to Friday, 9 AM to 6 PM EST. We're closed on weekends and major holidays.",
    "confidence": 0.95,
    "responseTime": 1.2,
    "tokensUsed": 45,
    "sources": [
      {
        "documentId": "doc_123",
        "chunk": "Business hours: Mon-Fri 9AM-6PM EST",
        "relevance": 0.98
      }
    ]
  }
}
```

---

## 📱 Channel Management

### Endpoints

#### List Channels
```http
GET /channels
```

**Response:**
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "id": "channel_123",
        "type": "WHATSAPP",
        "name": "WhatsApp Business",
        "status": "ACTIVE",
        "configuration": {
          "phoneNumber": "+1234567890",
          "businessAccountId": "123456789"
        },
        "performance": {
          "messagesReceived": 450,
          "messagesSent": 420,
          "averageResponseTime": 2.1
        },
        "createdAt": "2024-01-20T00:00:00.000Z",
        "lastActivity": "2024-12-01T11:30:00.000Z"
      }
    ]
  }
}
```

#### Create Channel
```http
POST /channels
```

**Request Body (WhatsApp):**
```json
{
  "type": "WHATSAPP",
  "name": "Main WhatsApp",
  "configuration": {
    "phoneNumber": "+1234567890",
    "accessToken": "your_whatsapp_token",
    "businessAccountId": "123456789",
    "webhookVerifyToken": "verify_token_123"
  },
  "agentId": "agent_123"
}
```

**Request Body (Website Widget):**
```json
{
  "type": "WEBSITE",
  "name": "Website Chat",
  "configuration": {
    "widgetStyle": {
      "primaryColor": "#3b82f6",
      "position": "bottom-right",
      "greeting": "Hi! How can I help you today?"
    },
    "allowedDomains": ["https://example.com", "https://www.example.com"]
  },
  "agentId": "agent_123"
}
```

#### Update Channel
```http
PUT /channels/:id
```

#### Delete Channel
```http
DELETE /channels/:id
```

#### Test Channel Connection
```http
POST /channels/:id/test
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connectionStatus": "CONNECTED",
    "testMessage": "Test message sent successfully",
    "responseTime": 0.8,
    "details": {
      "webhookStatus": "VERIFIED",
      "apiAccess": "VALID",
      "permissions": ["messages", "webhooks"]
    }
  }
}
```

---

## 💬 Conversation Management

### Endpoints

#### List Conversations
```http
GET /conversations
```

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by status (ACTIVE, CLOSED, WAITING)
- `channelId` (string): Filter by channel
- `agentId` (string): Filter by agent
- `priority` (string): Filter by priority (LOW, MEDIUM, HIGH, URGENT)
- `search` (string): Search in messages
- `dateFrom` (string): Start date (ISO format)
- `dateTo` (string): End date (ISO format)

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv_123",
        "status": "ACTIVE",
        "priority": "MEDIUM",
        "channel": {
          "id": "channel_123",
          "type": "WHATSAPP",
          "name": "WhatsApp Business"
        },
        "agent": {
          "id": "agent_123",
          "name": "Customer Support Bot"
        },
        "customer": {
          "id": "customer_456",
          "name": "John Customer",
          "phone": "+1234567890"
        },
        "messageCount": 8,
        "lastMessage": {
          "content": "Thank you for your help!",
          "timestamp": "2024-12-01T11:45:00.000Z",
          "sender": "CUSTOMER"
        },
        "createdAt": "2024-12-01T10:00:00.000Z",
        "updatedAt": "2024-12-01T11:45:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

#### Get Conversation Details
```http
GET /conversations/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "conv_123",
    "status": "ACTIVE",
    "priority": "MEDIUM",
    "channel": {
      "id": "channel_123",
      "type": "WHATSAPP",
      "name": "WhatsApp Business"
    },
    "agent": {
      "id": "agent_123",
      "name": "Customer Support Bot"
    },
    "customer": {
      "id": "customer_456",
      "name": "John Customer",
      "phone": "+1234567890",
      "email": "john@example.com"
    },
    "messages": [
      {
        "id": "msg_789",
        "content": "Hi, I need help with my order",
        "type": "TEXT",
        "sender": "CUSTOMER",
        "timestamp": "2024-12-01T10:00:00.000Z",
        "metadata": {
          "deliveryStatus": "DELIVERED",
          "readStatus": "READ"
        }
      },
      {
        "id": "msg_790",
        "content": "I'd be happy to help you with your order. Could you please provide your order number?",
        "type": "TEXT",
        "sender": "AGENT",
        "timestamp": "2024-12-01T10:01:00.000Z",
        "metadata": {
          "aiGenerated": true,
          "confidence": 0.95,
          "responseTime": 1.2
        }
      }
    ],
    "createdAt": "2024-12-01T10:00:00.000Z",
    "updatedAt": "2024-12-01T11:45:00.000Z"
  }
}
```

#### Send Message
```http
POST /conversations/:id/messages
```

**Request Body:**
```json
{
  "content": "Thank you for contacting us. How can I help you today?",
  "type": "TEXT",
  "sender": "AGENT",
  "metadata": {
    "manualOverride": true
  }
}
```

#### Assign Conversation
```http
PUT /conversations/:id/assign
```

**Request Body:**
```json
{
  "agentId": "agent_456",
  "reason": "Escalated to human agent"
}
```

#### Close Conversation
```http
PUT /conversations/:id/close
```

**Request Body:**
```json
{
  "reason": "RESOLVED",
  "summary": "Customer issue resolved successfully",
  "rating": 5
}
```

---

## 📄 Document Management

### Endpoints

#### List Documents
```http
GET /documents
```

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `type` (string): Filter by type (PDF, DOCX, TXT, URL)
- `status` (string): Filter by status (UPLOADED, PROCESSING, PROCESSED, ERROR)
- `search` (string): Search by filename or content

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_123",
        "filename": "product-manual.pdf",
        "type": "PDF",
        "status": "PROCESSED",
        "size": 2048576,
        "pageCount": 45,
        "chunkCount": 120,
        "processingTime": 15.6,
        "metadata": {
          "title": "Product Manual v2.1",
          "author": "Acme Corp",
          "language": "en"
        },
        "uploadedAt": "2024-11-15T00:00:00.000Z",
        "processedAt": "2024-11-15T00:01:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "pages": 1
    }
  }
}
```

#### Upload Document
```http
POST /documents
```

**Request:** Multipart form data
- `file`: Document file (PDF, DOCX, TXT)
- `metadata`: JSON string with additional metadata

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "doc_456",
    "filename": "faq.docx",
    "type": "DOCX",
    "status": "UPLOADED",
    "size": 1024000,
    "uploadedAt": "2024-12-01T12:00:00.000Z"
  }
}
```

#### Get Document Details
```http
GET /documents/:id
```

#### Delete Document
```http
DELETE /documents/:id
```

#### Process Document
```http
POST /documents/:id/process
```

**Request Body:**
```json
{
  "options": {
    "chunkSize": 1000,
    "overlap": 200,
    "extractMetadata": true,
    "generateSummary": true
  }
}
```

#### Download Document
```http
GET /documents/:id/download
```

---

## 📊 Analytics

### Endpoints

#### Dashboard Metrics
```http
GET /analytics/dashboard
```

**Query Parameters:**
- `period` (string): Time period (today, week, month, quarter, year)
- `timezone` (string): Timezone for date calculations

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalConversations": 1250,
      "activeAgents": 5,
      "averageResponseTime": 2.1,
      "customerSatisfaction": 4.3,
      "messagesProcessed": 8750
    },
    "trends": {
      "conversationsGrowth": 15.2,
      "responseTimeImprovement": -8.5,
      "satisfactionChange": 2.1
    },
    "channelBreakdown": [
      {
        "channel": "WHATSAPP",
        "conversations": 650,
        "percentage": 52
      },
      {
        "channel": "WEBSITE",
        "conversations": 400,
        "percentage": 32
      },
      {
        "channel": "FACEBOOK",
        "conversations": 200,
        "percentage": 16
      }
    ],
    "timeSeriesData": [
      {
        "date": "2024-11-01",
        "conversations": 45,
        "messages": 320,
        "responseTime": 2.3
      }
    ]
  }
}
```

#### Agent Performance
```http
GET /analytics/agents
```

**Query Parameters:**
- `agentId` (string): Specific agent ID
- `period` (string): Time period
- `metrics` (string[]): Specific metrics to include

**Response:**
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "agentId": "agent_123",
        "agentName": "Customer Support Bot",
        "metrics": {
          "totalConversations": 450,
          "averageResponseTime": 1.8,
          "customerRating": 4.2,
          "resolutionRate": 0.85,
          "escalationRate": 0.15
        },
        "performance": {
          "accuracy": 0.92,
          "efficiency": 0.88,
          "customerSatisfaction": 4.2
        },
        "trends": {
          "conversationsChange": 12.5,
          "responseTimeChange": -5.2,
          "ratingChange": 0.3
        }
      }
    ]
  }
}
```

#### Conversation Analytics
```http
GET /analytics/conversations
```

#### Channel Performance
```http
GET /analytics/channels
```

#### Custom Report
```http
POST /analytics/reports
```

**Request Body:**
```json
{
  "name": "Monthly Performance Report",
  "type": "CUSTOM",
  "filters": {
    "dateRange": {
      "start": "2024-11-01",
      "end": "2024-11-30"
    },
    "channels": ["WHATSAPP", "WEBSITE"],
    "agents": ["agent_123", "agent_456"]
  },
  "metrics": [
    "conversations",
    "responseTime",
    "satisfaction",
    "resolution"
  ],
  "format": "PDF",
  "schedule": {
    "frequency": "MONTHLY",
    "recipients": ["admin@example.com"]
  }
}
```

---

## ⚙️ Settings & Configuration

### Endpoints

#### Get Tenant Settings
```http
GET /settings
```

#### Update Tenant Settings
```http
PUT /settings
```

**Request Body:**
```json
{
  "general": {
    "timezone": "America/New_York",
    "language": "en",
    "dateFormat": "MM/DD/YYYY",
    "timeFormat": "12h"
  },
  "branding": {
    "primaryColor": "#3b82f6",
    "secondaryColor": "#10b981",
    "logo": "https://cdn.example.com/logo.png",
    "favicon": "https://cdn.example.com/favicon.ico"
  },
  "notifications": {
    "email": {
      "newConversations": true,
      "escalations": true,
      "dailyReports": false
    },
    "slack": {
      "webhookUrl": "https://hooks.slack.com/...",
      "channel": "#customer-support"
    }
  },
  "security": {
    "sessionTimeout": 3600,
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireNumbers": true,
      "requireSymbols": true
    },
    "ipWhitelist": ["192.168.1.0/24"]
  }
}
```

#### List API Keys
```http
GET /settings/api-keys
```

#### Create API Key
```http
POST /settings/api-keys
```

**Request Body:**
```json
{
  "name": "Integration API Key",
  "permissions": ["conversations:read", "agents:read", "analytics:read"],
  "expiresAt": "2025-12-01T00:00:00.000Z"
}
```

#### Revoke API Key
```http
DELETE /settings/api-keys/:id
```

---

## 🔗 Webhooks

### Webhook Events

The API supports webhooks for real-time event notifications:

#### Available Events
- `conversation.created`
- `conversation.updated`
- `conversation.closed`
- `message.received`
- `message.sent`
- `agent.trained`
- `channel.connected`
- `channel.disconnected`

#### Webhook Payload Format
```json
{
  "event": "conversation.created",
  "timestamp": "2024-12-01T12:00:00.000Z",
  "data": {
    "conversationId": "conv_123",
    "channelId": "channel_456",
    "agentId": "agent_789",
    "customerId": "customer_101"
  },
  "tenantId": "tenant_123"
}
```

#### Configure Webhooks
```http
POST /webhooks
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/aigentable",
  "events": ["conversation.created", "message.received"],
  "secret": "webhook_secret_123",
  "active": true
}
```

---

## 🚨 Error Codes

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

### Application Error Codes
```json
{
  "VALIDATION_ERROR": "Input validation failed",
  "AUTHENTICATION_FAILED": "Invalid credentials",
  "TOKEN_EXPIRED": "Access token has expired",
  "INSUFFICIENT_PERMISSIONS": "User lacks required permissions",
  "RESOURCE_NOT_FOUND": "Requested resource not found",
  "RATE_LIMIT_EXCEEDED": "API rate limit exceeded",
  "TENANT_SUSPENDED": "Tenant account is suspended",
  "QUOTA_EXCEEDED": "Usage quota exceeded",
  "INTEGRATION_ERROR": "Third-party integration error",
  "AI_SERVICE_UNAVAILABLE": "AI service temporarily unavailable"
}
```

---

## 🔒 Rate Limiting

### Rate Limits by Endpoint Category

| Category | Limit | Window |
|----------|-------|--------|
| Authentication | 5 requests | 1 minute |
| General API | 100 requests | 1 minute |
| File Upload | 10 requests | 1 minute |
| AI Processing | 20 requests | 1 minute |
| Analytics | 50 requests | 1 minute |
| Webhooks | 1000 requests | 1 minute |

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1638360000
X-RateLimit-Window: 60
```

---

## 📝 Changelog

### v1.0.0 (Current)
- Initial API release
- Authentication and user management
- Agent creation and management
- Channel integrations
- Conversation handling
- Document processing
- Basic analytics

### Upcoming Features
- Advanced AI capabilities
- Real-time streaming
- Enhanced analytics
- Workflow automation
- Advanced security features

---

**API Documentation Version**: 1.0.0  
**Last Updated**: December 2024  
**Support**: api-support@aigentable.com
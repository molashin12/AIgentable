# Backend API Integration Guide

This document provides comprehensive documentation for all AIgentable backend API endpoints and their integration with the React frontend.

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Frontend Integration](#frontend-integration)
5. [Error Handling](#error-handling)
6. [Real-time Features](#real-time-features)
7. [File Upload](#file-upload)
8. [Best Practices](#best-practices)

## API Overview

### Base Configuration
- **Base URL**: `http://localhost:3000/api/v1`
- **Authentication**: JWT Bearer tokens
- **Content-Type**: `application/json`
- **Rate Limiting**: Applied per endpoint

### Common Headers
```javascript
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer <jwt_token>',
  'X-Tenant-ID': '<tenant_id>' // Required for tenant-specific operations
}
```

## Authentication

### Auth Endpoints

#### POST /auth/register
Register a new user account.

**Request:**
```javascript
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "tenantName": "My Company" // Optional, creates new tenant
}
```

**Response:**
```javascript
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "TENANT_ADMIN"
  },
  "tenant": {
    "id": "tenant_id",
    "name": "My Company"
  },
  "token": "jwt_token_here"
}
```

#### POST /auth/login
Authenticate user and get access token.

**Request:**
```javascript
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```javascript
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "TENANT_ADMIN",
    "tenantId": "tenant_id"
  },
  "token": "jwt_token_here"
}
```

#### POST /auth/logout
Invalidate current session.

#### POST /auth/forgot-password
Request password reset.

#### POST /auth/reset-password
Reset password with token.

#### GET /auth/me
Get current user information.

## API Endpoints

### Users Management

#### GET /users
Get paginated list of users in tenant.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search term
- `role`: Filter by role
- `status`: Filter by status

**Response:**
```javascript
{
  "users": [
    {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "TENANT_USER",
      "status": "ACTIVE",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

#### POST /users
Create new user in tenant.

#### GET /users/:id
Get specific user details.

#### PUT /users/:id
Update user information.

#### DELETE /users/:id
Delete user account.

### Tenant Management

#### GET /tenants
Get tenant information (admin only).

#### PUT /tenants/:id
Update tenant settings.

#### GET /tenants/:id/usage
Get tenant usage statistics.

#### GET /tenants/:id/billing
Get billing information.

### AI Agents

#### GET /agents
Get paginated list of AI agents.

**Query Parameters:**
- `page`, `limit`: Pagination
- `search`: Search by name/description
- `status`: Filter by status (ACTIVE, INACTIVE, TRAINING)
- `category`: Filter by category

#### POST /agents
Create new AI agent.

**Request:**
```javascript
{
  "name": "Customer Support Agent",
  "description": "Handles customer inquiries",
  "personality": "friendly and helpful",
  "instructions": "Always be polite and provide accurate information",
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 1000,
  "category": "CUSTOMER_SERVICE",
  "isActive": true
}
```

#### GET /agents/:id
Get specific agent details.

#### PUT /agents/:id
Update agent configuration.

#### DELETE /agents/:id
Delete agent.

#### POST /agents/:id/test
Test agent with sample input.

#### POST /agents/:id/train
Train agent with documents.

### Documents & Knowledge Base

#### GET /documents
Get paginated list of documents.

#### POST /documents/upload
Upload documents for knowledge base.

**Request:** Multipart form data
- `files`: Document files (PDF, DOCX, TXT)
- `agentId`: Target agent ID
- `category`: Document category

#### GET /documents/:id
Get document details.

#### DELETE /documents/:id
Delete document.

#### POST /documents/:id/process
Process document for vector embeddings.

### Channels & Integrations

#### GET /channels
Get configured channels.

#### POST /channels
Create new channel integration.

**Request:**
```javascript
{
  "type": "WHATSAPP", // WHATSAPP, FACEBOOK, INSTAGRAM, TELEGRAM, WEBSITE
  "name": "WhatsApp Business",
  "config": {
    "phoneNumber": "+1234567890",
    "accessToken": "token_here",
    "webhookUrl": "https://your-domain.com/webhooks/whatsapp"
  },
  "agentId": "agent_id",
  "isActive": true
}
```

#### GET /channels/:id
Get channel details.

#### PUT /channels/:id
Update channel configuration.

#### DELETE /channels/:id
Delete channel.

#### POST /channels/:id/test
Test channel connection.

### Conversations

#### GET /conversations
Get paginated conversations.

**Query Parameters:**
- `page`, `limit`: Pagination
- `channelId`: Filter by channel
- `agentId`: Filter by agent
- `status`: Filter by status
- `startDate`, `endDate`: Date range

#### GET /conversations/:id
Get conversation details with messages.

#### POST /conversations/:id/messages
Send message in conversation.

#### PUT /conversations/:id/assign
Assign conversation to human agent.

#### PUT /conversations/:id/status
Update conversation status.

### Analytics

#### GET /analytics/overview
Get dashboard overview metrics.

**Response:**
```javascript
{
  "totalConversations": 1250,
  "activeAgents": 5,
  "averageResponseTime": 2.5,
  "customerSatisfaction": 4.2,
  "conversationsToday": 45,
  "messagesProcessed": 3420
}
```

#### GET /analytics/conversations
Get conversation analytics.

#### GET /analytics/agents
Get agent performance metrics.

#### GET /analytics/channels
Get channel performance data.

#### GET /analytics/export
Export analytics data.

### Search

#### GET /search/conversations
Search conversations.

#### GET /search/documents
Search knowledge base documents.

#### GET /search/agents
Search AI agents.

### API Keys

#### GET /api-keys
Get API keys for tenant.

#### POST /api-keys
Create new API key.

**Request:**
```javascript
{
  "name": "Mobile App Key",
  "permissions": [
    "conversations:read",
    "conversations:write",
    "messages:read"
  ],
  "rateLimit": 1000,
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

#### DELETE /api-keys/:id
Revoke API key.

### AI Providers

#### GET /ai-providers
Get configured AI providers.

#### POST /ai-providers
Add AI provider configuration.

#### PUT /ai-providers/:id
Update provider settings.

### System (Admin Only)

#### GET /system/health
Get system health status.

#### GET /system/metrics
Get system performance metrics.

#### GET /system/backups
Get backup status.

#### POST /system/backups
Create system backup.

### Webhooks

#### POST /webhooks/whatsapp
WhatsApp webhook endpoint.

#### POST /webhooks/facebook
Facebook Messenger webhook.

#### POST /webhooks/telegram
Telegram webhook.

## Frontend Integration

### API Client Setup

Create a centralized API client in `src/lib/api.ts`:

```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

class APIClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private tenantId: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        if (this.tenantId) {
          config.headers['X-Tenant-ID'] = this.tenantId;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearAuth();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setAuth(token: string, tenantId: string) {
    this.token = token;
    this.tenantId = tenantId;
    localStorage.setItem('token', token);
    localStorage.setItem('tenantId', tenantId);
  }

  clearAuth() {
    this.token = null;
    this.tenantId = null;
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
  }

  // Auth methods
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    const { user, token } = response.data;
    this.setAuth(token, user.tenantId);
    return response.data;
  }

  async register(userData: any) {
    const response = await this.client.post('/auth/register', userData);
    const { user, token } = response.data;
    this.setAuth(token, user.tenantId);
    return response.data;
  }

  async logout() {
    await this.client.post('/auth/logout');
    this.clearAuth();
  }

  // Agent methods
  async getAgents(params?: any) {
    const response = await this.client.get('/agents', { params });
    return response.data;
  }

  async createAgent(agentData: any) {
    const response = await this.client.post('/agents', agentData);
    return response.data;
  }

  async updateAgent(id: string, agentData: any) {
    const response = await this.client.put(`/agents/${id}`, agentData);
    return response.data;
  }

  async deleteAgent(id: string) {
    await this.client.delete(`/agents/${id}`);
  }

  // Conversation methods
  async getConversations(params?: any) {
    const response = await this.client.get('/conversations', { params });
    return response.data;
  }

  async getConversation(id: string) {
    const response = await this.client.get(`/conversations/${id}`);
    return response.data;
  }

  async sendMessage(conversationId: string, message: any) {
    const response = await this.client.post(`/conversations/${conversationId}/messages`, message);
    return response.data;
  }

  // Document methods
  async uploadDocuments(files: FileList, agentId: string) {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    formData.append('agentId', agentId);

    const response = await this.client.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Analytics methods
  async getAnalyticsOverview() {
    const response = await this.client.get('/analytics/overview');
    return response.data;
  }

  async getConversationAnalytics(params?: any) {
    const response = await this.client.get('/analytics/conversations', { params });
    return response.data;
  }
}

export const apiClient = new APIClient();
```

### React Hooks for API Integration

Create custom hooks in `src/hooks/`:

```typescript
// src/hooks/useAgents.ts
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

export const useAgents = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAgents = async (params?: any) => {
    try {
      setLoading(true);
      const data = await apiClient.getAgents(params);
      setAgents(data.agents);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createAgent = async (agentData: any) => {
    try {
      const newAgent = await apiClient.createAgent(agentData);
      setAgents(prev => [...prev, newAgent]);
      return newAgent;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateAgent = async (id: string, agentData: any) => {
    try {
      const updatedAgent = await apiClient.updateAgent(id, agentData);
      setAgents(prev => prev.map(agent => 
        agent.id === id ? updatedAgent : agent
      ));
      return updatedAgent;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteAgent = async (id: string) => {
    try {
      await apiClient.deleteAgent(id);
      setAgents(prev => prev.filter(agent => agent.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  return {
    agents,
    loading,
    error,
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent
  };
};
```

### State Management with Zustand

Update your Zustand stores to integrate with the API:

```typescript
// src/stores/authStore.ts
import { create } from 'zustand';
import { apiClient } from '../lib/api';

interface AuthState {
  user: any | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (email: string, password: string) => {
    try {
      const { user, token } = await apiClient.login(email, password);
      set({ user, token, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },

  register: async (userData: any) => {
    try {
      const { user, token } = await apiClient.register(userData);
      set({ user, token, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },

  logout: () => {
    apiClient.logout();
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: () => {
    const token = localStorage.getItem('token');
    if (token) {
      set({ token, isAuthenticated: true });
      // Optionally fetch user data
    }
  }
}));
```

### Component Integration Examples

#### Agent Builder Component

```typescript
// src/pages/AgentBuilder.tsx
import React, { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import { toast } from 'sonner';

export const AgentBuilder: React.FC = () => {
  const { agents, createAgent, updateAgent, deleteAgent, loading } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    personality: '',
    instructions: '',
    model: 'gpt-4',
    temperature: 0.7
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedAgent) {
        await updateAgent(selectedAgent.id, formData);
        toast.success('Agent updated successfully');
      } else {
        await createAgent(formData);
        toast.success('Agent created successfully');
      }
      setFormData({ name: '', description: '', personality: '', instructions: '', model: 'gpt-4', temperature: 0.7 });
      setSelectedAgent(null);
    } catch (error) {
      toast.error('Failed to save agent');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      try {
        await deleteAgent(id);
        toast.success('Agent deleted successfully');
      } catch (error) {
        toast.error('Failed to delete agent');
      }
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">AI Agent Builder</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">
            {selectedAgent ? 'Edit Agent' : 'Create New Agent'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Agent Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 border rounded-lg"
              required
            />
            
            <textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-3 border rounded-lg h-24"
            />
            
            <textarea
              placeholder="Personality"
              value={formData.personality}
              onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
              className="w-full p-3 border rounded-lg h-24"
            />
            
            <textarea
              placeholder="Instructions"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="w-full p-3 border rounded-lg h-32"
            />
            
            <select
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full p-3 border rounded-lg"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Temperature: {formData.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"
            >
              {selectedAgent ? 'Update Agent' : 'Create Agent'}
            </button>
            
            {selectedAgent && (
              <button
                type="button"
                onClick={() => {
                  setSelectedAgent(null);
                  setFormData({ name: '', description: '', personality: '', instructions: '', model: 'gpt-4', temperature: 0.7 });
                }}
                className="w-full bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600"
              >
                Cancel Edit
              </button>
            )}
          </form>
        </div>
        
        {/* Agents List */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Your Agents</h2>
          
          {loading ? (
            <div className="text-center py-8">Loading agents...</div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id} className="border p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{agent.name}</h3>
                      <p className="text-gray-600 text-sm">{agent.description}</p>
                      <span className={`inline-block px-2 py-1 text-xs rounded ${
                        agent.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {agent.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedAgent(agent);
                          setFormData({
                            name: agent.name,
                            description: agent.description,
                            personality: agent.personality,
                            instructions: agent.instructions,
                            model: agent.model,
                            temperature: agent.temperature
                          });
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

## Error Handling

### Global Error Handler

```typescript
// src/utils/errorHandler.ts
import { toast } from 'sonner';

export const handleApiError = (error: any) => {
  if (error.response) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        toast.error(data.message || 'Invalid request');
        break;
      case 401:
        toast.error('Authentication required');
        break;
      case 403:
        toast.error('Access denied');
        break;
      case 404:
        toast.error('Resource not found');
        break;
      case 429:
        toast.error('Too many requests. Please try again later.');
        break;
      case 500:
        toast.error('Server error. Please try again.');
        break;
      default:
        toast.error('An unexpected error occurred');
    }
  } else if (error.request) {
    toast.error('Network error. Please check your connection.');
  } else {
    toast.error('An unexpected error occurred');
  }
};
```

## Real-time Features

### Socket.IO Integration

```typescript
// src/hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (token && user) {
      socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
        auth: {
          token,
          tenantId: user.tenantId
        }
      });

      socketRef.current.on('connect', () => {
        console.log('Connected to server');
      });

      socketRef.current.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      return () => {
        socketRef.current?.disconnect();
      };
    }
  }, [token, user]);

  const joinConversation = (conversationId: string) => {
    socketRef.current?.emit('join-conversation', conversationId);
  };

  const leaveConversation = (conversationId: string) => {
    socketRef.current?.emit('leave-conversation', conversationId);
  };

  const sendMessage = (conversationId: string, message: any) => {
    socketRef.current?.emit('send-message', { conversationId, message });
  };

  const onNewMessage = (callback: (message: any) => void) => {
    socketRef.current?.on('new-message', callback);
  };

  const onConversationUpdate = (callback: (conversation: any) => void) => {
    socketRef.current?.on('conversation-updated', callback);
  };

  return {
    socket: socketRef.current,
    joinConversation,
    leaveConversation,
    sendMessage,
    onNewMessage,
    onConversationUpdate
  };
};
```

## File Upload

### Document Upload Component

```typescript
// src/components/DocumentUpload.tsx
import React, { useState } from 'react';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';

interface DocumentUploadProps {
  agentId: string;
  onUploadComplete?: () => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ agentId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;

    setUploading(true);
    try {
      await apiClient.uploadDocuments(files, agentId);
      toast.success(`${files.length} document(s) uploaded successfully`);
      onUploadComplete?.();
    } catch (error) {
      toast.error('Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileUpload(e.target.files);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
    >
      {uploading ? (
        <div className="text-blue-600">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          Uploading documents...
        </div>
      ) : (
        <>
          <div className="text-gray-600 mb-4">
            <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg font-medium">Upload Documents</p>
            <p className="text-sm">Drag and drop files here, or click to select</p>
            <p className="text-xs text-gray-500 mt-2">Supports PDF, DOCX, TXT files</p>
          </div>
          
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          
          <label
            htmlFor="file-upload"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-blue-700"
          >
            Select Files
          </label>
        </>
      )}
    </div>
  );
};
```

## Best Practices

### 1. Error Handling
- Always wrap API calls in try-catch blocks
- Use consistent error messaging
- Implement retry logic for transient failures
- Log errors for debugging

### 2. Loading States
- Show loading indicators for async operations
- Disable buttons during API calls
- Provide feedback for long-running operations

### 3. Caching
- Cache frequently accessed data
- Implement proper cache invalidation
- Use React Query or SWR for advanced caching

### 4. Security
- Never store sensitive data in localStorage
- Validate all user inputs
- Implement proper CSRF protection
- Use HTTPS in production

### 5. Performance
- Implement pagination for large datasets
- Use debouncing for search inputs
- Optimize re-renders with React.memo
- Lazy load components when possible

### 6. Testing
- Mock API calls in tests
- Test error scenarios
- Use integration tests for critical flows
- Implement E2E tests for user journeys

---

This documentation provides a comprehensive guide for integrating the AIgentable backend with your React frontend. Follow the patterns and examples provided to ensure consistent and maintainable code across your application.
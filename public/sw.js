// Service Worker for AIgentable - Offline Support
const CACHE_NAME = 'aigentable-v1'
const STATIC_CACHE_NAME = 'aigentable-static-v1'
const DYNAMIC_CACHE_NAME = 'aigentable-dynamic-v1'

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css',
  // Add other static assets as needed
]

// API endpoints that should be cached
const CACHEABLE_APIS = [
  '/api/v1/agents',
  '/api/v1/conversations',
  '/api/v1/analytics',
  '/api/v1/profile'
]

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files')
        return cache.addAll(STATIC_FILES)
      })
      .then(() => {
        console.log('Service Worker: Static files cached')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static files', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('Service Worker: Activated')
        return self.clients.claim()
      })
  )
})

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests - cache with network-first strategy
    event.respondWith(handleApiRequest(request))
  } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/)) {
    // Static assets - cache-first strategy
    event.respondWith(handleStaticAsset(request))
  } else {
    // HTML pages - network-first with fallback
    event.respondWith(handlePageRequest(request))
  }
})

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url)
  
  try {
    // Try network first
    const networkResponse = await fetch(request)
    
    // Cache successful responses for cacheable APIs
    if (networkResponse.ok && CACHEABLE_APIs.some(api => url.pathname.startsWith(api))) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache for', request.url)
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline response for API requests
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'This request is not available offline',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Not in cache, fetch from network
    const networkResponse = await fetch(request)
    
    // Cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('Service Worker: Failed to fetch static asset', request.url)
    
    // Return a fallback response or empty response
    return new Response('', {
      status: 404,
      statusText: 'Not Found'
    })
  }
}

// Handle page requests with network-first strategy
async function handlePageRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request)
    
    // Cache successful HTML responses
    if (networkResponse.ok && networkResponse.headers.get('content-type')?.includes('text/html')) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('Service Worker: Network failed for page, trying cache', request.url)
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline page
    return caches.match('/index.html')
      .then((response) => {
        if (response) {
          return response
        }
        
        // Fallback offline page
        return new Response(
          `
          <!DOCTYPE html>
          <html>
          <head>
            <title>AIgentable - Offline</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f3f4f6;
                color: #374151;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .container {
                text-align: center;
                max-width: 400px;
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              }
              .icon {
                width: 64px;
                height: 64px;
                margin: 0 auto 20px;
                background: #ef4444;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
              }
              h1 {
                margin: 0 0 10px;
                font-size: 24px;
                font-weight: 600;
              }
              p {
                margin: 0 0 20px;
                color: #6b7280;
                line-height: 1.5;
              }
              button {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s;
              }
              button:hover {
                background: #2563eb;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">⚠</div>
              <h1>You're Offline</h1>
              <p>AIgentable is not available right now. Please check your internet connection and try again.</p>
              <button onclick="window.location.reload()">Try Again</button>
            </div>
          </body>
          </html>
          `,
          {
            headers: {
              'Content-Type': 'text/html'
            }
          }
        )
      })
  }
}

// Handle background sync
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag)
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

// Background sync function
async function doBackgroundSync() {
  try {
    // Get queued actions from IndexedDB or localStorage
    const queuedActions = await getQueuedActions()
    
    for (const action of queuedActions) {
      try {
        await syncAction(action)
        await removeQueuedAction(action.id)
      } catch (error) {
        console.error('Service Worker: Failed to sync action', action, error)
      }
    }
  } catch (error) {
    console.error('Service Worker: Background sync failed', error)
  }
}

// Get queued actions (placeholder - implement with IndexedDB)
async function getQueuedActions() {
  // This would typically read from IndexedDB
  // For now, return empty array
  return []
}

// Sync individual action
async function syncAction(action) {
  const { type, resource, data } = action
  
  let url = `/api/v1/${resource}`
  let method = 'GET'
  let body = null
  
  switch (type) {
    case 'create':
      method = 'POST'
      body = JSON.stringify(data)
      break
    case 'update':
      method = 'PUT'
      url += `/${data.id}`
      body = JSON.stringify(data)
      break
    case 'delete':
      method = 'DELETE'
      url += `/${data.id}`
      break
  }
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  return response.json()
}

// Remove queued action (placeholder)
async function removeQueuedAction(actionId) {
  // This would typically remove from IndexedDB
  console.log('Service Worker: Action synced and removed', actionId)
}

// Handle push notifications (if needed)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received', event)
  
  if (event.data) {
    const data = event.data.json()
    
    const options = {
      body: data.body || 'New notification from AIgentable',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      tag: data.tag || 'aigentable-notification',
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Open App'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    }
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'AIgentable',
        options
      )
    )
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event)
  
  event.notification.close()
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME })
  }
})

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    console.log('Service Worker: Periodic sync triggered', event.tag)
    
    if (event.tag === 'content-sync') {
      event.waitUntil(doPeriodicSync())
    }
  })
}

// Periodic sync function
async function doPeriodicSync() {
  try {
    // Sync critical data in the background
    await fetch('/api/v1/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    console.log('Service Worker: Periodic sync completed')
  } catch (error) {
    console.error('Service Worker: Periodic sync failed', error)
  }
}

console.log('Service Worker: Script loaded')
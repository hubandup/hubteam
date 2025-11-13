// Service Worker for Push Notifications

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Listen for push events
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'Nouvelle notification',
    body: 'Vous avez une nouvelle notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    url: '/',
  };

  // Try to parse the push data
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        url: data.url || notificationData.url,
        data: data, // Store full data for click handling
      };
    } catch (error) {
      console.error('Error parsing push data:', error);
      notificationData.body = event.data.text();
    }
  }

  // Show the notification
  const promiseChain = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: 'hub-and-up-notification',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: notificationData,
    }
  ).then(() => {
    // Update app badge
    if ('setAppBadge' in self.navigator) {
      return self.registration.getNotifications({ tag: 'hub-and-up-notification' })
        .then(notifications => {
          const unreadCount = notifications.length;
          if (unreadCount > 0) {
            return self.navigator.setAppBadge(unreadCount);
          }
        });
    }
  });

  event.waitUntil(promiseChain);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  // Update badge count after closing notification
  const updateBadge = self.registration.getNotifications({ tag: 'hub-and-up-notification' })
    .then(notifications => {
      const unreadCount = notifications.length;
      if ('setAppBadge' in self.navigator) {
        if (unreadCount > 0) {
          return self.navigator.setAppBadge(unreadCount);
        } else {
          return self.navigator.clearAppBadge();
        }
      }
    });

  // Open or focus the app window
  event.waitUntil(
    Promise.all([
      updateBadge,
      self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      }).then((clientList) => {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Focus the existing window and navigate to the URL
            return client.focus().then(() => {
              return client.navigate(urlToOpen);
            });
          }
        }
        // No window found, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
    ])
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  // Update badge count after dismissing notification
  const updateBadge = self.registration.getNotifications({ tag: 'hub-and-up-notification' })
    .then(notifications => {
      const unreadCount = notifications.length;
      if ('setAppBadge' in self.navigator) {
        if (unreadCount > 0) {
          return self.navigator.setAppBadge(unreadCount);
        } else {
          return self.navigator.clearAppBadge();
        }
      }
    });
  
  // You can track notification dismissals here
  const notificationData = event.notification.data;
  
  if (notificationData?.tracking) {
    // Send tracking data if needed
    console.log('Notification dismissed:', notificationData);
  }
  
  event.waitUntil(updateBadge);
});

// Handle background sync (optional, for offline support)
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      // Sync logic here if needed
      Promise.resolve()
    );
  }
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle badge update requests from the app
  if (event.data && event.data.type === 'UPDATE_BADGE') {
    const count = event.data.count || 0;
    if ('setAppBadge' in self.navigator) {
      if (count > 0) {
        self.navigator.setAppBadge(count);
      } else {
        self.navigator.clearAppBadge();
      }
    }
  }
});

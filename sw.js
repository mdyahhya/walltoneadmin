const CACHE_NAME = 'walltone-admin-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Cache-first for offline support
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request).then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                }
                return response;
            }).catch(() => caches.match('/'));
        })
    );
});

// ─── RECEIVE PUSH NOTIFICATION ───
self.addEventListener('push', event => {
    let data = { title: '🛍️ New Order!', body: 'A new order was placed on Walltone.' };
    try { data = event.data.json(); } catch(e) {}

    const options = {
        body: data.body,
        icon: '/walltone.png',
        badge: '/walltone.png',
        image: data.image || undefined,
        data: { url: data.url || '/', orderId: data.orderId },
        actions: [
            { action: 'view',    title: '👁️ View Order' },
            { action: 'dismiss', title: 'Dismiss'       }
        ],
        requireInteraction: true,
        vibrate: [300, 100, 300],
        tag: 'order-' + (data.orderId || Date.now()),
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title || '🛍️ New Order!', options)
    );
});

// ─── NOTIFICATION CLICK ───
self.addEventListener('notificationclick', event => {
    event.notification.close();
    if (event.action === 'dismiss') return;
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const c of list) {
                if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});

// ─── BUMP THIS VERSION on every deploy to force cache refresh ───
const CACHE_NAME = 'walltone-admin-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Network-first for HTML pages (always get latest code from server)
// Cache-first only for static assets (images, fonts, etc.)
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Always go network-first for same-origin HTML pages
    const isHtml = event.request.headers.get('accept')?.includes('text/html')
        || url.pathname === '/'
        || url.pathname.endsWith('.html');

    // Always go network for JS/CSS files (so code updates take effect)
    const isCodeFile = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');

    // Skip Supabase API, CDN scripts, push endpoints
    const isExternal = !url.origin.includes(self.location.origin);

    if (isExternal || isHtml || isCodeFile) {
        // Network-first: try network, fall back to cache
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.status === 200 && !isExternal) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    } else {
        // Cache-first for images and other static assets
        event.respondWith(
            caches.match(event.request).then(cached => {
                return cached || fetch(event.request).then(response => {
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
    }
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

// Firebase Messaging Service Worker
// Note: This file must be at the root of public folder

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
// These values will be replaced during build or you can hardcode them
firebase.initializeApp({
    apiKey: "AIzaSyAFNZS1TFdVvspJ21M2LV2qhG-cPu5-G0A",
    authDomain: "crms6it.firebaseapp.com",
    projectId: "crms6it",
    storageBucket: "crms6it.firebasestorage.app",
    messagingSenderId: "1082377706015",
    appId: "1:1082377706015:web:8c8f66af15ff6efb65fc52"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'CRMS6 IT';
    const notificationOptions = {
        body: payload.notification?.body || 'มีการแจ้งเตือนใหม่',
        icon: '/icon.png',
        badge: '/icon.png',
        tag: payload.data?.tag || 'default',
        data: payload.data,
        vibrate: [100, 50, 100],
        actions: [
            { action: 'open', title: 'เปิดดู' },
            { action: 'close', title: 'ปิด' }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification click:', event);

    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    // Open or focus the app
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If there's already a window open, focus it
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    if (urlToOpen !== '/') {
                        client.navigate(urlToOpen);
                    }
                    return;
                }
            }
            // Otherwise open new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// 오프라인에서도 앱 화면이 열리도록 화면 파일을 저장해 둡니다.
// 앱을 고치면 js/app.js 의 VERSION 과 이 VERSION 을 같이 올리세요.
const VERSION = 'card-v0.3.0';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 앱 화면 파일: 네트워크 우선(항상 새 버전 확인), 끊기면 저장본. 내역 데이터(구글)는 건드리지 않음.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
    const copy = res.clone();
    caches.open(VERSION).then(c => c.put(req, copy));
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});

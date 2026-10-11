// 내용을 바꿔 배포할 때마다 버전을 올리면 이전 캐시가 정리됩니다.
const CACHE_NAME = '학과검색-cache-v2';
const PRECACHE_URLS = [
    './',
    'index.html',
    'app.js',
    'vendor/xlsx.full.min.js',
    'manifest.json',
    'icon.png',
    '과목선택.xlsx'
];
const TAILWIND_URL = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            await cache.addAll(PRECACHE_URLS);
            // 외부 CSS는 실패해도 설치를 막지 않음 (SRI 검증을 위해 CORS 모드로 요청)
            try {
                await cache.add(new Request(TAILWIND_URL, { mode: 'cors' }));
            } catch (e) {
                console.warn('Tailwind 캐시 실패:', e);
            }
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

// 네트워크 우선: 최신 파일(보안 수정 포함)을 먼저 받고, 오프라인일 때만 캐시 사용
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    if (!isSameOrigin && request.url !== TAILWIND_URL) return;

    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok && (response.type === 'basic' || response.type === 'cors')) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});

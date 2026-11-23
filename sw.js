/* 일본 마운자로 방문 도우미 — Service Worker
 * 전략: 캐시 우선 + 백그라운드 갱신(stale-while-revalidate)
 * index.html(인라인 CSS/JS) + clinics.json(기관 데이터) 구조입니다.
 * v2: 한/영(KO/EN) UI, clinics.json 프리캐시 추가.
 * v3: 7.5mg·10mg 가격순 정렬 · 비교표 용량 전환 추가.
 * v4: 예약 탭 이름 입력 예시를 일반 이름으로 교체(개인정보 흔적 제거).
 * v5: GoatCounter 방문자 통계 스크립트 추가.
 * v6: 상단 헤더 방문자 수 배지(GoatCounter 공개 카운터) 추가.
 * v7: ?lang=en·ko 공유 링크 + 비한국어 브라우저 자동 영어 전환, 클리닉 데이터 3건 정정.
 * v8: 12.5mg 가격순 정렬 · 비교표·계산기 용량 추가, 클라라 3개월 공개가 보강.
 */
const VERSION = 'v8';
const CACHE = 'jmh-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './clinics.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE && key.startsWith('jmh-')).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 페이지 이동 요청은 항상 index.html(또는 './')로 응답
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

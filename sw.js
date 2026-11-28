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
 * v9: 상단 방문자 배지를 hits.sh 실시간(오늘·누적) 배지로 교체(GoatCounter 집계 스크립트는 유지).
 * v10: 반입 탭에 쿠팡 파트너스 준비물 카드(보냉팩·아이스팩·보냉파우치, KO 전용 + 수수료 고지)와 클리닉 첫 화면 CTA 추가.
 * v11: 리뉴얼 디자인 반영 — 모바일 우선 팔레트/타이포, 상단 요약 히어로(공개가 통계),
 *      3칸 가격 타일 카드(전체 가격표는 펼치기), 5탭 하단 내비게이션. 기능·데이터는 그대로.
 * v12: 클리닉 탭 맨 위로 '출국 전 기내 반입 체크리스트·준비물' 배너 이동(히어로 위, KO 전용).
 * v13: 그 배너 문구를 두 줄(제목 + (보냉팩·아이스팩·보냉파우치) →)로 정리, 영어 헤더 제목 크기 보정.
 * v14: 그 배너 위치를 히어로 위 → 검색창 아래·기관 카드 위로 이동.
 * v15: 상단 방문자 배지를 hits.sh(새로고침마다 +1) → GoatCounter 순 방문자 수 JSON 알약으로 교체
 *      (중복 제거 · 새로고침으로 카운트가 늘지 않음). GoatCounter 집계 스크립트는 유지.
 * v16: 기술 SEO — canonical·hreflang(KO/EN)·Open Graph·Twitter Card·JSON-LD(WebApplication/FAQPage)
 *      헤드 메타 추가, robots.txt·sitemap.xml 생성. robots.txt·sitemap.xml은 서비스 워커가
 *      가로채지 않고 네트워크로 그대로 보낸다(크롤러가 원본을 받도록).
 * v17: 네이버 서치어드바이저 소유확인 메타태그(naver-site-verification)를 head에 추가.
 * v18: 2026-11-27 가격 재점검 — 모데나 12.5mg·15mg, 재팬넷 15mg 공개가 반영.
 * v19: 커스텀 도메인 jpsave.com 전환(canonical·hreflang·sitemap).
 * v20: jpsave.com 사이트끼리 상호 연결 — 상단 메타 줄 'jpsave.com 홈' 알약과
 *      본문 맨 아래(탭바 위) '포켓몬 카드 시세 레이더' 크로스링크 배너를 추가.
 * v21: 2호 사이트 이름 변경(포켓몬 카드 시세 레이더 → 포켓몬 카드샵 방문 도우미)에
 *      맞춰 크로스링크 배너 문구를 '포켓몬 카드샵 방문 도우미 · 시세 보기 →' 로 교체.
 * v22: 반입 탭에 '일본 방문 전 필수 준비(제휴)' 카드 추가 — eSIM·게이세이 스카이라이너·
 *      APA 호텔 신주쿠 가부키초 타워(3ha.in 경유, KO/EN 공통 + 수수료 고지).
 */
const VERSION = 'v22';
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
  // 외부 요청(GoatCounter 카운터 JSON·count.js·쿠팡 링크 등)은 캐시하지 않고 네트워크로 그대로 보낸다
  // — 순 방문자 수가 캐시에 가려지지 않도록
  if (url.origin !== self.location.origin) return;

  // 크롤러용 SEO 파일(robots.txt·sitemap.xml)은 가로채지 않는다
  // — 앱 셸(index.html)로 대체 응답되거나 캐시에 남지 않도록 네트워크 결과를 그대로 돌려준다
  const SEO_PATH = /\/(robots\.txt|sitemap\.xml)$/;
  if (SEO_PATH.test(url.pathname)) return;

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

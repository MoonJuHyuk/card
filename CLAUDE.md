# 우리집 카드 정산 — notes for Claude

Read `docs/작업안내서.md` first (architecture, file map, sheet columns, change procedures) and `docs/진행사항.md` (history).
The owner is a non-developer; reply in Korean, keep explanations plain, and do browser/PC setup work yourself where you can.

- Static PWA, no build step. Hosted on GitHub Pages from `main` (repo `MoonJuHyuk/card`, public). Working copy on the owner's NAS (path in `docs/연결정보.local.md`).
- Data: Google Sheet "우리집 카드 정산", tab `내역` (columns: 날짜, 가맹점, 항목, 금액, 사용자, 카드, 상태, 메모). Read/written through the Apps Script web app in `apps-script/Code.gs` (POST text/plain JSON with `secret`; actions `list`, `add`).
- Card data is private: never put transaction rows, the sheet ID, the web app URL or the secret in the repo. Secrets live in `docs/연결정보.local.md` (git-ignored).
- Settlement (adding new card rows) is done by Claude writing directly into the sheet, not through the app.
- On every app change bump `VERSION` in both `js/app.js` and `sw.js`.
- Changing Code.gs: paste into the sheet's Apps Script editor, save, then 배포 관리 → 편집 → 새 버전 (keep the same deployment so the URL stays).

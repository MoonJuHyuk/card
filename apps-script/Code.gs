/**
 * 우리집 카드 정산 — 구글시트 저장 스크립트 (Apps Script)
 *
 * 구글시트 '우리집 카드 정산'에 붙어 있고(확장 프로그램 > Apps Script), 앱의 저장소 역할을 합니다.
 * 원본은 GitHub 저장소의 apps-script/Code.gs 입니다. 여기를 고치면 그 파일도 같이 고치세요.
 *
 * 처음 한 번:
 *   1) setup 실행 → 권한 허용 (비밀키 생성)
 *   2) 배포 > 새 배포 > 웹 앱 (실행: 나, 액세스: 모든 사용자)
 *   3) 배포 관리의 웹 앱 URL(…/exec)을 아래 WEB_APP_URL에 붙여넣고 저장
 *   4) connectLink 실행 → 실행 로그의 링크를 폰·PC에서 한 번 열기
 */

const APP_URL = 'https://moonjuhyuk.github.io/card/'; // GitHub Pages 주소
const WEB_APP_URL = '';   // 배포 후 …/exec 주소를 붙여넣으세요
const SHEET_NAME = '내역';

// 열 순서 = 앱이 읽고 쓰는 순서. 시트에서 열 순서를 바꾸지 마세요.
const FIELDS = ['date', 'merchant', 'category', 'amount', 'user', 'card', 'status', 'memo'];
const HEADERS = ['날짜', '가맹점', '항목', '금액', '사용자', '카드', '상태', '메모'];

/* ---------------- 처음 설정 ---------------- */

function setup() {
  const sh = sheet_();
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) props.setProperty('SECRET', Utilities.getUuid().replace(/-/g, ''));
  Logger.log('✅ setup 완료. [배포 > 새 배포 > 웹 앱]을 하고 connectLink를 실행하세요.');
}

/** 폰·PC에서 한 번 열 연결 링크를 로그에 출력합니다. 남에게 공유하지 마세요. */
function connectLink() {
  const url = WEB_APP_URL || ScriptApp.getService().getUrl();
  if (!url || !/\/exec$/.test(url)) { Logger.log('❌ 배포 관리의 웹 앱 URL(…/exec)을 WEB_APP_URL에 붙여넣고 저장한 뒤 다시 실행하세요.'); return; }
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  const token = Utilities.base64EncodeWebSafe(JSON.stringify({ u: url, s: secret }));
  Logger.log('📱 연결 링크 (이 링크를 가진 사람은 내역을 볼 수 있습니다):\n' + APP_URL + '#connect=' + token);
}

/** 연결 링크가 새어 나갔을 때 실행: 비밀키를 바꿔 모든 기기 연결을 끊습니다. */
function resetSecret() {
  PropertiesService.getScriptProperties().setProperty('SECRET', Utilities.getUuid().replace(/-/g, ''));
  Logger.log('🔑 비밀키를 바꿨습니다. connectLink를 다시 실행해 새 링크로 연결하세요.');
}

/* ---------------- 웹 앱 ---------------- */

function doGet() {
  return json_({ ok: true, app: '우리집 카드 정산', hint: 'POST only' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || req.secret !== secret) return json_({ ok: false, error: 'unauthorized' });
    switch (req.action) {
      case 'list': return json_({ ok: true, rows: list_() });
      case 'add': return json_({ ok: true, row: add_(req.entry || {}) });
      default: return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ---------------- 내부 ---------------- */

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME, 0);
}

function list_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const tz = Session.getScriptTimeZone();
  return sh.getRange(2, 1, last - 1, FIELDS.length).getValues()
    .filter(r => r[0] !== '' && r[3] !== '')
    .map(r => [
      r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]).trim(),
      String(r[1]), String(r[2] || '기타'), Number(String(r[3]).replace(/,/g, '')) || 0,
      String(r[4] || ''), String(r[5] || ''), String(r[6] || ''), String(r[7] || ''),
    ]);
}

function add_(e) {
  const amt = Number(String(e.amount || '').replace(/,/g, ''));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '') || !e.merchant || !amt) throw new Error('날짜, 내용, 금액을 확인해 주세요.');
  const row = [e.date, String(e.merchant).slice(0, 100), e.category || '기타', amt, e.user || '', e.card || '현금', '직접입력', String(e.memo || '').slice(0, 200)];
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { sheet_().appendRow(row); } finally { lock.releaseLock(); }
  return row;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

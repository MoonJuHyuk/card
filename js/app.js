'use strict';
const ONE_OFF = c => c === '자동차 구매' || c === '결혼식' || c.indexOf('여행') >= 0;
const FIXED_CATS = ['보험', '주거·관리비', '회비'];   // 고정비로 보는 항목
const FIXED = c => FIXED_CATS.indexOf(c) >= 0;
const REFUND_CAT = '돌려받음';   // 대신 냈다가 돌려받은 돈: 모든 합계·차트에서 빼고 목록에만 회색으로 표시
let REFUND = [];
let ALL = [], person = '', cur = '', q = '', catF = '';
const $ = id => document.getElementById(id);
const won = v => Math.round(v).toLocaleString('ko-KR') + '원';
const man = v => Math.abs(v) >= 10000 ? Math.round(v / 10000).toLocaleString('ko-KR') + '만원' : won(v);
const mLabel = m => Number(m.slice(5)) + '월';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum = a => a.reduce((s, r) => s + r.amount, 0);
const groupSum = (rows, key) => { const m = new Map(); rows.forEach(r => { const k = key(r); const o = m.get(k) || {amount:0,count:0}; o.amount += r.amount; o.count++; m.set(k, o); }); return m; };

const VERSION = '0.4.1';
const LS = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

/* ---------- 연결 (구글시트 Apps Script) ---------- */
function parseConnect(str) {
  try {
    const m = String(str).match(/connect=([A-Za-z0-9_\-=]+)/);
    const tok = m ? m[1] : String(str).trim();
    const c = JSON.parse(decodeURIComponent(escape(atob(tok.replace(/-/g, '+').replace(/_/g, '/')))));
    if (!c.u || !c.s || !/^https:\/\/script\.google(usercontent)?\.com\//.test(c.u)) return null;
    return c;
  } catch (e) { return null; }
}
function takeConnectFromUrl() {
  const c = location.hash.indexOf('connect=') >= 0 ? parseConnect(location.hash) : null;
  if (c) { LS.set('card.conn', c); LS.del('card.cache'); }
  if (location.hash.indexOf('connect=') >= 0) history.replaceState(null, '', location.pathname);
  return !!c;
}
takeConnectFromUrl();
window.addEventListener('hashchange', () => { if (takeConnectFromUrl()) { ALL = []; load(); } });
const conn = () => LS.get('card.conn', null);
{ const m = location.hash.match(/^#m(\d{4}-\d{2})$/); if (m) cur = m[1]; }

async function call(action, payload = {}, timeoutMs = 30000) {
  const c = conn(); if (!c) throw new Error('not connected');
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    // text/plain: Apps Script는 CORS 사전 요청에 답하지 못하므로 단순 요청으로 보냄
    const res = await fetch(c.u, { method: 'POST', redirect: 'follow', signal: ctl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ secret: c.s, action, ...payload }) });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'server error');
    return j;
  } finally { clearTimeout(tm); }
}

function setRows(rows) {
  ALL = rows.map(r => ({date:r[0], merchant:r[1], category:r[2], amount:Number(r[3]) || 0, user:r[4], card:r[5], status:r[6], memo:r[7], row:Number(r[8]) || 0}))
            .sort((a, b) => a.date.localeCompare(b.date));
  REFUND = ALL.filter(r => r.category === REFUND_CAT);
  ALL = ALL.filter(r => r.category !== REFUND_CAT);
}
function setStatus(t) { $('status').textContent = t || ''; }

async function load() {
  if (!conn()) { showConnect(); return; }
  $('fab').classList.remove('hide');
  const cache = LS.get('card.cache', null);
  if (cache && !ALL.length) { setRows(cache.rows); render(); setStatus('저장된 내역을 보여주는 중 · 새로 불러오는 중…'); }
  try {
    const j = await call('list');
    LS.set('card.cache', { rows: j.rows, at: Date.now() });
    setRows(j.rows); render(); setStatus('');
  } catch (e) {
    if (String(e.message) === 'unauthorized') { setStatus('연결이 끊겼습니다. 새 연결 링크로 다시 열어 주세요.'); return; }
    if (cache) setStatus('인터넷 연결이 안 돼서 ' + new Date(cache.at).toLocaleString('ko-KR') + '에 불러온 내역을 보여줍니다.');
    else $('app').innerHTML = '<div class="loading">불러오지 못했습니다: ' + esc(e.message) + '</div>';
  }
}

function showConnect() {
  $('fab').classList.add('hide');
  $('headline').textContent = '이 기기는 아직 연결되지 않았습니다';
  $('people').innerHTML = ''; $('tabs').innerHTML = '';
  $('app').innerHTML = `<div class="empty"><h2>연결 링크로 열어 주세요</h2>
    <p>카드 내역은 구글시트에 있고, 연결 링크를 한 번 열면 이 기기가 연결됩니다. 링크는 시트를 관리하는 사람에게 받으세요.</p>
    <p>링크를 복사해 두었다면 아래에 붙여넣어도 됩니다.</p>
    <textarea id="c-input" placeholder="https://moonjuhyuk.github.io/card/#connect=..."></textarea>
    <button class="btn" id="c-go">연결하기</button></div>`;
  $('c-go').onclick = () => { const c = parseConnect($('c-input').value); if (!c) { alert('연결 링크가 올바르지 않습니다.'); return; } LS.set('card.conn', c); load(); };
}

function rowsP() { return person ? ALL.filter(r => r.user === person) : ALL; }

function render() {
  const users = [...new Set(ALL.map(r => r.user).filter(Boolean))];
  $('people').innerHTML = ['', ...users].map(u => `<button data-u="${esc(u)}" class="${u === person ? 'on' : ''}">${u ? esc(u) : '둘 다'}</button>`).join('');
  $('people').querySelectorAll('button').forEach(b => b.onclick = () => { person = b.dataset.u; render(); });
  const P = rowsP();
  const months = [...new Set(ALL.map(r => r.date.slice(0, 7)))].sort();
  if (cur && months.indexOf(cur) < 0) cur = '';
  $('tabs').innerHTML = ['', ...months.slice().reverse()].map(m => `<button data-m="${m}" class="${m === cur ? 'on' : ''}">${m ? mLabel(m) + (m.slice(0,4) !== months[months.length-1].slice(0,4) ? ' (' + m.slice(2,4) + ')' : '') : '전체'}</button>`).join('');
  $('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { cur = b.dataset.m; history.replaceState(null, '', cur ? '#m' + cur : '#'); render(); window.scrollTo({top:0}); });
  const first = P[0], last = P[P.length - 1];
  $('headline').innerHTML = P.length ? `${fmtD(first.date)}부터 ${fmtD(last.date)}까지 <b>${won(sum(P))}</b> · ${P.length.toLocaleString()}건` : '내역이 없습니다';
  $('app').innerHTML = cur ? monthView(P, months) : overview(P, months);
  bind();
}
const fmtD = d => Number(d.slice(5,7)) + '월 ' + Number(d.slice(8)) + '일';

function overview(P, months) {
  const total = sum(P);
  const full = months.slice(1, -1);
  const fullRows = P.filter(r => full.indexOf(r.date.slice(0, 7)) >= 0);
  const n = Math.max(1, full.length);
  const avg = sum(fullRows) / n, avgLife = sum(fullRows.filter(r => !ONE_OFF(r.category))) / n;
  const avgFixed = sum(fullRows.filter(r => FIXED(r.category))) / n;
  const fullLbl = full.length ? mLabel(full[0]) + '~' + mLabel(full[full.length - 1]) : '';
  const bym = groupSum(P, r => r.date.slice(0, 7));
  const mrows = months.map(m => ({key:m, amount:(bym.get(m) || {amount:0}).amount}));
  const cats = [...groupSum(P, r => r.category)].map(([k, o]) => ({key:k, ...o})).sort((a, b) => b.amount - a.amount);
  const top = P.slice().sort((a, b) => b.amount - a.amount).slice(0, 10);
  return `
  <div class="tiles">
    ${tile('총 사용액', man(total), '전체 기간')}
    ${tile('월평균 · ' + fullLbl, man(avg), '처음·이번 달 제외')}
    ${tile('생활비 월평균', man(avgLife), '여행·자동차 구매·결혼식 제외')}
    ${tile('고정비 월평균', man(avgFixed), '보험·관리비·회비 · 생활비에 포함')}
    ${tile('결제 건수', P.length.toLocaleString() + '건', '')}
  </div>
  <div class="grid">
    <div class="card"><h2>월별 사용액</h2><p class="note">막대를 누르면 그 달로 이동</p>${vbars(mrows, r => mLabel(r.key), 'month')}</div>
    <div class="card"><h2>항목별 사용액</h2><p class="note">전체 기간 · 항목을 누르면 아래 내역이 걸러집니다</p>${hbars(cats)}</div>
  </div>
  <div class="card" style="margin-bottom:12px"><h2>월별 항목 비교</h2><p class="note">단위 만원</p><div class="wide">${pivot(P, months, cats)}</div></div>
  <div class="card" style="margin-bottom:12px"><h2>큰 지출 10건</h2><p class="note">전체 기간</p>${table(top, false)}</div>
  ${fixedCard(P, months, null)}
  ${listCard(P)}`;
}

function monthView(P, months) {
  const R = P.filter(r => r.date.slice(0, 7) === cur);
  const i = months.indexOf(cur), prevM = i > 0 ? months[i - 1] : null;
  const PR = prevM ? P.filter(r => r.date.slice(0, 7) === prevM) : [];
  const t = sum(R), pt = sum(PR), d = t - pt;
  const pc = groupSum(PR, r => r.category);
  const cats = [...groupSum(R, r => r.category)].map(([k, o]) => ({key:k, ...o, delta: prevM ? o.amount - (pc.get(k) || {amount:0}).amount : null})).sort((a, b) => b.amount - a.amount);
  const byd = groupSum(R, r => r.date);
  const [y, m] = cur.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const days = Array.from({length: dim}, (_, k) => { const ds = cur + '-' + String(k + 1).padStart(2, '0'); return {key: ds, amount: (byd.get(ds) || {amount:0}).amount}; });
  const merch = [...groupSum(R, r => r.merchant)].map(([k, o]) => ({key:k, ...o, category:(R.find(r => r.merchant === k) || {}).category})).sort((a, b) => b.amount - a.amount).slice(0, 10);
  const lifeT = sum(R.filter(r => !ONE_OFF(r.category)));
  const fixedT = sum(R.filter(r => FIXED(r.category)));
  return `
  <div class="tiles">
    ${tile(mLabel(cur) + ' 사용액', man(t), R.length ? fmtD(R[0].date) + ' ~ ' + fmtD(R[R.length-1].date) : '')}
    ${tile('전월 대비', prevM ? (d >= 0 ? '+' : '−') + man(Math.abs(d)) : '첫 달', prevM ? mLabel(prevM) + ' ' + man(pt) : '', prevM ? (d > 0 ? 'up' : 'down') : '')}
    ${tile('생활비', man(lifeT), '고정비 ' + man(fixedT) + ' + 그 외 ' + man(lifeT - fixedT))}
    ${tile('결제 건수', R.length + '건', cats[0] ? '가장 큰 항목: ' + cats[0].key : '')}
  </div>
  <div class="grid">
    <div class="card"><h2>항목별 사용액</h2><p class="note">${prevM ? '옆 숫자는 전월 대비' : ''}</p>${hbars(cats)}</div>
    <div class="card"><h2>날짜별 사용액</h2><p class="note">하루 합계 · 막대를 누르면 그날 내역</p>${vbars(days, r => { const dd = Number(r.key.slice(8)); return (dd === 1 || dd % 5 === 0) ? dd + '일' : ''; }, 'day', true)}</div>
  </div>
  <div class="card" style="margin-bottom:12px"><h2>많이 쓴 곳</h2><p class="note">금액 순 상위 10곳</p>
    <table><thead><tr><th>가맹점</th><th class="hidem">항목</th><th class="r">건수</th><th class="r">금액</th></tr></thead><tbody>
    ${merch.map(r => `<tr><td>${esc(r.key)}</td><td class="hidem">${esc(r.category)}</td><td class="r">${r.count}건</td><td class="r">${won(r.amount)}</td></tr>`).join('')}
    </tbody></table></div>
  ${fixedCard(P, months, cur)}
  ${listCard(R)}`;
}

function tile(l, n, s, cls) { return `<div class="tile"><div class="l">${esc(l)}</div><div class="n ${cls || ''}">${esc(n)}</div><div class="s">${esc(s || '')}</div></div>`; }

function hbars(rows) {
  if (!rows.length) return '<p class="note">내역 없음</p>';
  const mx = Math.max(...rows.map(r => r.amount), 1);
  return `<div class="hb">${rows.map((r, i) => `
    <div class="lab clk" data-cat="${esc(r.key)}">${esc(r.key)}</div>
    <div class="clk" data-cat="${esc(r.key)}" data-tip="${esc(r.key)} · ${r.count}건|${won(r.amount)}"><div class="bar ${i === 0 ? 'first' : ''}" style="width:${Math.max(0, r.amount) / mx * 100}%"></div></div>
    <div class="val">${man(r.amount)}${r.delta == null ? '' : `<i class="${r.delta > 0 ? 'up' : 'down'}">${r.delta >= 0 ? '+' : '−'}${man(Math.abs(r.delta))}</i>`}</div>`).join('')}</div>`;
}

function vbars(rows, xl, kind, compact) {
  const mx = Math.max(...rows.map(r => r.amount), 1);
  return `<div class="vb ${compact ? 'days' : ''}">${rows.map(r => `
    <div class="c" data-${kind}="${r.key}" data-tip="${kind === 'month' ? mLabel(r.key) : fmtD(r.key)}|${won(r.amount)}">
      <div class="v">${r.amount ? man(r.amount) : ''}</div>
      <div class="b" style="height:${Math.max(0, r.amount) / mx * 85}%"></div>
      <div class="x">${xl(r)}</div></div>`).join('')}</div>`;
}

function pivot(P, months, cats) {
  const g = new Map(); P.forEach(r => { const k = r.category + '|' + r.date.slice(0, 7); g.set(k, (g.get(k) || 0) + r.amount); });
  const f = v => v ? Math.round(v / 10000).toLocaleString('ko-KR') : '·';
  const tot = months.map(m => sum(P.filter(r => r.date.slice(0, 7) === m)));
  return `<table class="pv"><thead><tr><th>항목</th>${months.map(m => `<th class="r">${mLabel(m)}</th>`).join('')}<th class="r">합계</th></tr></thead><tbody>
    ${cats.map(c => `<tr><td>${esc(c.key)}</td>${months.map(m => `<td class="r">${f(g.get(c.key + '|' + m))}</td>`).join('')}<td class="r">${f(c.amount)}</td></tr>`).join('')}
    <tr class="t"><td>합계</td>${tot.map(v => `<td class="r">${f(v)}</td>`).join('')}<td class="r">${f(sum(P))}</td></tr></tbody></table>`;
}

function table(rows, withMore) {
  return `<table><thead><tr><th>날짜</th><th>가맹점</th><th class="hidem">항목</th>${person ? '' : '<th class="hidem">누가</th>'}<th class="r">금액</th></tr></thead><tbody>
  ${rows.map(r => `<tr${r.row ? ' data-row="' + r.row + '" class="edit' + (r.category === REFUND_CAT ? ' refund' : '') + '"' : ''}><td>${r.date.slice(5).replace('-', '.')}</td><td>${esc(r.merchant)}${r.memo ? ' <span class="pill">' + esc(r.memo) + '</span>' : ''}${r.status && r.status !== '청구' ? ' <span class="pill">' + esc(r.status) + '</span>' : ''}</td><td class="hidem">${esc(r.category)}</td>${person ? '' : '<td class="hidem">' + esc(r.user) + '</td>'}<td class="r">${won(r.amount)}</td></tr>`).join('')}
  </tbody></table>`;
}

// 고정비 카드: 전체 화면은 월평균, 월별 화면은 그달 금액 (마지막 달이면 '아직 안 나감' 표시)
function fixedCard(P, months, m) {
  const F = P.filter(r => FIXED(r.category));
  if (!F.length) return '';
  const full = months.slice(1, -1), n = Math.max(1, full.length);
  const lastM = months[months.length - 1], prevM = m ? months[months.indexOf(m) - 1] : months[months.length - 2];
  const items = [...new Set(F.map(r => r.merchant))].map(k => {
    const rs = F.filter(r => r.merchant === k);
    const inM = mm => sum(rs.filter(r => r.date.slice(0, 7) === mm));
    return { key: k, category: rs[rs.length - 1].category, last: rs[rs.length - 1].date,
             avg: sum(rs.filter(r => full.indexOf(r.date.slice(0, 7)) >= 0)) / n,
             prev: prevM ? inM(prevM) : 0, cur: m ? inM(m) : 0 };
  }).filter(o => m ? (o.cur || o.prev) : o.avg).sort((a, b) => FIXED_CATS.indexOf(a.category) - FIXED_CATS.indexOf(b.category) || b.avg - a.avg);
  const pending = o => m === lastM && !o.cur && o.prev;
  const total = m ? sum(F.filter(r => r.date.slice(0, 7) === m)) : sum(F.filter(r => full.indexOf(r.date.slice(0, 7)) >= 0)) / n;
  const waiting = m ? items.filter(pending) : [];
  return `<div class="card" style="margin-bottom:12px"><h2>고정비 ${m ? mLabel(m) + ' ' + won(total) : '월평균 ' + won(total)}</h2>
    <p class="note">보험·주거·관리비·회비 항목${waiting.length ? ` · 아직 안 나간 것 ${waiting.length}건 (지난달 ${won(sum(waiting.map(o => ({amount: o.prev}))))})` : ''}</p>
    <table><thead><tr><th>내용</th><th class="hidem">항목</th>${m ? '' : '<th class="r">월평균</th>'}<th class="r">${prevM ? mLabel(prevM) : '지난달'}</th>${m ? `<th class="r">${mLabel(m)}</th>` : '<th class="r hidem">최근 결제</th>'}</tr></thead><tbody>
    ${items.map(o => `<tr><td>${esc(o.key)}</td><td class="hidem">${esc(o.category)}</td>${m ? '' : `<td class="r">${won(o.avg)}</td>`}<td class="r">${o.prev ? won(o.prev) : '·'}</td>${m ? `<td class="r">${o.cur ? won(o.cur) : pending(o) ? '<span class="pill">아직 안 나감</span>' : '·'}</td>` : `<td class="r hidem">${fmtD(o.last)}</td>`}</tr>`).join('')}
    </tbody></table></div>`;
}

function listCard(R) {
  const cats = [...new Set(R.map(r => r.category))].sort();
  return `<div class="card" id="list"><h2>이용내역</h2><p class="note">${cur ? mLabel(cur) : '전체 기간'} · 최근 순</p>
    <div class="tools"><input type="search" id="q" placeholder="가맹점 검색" value="${esc(q)}">
    <select id="catF"><option value="">전체 항목</option>${cats.map(c => `<option ${c === catF ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
    <div class="scroll" id="listBody">${listTable(R)}</div></div>`;
}
function listTable(R) {
  const ok = r => (!catF || r.category === catF) && (!q || r.merchant.toLowerCase().indexOf(q.toLowerCase()) >= 0);
  const rows = R.filter(ok);
  const ref = REFUND.filter(r => (!person || r.user === person) && (!cur || r.date.slice(0, 7) === cur) && ok(r));
  const all = rows.concat(ref).sort((a, b) => a.date.localeCompare(b.date)).reverse();
  return `<p class="note">${rows.length}건 · ${won(sum(rows))}${ref.length ? ` · 돌려받은 ${ref.length}건(${won(sum(ref))})은 합계에서 뺌` : ''}</p>` + table(all);
}

function bind() {
  const P = rowsP(), R = cur ? P.filter(r => r.date.slice(0, 7) === cur) : P;
  const refresh = () => { $('listBody').innerHTML = listTable(R); bindRows(); };
  $('q').oninput = e => { q = e.target.value.trim(); refresh(); };
  $('catF').onchange = e => { catF = e.target.value; refresh(); };
  document.querySelectorAll('[data-month]').forEach(el => el.onclick = () => { cur = el.dataset.month; history.replaceState(null, '', '#m' + cur); render(); window.scrollTo({top:0}); });
  document.querySelectorAll('[data-day]').forEach(el => el.onclick = () => { q = ''; catF = ''; $('q').value = ''; $('catF').value = ''; const d = el.dataset.day; $('listBody').innerHTML = `<p class="note">${fmtD(d)} · <a href="#" id="clr">전체 보기</a></p>` + table(R.filter(r => r.date === d).reverse()); bindRows(); $('clr').onclick = ev => { ev.preventDefault(); refresh(); }; $('list').scrollIntoView({behavior:'smooth'}); });
  document.querySelectorAll('[data-cat]').forEach(el => el.onclick = () => { catF = el.dataset.cat; $('catF').value = catF; refresh(); $('list').scrollIntoView({behavior:'smooth'}); });
  bindRows();
  const tip = $('tip');
  document.querySelectorAll('[data-tip]').forEach(el => {
    el.onmousemove = e => { const [a, b] = el.dataset.tip.split('|'); tip.innerHTML = `<div style="color:var(--muted)">${a}</div><div>${b}</div>`; tip.style.display = 'block'; tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 48) + 'px'; };
    el.onmouseleave = () => { tip.style.display = 'none'; };
  });
}

// 직접 추가 · 내역 고치기 (같은 창을 같이 씀)
let editing = null;   // 고치는 중인 내역 (null 이면 새로 추가)
function bindRows() {
  document.querySelectorAll('tr[data-row]').forEach(tr => tr.onclick = () => {
    const r = ALL.concat(REFUND).find(x => x.row === Number(tr.dataset.row));
    if (r) openForm(r);
  });
}
function fillCats(sel) {
  const cats = [...new Set(ALL.map(r => r.category))].sort().concat([REFUND_CAT]);
  if (sel && cats.indexOf(sel) < 0) cats.push(sel);
  $('f-cat').innerHTML = cats.map(c => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('') + '<option value="__new">＋ 새 항목 만들기</option>';
  $('f-catnew').value = ''; $('f-catnew').classList.add('hide');
}
function openForm(r) {
  editing = r || null;
  fillCats(r ? r.category : '');
  const users = [...new Set(ALL.map(x => x.user).filter(Boolean))];
  const u = r ? r.user : person;
  $('f-user').innerHTML = users.map(x => `<option ${x === u ? 'selected' : ''}>${esc(x)}</option>`).join('');
  $('f-title').textContent = r ? '내역 고치기' : '지출 직접 추가';
  $('f-date').value = r ? r.date : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  $('f-merchant').value = r ? r.merchant : '';
  $('f-amount').value = r ? r.amount : '';
  $('f-card').value = r ? r.card : '현금';
  $('f-memo').value = r ? r.memo : '';
  $('f-del').classList.toggle('hide', !r);
  $('modal').classList.add('on');
}
$('f-cat').onchange = () => { const nw = $('f-cat').value === '__new'; $('f-catnew').classList.toggle('hide', !nw); if (nw) $('f-catnew').focus(); };
$('fab').onclick = () => openForm(null);
$('f-cancel').onclick = () => $('modal').classList.remove('on');
function busy(btn, on, label) { btn.disabled = on; btn.textContent = label; }
$('f-save').onclick = () => {
  let cat = $('f-cat').value;
  if (cat === '__new') { cat = $('f-catnew').value.trim(); if (!cat) { alert('새 항목 이름을 써 주세요.'); return; } }
  const e = {date: $('f-date').value, merchant: $('f-merchant').value.trim(), amount: $('f-amount').value, category: cat, user: $('f-user').value, card: $('f-card').value.trim(), memo: $('f-memo').value.trim()};
  const req = editing ? call('update', { row: editing.row, entry: e, orig: {date: editing.date, merchant: editing.merchant, amount: editing.amount} })
                      : call('add', { entry: e });
  busy($('f-save'), true, '저장 중…');
  req.then(() => { $('modal').classList.remove('on'); busy($('f-save'), false, '저장'); load(); })
     .catch(err => { alert('저장하지 못했습니다: ' + err.message); busy($('f-save'), false, '저장'); });
};
$('f-del').onclick = () => {
  if (!editing || !confirm(`'${editing.merchant}' ${won(editing.amount)} 내역을 지울까요? 구글시트에서도 지워집니다.`)) return;
  busy($('f-del'), true, '지우는 중…');
  call('delete', { row: editing.row, orig: {date: editing.date, merchant: editing.merchant, amount: editing.amount} })
    .then(() => { $('modal').classList.remove('on'); busy($('f-del'), false, '삭제'); load(); })
    .catch(err => { alert('지우지 못했습니다: ' + err.message); busy($('f-del'), false, '삭제'); });
};
// 설정
$('btn-settings').onclick = () => {
  const c = conn(), cache = LS.get('card.cache', null);
  $('s-conn').textContent = c ? '구글시트에 연결됨' : '연결 안 됨';
  $('s-time').textContent = cache ? new Date(cache.at).toLocaleString('ko-KR') : '-';
  $('s-ver').textContent = 'v' + VERSION;
  $('settings').classList.add('on');
};
$('s-close').onclick = () => $('settings').classList.remove('on');
$('s-reload').onclick = () => { $('settings').classList.remove('on'); load(); };
$('s-disconnect').onclick = () => { if (!confirm('이 기기의 연결을 끊고 저장된 내역을 지울까요?')) return; LS.del('card.conn'); LS.del('card.cache'); ALL = []; $('settings').classList.remove('on'); load(); };

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}
load();

import { randomBytes } from 'node:crypto';

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function sendSurfOperatorConnectPage(res, { origin, challenge, hasAccess, session, administrator }) {
  const nonce = randomBytes(18).toString('base64url');
  const returnTo = `/local-draw-operator?${new URLSearchParams({ origin, challenge })}`;
  const data = JSON.stringify({ origin, challenge }).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>連接本地開獎 | Renaiss</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#f8f6f3;color:#292a30;font:14px -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}main{width:min(420px,calc(100% - 40px));padding:36px;border:1px solid #e5e1de;border-radius:20px;background:#ffffffb8}small,p{color:#777983;line-height:1.7}h1{font-size:26px;font-weight:500;letter-spacing:-.03em}label{display:block;margin-top:16px}input{width:100%;margin-top:7px;padding:11px;border:1px solid #dedbd8;border-radius:9px;background:#fff}button,a{display:inline-block;margin-top:20px;padding:12px 18px;border:0;border-radius:10px;background:#30343b;color:white;text-decoration:none;font:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:default}#status{margin-bottom:0}code{overflow-wrap:anywhere}</style></head><body><main><small>RENAISS · LOCAL OPERATOR</small><h1>連接本地正式開獎</h1><p>允許此本地頁面操作 Surf 正式開獎與鏈上重置。</p><p><code>${escapeHtml(origin)}</code></p>
${!hasAccess ? '<form id="login"><label>開獎室帳號<input name="username" autocomplete="username" required maxlength="64"></label><label>密碼<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button>登入開獎室</button></form>' :
  !session || session.user.isDemo ? `<a href="/api/auth/renaiss/start?${escapeHtml(new URLSearchParams({ returnTo }).toString())}">登入 Renaiss 管理員 ↗</a>` :
  !administrator ? '<p>目前 Renaiss 帳號沒有開獎管理員權限。</p>' :
  `<p>${escapeHtml(session.user.name || 'Renaiss 管理員')}</p><button id="approve">連接本地開獎</button>`}
<p id="status" role="status"></p></main><script nonce="${nonce}">
const connection=${data}, status=document.getElementById('status');
async function post(path,body){const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw Error(value.code||'連接失敗');return value;}
document.getElementById('login')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{await post('/api/auth/surf-draw/login',Object.fromEntries(new FormData(form)));form.reset();location.reload();}catch(error){status.textContent=error.message==='surf_draw_invalid_credentials'?'帳號或密碼不正確':error.message;button.disabled=false;}});
document.getElementById('approve')?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await post('/api/admin/missions/surf/draw/local-operator/approve',connection);status.textContent='已允許連接，請回到本地開獎頁。';}catch(error){status.textContent=error.message;button.disabled=false;}});
</script></body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html), 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'` });
  res.end(html);
}

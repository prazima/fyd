const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const form = $('#registration-form'), passModal = $('#pass-modal'), adminModal = $('#admin-modal'), resultModal = $('#result-modal');
let scanner = null, activePass = null, lastRegistration = null;

window.addEventListener('scroll', () => { const max = document.documentElement.scrollHeight - innerHeight; $('#progress').style.width = `${max ? scrollY / max * 100 : 0}%`; }, { passive:true });
const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }), { threshold:.12 });
$$('.reveal').forEach(el => observer.observe(el));
$$('.battle-card').forEach((el, i) => el.style.transitionDelay = `${i*70}ms`);
const entry = form.elements.entry, team = $('.team-field');
entry.addEventListener('change', () => { const group = entry.value.startsWith('Group'); team.classList.toggle('hidden', !group); form.elements.teamName.required = group; });
form.elements.category.addEventListener('change', () => { if(form.elements.category.value === 'Kids Battle') form.elements.age.max = '13'; else form.elements.age.max = '100'; });

form.addEventListener('submit', async e => {
  e.preventDefault(); $('#form-error').textContent = '';
  if (!form.reportValidity()) return;
  const payload = Object.fromEntries(new FormData(form)); payload.age = Number(payload.age);
  const button = $('.submit-button'); button.disabled = true; button.firstChild.textContent = 'Saving registration… ';
  try {
    const response = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not register.');
    lastRegistration = data; $('#pass-name').textContent = data.name; $('#pass-meta').textContent = `${data.category} · ${data.entry}`;
    $('#qr-code').replaceChildren();
    if (!window.QRCode) throw new Error('QR generator did not load. Check your internet connection and try again.');
    new QRCode($('#qr-code'), { text:`fyd-namma:${data.id}`, width:180, height:180, colorDark:'#160b09', colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.H });
    passModal.showModal(); form.reset(); team.classList.add('hidden');
  } catch(err) { $('#form-error').textContent = err.message; }
  finally { button.disabled = false; button.firstChild.textContent = 'Continue & create my QR '; }
});

$('#download-pass').addEventListener('click', () => {
  const qr = $('#qr-code canvas'); if (!qr || !lastRegistration) return;
  const canvas = document.createElement('canvas'); canvas.width=720; canvas.height=900; const c=canvas.getContext('2d');
  c.fillStyle='#190806';c.fillRect(0,0,720,900);c.fillStyle='#bf352f';c.fillRect(0,0,720,205);c.fillStyle='#ffdb32';c.font='bold 27px sans-serif';c.fillText('FYD DANCE & FITNESS',48,65);c.fillStyle='#fff5df';c.font='bold 45px sans-serif';c.fillText('NAMMA NAMAKKAL',48,130);c.font='bold 23px sans-serif';c.fillText('BATTLE · CYPHER · SHOWCASE',48,174);
  c.fillStyle='#fff5df';c.fillRect(176,245,368,368);c.drawImage(qr,196,265,328,328);c.fillStyle='#ffdb32';c.font='bold 29px sans-serif';c.textAlign='center';c.fillText(lastRegistration.name,360,680);c.fillStyle='#fff5df';c.font='20px sans-serif';c.fillText(`${lastRegistration.category} · ${lastRegistration.entry}`,360,722);c.fillText('SUNDAY · 6 DECEMBER 2026',360,790);c.fillStyle='#c9b5a0';c.font='15px sans-serif';c.fillText('REPORTING 9:00 AM · BATTLES START 10:00 AM',360,830);
  const a=document.createElement('a');a.download=`FYD-Namma-Namakkal-${lastRegistration.name.replace(/[^a-z0-9]/gi,'-')}-pass.png`;a.href=canvas.toDataURL('image/png');a.click();
});

$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach(d => d.addEventListener('click', e => { if(e.target===d)d.close(); }));

$('#admin-open').addEventListener('click', async () => { adminModal.showModal(); const r=await fetch('/api/admin/me'); const d=await r.json(); if(d.authenticated) showAdmin(); });
async function showAdmin(){ $('#admin-login-view').classList.add('hidden'); $('#admin-dash').classList.remove('hidden'); startScanner(); }
async function startScanner(){
  if(!window.Html5Qrcode){$('#scan-result').textContent='QR scanner could not load. Check your internet connection.';return;}
  if(scanner)return;
  scanner = new Html5Qrcode('qr-reader');
  try { await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:230,height:230}},onQr,()=>{}); }
  catch { $('#scan-result').textContent='Camera unavailable. Allow camera access and use localhost or HTTPS.'; scanner=null; }
}
async function onQr(decoded){
  const id=decoded.trim().replace(/^fyd-namma:/,''); if(!id||id===decoded.trim()&&!id.includes('-'))return;
  $('#scan-result').textContent='Loading registration…';
  try { const r=await fetch(`/api/admin/scan/${encodeURIComponent(id)}`); const data=await r.json(); if(!r.ok)throw new Error(data.error); renderScan(data); }
  catch(e){ $('#scan-result').textContent=e.message; }
  try { await scanner?.pause(true); } catch {}
}
function renderScan(x){
  const el=$('#scan-result'); el.innerHTML=`<b>${esc(x.name)}</b><br>${esc(x.category)} · ${esc(x.entry)}${x.teamName?`<br>Group: ${esc(x.teamName)}`:''}<br>Age: ${x.age} · Phone: ${esc(x.phone)}<br>Transaction ID: <b>${esc(x.transactionId)}</b><br><small>${esc(x.paymentStatus)}</small><br>Status: <b>${x.checkedIn?'CHECKED IN':'NOT CHECKED IN'}</b>${x.checkedIn?'':`<button class="button button-yellow" id="checkin-btn">Mark checked in</button>`}`;
  $('#checkin-btn')?.addEventListener('click', async()=>{const r=await fetch('/api/admin/checkin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:x.id})});const d=await r.json();if(r.ok)renderScan(d);});
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
$('#admin-login').addEventListener('click',async()=>{ $('#admin-error').textContent='';const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#admin-user').value,password:$('#admin-pass').value})});const d=await r.json();if(!r.ok){$('#admin-error').textContent=d.error;return;}showAdmin();});
$('#admin-logout').addEventListener('click',async()=>{await fetch('/api/admin/logout',{method:'POST'});if(scanner){try{await scanner.stop();}catch{}scanner.clear();scanner=null;}$('#admin-dash').classList.add('hidden');$('#admin-login-view').classList.remove('hidden');});

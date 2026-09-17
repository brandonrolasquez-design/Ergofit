(function(){
  const root=document.getElementById('app-shell');
  const cfg=window.ERGOFIT_SUPABASE||{};
  const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  let supa=null, channel=null, rows=[], pollTimer=null, lastSignature='', knownIds=new Set(), initialized=false;
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  async function getClient(){if(supa)return supa;const m=await import(SDK);supa=m.createClient(cfg.url,cfg.publishableKey);return supa;}
  function login(){
    stopPolling();
    root.innerHTML=`<div class="login"><form class="login-card" id="cloudLogin"><div class="brand"><div class="brand-mark">E</div><div><strong>ERGOFIT</strong><span>Panel administrativo</span></div></div><h1 style="margin-top:24px">Acceso administrador</h1><p>Ingresa con el usuario creado en Supabase Authentication.</p><div class="grid"><div class="field"><label>Correo</label><input name="email" type="email" autocomplete="username" required></div><div class="field"><label>Contraseña</label><input name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary">Ingresar</button></div><p id="err" class="small" style="margin-top:12px"></p></form></div>`;
    document.getElementById('cloudLogin').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),c=await getClient();const {error}=await c.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){document.getElementById('err').textContent=error.message;return;}render()};
  }
  function metrics(){const n=rows.length,high=rows.filter(r=>r.level==='Alto').length,medium=rows.filter(r=>r.level==='Moderado').length,alerts=rows.filter(r=>r.alarm==='si').length,avg=n?Math.round(rows.reduce((s,r)=>s+Number(r.fatigue||0),0)/n):0;return {n,high,medium,alerts,avg};}
  function table(){return `<section class="card" style="margin-top:16px"><div class="hero"><div><h2>Registros recibidos</h2><p>Los registros enviados desde el celular aparecen automáticamente.</p></div><button class="btn btn-secondary" id="refresh">Actualizar</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Fecha/hora</th><th>Nombre</th><th>Trabajo</th><th>Exposición</th><th>Zona</th><th>Fatiga</th><th>Alarma</th><th>Nivel</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString('es-CO')}</td><td>${esc(r.name)}</td><td>${esc(r.job)}</td><td>${esc((r.exposures||[]).join(', '))}</td><td>${esc((r.zones||[]).join(', '))}</td><td>${r.fatigue}/10</td><td>${r.alarm==='si'?'⚠️ Sí':'No'}</td><td><span class="badge ${(r.level||'Bajo').toLowerCase()}">${esc(r.level||'Bajo')}</span></td></tr>`).join('')}</tbody></table></div></section>`}
  function dashboard(){
    const m=metrics();
    root.innerHTML=`<header class="topbar"><div class="brand"><div class="brand-mark">E</div><div><strong>ERGOFIT</strong><span>Monitoreo en tiempo real</span></div></div><div class="actions"><span class="small" id="status">● Conectando…</span><button class="btn btn-secondary" id="logout">Cerrar sesión</button></div></header><main class="content" style="max-width:1400px;margin:auto"><div class="hero"><div><h1>Panel de control</h1><p>Registros centralizados de la aplicación ERGOFIT.</p></div></div><div class="grid kpis">${kpi('Registros',m.n,'Total recibidos')}${kpi('Riesgo alto',m.high,'Nivel preventivo')}${kpi('Alertas',m.alerts,'Señales reportadas')}${kpi('Fatiga promedio',m.avg+'/10','Entre registros')}</div><div class="grid kpis" style="margin-top:16px">${kpi('Moderado',m.medium,'Nivel preventivo')}${kpi('Último registro',m.n?new Date(rows[0].created_at).toLocaleTimeString('es-CO'):'—','Hora local')}</div>${table()}</main>`;
    document.getElementById('logout').onclick=async()=>{const c=await getClient();await c.auth.signOut();stopPolling();if(channel){await c.removeChannel(channel);channel=null;}knownIds.clear();initialized=false;login()};
    document.getElementById('refresh').onclick=()=>load(true);
    updateStatus();
  }
  function kpi(t,v,s){return `<div class="card kpi"><div class="label">${t}</div><div class="value">${v}</div><div class="trend">${s}</div></div>`}
  function signature(data){return (data||[]).map(r=>`${r.id}|${r.created_at}|${r.name}|${r.level}`).join('||');}
  function showNewAlert(newRows){
    const old=document.getElementById('ergofit-new-alert');if(old)old.remove();
    const count=newRows.length;
    const names=newRows.slice(0,3).map(r=>esc(r.name||'Trabajador')).join(', ');
    const box=document.createElement('div');box.id='ergofit-new-alert';box.style.cssText='position:fixed;right:24px;top:24px;z-index:99999;width:min(460px,calc(100vw - 48px));padding:18px 22px;border-radius:16px;background:#0F5C5E;color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.25);font:600 16px/1.4 system-ui,-apple-system,sans-serif;display:flex;gap:14px;align-items:center;cursor:pointer';
    box.innerHTML=`<div style="font-size:32px">🔔</div><div style="flex:1"><div style="font-size:19px;margin-bottom:4px">Nuevo registro recibido</div><div style="font-weight:400;opacity:.95">${count===1?`Registro de <b>${names}</b> recibido desde el celular.`:`${count} registros nuevos recibidos desde el celular.`}</div><div style="font-size:12px;margin-top:8px;opacity:.85">Haz clic para cerrar esta alerta.</div></div><button aria-label="Cerrar" style="border:0;background:transparent;color:#fff;font-size:24px;cursor:pointer">×</button>`;
    box.onclick=()=>{box.remove();document.title='ERGOFIT | Gestión ergonómica';};
    document.body.appendChild(box);
    document.title='🔔 Nuevo registro | ERGOFIT';
    try{if(navigator.vibrate)navigator.vibrate([180,80,180]);}catch(e){}
    if('Notification' in window && Notification.permission==='granted'){
      try{new Notification('ERGOFIT — Nuevo registro',{body:count===1?`Registro de ${names} recibido desde el celular.`:`${count} registros nuevos recibidos.`,icon:'assets/images/logo.svg',tag:'ergofit-new-registration'});}catch(e){}
    }
  }
  async function enableBrowserNotifications(){
    if(!('Notification' in window))return;
    if(Notification.permission==='default'){
      try{await Notification.requestPermission();}catch(e){}
    }
  }
  async function fetchRows(forceRender=false){
    const c=await getClient();
    const {data,error}=await c.from('registrations').select('*').order('created_at',{ascending:false});
    if(error)throw error;
    const next=data||[], nextSignature=signature(next), changed=nextSignature!==lastSignature;
    const incoming=initialized?next.filter(r=>!knownIds.has(String(r.id))):[];
    rows=next;
    next.forEach(r=>knownIds.add(String(r.id)));
    if(changed){
      lastSignature=nextSignature;
      dashboard();
    }else if(forceRender){dashboard();}
    if(incoming.length)showNewAlert(incoming.slice(0,10));
    updateStatus();
    initialized=true;
    return changed;
  }
  async function load(forceRender=false){
    try{await fetchRows(forceRender);subscribe();startPolling();enableBrowserNotifications();}
    catch(e){root.innerHTML=`<div class="login"><div class="login-card"><h1>No se pudo cargar el panel</h1><p>${esc(e.message)}</p><p class="small">Verifica que el usuario administrador tenga permiso de lectura sobre registrations en Supabase.</p></div></div>`;}}
  function updateStatus(text){const el=document.getElementById('status');if(el&&text)el.textContent=text;}
  function subscribe(){
    if(channel)return;
    getClient().then(c=>{
      channel=c.channel('ergofit-admin-live')
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'registrations'},async()=>{await fetchRows(true);})
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'registrations'},async()=>{await fetchRows(true);})
        .on('postgres_changes',{event:'DELETE',schema:'public',table:'registrations'},async()=>{await fetchRows(true);})
        .subscribe((status,err)=>{
          if(status==='SUBSCRIBED')updateStatus('● Tiempo real activo');
          else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){console.warn('ERGOFIT Realtime:',status,err);updateStatus('● Sin tiempo real · sincronización automática activa');channel=null;}
        });
    }).catch(e=>{console.warn('ERGOFIT Realtime:',e);updateStatus('● Sin tiempo real · sincronización automática activa');channel=null;});
  }
  function startPolling(){
    if(pollTimer)return;
    pollTimer=setInterval(async()=>{try{await fetchRows(false);}catch(e){console.warn('ERGOFIT sync:',e.message);}},2000);
  }
  function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
  async function render(){const c=await getClient();const {data}=await c.auth.getSession();if(data.session)load(true);else login();}
  window.addEventListener('DOMContentLoaded',render);
})();

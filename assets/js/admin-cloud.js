(function(){
  const root=document.getElementById('app-shell');
  const cfg=window.ERGOFIT_SUPABASE||{};
  const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  let supa=null, channel=null, rows=[], pollTimer=null, lastSignature='', knownIds=new Set(), initialized=false;
  let criteria=[];
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const norm=v=>String(v??'').trim().toLowerCase();
  const uniq=a=>[...new Set(a.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').map(v=>String(v).trim()))].sort((a,b)=>a.localeCompare(b,'es'));
  async function getClient(){if(supa)return supa;const m=await import(SDK);supa=m.createClient(cfg.url,cfg.publishableKey);return supa;}
  function login(){
    stopPolling();
    root.innerHTML=`<div class="login"><form class="login-card" id="cloudLogin"><div class="brand"><div class="brand-mark">E</div><div><strong>ERGOFIT</strong><span>Panel administrativo</span></div></div><h1 style="margin-top:24px">Acceso administrador</h1><p>Ingresa con el usuario creado en Supabase Authentication.</p><div class="grid"><div class="field"><label>Correo</label><input name="email" type="email" autocomplete="username" required></div><div class="field"><label>Contraseña</label><input name="password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary">Ingresar</button></div><p id="err" class="small" style="margin-top:12px"></p></form></div>`;
    document.getElementById('cloudLogin').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),c=await getClient();const {error}=await c.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){document.getElementById('err').textContent=error.message;return;}render()};
  }
  function metrics(data=rows){const n=data.length,high=data.filter(r=>norm(r.level)==='alto').length,medium=data.filter(r=>norm(r.level)==='moderado').length,alerts=data.filter(r=>norm(r.alarm)==='si').length,avg=n?Math.round(data.reduce((s,r)=>s+Number(r.fatigue||0),0)/n):0;return {n,high,medium,alerts,avg};}
  function table(data=rows){return `<section class="card" style="margin-top:16px"><div class="hero"><div><h2>Registros recibidos</h2><p>Los registros enviados desde el celular aparecen automáticamente. ${data.length!==rows.length?`Mostrando <strong>${data.length}</strong> de ${rows.length} registros según la combinación activa.`:''}</p></div><button class="btn btn-secondary" id="refresh">Actualizar</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Fecha/hora</th><th>Nombre</th><th>Trabajo</th><th>Exposición</th><th>Zona</th><th>Fatiga</th><th>Alarma</th><th>Nivel</th></tr></thead><tbody>${data.map(r=>`<tr><td>${new Date(r.created_at).toLocaleString('es-CO')}</td><td>${esc(r.name)}</td><td>${esc(r.job)}</td><td>${esc((r.exposures||[]).join(', '))}</td><td>${esc((r.zones||[]).join(', '))}</td><td>${r.fatigue}/10</td><td>${norm(r.alarm)==='si'?'⚠️ Sí':'No'}</td><td><span class="badge ${(r.level||'Bajo').toLowerCase()}">${esc(r.level||'Bajo')}</span></td></tr>`).join('')||'<tr><td colspan="8" style="text-align:center;padding:28px">No hay registros que cumplan la combinación seleccionada.</td></tr>'}</tbody></table></div></section>`}
  function optionsForDimension(dimension,data=rows){
    if(dimension==='exposure')return uniq(data.flatMap(r=>r.exposures||[]));
    if(dimension==='zone')return uniq(data.flatMap(r=>r.zones||[]));
    if(dimension==='job')return uniq(data.map(r=>r.job));
    if(dimension==='level')return ['Bajo','Moderado','Alto'];
    if(dimension==='alarm')return ['No','Sí'];
    return [];
  }
  function rowMatchesCriterion(r,c){
    if(c.dimension==='exposure')return (r.exposures||[]).some(v=>norm(v)===norm(c.value));
    if(c.dimension==='zone')return (r.zones||[]).some(v=>norm(v)===norm(c.value));
    if(c.dimension==='job')return norm(r.job)===norm(c.value);
    if(c.dimension==='level')return norm(r.level)===norm(c.value);
    if(c.dimension==='alarm')return norm(r.alarm)===(norm(c.value)==='sí'?'si':'no');
    return true;
  }
  function filteredRows(){
    if(!criteria.length)return rows;
    const grouped={};criteria.forEach(c=>(grouped[c.dimension]??=[]).push(c));
    return rows.filter(r=>Object.values(grouped).every(group=>group.some(c=>rowMatchesCriterion(r,c))));
  }
  function svgShell(viewBox,inner){return `<svg viewBox="0 0 700 ${viewBox}" role="img" aria-label="Gráfico epidemiológico" style="width:100%;height:auto;display:block">${inner}</svg>`}
  function riskDonut(data){
    const counts={Bajo:data.filter(r=>norm(r.level)==='bajo').length,Moderado:data.filter(r=>norm(r.level)==='moderado').length,Alto:data.filter(r=>norm(r.level)==='alto').length};
    const total=Object.values(counts).reduce((a,b)=>a+b,0)||1, cx=170,cy=150,R=92,r=58;let start=-Math.PI/2;
    const palette={Bajo:'#2F7D78',Moderado:'#E09F3E',Alto:'#B84A4A'};
    const parts=Object.entries(counts).map(([label,value])=>{const angle=value/total*Math.PI*2,end=start+angle;const x1=cx+R*Math.cos(start),y1=cy+R*Math.sin(start),x2=cx+R*Math.cos(end),y2=cy+R*Math.sin(end),ix1=cx+r*Math.cos(end),iy1=cy+r*Math.sin(end),ix2=cx+r*Math.cos(start),iy2=cy+r*Math.sin(start),large=angle>Math.PI?1:0;const path=value?`<path d="M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z" fill="${palette[label]}" stroke="#fff" stroke-width="4"><title>${label}: ${value}</title></path>`:'';start=end;return path}).join('');
    const legend=Object.entries(counts).map(([label,value],i)=>`<g transform="translate(330 ${76+i*54})"><rect width="18" height="18" rx="4" fill="${palette[label]}"/><text x="28" y="14" font-size="18" fill="#153B3C">${label}</text><text x="150" y="14" font-size="18" font-weight="700" fill="#153B3C">${value} (${Math.round(value/total*100)}%)</text></g>`).join('');
    return svgShell(300,`${parts}<circle cx="${cx}" cy="${cy}" r="47" fill="#fff"/><text x="${cx}" y="${cy-2}" text-anchor="middle" font-size="28" font-weight="800" fill="#153B3C">${data.length}</text><text x="${cx}" y="${cy+22}" text-anchor="middle" font-size="14" fill="#526466">registros</text>${legend}`);
  }
  function barChart(data,field,titleColor='#0F5C5E'){
    const items=data.slice(0,8), max=Math.max(...items.map(x=>x.value),1), left=190, chartW=430, rowH=32;
    return svgShell(Math.max(220,items.length*rowH+45),items.map((x,i)=>{const y=28+i*rowH,w=(x.value/max)*chartW;return `<g><text x="${left-12}" y="${y+20}" text-anchor="end" font-size="14" fill="#526466">${esc(x.label)}</text><rect x="${left}" y="${y+5}" width="${chartW}" height="20" rx="10" fill="#E8F3F1"/><rect x="${left}" y="${y+5}" width="${w}" height="20" rx="10" fill="${titleColor}"><title>${esc(x.label)}: ${x.value}</title></rect><text x="${left+w+10}" y="${y+21}" font-size="14" font-weight="700" fill="#153B3C">${x.value}</text></g>`}).join(''));
  }
  function exposureRiskChart(data){
    const map={};data.forEach(r=>(r.exposures||[]).forEach(e=>{map[e]??={Bajo:0,Moderado:0,Alto:0};const level=['Bajo','Moderado','Alto'].includes(r.level)?r.level:'Bajo';map[e][level]++;}));
    const items=Object.entries(map).sort((a,b)=>(b[1].Bajo+b[1].Moderado+b[1].Alto)-(a[1].Bajo+a[1].Moderado+a[1].Alto)).slice(0,6), left=175, chartW=455,rowH=52,max=Math.max(...items.map(([,v])=>v.Bajo+v.Moderado+v.Alto),1);let body='';
    items.forEach(([label,v],i)=>{const y=24+i*rowH,total=v.Bajo+v.Moderado+v.Alto,scale=chartW/max;let x=left;[['Bajo','#2F7D78'],['Moderado','#E09F3E'],['Alto','#B84A4A']].forEach(([k,c])=>{const w=v[k]*scale;if(w){body+=`<rect x="${x}" y="${y+7}" width="${w}" height="22" fill="${c}"><title>${esc(label)} — ${k}: ${v[k]}</title></rect>`;x+=w;}});body+=`<text x="${left-10}" y="${y+23}" text-anchor="end" font-size="14" fill="#526466">${esc(label)}</text><text x="${Math.min(left+chartW+8,x+8)}" y="${y+23}" font-size="13" font-weight="700" fill="#153B3C">${total}</text>`;});
    const legend=[['Bajo','#2F7D78'],['Moderado','#E09F3E'],['Alto','#B84A4A']].map(([k,c],i)=>`<g transform="translate(${left+i*125} ${items.length*rowH+20})"><rect width="14" height="14" rx="3" fill="${c}"/><text x="22" y="12" font-size="13" fill="#526466">${k}</text></g>`).join('');
    return svgShell(Math.max(190,items.length*rowH+65),body+legend);
  }
  function charts(data){
    const exposures={};data.forEach(r=>(r.exposures||[]).forEach(e=>exposures[e]=(exposures[e]||0)+1));
    const zones={};data.forEach(r=>(r.zones||[]).forEach(z=>zones[z]=(zones[z]||0)+1));
    const exposureData=Object.entries(exposures).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
    const zoneData=Object.entries(zones).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
    return `<section id="epi-analysis" style="margin-top:18px"><div class="card" style="background:linear-gradient(135deg,#F4F7F7,#fff);border-left:5px solid #0F5C5E"><div class="hero"><div><h2>Análisis epidemiológico del riesgo ergonómico</h2><p>Frecuencia, distribución y coexistencia de factores de exposición en los registros seleccionados.</p></div><div style="font-weight:800;color:#0F5C5E">n = ${data.length}</div></div><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px"><div class="card" style="padding:18px"><h3 style="margin:0 0 4px">Distribución del nivel de riesgo</h3><p class="small">Proporción de registros por clasificación preventiva.</p>${riskDonut(data)}</div><div class="card" style="padding:18px"><h3 style="margin:0 0 4px">Frecuencia de exposiciones</h3><p class="small">Número de registros en los que se reporta cada exposición.</p>${barChart(exposureData)}</div><div class="card" style="padding:18px"><h3 style="margin:0 0 4px">Exposición y nivel de riesgo</h3><p class="small">Permite identificar qué exposiciones concentran niveles moderados o altos.</p>${exposureRiskChart(data)}</div></div><div class="card" style="margin-top:16px;padding:18px"><h3 style="margin:0 0 4px">Segmentos corporales afectados</h3><p class="small">Frecuencia de zonas corporales reportadas. Útil para orientar vigilancia e intervención.</p>${barChart(zoneData)}</div></div></section>`;
  }
  function criteriaBuilder(data){
    const dimensions=[['exposure','Exposición'],['zone','Zona corporal'],['job','Tipo de trabajo'],['level','Nivel de riesgo'],['alarm','Alarma']];
    const dimensionOptions=dimensions.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
    const active=criteria.map((c,i)=>`<button type="button" class="btn btn-secondary" data-remove-criterion="${i}" style="font-size:13px;padding:8px 12px">${esc(dimensions.find(d=>d[0]===c.dimension)?.[1]||c.dimension)} = <strong>${esc(c.value)}</strong> ×</button>`).join('');
    const quick=[
      ['Riesgo moderado o alto',[{dimension:'level',value:'Moderado'},{dimension:'level',value:'Alto'}]],
      ['Repetición + cuello',[{dimension:'exposure',value:'repeticion'},{dimension:'zone',value:'Cuello'}]],
      ['Fuerza + tronco',[{dimension:'exposure',value:'fuerza'},{dimension:'zone',value:'Tronco'}]],
      ['Alarma activa',[{dimension:'alarm',value:'Sí'}]]
    ];
    return `<section class="card" style="margin-top:18px"><div class="hero"><div><h2>Constructor de combinaciones</h2><p>Combina respuestas con lógica <strong>Y</strong> entre dimensiones y <strong>O</strong> dentro de una misma dimensión.</p></div><button class="btn btn-secondary" id="clearCriteria">Limpiar filtros</button></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end"><div class="field"><label>Variable</label><select id="criterionDimension">${dimensionOptions}</select></div><div class="field"><label>Respuesta</label><select id="criterionValue"></select></div><button class="btn btn-primary" id="addCriterion">+ Añadir criterio</button></div><div style="margin-top:14px"><div class="small" style="margin-bottom:7px">Combinaciones activas</div><div style="display:flex;gap:8px;flex-wrap:wrap">${active||'<span class="small">Ninguna. Se están mostrando todos los registros.</span>'}</div></div><div style="margin-top:14px"><div class="small" style="margin-bottom:7px">Combinaciones rápidas</div><div style="display:flex;gap:8px;flex-wrap:wrap">${quick.map((q,i)=>`<button type="button" class="btn btn-secondary" data-quick="${i}">${q[0]}</button>`).join('')}</div></div></section>`;
  }
  function bindBuilder(){
    const d=document.getElementById('criterionDimension'),v=document.getElementById('criterionValue');
    const fill=()=>{v.innerHTML=optionsForDimension(d.value).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')||'<option value="">Sin respuestas disponibles</option>';};fill();d.onchange=fill;
    document.getElementById('addCriterion').onclick=()=>{if(!v.value)return;criteria.push({dimension:d.value,value:v.value});renderDashboard(false);};
    document.getElementById('clearCriteria').onclick=()=>{criteria=[];renderDashboard(false);};
    document.querySelectorAll('[data-remove-criterion]').forEach(b=>b.onclick=()=>{criteria.splice(Number(b.dataset.removeCriterion),1);renderDashboard(false);});
    document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{const quick=[
      [{dimension:'level',value:'Moderado'},{dimension:'level',value:'Alto'}],
      [{dimension:'exposure',value:'repeticion'},{dimension:'zone',value:'Cuello'}],
      [{dimension:'exposure',value:'fuerza'},{dimension:'zone',value:'Tronco'}],
      [{dimension:'alarm',value:'Sí'}]
    ];criteria=quick[Number(b.dataset.quick)]||[];renderDashboard(false);});
  }
  function renderDashboard(resetBuilder=false){
    if(resetBuilder)criteria=[];
    const data=filteredRows(),m=metrics(data);
    root.innerHTML=`<header class="topbar"><div class="brand"><div class="brand-mark">E</div><div><strong>ERGOFIT</strong><span>Monitoreo en tiempo real</span></div></div><div class="actions"><span class="small" id="status">● Conectando…</span><button class="btn btn-secondary" id="logout">Cerrar sesión</button></div></header><main class="content" style="max-width:1400px;margin:auto"><div class="hero"><div><h1>Panel de control</h1><p>Registros centralizados de la aplicación ERGOFIT.</p></div></div><div class="grid kpis">${kpi('Registros',m.n,'Total en la combinación')}${kpi('Riesgo alto',m.high,'Nivel preventivo')}${kpi('Alertas',m.alerts,'Señales reportadas')}${kpi('Fatiga promedio',m.avg+'/10','Entre registros')}</div><div class="grid kpis" style="margin-top:16px">${kpi('Moderado',m.medium,'Nivel preventivo')}${kpi('Último registro',m.n?new Date(data[0].created_at).toLocaleTimeString('es-CO'):'—','Hora local')}</div>${criteriaBuilder(rows)}${charts(data)}${table(data)}</main>`;
    document.getElementById('logout').onclick=async()=>{const c=await getClient();await c.auth.signOut();stopPolling();if(channel){await c.removeChannel(channel);channel=null;}knownIds.clear();initialized=false;criteria=[];login()};
    document.getElementById('refresh').onclick=()=>load(true);
    bindBuilder();updateStatus();
  }
  function kpi(t,v,s){return `<div class="card kpi"><div class="label">${t}</div><div class="value">${v}</div><div class="trend">${s}</div></div>`}
  function signature(data){return (data||[]).map(r=>`${r.id}|${r.created_at}|${r.name}|${r.level}`).join('||');}
  function showNewAlert(newRows){
    const old=document.getElementById('ergofit-new-alert');if(old)old.remove();
    const count=newRows.length,names=newRows.slice(0,3).map(r=>esc(r.name||'Trabajador')).join(', ');
    const box=document.createElement('div');box.id='ergofit-new-alert';box.style.cssText='position:fixed;right:24px;top:24px;z-index:99999;width:min(460px,calc(100vw - 48px));padding:18px 22px;border-radius:16px;background:#0F5C5E;color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.25);font:600 16px/1.4 system-ui,-apple-system,sans-serif;display:flex;gap:14px;align-items:center;cursor:pointer';
    box.innerHTML=`<div style="font-size:32px">🔔</div><div style="flex:1"><div style="font-size:19px;margin-bottom:4px">Nuevo registro recibido</div><div style="font-weight:400;opacity:.95">${count===1?`Registro de <b>${names}</b> recibido desde el celular.`:`${count} registros nuevos recibidos desde el celular.`}</div><div style="font-size:12px;margin-top:8px;opacity:.85">Haz clic para cerrar esta alerta.</div></div><button aria-label="Cerrar" style="border:0;background:transparent;color:#fff;font-size:24px;cursor:pointer">×</button>`;
    box.onclick=()=>{box.remove();document.title='ERGOFIT | Gestión ergonómica';};document.body.appendChild(box);document.title='🔔 Nuevo registro | ERGOFIT';
    try{if(navigator.vibrate)navigator.vibrate([180,80,180]);}catch(e){}
    if('Notification' in window&&Notification.permission==='granted'){try{new Notification('ERGOFIT — Nuevo registro',{body:count===1?`Registro de ${names} recibido desde el celular.`:`${count} registros nuevos recibidos.`,icon:'assets/images/logo.svg',tag:'ergofit-new-registration'});}catch(e){}}
  }
  async function enableBrowserNotifications(){if(!('Notification' in window))return;if(Notification.permission==='default'){try{await Notification.requestPermission();}catch(e){}}}
  async function fetchRows(forceRender=false){
    const c=await getClient();const {data,error}=await c.from('registrations').select('*').order('created_at',{ascending:false});if(error)throw error;
    const next=data||[],nextSignature=signature(next),changed=nextSignature!==lastSignature,incoming=initialized?next.filter(r=>!knownIds.has(String(r.id))):[];
    rows=next;next.forEach(r=>knownIds.add(String(r.id)));
    if(changed){lastSignature=nextSignature;renderDashboard(false);}else if(forceRender){renderDashboard(false);}
    if(incoming.length)showNewAlert(incoming.slice(0,10));updateStatus();initialized=true;return changed;
  }
  async function load(forceRender=false){try{await fetchRows(forceRender);subscribe();startPolling();enableBrowserNotifications();}catch(e){root.innerHTML=`<div class="login"><div class="login-card"><h1>No se pudo cargar el panel</h1><p>${esc(e.message)}</p><p class="small">Verifica que el usuario administrador tenga permiso de lectura sobre registrations en Supabase.</p></div></div>`;}}
  function updateStatus(text){const el=document.getElementById('status');if(el&&text)el.textContent=text;}
  function subscribe(){
    if(channel)return;getClient().then(c=>{channel=c.channel('ergofit-admin-live').on('postgres_changes',{event:'INSERT',schema:'public',table:'registrations'},async()=>{await fetchRows(true);}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'registrations'},async()=>{await fetchRows(true);}).on('postgres_changes',{event:'DELETE',schema:'public',table:'registrations'},async()=>{await fetchRows(true);}).subscribe((status,err)=>{if(status==='SUBSCRIBED')updateStatus('● Tiempo real activo');else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){console.warn('ERGOFIT Realtime:',status,err);updateStatus('● Sin tiempo real · sincronización automática activa');channel=null;}});}).catch(e=>{console.warn('ERGOFIT Realtime:',e);updateStatus('● Sin tiempo real · sincronización automática activa');channel=null;});
  }
  function startPolling(){if(pollTimer)return;pollTimer=setInterval(async()=>{try{await fetchRows(false);}catch(e){console.warn('ERGOFIT sync:',e.message);}},2000)}
  function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
  async function render(){const c=await getClient();const {data}=await c.auth.getSession();if(data.session)load(true);else login();}
  window.addEventListener('DOMContentLoaded',render);
})();

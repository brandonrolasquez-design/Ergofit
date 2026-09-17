async function saveRegistration(level){
  const btn=document.querySelector('#saveBtn');
  if(btn){btn.disabled=true;btn.textContent='Sincronizando…';}
  const record={...data,level,createdAt:new Date().toISOString(),id:'r'+Date.now()};
  try{
    if(!window.ERGOFIT_CLOUD?.configured) throw new Error('Supabase no está configurado');
    await window.ERGOFIT_CLOUD.saveRegistration(record);
    const list=JSON.parse(localStorage.getItem(KEY)||'[]');
    list.unshift(record);
    localStorage.setItem(KEY,JSON.stringify(list));
    app.innerHTML=`<div class="app">${header()}<div class="content"><section class="card success"><div class="icon">✅</div><h2>Registro sincronizado</h2><p class="muted">Tu registro fue enviado correctamente al sistema ERGOFIT. El tablero administrativo puede recibirlo en tiempo real.</p><button class="btn primary" onclick="welcome()">Nuevo registro</button></section></div></div>`;
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='Guardar y sincronizar mi registro';}
    alert('No fue posible sincronizar el registro. Verifica tu conexión e inténtalo nuevamente.');
    console.error('ERGOFIT sync:',e);
  }
}
function makePlan(){
  data.exposures=[...document.querySelectorAll('.exp:checked')].map(x=>x.value);
  data.zones=[...document.querySelectorAll('.zn:checked')].map(x=>x.value);
  data.fatigue=+document.getElementById('fatigue').value;
  data.duration=document.getElementById('duration').value;
  data.alarm=document.getElementById('alarm').value;
  if(!data.exposures.length||!data.zones.length)return alert('Selecciona al menos una exposición y una zona corporal.');
  const high=data.alarm==='si'||data.fatigue>=8,moderate=data.fatigue>=5;
  let items=[['🧘','Movilidad general','2 min','Moviliza suavemente los segmentos confortables, sin rebotes ni dolor.']];
  if(data.exposures.includes('posturas'))items.push(['🤸','Estiramientos suaves','2–3 min','Estira progresivamente y detente si aumenta la molestia.']);
  if(data.zones.some(z=>['Cabeza','Cuello','Hombros'].includes(z)))items.push(['👀','Descanso visual','1–2 min','Alterna la mirada entre cerca y lejos y cambia el foco visual.']);
  if(data.exposures.includes('repeticion'))items.push(['🧠','Pausa mental','2 min','Interrumpe brevemente la tarea y cambia de actividad cuando sea posible.']);
  if(data.exposures.includes('fuerza')&&!high)items.push(['🚶','Caminata ligera','3–5 min','Realiza una caminata suave si el entorno es seguro.']);
  items.push(['🌿','Respiración y relajación','2 min','Respira tranquilamente y relaja hombros y manos.']);
  const level=high?'Alto':moderate?'Moderado':'Bajo';
  const recommendation=high?'Prioriza recuperación y considera valoración profesional antes de realizar ejercicios por cuenta propia.':'Mantén pausas breves y frecuentes y alterna posiciones y tareas cuando sea posible.';
  shell(`<section class="card"><div class="success"><div class="icon">${high?'⚠️':'🎯'}</div><h2>Tu plan ERGOFIT</h2><p class="muted">Hola, <b>${esc(data.name)}</b>. Nivel preventivo: <b>${level}</b>.</p></div><div class="progress"><span style="width:${Math.max(20,100-data.fatigue*7)}%"></span></div><div class="notice ${high?'danger':''}"><b>Orientación:</b> ${recommendation}</div><p><b>Trabajo:</b> ${esc(data.job)} · <b>Fatiga:</b> ${data.fatigue}/10</p>${items.map(x=>`<div class="plan-item"><span class="tag">${x[0]}</span><span class="tag">${x[2]}</span><h3>${x[1]}</h3><p class="muted">${x[3]}</p></div>`).join('')}<button class="btn primary" id="saveBtn" onclick="saveRegistration('${level}')">Guardar y sincronizar mi registro</button><button class="btn secondary" onclick="registerStep()">Modificar respuestas</button></section>`,4);
}
welcome();

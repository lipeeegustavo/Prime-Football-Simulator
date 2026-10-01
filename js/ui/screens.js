(function (Prime) {
  const {GameStates:S,FORMATIONS,COACHES,PLAYERS}=Prime;
  const store=Prime.Store,state=store.state;
  const Squad=Prime.Squad;
  const {$dummy}=Prime;
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let subDialogWasPaused=false;
  let confirmResolve=null;

  const STEP_ORDER=[S.MODE,S.BUILD_P1,S.BUILD_P2,S.PRE_GAME,S.MATCH,S.END];
  const STEP_LABELS={
    [S.MODE]:'Modo',[S.BUILD_P1]:'Time 1',[S.BUILD_P2]:'Time 2',[S.PRE_GAME]:'Pré-jogo',[S.MATCH]:'Partida',[S.END]:'Fim'
  };

  function showToast(message,type,title){
    const root=$('#toastRoot');if(!root)return;
    const item=document.createElement('div');item.className=`toast ${type||''}`.trim();
    item.innerHTML=`<strong>${esc(title||(type==='error'?'Erro':type==='success'?'Pronto':'Aviso'))}</strong><p>${esc(message)}</p>`;
    root.appendChild(item);setTimeout(()=>item.remove(),4200);
  }
  function confirmAction(title,text){
    const dialog=$('#confirmDialog');$('#confirmTitle').textContent=title;$('#confirmText').textContent=text;
    return new Promise(resolve=>{confirmResolve=resolve;dialog.showModal();});
  }
  function bindConfirmDialog(){
    const dialog=$('#confirmDialog');if(!dialog)return;
    dialog.addEventListener('close',()=>{const result=dialog.returnValue==='confirm';if(confirmResolve){const r=confirmResolve;confirmResolve=null;r(result);}});
  }

  function setHeader(){
    $('#seedChip').textContent=`Seed: ${state.settings.seed}`;
    $('#homeBtn').style.visibility=state.screen===S.MENU?'hidden':'visible';
  }
  function renderStepper(){
    const root=$('#progressRoot');if(!root)return;
    if(state.screen===S.MENU){root.innerHTML='';return;}
    let idx=STEP_ORDER.indexOf(state.screen);
    if(state.mode==='cpu'&&state.screen===S.PRE_GAME)idx=3;
    root.innerHTML=`<div class="stepper">${STEP_ORDER.map((step,i)=>{
      const cls=i<idx?'done':i===idx?'active':'';return `<div class="step ${cls}"><span>${esc(STEP_LABELS[step])}</span></div>`;
    }).join('')}</div>`;
  }
  function render(){
    setHeader();renderStepper();const app=$('#app');
    if(state.screen===S.MENU)renderMenu(app);
    else if(state.screen===S.MODE)renderMode(app);
    else if(state.screen===S.BUILD_P1)renderBuilder(app,'A');
    else if(state.screen===S.BUILD_P2)renderBuilder(app,'B');
    else if(state.screen===S.PRE_GAME)renderPreGame(app);
    else if(state.screen===S.MATCH)renderMatch(app);
    else if(state.screen===S.END)renderEnd(app);
  }

  function renderMenu(app){
    const history=Prime.Persistence?.history?.()||[];const last=history[0];
    app.innerHTML=`<section class="hero-screen"><div class="panel hero"><div class="hero-copy"><span class="eyebrow">Monte · simule · assista</span><h1>Seu time dos sonhos.<br><em>Em campo.</em></h1><p>Escolha lendas no auge, monte a formação e veja a partida acontecer com marcadores táticos circulares, bola física e decisões reproduzíveis por seed.</p><div class="hero-actions"><button id="playNow" class="btn btn-primary">Jogar agora →</button><button id="howBtn" class="btn btn-ghost">Como jogar</button></div><div id="howPanel" class="card-soft" hidden style="margin-top:18px;max-width:620px;text-align:left"><strong>Como jogar</strong><p class="muted" style="margin:8px 0 0">1. Escolha o modo. 2. Monte titulares, banco, técnico e pênaltis. 3. Revise o pré-jogo. 4. Dê PLAY e acompanhe a partida. O jogo salva sua montagem e os últimos resultados neste navegador.</p></div>${history.length?`<div class="card-soft local-history"><span class="eyebrow">Ranking local · últimos jogos</span>${history.slice(0,3).map((h,i)=>`<div class="history-row"><span>#${i+1}</span><strong>${esc(h.a)} ${h.sa}–${h.sb} ${esc(h.b)}</strong><small>${esc(h.seed||'')}</small></div>`).join('')}</div>`:''}</div></div></section>`;
    $('#playNow').onclick=()=>store.transition(S.MODE);
    $('#howBtn').onclick=()=>{$('#howPanel').hidden=!$('#howPanel').hidden;};
  }

  function renderMode(app){
    app.innerHTML=`<section class="screen"><div class="screen-head"><div><span class="eyebrow">Passo 1</span><h2>Escolha como jogar</h2><p class="muted">Primeiro o modo. Depois você monta os times.</p></div></div><div class="card"><div class="form-grid"><label class="field">Seed da partida<input id="modeSeed" value="${esc(state.settings.seed)}"></label><label class="field">Estilo da máquina<select id="cpuStyle"><option value="balanced" ${state.settings.cpuDifficulty==='balanced'?'selected':''}>Equilibrada</option><option value="elite" ${state.settings.cpuDifficulty==='elite'?'selected':''}>Melhores disponíveis</option><option value="random" ${state.settings.cpuDifficulty==='random'?'selected':''}>Aleatória</option></select></label></div></div><div class="mode-grid"><article class="panel mode-card"><div><span class="mode-icon">🤖</span><h3>Jogador x Máquina</h3><p>Monte seu time. A CPU completa o adversário de forma determinística pela seed.</p></div><button class="btn btn-primary choose-mode" data-mode="cpu">Jogar contra a máquina</button></article><article class="panel mode-card"><div><span class="mode-icon">👥</span><h3>Jogador x Jogador</h3><p>Dois jogadores no mesmo dispositivo. O segundo não pode escolher atletas usados pelo primeiro.</p></div><button class="btn btn-primary choose-mode" data-mode="local">Jogar local</button></article><article class="panel mode-card"><div><span class="mode-icon">🎯</span><h3>Desafio 3–0</h3><p>Monte seu time e tente vencer a máquina por pelo menos 3 gols de diferença.</p></div><button class="btn btn-gold" id="challengeMode">Aceitar desafio</button></article><article class="panel mode-card"><div><span class="mode-icon">🏆</span><h3>Ranking local</h3><p>Veja os últimos resultados salvos neste navegador.</p></div><button class="btn btn-ghost" id="localRankingBtn">Ver histórico</button></article></div><div class="split-actions"><button id="modeBack" class="btn btn-ghost">← Voltar</button></div></section>`;
    $('#modeBack').onclick=()=>store.transition(S.MENU);
    document.querySelectorAll('.choose-mode').forEach(btn=>btn.onclick=()=>{
      state.settings.seed=$('#modeSeed').value.trim()||'PRIME-001';state.settings.cpuDifficulty=$('#cpuStyle').value;state.settings.challenge=null;store.resetForMode(btn.dataset.mode);store.transition(S.BUILD_P1);
    });
    const ch=$('#challengeMode');if(ch)ch.onclick=()=>{state.settings.seed=$('#modeSeed').value.trim()||'PRIME-001';state.settings.cpuDifficulty='elite';store.resetForMode('cpu');state.settings.challenge={id:'win-by-3',label:'Vencer por 3 gols',margin:3};store.transition(S.BUILD_P1);};
    const rk=$('#localRankingBtn');if(rk)rk.onclick=()=>{const h=Prime.Persistence?.history?.()||[];showToast(h.length?h.slice(0,5).map(x=>`${x.a} ${x.sa}–${x.sb} ${x.b}`).join(' · '):'Ainda não há partidas salvas.',h.length?'success':'');};
  }

  function slotCoordinates(teamKey){return Prime.Pitch.coordinatesForFormation(state.teams[teamKey].formation,teamKey);}
  function tacticalPitchMarkup(key){
    const t=state.teams[key],coords=slotCoordinates(key),positions=FORMATIONS[t.formation];
    return `<div class="builder-pitch ${key==='B'?'team-b-builder':''}">${coords.map((xy,i)=>{
      const p=Squad.playerById(t.starters[i]),pos=positions[i],left=xy[0]/Prime.FieldGeometry.FIELD.width*100,top=xy[1]/Prime.FieldGeometry.FIELD.length*100;
      const number=p?Squad.shirtNumber(t,p.id):'';
      return `<button type="button" class="slot ${p?'filled':''} ${pos==='GOL'?'goalkeeper-slot':''} ${state.ui.selectedSlot===i&&state.ui.builderTab==='titulares'?'selected':''}" data-slot="${i}" style="left:${left}%;top:${top}%"><span class="slot-pos">${pos==='GOL'?'GOLEIRO':pos}</span><span class="slot-badge">${p?number:'+'}</span><span class="slot-name">${p?esc(Squad.surname(p.name)):pos==='GOL'?'Goleiro':pos}</span></button>`;
    }).join('')}</div>`;
  }

  function teamCounts(key){const t=state.teams[key];return {starters:t.starters.filter(Boolean).length,bench:t.bench.filter(Boolean).length,pens:t.penalties.filter(Boolean).length};}
  function playerCandidates(key,position,kind,index){
    const t=state.teams[key],selected=kind==='starter'?t.starters[index]:t.bench[index],used=Squad.globallyUsedIds(key,selected);
    let list=PLAYERS.filter(p=>kind==='bench'||Squad.eligibleForPosition(p,position));
    const q=state.ui.playerSearch.trim().toLowerCase();if(q)list=list.filter(p=>p.name.toLowerCase().includes(q)||p.positions.some(x=>x.toLowerCase().includes(q)));
    if(state.ui.playerSort==='name')list=list.slice().sort((a,b)=>a.name.localeCompare(b.name));else list=list.slice().sort((a,b)=>b.overall-a.overall);
    return list.map(p=>({p,disabled:used.has(String(p.id))&&String(p.id)!==String(selected)}));
  }
  function playerCard(p,disabled,selected){
    const attrs=Squad.topAttributes(p).map(a=>`<span class="attr">${a.label} ${a.value}</span>`).join('');
    return `<button type="button" class="player-card ${selected?'selected-player':''}" data-player="${p.id}" ${disabled?'disabled':''} ${selected?'aria-pressed="true"':''}><span class="player-ovr">${p.overall}</span><span><span class="player-name">${esc(p.name)}</span><span class="player-meta">${p.positions.join(' / ')} · ${esc(p.profileStyle||p.group)}</span></span><span class="attr-row">${selected?'<span class="selected-chip">✓ escolhido</span>':''}${attrs}</span></button>`;
  }

  function benchOverviewMarkup(key,activeIndex){
    const t=state.teams[key];
    return `<div class="bench-overview">${t.bench.map((id,i)=>{const p=Squad.playerById(id);return `<button type="button" class="bench-summary-card ${i===activeIndex?'active':''} ${p?'filled':''}" data-bench-slot="${i}"><span class="bench-order">${i+1}</span><span class="bench-summary-main"><strong>${p?esc(Squad.surname(p.name)):'Vaga '+(i+1)}</strong><small>${p?esc(p.positions.join('/')):'Não escolhido'}</small></span>${p?`<span class="bench-shirt">#${Squad.shirtNumber(t,p.id)}</span>`:''}</button>`;}).join('')}</div>`;
  }
  function coachCards(key){
    const other=key==='A'?'B':'A',blocked=String(state.teams[other].coach||'');
    return COACHES.map(c=>{const used=blocked&&String(c.id)===blocked;return `<button type="button" class="player-card coach-choice" data-coach="${c.id}" ${used?'disabled title="Este técnico já está no outro time"':''}><span class="player-ovr">${c.attack+c.defense}</span><span><span class="player-name">${esc(c.name)}</span><span class="player-meta">${used?'Já escolhido pelo adversário':esc(c.style)}</span></span><span class="attr-row"><span class="attr">PRE ${c.tactics.pressing}</span><span class="attr">RIT ${c.tactics.tempo}</span><span class="attr">TRA ${c.tactics.transitionSpeed}</span></span></button>`;}).join('');
  }

  function pickerMarkup(key){
    const t=state.teams[key],tab=state.ui.builderTab,counts=teamCounts(key);
    if(tab==='titulares'){
      const positions=FORMATIONS[t.formation],i=Math.max(0,Math.min(10,state.ui.selectedSlot)),pos=positions[i],selected=t.starters[i];
      const candidates=playerCandidates(key,pos,'starter',i);
      return `<div class="picker-panel"><span class="eyebrow">Escolha por posição</span><h3>${pos} · ${selected?esc(Squad.playerById(selected)?.name):'vaga aberta'}</h3><div class="toolbar"><input id="playerSearch" placeholder="Buscar jogador..." value="${esc(state.ui.playerSearch)}"><select id="playerSort"><option value="overall" ${state.ui.playerSort==='overall'?'selected':''}>Maior overall</option><option value="name" ${state.ui.playerSort==='name'?'selected':''}>Nome A–Z</option></select></div><div class="player-grid">${candidates.map(x=>playerCard(x.p,x.disabled,String(x.p.id)===String(selected))).join('')}</div></div>`;
    }
    if(tab==='banco'){
      const benchIndex=Math.max(0,Math.min(6,state.ui.selectedSlot));const selected=t.bench[benchIndex],candidates=playerCandidates(key,null,'bench',benchIndex);
      return `<div class="picker-panel"><span class="eyebrow">Banco ${counts.bench}/7</span><h3>Reserva ${benchIndex+1} ${selected?'· '+esc(Squad.surname(Squad.playerById(selected)?.name||'')):'· vaga aberta'}</h3><p class="muted small">Ao escolher um reserva, o jogo avança automaticamente para a próxima vaga vazia.</p>${benchOverviewMarkup(key,benchIndex)}<div class="toolbar"><input id="playerSearch" placeholder="Buscar reserva..." value="${esc(state.ui.playerSearch)}"><select id="playerSort"><option value="overall">Maior overall</option><option value="name" ${state.ui.playerSort==='name'?'selected':''}>Nome A–Z</option></select></div><div class="player-grid">${candidates.map(x=>playerCard(x.p,x.disabled,String(x.p.id)===String(selected))).join('')}</div></div>`;
    }
    if(tab==='tecnico'){
      return `<div class="picker-panel"><span class="eyebrow">Comando técnico</span><h3>Escolha o treinador</h3><div class="player-grid">${coachCards(key)}<button type="button" class="player-card coach-choice" data-coach=""><span class="player-ovr">—</span><span><span class="player-name">Sem técnico</span><span class="player-meta">Substituições somente manuais</span></span></button></div></div>`;
    }
    const optionsFor=(slot)=>Squad.penaltyOptions(t,slot);
    return `<div class="picker-panel"><span class="eyebrow">Pênaltis ${counts.pens}/5</span><h3>Ordem dos cobradores</h3><p class="muted small">Um jogador escolhido some das outras listas. A ordem pode ser sorteada de forma determinística pela seed.</p><div class="list-stack">${t.penalties.map((id,i)=>`<label class="field">${i+1}º cobrador<select data-pen-slot="${i}"><option value="">Escolher...</option>${optionsFor(i).map(o=>`<option value="${o.id}" ${String(o.id)===String(id)?'selected':''} ${o.disabled?'disabled':''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('')}</div><div class="action-row" style="margin-top:10px"><button id="randomPens" class="btn btn-gold">🎲 Sortear ordem</button></div></div>`;
  }

  function renderBuilder(app,key){
    state.activeBuilder=key;const t=state.teams[key],counts=teamCounts(key),errors=Prime.Validation.validateBuilderTeam(state,key);
    const coach=Squad.coachById(t.coach);
    app.innerHTML=`<section class="screen"><div class="screen-head"><div><span class="eyebrow">${key==='A'?'Passo 2':'Passo 3'} · ${state.mode==='cpu'?'Jogador x Máquina':'Jogador x Jogador'}</span><h2>Monte ${esc(t.name)}</h2><p class="muted">Clique numa posição do campo e escolha um jogador apto.</p></div><div class="progress-badges"><span class="pill"><strong>${counts.starters}/11</strong> titulares</span><span class="pill"><strong>${counts.bench}/7</strong> banco</span><span class="pill"><strong>${counts.pens}/5</strong> pênaltis</span></div></div><div class="builder-layout"><div class="panel tactical-card"><div class="form-grid" style="margin-bottom:10px"><label class="field">Nome<input id="teamName" value="${esc(t.name)}"></label><label class="field">Formação<select id="formation">${Object.keys(FORMATIONS).map(f=>`<option value="${f}" ${f===t.formation?'selected':''}>${f}</option>`).join('')}</select></label></div>${tacticalPitchMarkup(key)}<div class="action-row" style="margin-top:10px"><button id="autoFill" class="btn btn-primary">⚡ Preencher automático</button><button id="clearTeam" class="btn btn-ghost">Limpar</button></div></div><div class="builder-sidebar"><div class="panel card"><div class="section-tabs"><button class="tab-btn ${state.ui.builderTab==='titulares'?'active':''}" data-builder-tab="titulares">Titulares ${counts.starters}/11</button><button class="tab-btn ${state.ui.builderTab==='banco'?'active':''}" data-builder-tab="banco">Banco ${counts.bench}/7</button><button class="tab-btn ${state.ui.builderTab==='tecnico'?'active':''}" data-builder-tab="tecnico">Técnico ${coach?'✓':'—'}</button><button class="tab-btn ${state.ui.builderTab==='penaltis'?'active':''}" data-builder-tab="penaltis">Pênaltis ${counts.pens}/5</button></div></div><div class="panel card">${pickerMarkup(key)}</div><div class="validation ${errors.length?'error':'ok'}">${errors.length?`<strong>Falta concluir:</strong><ul>${errors.slice(0,6).map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:'✓ Time pronto para avançar.'}</div></div></div><div class="split-actions"><button id="builderBack" class="btn btn-ghost">← Voltar</button><button id="builderNext" class="btn btn-primary" ${errors.length?'disabled':''}>${state.mode==='cpu'&&key==='A'?'Gerar adversário e continuar →':'Continuar →'}</button></div></section>`;
    bindBuilder(key);
  }

  function bindBuilder(key){
    const t=state.teams[key];
    $('#teamName').oninput=e=>{t.name=e.target.value;};
    $('#formation').onchange=e=>{t.formation=e.target.value;Squad.sanitizeFormationPlayers(t);state.ui.selectedSlot=0;renderBuilder($('#app'),key);};
    $$('.slot').forEach(btn=>btn.onclick=()=>{state.ui.builderTab='titulares';state.ui.selectedSlot=Number(btn.dataset.slot);state.ui.playerSearch='';renderBuilder($('#app'),key);});
    $$('[data-builder-tab]').forEach(btn=>btn.onclick=()=>{state.ui.builderTab=btn.dataset.builderTab;state.ui.selectedSlot=0;state.ui.playerSearch='';renderBuilder($('#app'),key);});
    $$('[data-bench-slot]').forEach(btn=>btn.onclick=()=>{state.ui.selectedSlot=Number(btn.dataset.benchSlot);state.ui.playerSearch='';renderBuilder($('#app'),key);});
    if($('#playerSearch'))$('#playerSearch').oninput=e=>{state.ui.playerSearch=e.target.value;renderBuilder($('#app'),key);const input=$('#playerSearch');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}};
    if($('#playerSort'))$('#playerSort').onchange=e=>{state.ui.playerSort=e.target.value;renderBuilder($('#app'),key);};
    $$('.player-card[data-player]').forEach(btn=>btn.onclick=()=>{
      const id=btn.dataset.player;
      if(state.ui.builderTab==='titulares'){
        Squad.setStarter(key,state.ui.selectedSlot,id);
      }else{
        const current=state.ui.selectedSlot;
        Squad.setBench(key,current,id);
        const emptyAfter=t.bench.findIndex((value,i)=>i>current&&!value);
        const emptyBefore=t.bench.findIndex((value,i)=>i<current&&!value);
        const nextEmpty=emptyAfter>=0?emptyAfter:emptyBefore;
        if(nextEmpty>=0)state.ui.selectedSlot=nextEmpty;
      }
      state.ui.playerSearch='';renderBuilder($('#app'),key);
    });
    $$('.coach-choice').forEach(btn=>btn.onclick=()=>{if(btn.disabled)return;const other=state.teams[key==='A'?'B':'A'];if(btn.dataset.coach&&String(other.coach)===String(btn.dataset.coach)){showToast('Esse técnico já está no outro time.','error');return;}t.coach=btn.dataset.coach;renderBuilder($('#app'),key);});
    $$('[data-pen-slot]').forEach(sel=>sel.onchange=e=>{Squad.setPenalty(key,Number(sel.dataset.penSlot),e.target.value);renderBuilder($('#app'),key);});
    if($('#randomPens'))$('#randomPens').onclick=()=>{if(!Squad.randomizePenalties(key))showToast('Escolha pelo menos 5 titulares primeiro.','error');renderBuilder($('#app'),key);};
    $('#autoFill').onclick=()=>{Squad.autoFill(key);showToast('Escalação preenchida pela seed.','success');renderBuilder($('#app'),key);};
    $('#clearTeam').onclick=async()=>{if(await confirmAction('Limpar o time?','Titulares, banco, técnico e pênaltis serão removidos.')){Squad.clearTeam(key);renderBuilder($('#app'),key);}};
    $('#builderBack').onclick=()=>{state.ui.playerSearch='';if(key==='A')store.transition(S.MODE);else store.transition(S.BUILD_P1);};
    $('#builderNext').onclick=()=>{
      const errors=Prime.Validation.validateBuilderTeam(state,key);if(errors.length){showToast(errors[0],'error');return;}
      if(key==='A'&&state.mode==='local'){state.ui.builderTab='titulares';state.ui.selectedSlot=0;store.transition(S.BUILD_P2);}
      else if(key==='A'&&state.mode==='cpu'){Prime.Cpu.buildCpuTeam(state);const full=Prime.Validation.validateFullState(state);if(full.length){showToast(full[0],'error','CPU inválida');return;}store.transition(S.PRE_GAME);}
      else{const full=Prime.Validation.validateFullState(state);if(full.length){showToast(full[0],'error');return;}store.transition(S.PRE_GAME);}
    };
  }

  function lineupMarkup(key){
    const t=state.teams[key],positions=FORMATIONS[t.formation];
    return `<article class="panel summary-team ${key==='B'?'team-b':''}"><span class="team-stripe"></span><span class="eyebrow">${key==='A'?'Time A':'Time B'}</span><h3>${esc(t.name)}</h3><p class="muted">${esc(t.formation)} · ${esc(Squad.coachById(t.coach)?.name||'Sem técnico')}</p><div class="lineup-list">${t.starters.map((id,i)=>{const p=Squad.playerById(id);return `<div class="lineup-row"><span class="num">${Squad.shirtNumber(t,id)}</span><strong>${esc(Squad.surname(p?.name||'—'))}</strong><span class="pos">${positions[i]}</span></div>`;}).join('')}</div><p class="small" style="margin:12px 0 0">Banco: ${t.bench.map(id=>esc(Squad.surname(Squad.playerById(id)?.name||'—'))).join(' · ')}</p></article>`;
  }
  function renderPreGame(app){
    const errors=Prime.Validation.validateFullState(state);
    app.innerHTML=`<section class="screen"><div class="screen-head"><div><span class="eyebrow">Passo 4</span><h2>Prontos para entrar em campo?</h2><p class="muted">Revise os times, a seed e a velocidade.</p>${state.settings.challenge?`<span class="challenge-badge">🎯 ${esc(state.settings.challenge.label)}</span>`:''}</div></div><div class="summary-grid">${lineupMarkup('A')}${lineupMarkup('B')}</div><div class="versus">VS</div><div class="panel card"><div class="form-grid"><label class="field">Seed<input id="preSeed" value="${esc(state.settings.seed)}"></label><label class="field">Duração real<select id="realDuration"><option value="90" ${state.settings.realMatchSeconds===90?'selected':''}>90 segundos</option><option value="180" ${state.settings.realMatchSeconds===180?'selected':''}>3 minutos</option><option value="300" ${state.settings.realMatchSeconds===300?'selected':''}>5 minutos</option></select></label></div><div class="action-row" style="margin-top:12px"><span class="small">Velocidade inicial</span><div class="segmented">${[1,2,4].map(v=>`<button data-pre-speed="${v}" class="${state.settings.speedFactor===v?'active':''}">${v}x</button>`).join('')}</div></div>${errors.length?`<div class="validation error" style="margin-top:12px">${esc(errors[0])}</div>`:''}</div><div class="split-actions"><button id="preBack" class="btn btn-ghost">← Editar escalação</button><button id="playMatch" class="btn btn-primary" ${errors.length?'disabled':''}>▶ PLAY</button></div></section>`;
    $('#preBack').onclick=()=>store.transition(state.mode==='local'?S.BUILD_P2:S.BUILD_P1);
    $('#preSeed').oninput=e=>{state.settings.seed=e.target.value.trim()||'PRIME-001';setHeader();};
    $('#realDuration').onchange=e=>state.settings.realMatchSeconds=Number(e.target.value);
    $$('[data-pre-speed]').forEach(btn=>btn.onclick=()=>{state.settings.speedFactor=Number(btn.dataset.preSpeed);renderPreGame($('#app'));});
    $('#playMatch').onclick=()=>{const errs=Prime.Validation.validateFullState(state);if(errs.length){showToast(errs[0],'error');return;}store.transition(S.MATCH);};
  }

  function eventIcon(type){return ({GOAL:'⚽',SHOT:'🎯',SAVE:'🧤',FOUL:'📯',YELLOW_CARD:'🟨',RED_CARD:'🟥',TACKLE:'🛡️',SUBSTITUTION:'🔁',HALF_TIME:'⏸️',SECOND_HALF:'▶️',FULL_TIME:'🏁',SHOOTOUT:'🥅',PENALTY_KICK:'🥅',PASS:'↗️',DRIBBLE:'✨',CROSS:'➰',CORNER:'🚩',THROW_IN:'↔️',GOAL_KICK:'🥅'})[type]||'•';}
  function renderMatch(app){
    app.innerHTML=`<section class="match-page"><div id="matchError" class="validation error" hidden></div><div class="scoreboard"><div class="score-team"><span class="team-dot"></span><span class="score-team-name" id="scoreNameA">${esc(state.teams.A.name)}</span></div><div class="score-center"><div class="score-value"><span id="scoreA">0</span> – <span id="scoreB">0</span></div><div class="match-clock" id="matchClock">00:00</div><div class="half-label" id="matchHalf">1º tempo</div></div><div class="score-team b"><span class="score-team-name" id="scoreNameB">${esc(state.teams.B.name)}</span><span class="team-dot"></span></div></div><div class="match-grid"><div><div class="stadium-card"><div class="pitch-stage"><canvas id="matchCanvas" class="pitch-canvas"></canvas><div class="camera-controls"><button class="camera-btn ${state.settings.cameraMode==='follow'?'active':''}" data-camera="follow">Jogada</button><button class="camera-btn ${state.settings.cameraMode==='full'?'active':''}" data-camera="full">Campo inteiro</button><button class="camera-btn" id="narrationBtn">📣 Narração</button></div><div id="matchOverlay" class="match-overlay"><div class="overlay-card"></div></div><div id="substitutionCard" class="substitution-card" hidden></div><div id="halfTimePanel" class="half-time-panel" hidden></div><div id="penaltyPanel" class="penalty-panel" hidden></div><aside class="event-feed narration-drawer" id="narrationDrawer" aria-hidden="true"><div class="narration-head"><h3>📣 Narração ao vivo</h3><button class="icon-btn" id="closeNarrationBtn" aria-label="Fechar narração">×</button></div><div class="feed-list" id="feedList"></div></aside></div><div class="match-controls"><button id="pauseBtn" class="btn btn-primary">⏸ Pausar</button><div class="segmented">${[1,2,4].map(v=>`<button data-speed="${v}" class="${state.settings.speedFactor===v?'active':''}">${v}x</button>`).join('')}</div><button id="subBtn" class="btn btn-ghost">🔁 Substituição</button><button id="restartBtn" class="btn btn-ghost">↻ Reiniciar</button></div><div class="stat-strip"><div class="mini-stat"><strong id="possStat">50% – 50%</strong><small>posse</small></div><div class="mini-stat"><strong id="shotStat">0 – 0</strong><small>chutes</small></div><div class="mini-stat"><strong id="targetStat">0 – 0</strong><small>no gol</small></div></div><div class="physics-readout"><span class="pill">Bola <strong id="ballState">dead</strong></span><span class="pill">Fila <strong id="queueState">0</strong></span><span class="pill">Fase <strong id="phaseState">—</strong></span><span class="pill">Seed <strong>${esc(state.settings.seed)}</strong></span></div></div></div></div></section>`;
    bindMatchControls();
    const canvas=$('#matchCanvas');
    const mounted=Prime.Pitch.mount(canvas,state,{cameraMode:state.settings.cameraMode});
    if(!mounted){showMatchError('Não foi possível montar o campo.');return;}
    const started=Prime.MatchEngine.start(state,{onUpdate:updateMatchHud,onEvent:onMatchEvent,onPitchRefresh:()=>Prime.Pitch.refresh(state),onError:showMatchError,onFinish:onMatchFinish,onFrame:updateMatchHud,onHalfTime:showHalfTimePanel,onSubstitution:showSubstitutionCard,onPenaltyRequest:showPenaltyPanel});
    if(!started.ok)showMatchError(started.error);
  }
  function showSubstitutionCard(evt){
    const root=$('#substitutionCard');if(!root||!evt)return;const team=state.teams[evt.team],coach=Squad.coachById(team.coach);
    const out=Squad.playerById(evt.outId),incoming=Squad.playerById(evt.inId);
    root.innerHTML=`<span class="sub-card-title">🔁 Substituição · ${esc(coach?.name||'Comando manual')}</span><div class="sub-card-row"><span class="out">Sai <strong>${esc(out?.name||'Jogador')}</strong></span><span class="arrow">→</span><span class="in">Entra <strong>${esc(incoming?.name||'Jogador')}</strong></span></div><small>${esc(team.name)}</small>`;
    root.hidden=false;root.classList.add('show');clearTimeout(root._timer);root._timer=setTimeout(()=>{root.classList.remove('show');setTimeout(()=>root.hidden=true,250);},2800);
  }
  function showHalfTimePanel(){
    const root=$('#halfTimePanel');if(!root)return;const noCoach=state.mode==='cpu'&&!state.teams.A.coach;
    root.innerHTML=`<div class="half-card"><span class="eyebrow">45:00 · Intervalo</span><h2>Fim do primeiro tempo</h2><p>${noCoach?'Você está sem técnico. Deseja iniciar o 2º tempo sem fazer substituição?':'Os times vão trocar de lado. Você pode mexer no time antes de continuar.'}</p><div class="dialog-actions"><button id="halfSubBtn" class="btn btn-ghost">🔁 Fazer substituição</button><button id="startSecondHalfBtn" class="btn btn-primary">▶ Iniciar 2º tempo</button></div></div>`;
    root.hidden=false;$('#halfSubBtn').onclick=openSubDialog;$('#startSecondHalfBtn').onclick=()=>{const res=Prime.MatchEngine.startSecondHalf(state);if(!res.ok){showToast(res.error,'error');return;}root.hidden=true;showOverlay('2º TEMPO','',900);};
  }
  function showPenaltyPanel(info){
    const root=$('#penaltyPanel');if(!root||!info)return;const shooter=Squad.playerById(info.shooterId),keeper=Squad.playerById(info.goalkeeperId);
    const action=info.humanShooter?`Escolha onde ${esc(shooter?.name||'seu jogador')} vai chutar`:`Escolha para onde ${esc(keeper?.name||'seu goleiro')} vai pular`;
    root.innerHTML=`<div class="penalty-card"><span class="eyebrow">Disputa de pênaltis · ${info.score.A}–${info.score.B}</span><h2>${action}</h2><p class="muted">Clique em uma das nove zonas do gol.</p><div class="penalty-goal">${Array.from({length:9},(_,i)=>`<button type="button" class="penalty-zone" data-pen-zone="${i}" aria-label="Zona ${i+1}"></button>`).join('')}</div></div>`;
    root.hidden=false;$$('[data-pen-zone]',root).forEach(btn=>btn.onclick=()=>{root.hidden=true;Prime.MatchEngine.submitPenaltyChoice(state,Number(btn.dataset.penZone));});
  }

  function showMatchError(message){const box=$('#matchError');if(box){box.hidden=false;box.textContent=message;}showToast(message,'error','Falha na partida');}
  function showOverlay(text,kind,duration){const root=$('#matchOverlay');if(!root)return;root.className=`match-overlay show ${kind||''}`;$('.overlay-card',root).textContent=text;clearTimeout(root._timer);root._timer=setTimeout(()=>{root.className='match-overlay';},duration||1300);}
  function onMatchEvent(evt){
    if(!evt)return;if(evt.type==='OVERLAY'){if(evt.data?.kind==='half')showOverlay('INTERVALO','',1500);return;}
    const list=$('#feedList');if(list&&evt.text){const item=document.createElement('div');item.className=`feed-event ${evt.type==='GOAL'?'goal':evt.type==='RED_CARD'?'danger':''}`;item.innerHTML=`<span class="feed-minute">${evt.minute}'</span><span class="feed-icon">${eventIcon(evt.type)}</span><span>${esc(evt.text.replace(/^\d+'\s—\s/,''))}</span>`;list.prepend(item);while(list.children.length>45)list.lastElementChild.remove();}
    if(evt.type==='GOAL')showOverlay('GOL!','goal',1500);if(evt.type==='HALF_TIME')showOverlay('INTERVALO','',1400);
  }
  function updateMatchHud(){
    const m=state.match;if(!m)return;
    if($('#scoreA'))$('#scoreA').textContent=m.score.A;if($('#scoreB'))$('#scoreB').textContent=m.score.B;
    if($('#matchClock')){const sec=Math.floor(m.gameSeconds||0),min=Math.floor(sec/60),s=sec%60;$('#matchClock').textContent=`${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
    if($('#matchHalf'))$('#matchHalf').textContent=m.waitingHalfTime?'INTERVALO':m.secondHalf?'2º tempo':'1º tempo';
    if($('#phaseState')){const map={BUILDUP:'Construção',PROGRESSION:'Progressão',FINAL_THIRD:'Último terço',TRANSITION:'Transição',KICKOFF:'Reinício'};$('#phaseState').textContent=map[m.attackPhase]||m.attackPhase||'—';}
    const b=Prime.Pitch.getBall();if($('#ballState'))$('#ballState').textContent=b?.state||'—';if($('#queueState'))$('#queueState').textContent=(m.visualQueue?.length||0)+(m.visualBusy?1:0);
    const stats=Prime.MatchEngine.getStats(state);if(stats){if($('#possStat'))$('#possStat').textContent=`${stats.possession.A}% – ${stats.possession.B}%`;if($('#shotStat'))$('#shotStat').textContent=`${stats.shots.A} – ${stats.shots.B}`;if($('#targetStat'))$('#targetStat').textContent=`${stats.onTarget.A} – ${stats.onTarget.B}`;}
    if($('#pauseBtn')){$('#pauseBtn').textContent=m.paused?'▶ Continuar':'⏸ Pausar';$('#pauseBtn').disabled=Boolean(m.waitingHalfTime||m.pendingPenalty);}$$('[data-speed]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.speed)===m.speedFactor));
  }
  function bindMatchControls(){
    $('#pauseBtn').onclick=()=>{Prime.MatchEngine.togglePause(state);updateMatchHud();};
    $$('[data-speed]').forEach(btn=>btn.onclick=()=>{Prime.MatchEngine.setSpeed(state,Number(btn.dataset.speed));updateMatchHud();});
    $$('[data-camera]').forEach(btn=>btn.onclick=()=>{Prime.Pitch.setCameraMode(btn.dataset.camera);$$('[data-camera]').forEach(x=>x.classList.toggle('active',x===btn));});
    const narration=$('#narrationDrawer'), narrationBtn=$('#narrationBtn'), closeNarration=$('#closeNarrationBtn');
    const setNarration=open=>{if(!narration)return;narration.classList.toggle('open',Boolean(open));narration.setAttribute('aria-hidden',open?'false':'true');narrationBtn&&narrationBtn.classList.toggle('active',Boolean(open));};
    if(narrationBtn)narrationBtn.onclick=()=>setNarration(!narration.classList.contains('open'));
    if(closeNarration)closeNarration.onclick=()=>setNarration(false);
    $('#subBtn').onclick=openSubDialog;
    $('#restartBtn').onclick=async()=>{if(await confirmAction('Reiniciar a partida?','A partida atual será descartada e a mesma seed será usada novamente.'))restartMatch();};
  }
  function restartMatch(){Prime.MatchEngine.stop();state.match=null;renderMatch($('#app'));}
  function onMatchFinish(){
    const m=state.match,stats=Prime.MatchEngine.getStats(state),motm=Prime.MatchRules?.manOfTheMatch?.(state)||null;
    state.lastResult={score:{...m.score},shootout:m.shootout,events:m.events.slice(),stats,maxVisualQueue:m.maxVisualQueue,teamSnapshot:m.initialTeams||JSON.parse(JSON.stringify(state.teams)),motm};
    Prime.Persistence?.addHistory?.({a:state.teams.A.name,b:state.teams.B.name,sa:m.score.A,sb:m.score.B,shootout:m.shootout?{A:m.shootout.A,B:m.shootout.B}:null,seed:state.settings.seed,at:new Date().toISOString()});
    Prime.Persistence?.save?.(state);showOverlay('FIM','',900);setTimeout(()=>{if(state.screen===S.MATCH)store.transition(S.END);},850);
  }

  function renderEnd(app){
    const r=state.lastResult||{score:{A:0,B:0},events:[],stats:null},winner=r.shootout?(r.shootout.A>r.shootout.B?'A':'B'):(r.score.A===r.score.B?null:r.score.A>r.score.B?'A':'B');
    const goals=r.events.filter(e=>e.type==='GOAL'),saves=r.events.filter(e=>e.type==='SAVE').length,subs=r.events.filter(e=>e.type==='SUBSTITUTION').length;
    const timeline=r.events.filter(e=>['GOAL','YELLOW_CARD','RED_CARD','SUBSTITUTION'].includes(e.type)).slice(-12).reverse();
    const st=r.stats||{};const stat=(label,obj)=>`<div class="result-stat-row"><span>${label}</span><strong>${obj?.A??0}</strong><em>–</em><strong>${obj?.B??0}</strong></div>`;
    app.innerHTML=`<section class="screen result-page"><div class="panel result-card"><span class="eyebrow">Fim de jogo</span><h2>${winner?`${esc(state.teams[winner].name)} vence`:'Empate'}</h2><div class="result-score"><span class="a">${r.score.A}</span> – <span class="b">${r.score.B}</span></div>${r.shootout?`<p class="muted">Pênaltis: ${r.shootout.A} – ${r.shootout.B}</p>`:''}${state.settings.challenge?`<div class="challenge-result ${(r.score.A-r.score.B)>=state.settings.challenge.margin?'success':'fail'}">${(r.score.A-r.score.B)>=state.settings.challenge.margin?'✓ Desafio concluído':'Desafio não concluído'} · ${esc(state.settings.challenge.label)}</div>`:''}${r.motm?`<div class="motm-card"><span>⭐ Craque do jogo</span><strong>${esc(r.motm.name)}</strong></div>`:''}<div class="result-dashboard"><div class="result-stats panel card"><h3>Estatísticas</h3>${stat('Posse %',st.possession)}${stat('Finalizações',st.shots)}${stat('No gol',st.onTarget)}${stat('Passes',st.passes)}${stat('Escanteios',st.corners)}${stat('Laterais',st.throwIns)}${stat('Faltas',st.fouls)}${stat('Amarelos',st.yellow)}${stat('Vermelhos',st.red)}</div><div class="panel card result-timeline"><h3>Linha do tempo</h3>${timeline.length?timeline.map(e=>`<div><span>${e.minute}'</span><strong>${eventIcon(e.type)}</strong><p>${esc((e.text||'').replace(/^\d+'\s—\s/,''))}</p></div>`).join(''):'<p class="muted">Sem eventos de destaque.</p>'}</div></div><div class="highlight-grid"><div class="highlight"><strong>⚽ Gols</strong>${goals.length?goals.map(g=>esc(Squad.playerById(g.data?.playerId)?.name||'Jogador')).join(' · '):'Nenhum no tempo normal'}</div><div class="highlight"><strong>🧤 Defesas</strong>${saves}</div><div class="highlight"><strong>🔁 Substituições</strong>${subs}</div></div><div class="action-row center" style="margin-top:22px"><button id="rematchBtn" class="btn btn-primary">↻ Revanche</button><button id="newGameBtn" class="btn btn-ghost">Novo jogo</button><button id="shareResultBtn" class="btn btn-gold">Compartilhar resultado</button><button id="endMenuBtn" class="btn btn-ghost">Menu</button></div></div></section>`;
    $('#rematchBtn').onclick=()=>store.prepareRematch();$('#newGameBtn').onclick=()=>{state.screen=S.MODE;state.match=null;state.lastResult=null;store.notify('screen');};const share=$('#shareResultBtn');if(share)share.onclick=async()=>{const text=`Prime Football Simulator: ${state.teams.A.name} ${r.score.A}–${r.score.B} ${state.teams.B.name}${r.shootout?` (pênaltis ${r.shootout.A}–${r.shootout.B})`:''} · Seed ${state.settings.seed}`;try{if(navigator.share)await navigator.share({title:'Prime Football Simulator',text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);showToast('Resultado copiado.','success');}}catch(_){}};$('#endMenuBtn').onclick=()=>store.returnToMenu();
  }

  function openSubDialog(){
    const m=state.match;if(!m||m.finished){showToast('A partida não está ativa.','error');return;}
    subDialogWasPaused=m.paused;if(!m.paused)Prime.MatchEngine.setPaused(state,true);
    const dialog=$('#subDialog'),teamSel=$('#subTeam'),wrap=$('#subTeamWrap');
    const allowed=state.mode==='cpu'?['A']:['A','B'];wrap.hidden=allowed.length===1;teamSel.innerHTML=allowed.map(k=>`<option value="${k}">${esc(state.teams[k].name)}</option>`).join('');teamSel.value=allowed[0];refreshSubOut();dialog.showModal();updateMatchHud();
  }
  function refreshSubOut(){
    const key=$('#subTeam').value,t=state.teams[key],positions=FORMATIONS[t.formation];$('#subOut').innerHTML=t.starters.map((id,i)=>{const p=Squad.playerById(id);return `<option value="${i}">${esc(p?.name||'—')} (${positions[i]})</option>`;}).join('');refreshSubIn();
  }
  function refreshSubIn(){
    const key=$('#subTeam').value,outIndex=Number($('#subOut').value),valid=Squad.validBenchForPosition(key,outIndex);$('#subIn').innerHTML=valid.length?valid.map(x=>`<option value="${x.benchIndex}">${esc(x.player.name)} · ${x.player.positions.join('/')}</option>`).join(''):'<option value="">Nenhum reserva compatível</option>';$('#confirmSubBtn').disabled=!valid.length;
  }
  function closeSubDialog(){const dialog=$('#subDialog');if(dialog.open)dialog.close();if(state.match&&!state.match.finished&&!subDialogWasPaused)Prime.MatchEngine.setPaused(state,false);updateMatchHud();}
  function bindDialog(){
    bindConfirmDialog();const dialog=$('#subDialog');if(!dialog)return;
    $('#subTeam').onchange=refreshSubOut;$('#subOut').onchange=refreshSubIn;$('#closeSubBtn').onclick=closeSubDialog;$('#cancelSubBtn').onclick=closeSubDialog;
    $('#confirmSubBtn').onclick=()=>{const bench=$('#subIn').value;if(bench===''){showToast('Não há reserva compatível.','error');return;}const res=Prime.MatchEngine.manualSub(state,$('#subTeam').value,Number($('#subOut').value),Number(bench));if(!res.ok){showToast(res.error,'error');return;}showToast('Substituição realizada.','success');closeSubDialog();};
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeSubDialog();});
  }

  Prime.UI=Object.freeze({render,renderStepper,updateMatchHud,showToast,confirmAction,bindDialog,restartMatch});
})(window.Prime = window.Prime || {});

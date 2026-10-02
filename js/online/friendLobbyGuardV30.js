(function(Prime){
  'use strict';

  const TURN_SECONDS=30;
  const WAITING_DEADLINE=Number.MAX_SAFE_INTEGER;
  let lastConnected=false;
  let lastReady=false;
  let lastRoom=null;

  function getRoom(){
    return Prime.FriendMatchV29?.getRoom?.()||null;
  }

  function isDraftActive(room){
    return Boolean(room&&!room.complete&&room.turn&&room.phase);
  }

  function setupReady(room){
    return Boolean(room?.v31Setup?.started);
  }

  function gateOpen(room){
    return Boolean(room?.connected?.B&&setupReady(room));
  }

  function freezeDraft(room){
    if(!isDraftActive(room)||gateOpen(room))return;
    room.deadline=WAITING_DEADLINE;
  }

  function resumeWithFreshTurn(room){
    if(!isDraftActive(room)||!gateOpen(room))return;
    if(room.deadline===WAITING_DEADLINE||!Number.isFinite(room.deadline)||room.deadline<=0){
      room.deadline=Date.now()+TURN_SECONDS*1000;
    }
  }

  function updateWaitingUi(room){
    if(!isDraftActive(room)||gateOpen(room))return;

    const timerText=document.getElementById('friendTimerText');
    const timerBar=document.getElementById('friendTimerBar');
    const search=document.getElementById('friendSearch');
    const pickHead=document.querySelector('.friend-pick-head .eyebrow');
    const pickTitle=document.querySelector('.friend-pick-head h3');
    const connected=Boolean(room.connected?.B);

    if(timerText)timerText.textContent=connected?'CONFIGURAÇÃO':'AGUARDANDO';
    if(timerBar)timerBar.style.width='100%';
    if(search)search.disabled=true;
    document.querySelectorAll('.friend-candidate').forEach(button=>{button.disabled=true;});
    if(pickHead)pickHead.textContent=connected?'Configure os times':'Aguardando jogador 2';
    if(pickTitle)pickTitle.textContent=connected?'O draft começa depois que os dois confirmarem nome e formação.':'O draft começa quando seu amigo entrar na sala.';
  }

  function enforceLobbyGate(){
    const room=getRoom();
    if(!room){lastRoom=null;lastConnected=false;lastReady=false;return;}

    const connected=Boolean(room.connected?.B);
    const ready=gateOpen(room);
    if(room!==lastRoom){
      lastRoom=room;
      lastConnected=connected;
      lastReady=ready;
    }

    if(!ready){
      freezeDraft(room);
      updateWaitingUi(room);
    }else if(!lastReady){
      room.deadline=Date.now()+TURN_SECONDS*1000;
      Prime.UI?.showToast?.('Os dois times estão configurados. O cronômetro do draft começou.','success','Jogo online');
    }else{
      resumeWithFreshTurn(room);
    }

    lastConnected=connected;
    lastReady=ready;
  }

  document.addEventListener('click',event=>{
    const candidate=event.target.closest?.('.friend-candidate');
    if(!candidate)return;
    const room=getRoom();
    if(!room||gateOpen(room))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const msg=room.connected?.B?'Confirme a configuração dos dois times antes de começar o draft.':'Espere o segundo jogador entrar para começar o draft.';
    Prime.UI?.showToast?.(msg,'error','Jogo online');
  },true);

  const observer=new MutationObserver(enforceLobbyGate);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(enforceLobbyGate,50);
  enforceLobbyGate();

  Prime.FriendLobbyGuardV30=Object.freeze({enabled:true,enforce:enforceLobbyGate});
})(window.Prime=window.Prime||{});

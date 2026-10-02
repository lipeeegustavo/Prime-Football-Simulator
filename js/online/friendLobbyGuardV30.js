(function(Prime){
  'use strict';

  const TURN_SECONDS=30;
  const WAITING_DEADLINE=Number.MAX_SAFE_INTEGER;
  let lastConnected=false;
  let lastRoom=null;

  function getRoom(){
    return Prime.FriendMatchV29?.getRoom?.()||null;
  }

  function isDraftActive(room){
    return Boolean(room&&!room.complete&&room.turn&&room.phase);
  }

  function freezeUntilGuest(room){
    if(!isDraftActive(room)||room.connected?.B)return;
    room.deadline=WAITING_DEADLINE;
  }

  function resumeWithFreshTurn(room){
    if(!isDraftActive(room)||!room.connected?.B)return;
    if(room.deadline===WAITING_DEADLINE||!Number.isFinite(room.deadline)||room.deadline<=0){
      room.deadline=Date.now()+TURN_SECONDS*1000;
    }
  }

  function updateWaitingUi(room){
    if(!isDraftActive(room)||room.connected?.B)return;

    const timerText=document.getElementById('friendTimerText');
    const timerBar=document.getElementById('friendTimerBar');
    const search=document.getElementById('friendSearch');
    const pickHead=document.querySelector('.friend-pick-head .eyebrow');
    const pickTitle=document.querySelector('.friend-pick-head h3');

    if(timerText)timerText.textContent='AGUARDANDO';
    if(timerBar)timerBar.style.width='100%';
    if(search)search.disabled=true;
    document.querySelectorAll('.friend-candidate').forEach(button=>{button.disabled=true;});
    if(pickHead)pickHead.textContent='Aguardando jogador 2';
    if(pickTitle)pickTitle.textContent='O draft começa quando seu amigo entrar na sala.';
  }

  function enforceLobbyGate(){
    const room=getRoom();
    if(!room){lastRoom=null;lastConnected=false;return;}

    const connected=Boolean(room.connected?.B);
    if(room!==lastRoom){
      lastRoom=room;
      lastConnected=connected;
    }

    if(!connected){
      freezeUntilGuest(room);
      updateWaitingUi(room);
    }else if(!lastConnected){
      resumeWithFreshTurn(room);
      Prime.UI?.showToast?.('Amigo conectado. O cronômetro começou agora.','success','Jogo online');
    }else{
      resumeWithFreshTurn(room);
    }

    lastConnected=connected;
  }

  document.addEventListener('click',event=>{
    const candidate=event.target.closest?.('.friend-candidate');
    if(!candidate)return;
    const room=getRoom();
    if(!room||room.connected?.B)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    Prime.UI?.showToast?.('Espere o segundo jogador entrar para começar o draft.','error','Aguardando amigo');
  },true);

  const observer=new MutationObserver(enforceLobbyGate);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setInterval(enforceLobbyGate,50);
  enforceLobbyGate();

  Prime.FriendLobbyGuardV30=Object.freeze({enabled:true,enforce:enforceLobbyGate});
})(window.Prime=window.Prime||{});

(function(Prime){
  'use strict';
  const esc=v=>String(v??'');
  function result(){return Prime.Store?.state?.lastResult||null;}
  function state(){return Prime.Store?.state||null;}
  function gameLink(){return location.protocol==='file:'?'https://pied-phi.vercel.app/':`${location.origin}${location.pathname}`;}
  function canvas(){
    const st=state(),r=result();if(!st||!r)return null;
    const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');
    const bg=x.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,'#06140c');bg.addColorStop(1,'#102b1b');x.fillStyle=bg;x.fillRect(0,0,1080,1350);
    x.fillStyle='#a8f42f';x.fillRect(70,70,96,96);x.fillStyle='#07140d';x.font='900 58px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('P',118,118);
    x.textAlign='left';x.fillStyle='#fff';x.font='800 42px Arial';x.fillText('Prime Football',190,105);x.fillStyle='#9db5a5';x.font='700 24px Arial';x.fillText('SIMULATOR',190,145);
    x.fillStyle='#a8f42f';x.font='800 24px Arial';x.fillText('RESULTADO FINAL',70,250);
    x.fillStyle='#fff';x.font='800 44px Arial';x.textAlign='center';x.fillText(esc(st.teams.A.name),270,390);x.fillText(esc(st.teams.B.name),810,390);
    x.font='900 170px Arial';x.fillStyle='#3985ff';x.fillText(String(r.score?.A??0),405,540);x.fillStyle='#fff';x.fillText('–',540,540);x.fillStyle='#ff6b2d';x.fillText(String(r.score?.B??0),675,540);
    if(r.shootout){x.fillStyle='#b7c9bd';x.font='700 28px Arial';x.fillText(`Pênaltis ${r.shootout.A} – ${r.shootout.B}`,540,655);}
    if(r.motm){x.fillStyle='#ffc83d';x.font='800 25px Arial';x.fillText('⭐ CRAQUE DO JOGO',540,735);x.fillStyle='#fff';x.font='800 38px Arial';x.fillText(esc(r.motm.name),540,785);}
    const stt=r.stats||{},rows=[['Posse',`${stt.possession?.A??0}%`,`${stt.possession?.B??0}%`],['Finalizações',stt.shots?.A??0,stt.shots?.B??0],['No gol',stt.onTarget?.A??0,stt.onTarget?.B??0],['Escanteios',stt.corners?.A??0,stt.corners?.B??0],['Amarelos',stt.yellow?.A??0,stt.yellow?.B??0],['Vermelhos',stt.red?.A??0,stt.red?.B??0]];
    x.textAlign='left';let y=885;rows.forEach((row,i)=>{x.fillStyle=i%2?'#10261a':'#0b1f15';x.fillRect(150,y-34,780,60);x.fillStyle='#9fb8a8';x.font='700 22px Arial';x.fillText(row[0],190,y);x.fillStyle='#fff';x.font='800 24px Arial';x.textAlign='center';x.fillText(String(row[1]),500,y);x.fillText(String(row[2]),720,y);x.textAlign='left';y+=66;});
    const friend=st.settings?.friendSeries;if(friend){x.fillStyle='#a8f42f';x.font='800 22px Arial';x.textAlign='center';const label=Prime.FriendMatchV29?.formatLabel?.(friend.format)||friend.format;x.fillText(`${label} · Jogo ${friend.game}`,540,1280);}
    x.fillStyle='#7e9a88';x.font='600 20px Arial';x.textAlign='center';x.fillText('pied-phi.vercel.app',540,1320);
    return c;
  }
  function toBlob(c){return new Promise(resolve=>c.toBlob(resolve,'image/png',.96));}
  async function saveImage(){
    const c=canvas();if(!c)return;const blob=await toBlob(c);if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`prime-football-${Date.now()}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);Prime.UI?.showToast?.('Imagem salva.','success','Resultado');
  }
  async function shareImage(){
    const c=canvas(),st=state(),r=result();if(!c||!st||!r)return;const blob=await toBlob(c);if(!blob)return;const file=new File([blob],'prime-football-resultado.png',{type:'image/png'});const url=gameLink();const text=`${st.teams.A.name} ${r.score.A}–${r.score.B} ${st.teams.B.name}`;
    try{
      if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({title:'Prime Football Simulator',text,files:[file],url});return;}
      await saveImage();if(navigator.clipboard){await navigator.clipboard.writeText(url);Prime.UI?.showToast?.('Imagem salva e link do jogo copiado.','success','Compartilhar');}
    }catch(e){if(e?.name!=='AbortError')Prime.UI?.showToast?.('Não foi possível abrir o compartilhamento.','error','Resultado');}
  }
  function bind(){
    const share=document.getElementById('shareResultBtn');if(!share)return;if(share.dataset.imageShare==='1')return;share.dataset.imageShare='1';share.textContent='Compartilhar imagem';share.onclick=shareImage;
    const save=document.createElement('button');save.id='saveResultImageBtn';save.className='btn btn-ghost';save.textContent='Salvar imagem';save.onclick=saveImage;share.insertAdjacentElement('afterend',save);
  }
  const mo=new MutationObserver(bind);document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>{mo.observe(document.documentElement,{childList:true,subtree:true});bind();}):(mo.observe(document.documentElement,{childList:true,subtree:true}),bind());
  Prime.ShareResultV29=Object.freeze({canvas,saveImage,shareImage});
})(window.Prime=window.Prime||{});

(function (Prime) {
  const EXTRA = [
    ['Kevin Viveros','ATA',['CA'],91,'power_finisher'],
    ['Giorgian de Arrascaeta','MEI',['MEI','MC'],94,'creator'],
    ['Pedro','ATA',['CA'],93,'box_finisher'],
    ['Raphinha','ATA',['PD','PE'],95,'winger'],
    ['Rodrygo','ATA',['PD','PE','SA'],94,'creator_dribbler'],
    ['Bruno Guimaraes','MEI',['MC','VOL'],94,'box_to_box'],
    ['Lucas Paqueta','MEI',['MC','MEI'],92,'creator'],
    ['Gabriel Magalhaes','DEF',['ZAG'],93,'physical_defender'],
    ['Marquinhos','DEF',['ZAG'],93,'positioning_defender'],
    ['Ederson','GOL',['GOL'],94,'sweeper_keeper'],
    ['Bento','GOL',['GOL'],91,'shot_stopper'],
    ['Estevao','ATA',['PD','MEI'],92,'creator_dribbler'],
    ['Endrick','ATA',['CA','SA'],91,'power_finisher'],
    ['Savinho','ATA',['PD','PE'],92,'winger'],
    ['Lautaro Martinez','ATA',['CA','SA'],95,'box_finisher'],
    ['Julian Alvarez','ATA',['CA','SA','MEI'],94,'runner_finisher'],
    ['Federico Valverde','MEI',['MC','VOL','PD'],95,'box_to_box'],
    ['Jamal Musiala','MEI',['MEI','PE'],95,'creator_dribbler'],
    ['Florian Wirtz','MEI',['MEI','MC'],95,'creator'],
    ['Lamine Yamal','ATA',['PD','MEI'],96,'creator_dribbler']
  ];

  function clamp(v,min,max){return Math.max(min,Math.min(max,Math.round(v)));}
  function attrs(overall,group,positions,style){
    const a={pace:overall-3,passing:overall-4,vision:overall-4,dribbling:overall-3,finishing:overall-5,defending:overall-12,physical:overall-5,positioning:overall-3,heading:overall-7,goalkeeping:group==='GOL'?overall:5};
    if(group==='GOL'){
      Object.assign(a,{pace:overall-22,passing:overall-10,vision:overall-11,dribbling:overall-28,finishing:12,defending:overall-18,physical:overall-4,positioning:overall-1,heading:20,goalkeeping:overall});
    }else if(group==='DEF'){
      a.defending=overall;a.positioning=overall;a.physical=overall-1;a.heading=overall-2;a.finishing=overall-24;
    }else if(group==='MEI'){
      a.passing=overall;a.vision=overall;a.dribbling=overall-1;a.defending=overall-10;a.finishing=overall-8;
      if(positions.includes('VOL')){a.defending+=8;a.physical+=4;a.positioning+=4;}
    }else{
      a.finishing=overall;a.dribbling=overall-1;a.pace=overall-1;a.positioning=overall;a.defending=overall-34;
      if(positions.includes('CA')){a.heading+=6;a.physical+=3;}
    }
    const boosts={
      power_finisher:{finishing:5,physical:7,pace:3,positioning:4},box_finisher:{finishing:7,positioning:7,heading:5,physical:3},
      winger:{pace:5,dribbling:5,passing:2},creator_dribbler:{dribbling:7,vision:6,passing:5,pace:2},creator:{passing:6,vision:7,dribbling:3},
      box_to_box:{physical:4,passing:3,positioning:3,pace:2},physical_defender:{defending:6,physical:7,heading:6},positioning_defender:{defending:7,positioning:8},
      sweeper_keeper:{goalkeeping:4,passing:8,vision:5,pace:5,positioning:5},shot_stopper:{goalkeeping:7,positioning:5},runner_finisher:{pace:7,finishing:5,positioning:4}
    };
    const b=boosts[style]||{};Object.keys(b).forEach(k=>a[k]=(a[k]||0)+b[k]);
    Object.keys(a).forEach(k=>a[k]=clamp(a[k],k==='goalkeeping'&&group!=='GOL'?1:25,99));
    return a;
  }

  const base=Array.isArray(Prime.PLAYERS)?Prime.PLAYERS:[];
  let nextId=base.reduce((m,p)=>Math.max(m,Number(p.id)||0),0)+1;
  const existing=new Set(base.map(p=>String(p.name).toLowerCase()));
  for(const [name,group,positions,overall,style] of EXTRA){
    if(existing.has(name.toLowerCase()))continue;
    base.push(Object.freeze({id:nextId++,name,group,positions:Object.freeze(positions.slice()),overall,profileStyle:style,attributes:Object.freeze(attrs(overall,group,positions,style))}));
  }
})(window.Prime=window.Prime||{});

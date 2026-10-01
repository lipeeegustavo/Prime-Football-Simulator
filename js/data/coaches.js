(function (Prime) {
  Prime.COACHES = Object.freeze([
    {id:1,name:'Pep Guardiola',style:'Posse e pressão',attack:9,defense:8,subs:8,tactics:{lineHeight:82,pressing:92,tempo:66,width:72,passRisk:58,transitionSpeed:68}},
    {id:2,name:'Carlo Ancelotti',style:'Equilíbrio e adaptação',attack:8,defense:8,subs:9,tactics:{lineHeight:58,pressing:62,tempo:63,width:65,passRisk:61,transitionSpeed:68}},
    {id:3,name:'Jose Mourinho',style:'Defesa e transição',attack:7,defense:10,subs:9,tactics:{lineHeight:36,pressing:48,tempo:55,width:57,passRisk:45,transitionSpeed:88}},
    {id:4,name:'Sir Alex Ferguson',style:'Intensidade e viradas',attack:9,defense:8,subs:9,tactics:{lineHeight:67,pressing:76,tempo:86,width:82,passRisk:69,transitionSpeed:85}},
    {id:5,name:'Johan Cruyff',style:'Futebol total',attack:10,defense:7,subs:7,tactics:{lineHeight:84,pressing:88,tempo:75,width:78,passRisk:72,transitionSpeed:77}},
    {id:6,name:'Arrigo Sacchi',style:'Pressão e linha alta',attack:8,defense:9,subs:8,tactics:{lineHeight:88,pressing:94,tempo:78,width:55,passRisk:54,transitionSpeed:79}},
    {id:7,name:'Vicente del Bosque',style:'Controle e equilíbrio',attack:8,defense:8,subs:8,tactics:{lineHeight:61,pressing:65,tempo:60,width:64,passRisk:55,transitionSpeed:62}},
    {id:8,name:'Zinedine Zidane',style:'Liberdade aos craques',attack:9,defense:7,subs:8,tactics:{lineHeight:62,pressing:60,tempo:70,width:73,passRisk:74,transitionSpeed:76}},
    {id:9,name:'Marcelo Bielsa',style:'Pressão total',attack:9,defense:6,subs:7,tactics:{lineHeight:90,pressing:98,tempo:92,width:74,passRisk:76,transitionSpeed:92}},
    {id:10,name:'Rinus Michels',style:'Futebol total clássico',attack:9,defense:8,subs:8,tactics:{lineHeight:86,pressing:90,tempo:80,width:76,passRisk:67,transitionSpeed:82}},

    {id:11,name:'Abel Ferreira',style:'Competitividade e transição',attack:8,defense:9,subs:9,tactics:{lineHeight:60,pressing:76,tempo:72,width:64,passRisk:56,transitionSpeed:88}},
    {id:12,name:'Filipe Luis',style:'Posse agressiva e pressão',attack:9,defense:8,subs:8,tactics:{lineHeight:78,pressing:88,tempo:76,width:70,passRisk:66,transitionSpeed:82}},
    {id:13,name:'Tite',style:'Organização e controle',attack:8,defense:9,subs:8,tactics:{lineHeight:58,pressing:72,tempo:62,width:62,passRisk:52,transitionSpeed:72}},
    {id:14,name:'Tele Santana',style:'Jogo técnico e ofensivo',attack:10,defense:7,subs:8,tactics:{lineHeight:72,pressing:70,tempo:78,width:82,passRisk:74,transitionSpeed:80}},
    {id:15,name:'Luiz Felipe Scolari',style:'Força, defesa e decisão',attack:8,defense:9,subs:9,tactics:{lineHeight:45,pressing:66,tempo:68,width:60,passRisk:48,transitionSpeed:86}},
    {id:16,name:'Zagallo',style:'Equilíbrio brasileiro',attack:9,defense:8,subs:8,tactics:{lineHeight:64,pressing:70,tempo:72,width:76,passRisk:62,transitionSpeed:76}},
    {id:17,name:'Carlos Alberto Parreira',style:'Controle e disciplina tática',attack:7,defense:9,subs:8,tactics:{lineHeight:52,pressing:60,tempo:56,width:60,passRisk:44,transitionSpeed:64}},
    {id:18,name:'Dorival Junior',style:'Equilíbrio e jogo vertical',attack:8,defense:8,subs:9,tactics:{lineHeight:61,pressing:69,tempo:72,width:68,passRisk:58,transitionSpeed:80}},
    {id:19,name:'Renato Gaucho',style:'Liberdade e ataque direto',attack:9,defense:6,subs:8,tactics:{lineHeight:60,pressing:58,tempo:82,width:78,passRisk:72,transitionSpeed:88}},
    {id:20,name:'Muricy Ramalho',style:'Compactação e bola forte',attack:7,defense:9,subs:8,tactics:{lineHeight:50,pressing:68,tempo:64,width:58,passRisk:46,transitionSpeed:76}}
  ].map(c => Object.freeze({...c,tactics:Object.freeze(c.tactics)})));
})(window.Prime = window.Prime || {});

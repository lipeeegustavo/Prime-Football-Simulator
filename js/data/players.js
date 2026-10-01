(function (Prime) {
  const RAW_PLAYERS = [
    ['Lev Yashin','GOL',['GOL'],98],
    ['Gianluigi Buffon','GOL',['GOL'],97],
    ['Manuel Neuer','GOL',['GOL'],97],
    ['Iker Casillas','GOL',['GOL'],96],
    ['Peter Schmeichel','GOL',['GOL'],95],
    ['Petr Cech','GOL',['GOL'],95],
    ['Edwin van der Sar','GOL',['GOL'],94],
    ['Alisson','GOL',['GOL'],94],
    ['Thibaut Courtois','GOL',['GOL'],94],
    ['Oliver Kahn','GOL',['GOL'],96],
    ['Paolo Maldini','DEF',['ZAG','LE'],98],
    ['Franz Beckenbauer','DEF',['ZAG','VOL'],98],
    ['Franco Baresi','DEF',['ZAG'],97],
    ['Sergio Ramos','DEF',['ZAG','LD'],96],
    ['Alessandro Nesta','DEF',['ZAG'],96],
    ['Fabio Cannavaro','DEF',['ZAG'],95],
    ['Carles Puyol','DEF',['ZAG'],95],
    ['Rio Ferdinand','DEF',['ZAG'],94],
    ['Nemanja Vidic','DEF',['ZAG'],94],
    ['Virgil van Dijk','DEF',['ZAG'],96],
    ['Roberto Carlos','DEF',['LE','ALA'],96],
    ['Cafu','DEF',['LD','ALA'],96],
    ['Marcelo','DEF',['LE','ALA'],95],
    ['Dani Alves','DEF',['LD','ALA'],95],
    ['Philipp Lahm','DEF',['LD','LE','VOL','ALA'],96],
    ['Javier Zanetti','DEF',['LD','LE','VOL','ALA'],95],
    ['Ashley Cole','DEF',['LE','ALA'],93],
    ['Lilian Thuram','DEF',['ZAG','LD'],95],
    ['Giorgio Chiellini','DEF',['ZAG'],94],
    ['Jaap Stam','DEF',['ZAG'],94],
    ['Zinedine Zidane','MEI',['MC','MEI'],99],
    ['Ronaldinho Gaucho','MEI',['MEI','PE'],99],
    ['Diego Maradona','MEI',['MEI','SA'],99],
    ['Johan Cruyff','MEI',['MEI','SA','CA'],99],
    ['Andres Iniesta','MEI',['MC','MEI'],97],
    ['Xavi','MEI',['MC'],97],
    ['Luka Modric','MEI',['MC'],96],
    ['Andrea Pirlo','MEI',['MC','VOL'],95],
    ['Kaka','MEI',['MEI','MC'],96],
    ['Michel Platini','MEI',['MEI','MC'],97],
    ['Zico','MEI',['MC','MEI'],98],
    ['Socrates','MEI',['MC','MEI'],95],
    ['Kevin De Bruyne','MEI',['MC','MEI'],96],
    ['Toni Kroos','MEI',['MC'],96],
    ['Steven Gerrard','MEI',['MC','VOL'],95],
    ['Frank Lampard','MEI',['MC','MEI'],94],
    ['Paul Scholes','MEI',['MC'],94],
    ['Clarence Seedorf','MEI',['MC','VOL'],94],
    ['Patrick Vieira','MEI',['VOL','MC'],95],
    ['Claude Makelele','MEI',['VOL'],94],
    ['Sergio Busquets','MEI',['VOL'],95],
    ['Casemiro','MEI',['VOL'],94],
    ['Lothar Matthaus','MEI',['MC','VOL'],98],
    ['Ruud Gullit','MEI',['MEI','MC','SA'],97],
    ['Pavel Nedved','MEI',['MC','PE','ALA'],94],
    ['Michael Ballack','MEI',['MC','MEI'],94],
    ['David Beckham','MEI',['MC','PD','ALA'],94],
    ['Luis Figo','MEI',['PD','MEI','ALA'],96],
    ['Rivaldo','MEI',['MEI','PE'],96],
    ['Juan Roman Riquelme','MEI',['MEI'],95],
    ['Pele','ATA',['CA','SA','MEI'],100],
    ['Lionel Messi','ATA',['PD','MEI','SA'],100],
    ['Cristiano Ronaldo','ATA',['PE','CA'],99],
    ['Ronaldo Fenomeno','ATA',['CA'],99],
    ['Neymar','ATA',['PE','MEI'],97],
    ['Thierry Henry','ATA',['PE','CA'],97],
    ['Marco van Basten','ATA',['CA'],98],
    ['Romario','ATA',['CA'],98],
    ['George Best','ATA',['PD','PE','ALA'],97],
    ['Eusebio','ATA',['CA'],98],
    ['Alfredo Di Stefano','ATA',['CA','SA','MEI'],99],
    ['Ferenc Puskas','ATA',['CA','SA','MEI'],98],
    ['Garrincha','ATA',['PD'],98],
    ['Gerd Muller','ATA',['CA'],98],
    ['Luis Suarez','ATA',['CA'],96],
    ['Robert Lewandowski','ATA',['CA'],96],
    ['Karim Benzema','ATA',['CA','SA'],96],
    ['Zlatan Ibrahimovic','ATA',['CA'],95],
    ['Samuel Etoo','ATA',['CA'],95],
    ['Didier Drogba','ATA',['CA'],95],
    ['Wayne Rooney','ATA',['CA','SA','MEI'],95],
    ['Dennis Bergkamp','ATA',['SA','CA','MEI'],96],
    ['Eric Cantona','ATA',['SA','CA'],94],
    ['Kenny Dalglish','ATA',['CA','SA'],95],
    ['George Weah','ATA',['CA'],95],
    ['Andriy Shevchenko','ATA',['CA'],95],
    ['Gabriel Batistuta','ATA',['CA'],95],
    ['Raul','ATA',['CA','SA'],94],
    ['Alessandro Del Piero','ATA',['SA','PE'],95],
    ['Francesco Totti','ATA',['MEI','SA'],96],
    ['Arjen Robben','ATA',['PD','ALA'],96],
    ['Franck Ribery','ATA',['PE','ALA'],95],
    ['Mohamed Salah','ATA',['PD'],96],
    ['Kylian Mbappe','ATA',['PE','CA'],97],
    ['Erling Haaland','ATA',['CA'],96],
    ['Vinicius Junior','ATA',['PE'],95],
    ['Antoine Griezmann','ATA',['SA','MEI'],94],
    ['Sadio Mane','ATA',['PE','PD'],94],
    ['Gareth Bale','ATA',['PD','PE','ALA'],95],
    ['Eden Hazard','ATA',['PE','MEI'],95],
    ['Dida','GOL',['GOL'],93],
    ['Julio Cesar','GOL',['GOL'],93],
    ['Jan Oblak','GOL',['GOL'],94],
    ['Marc-Andre ter Stegen','GOL',['GOL'],93],
    ['Keylor Navas','GOL',['GOL'],92],
    ['Emiliano Martinez','GOL',['GOL'],92]
  ];

  const STYLE_OVERRIDES = {
    'Garrincha':'dribbler',
    'Lionel Messi':'creator_dribbler',
    'Cristiano Ronaldo':'box_finisher',
    'Ronaldo Fenomeno':'power_dribbler',
    'Neymar':'creator_dribbler',
    'Ronaldinho Gaucho':'creator_dribbler',
    'Diego Maradona':'creator_dribbler',
    'Toni Kroos':'deep_playmaker',
    'Xavi':'deep_playmaker',
    'Andrea Pirlo':'deep_playmaker',
    'Kevin De Bruyne':'creator',
    'Zinedine Zidane':'creator',
    'Paolo Maldini':'positioning_defender',
    'Franco Baresi':'positioning_defender',
    'Alessandro Nesta':'positioning_defender',
    'Virgil van Dijk':'physical_defender',
    'Sergio Ramos':'aggressive_defender',
    'Roberto Carlos':'attacking_fullback',
    'Cafu':'attacking_fullback',
    'Marcelo':'attacking_fullback',
    'Philipp Lahm':'inverted_fullback',
    'Manuel Neuer':'sweeper_keeper',
    'Lev Yashin':'shot_stopper',
    'Gianluigi Buffon':'shot_stopper',
    'Iker Casillas':'shot_stopper',
    'Ronaldo Fenomeno':'power_dribbler',
    'Romario':'poacher',
    'Gerd Muller':'poacher',
    'Erling Haaland':'box_finisher',
    'Thierry Henry':'runner_finisher',
    'Kylian Mbappe':'runner_finisher',
    'Patrick Vieira':'ball_winner',
    'Claude Makelele':'ball_winner',
    'Casemiro':'ball_winner',
    'Sergio Busquets':'holding_playmaker'
  };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, Math.round(v))); }

  function inferStyle(name, group, positions) {
    if (STYLE_OVERRIDES[name]) return STYLE_OVERRIDES[name];
    if (group === 'GOL') return 'shot_stopper';
    if (positions.includes('ZAG')) return 'positioning_defender';
    if (positions.includes('LD') || positions.includes('LE') || positions.includes('ALA')) return 'fullback';
    if (positions.includes('VOL')) return 'holding_midfielder';
    if (positions.includes('MC')) return 'box_to_box';
    if (positions.includes('MEI')) return 'creator';
    if (positions.includes('PD') || positions.includes('PE')) return 'winger';
    if (positions.includes('CA')) return 'finisher';
    return 'balanced';
  }

  function deriveAttributes(overall, group, positions, style) {
    const a = {
      pace: overall - 4, passing: overall - 4, vision: overall - 4, dribbling: overall - 4,
      finishing: overall - 5, defending: overall - 10, physical: overall - 4, positioning: overall - 3,
      heading: overall - 6, goalkeeping: group === 'GOL' ? overall : 5
    };

    if (group === 'GOL') {
      a.pace = overall - 22; a.passing = overall - 14; a.vision = overall - 12; a.dribbling = overall - 28;
      a.finishing = 12; a.defending = overall - 18; a.physical = overall - 5; a.positioning = overall - 2; a.heading = 20;
    } else if (group === 'DEF') {
      a.defending = overall; a.positioning = overall; a.physical = overall - 1; a.heading = overall - 2; a.finishing = overall - 24;
      if (positions.some(p => ['LD','LE','ALA'].includes(p))) { a.pace += 5; a.passing += 3; a.dribbling += 2; a.finishing += 5; }
    } else if (group === 'MEI') {
      a.passing = overall; a.vision = overall; a.dribbling = overall - 1; a.defending = overall - 10; a.finishing = overall - 8;
      if (positions.includes('VOL')) { a.defending += 10; a.physical += 4; a.positioning += 4; a.finishing -= 5; }
    } else if (group === 'ATA') {
      a.finishing = overall; a.dribbling = overall - 1; a.pace = overall - 1; a.positioning = overall; a.defending = overall - 34;
      if (positions.includes('CA')) { a.heading += 7; a.physical += 3; }
    }

    const boosts = {
      dribbler:{pace:5,dribbling:8,passing:1,finishing:1}, creator_dribbler:{dribbling:7,vision:6,passing:5,pace:2},
      box_finisher:{finishing:7,positioning:7,heading:6,physical:4}, power_dribbler:{pace:6,dribbling:6,finishing:6,physical:5},
      deep_playmaker:{passing:8,vision:8,positioning:4,pace:-5}, creator:{passing:6,vision:7,dribbling:3},
      positioning_defender:{defending:7,positioning:8,pace:-1}, physical_defender:{defending:6,physical:7,heading:6}, aggressive_defender:{defending:5,physical:6,heading:5},
      attacking_fullback:{pace:6,passing:5,dribbling:4,finishing:3}, inverted_fullback:{passing:6,vision:5,defending:4,positioning:5},
      sweeper_keeper:{goalkeeping:4,passing:8,vision:5,pace:5,positioning:5}, shot_stopper:{goalkeeping:7,positioning:5},
      poacher:{finishing:7,positioning:8,pace:1,passing:-5}, runner_finisher:{pace:7,finishing:5,positioning:4},
      ball_winner:{defending:7,physical:7,positioning:4,passing:-1}, holding_playmaker:{passing:6,vision:6,defending:5,positioning:6},
      holding_midfielder:{defending:5,physical:4,positioning:4}, box_to_box:{physical:3,passing:2,positioning:2}, fullback:{pace:3,defending:3,passing:2}, winger:{pace:4,dribbling:4}, finisher:{finishing:4,positioning:4,heading:2}
    };
    const b = boosts[style] || {};
    Object.keys(b).forEach(k => { a[k] += b[k]; });
    Object.keys(a).forEach(k => { a[k] = clamp(a[k], k === 'goalkeeping' && group !== 'GOL' ? 1 : 25, 99); });
    if (group === 'GOL') a.goalkeeping = clamp(Math.max(a.goalkeeping, overall), 25, 99);
    return a;
  }

  Prime.PLAYERS = RAW_PLAYERS.map((p, i) => {
    const style = inferStyle(p[0], p[1], p[2]);
    return Object.freeze({
      id: i + 1, name: p[0], group: p[1], positions: Object.freeze(p[2].slice()), overall: p[3],
      profileStyle: style, attributes: Object.freeze(deriveAttributes(p[3], p[1], p[2], style))
    });
  });

  Prime.PLAYER_STYLE_OVERRIDES = Object.freeze(STYLE_OVERRIDES);
})(window.Prime = window.Prime || {});

(function(Prime){
  // A sinalização de cartão amarelo já é desenhada diretamente sobre o
  // marcador do jogador no campo. Este overlay antigo adicionava uma faixa
  // horizontal extra (YC) que poluía a leitura visual, então foi desativado.
  // Mantemos o arquivo carregado para preservar compatibilidade com o index.
  Prime.PlayerStatusOverlayV14=Object.freeze({enabled:false});
})(window.Prime=window.Prime||{});

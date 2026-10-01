# Prime Football Simulator — Sequence View v3

Esta versão transforma a partida em uma leitura tática por etapas:

- jogadores renderizados como marcadores circulares vistos de cima;
- direção do movimento indicada por um pequeno ponteiro no marcador;
- portador com halo dourado e alvo do passe com halo lima;
- seta tracejada mostra a intenção do passe/cruzamento/chute antes da execução;
- os eventos visuais são executados em sequência: uma nova etapa não nasce enquanto a etapa anterior ainda está em animação;
- câmera Jogada continua seguindo a bola e Campo inteiro continua disponível;
- narração virou um card opcional sobre o campo: pode abrir e fechar sem reduzir a área do jogo;
- no celular, a narração abre como uma gaveta inferior;
- o minimapa continua mostrando o campo completo.

A simulação continua determinística pela seed e a animação não decide o resultado.

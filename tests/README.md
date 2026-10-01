# Testes

Execute com Node 18+:

```bash
node tests/simulations.js
```

O script roda 12 partidas determinísticas com canvas/game loop simulados e imprime placar, estatísticas, fila visual e disputa de pênaltis.

Metas de balanceamento da v6 (média, não garantia por partida):
- 20–25 finalizações totais
- 2–5 escanteios
- 10–20 laterais
- 8–15 faltas
- fila visual <= 5
- todas as partidas terminam

A interação real de toque/canvas continua exigindo teste em navegador.

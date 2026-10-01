# Test report

## Simulação completa (Node + VM + stubs de canvas/requestAnimationFrame)

Configuração do teste: Jogador x CPU, CPU equilibrada, velocidade 4x, 45 s de duração real equivalente, times válidos gerados pela seed.

| Seed | Placar | Pênaltis | Chutes | Gols | Eventos | Fila visual máxima | Finalizou |
|---|---:|---:|---:|---:|---:|---:|---|
| SEED-001 | 1–0 | — | 5 | 1 | 81 | 5 | Sim |
| SEED-002 | 1–1 | 2–3 | 5 | 2 | 86 | 5 | Sim |
| SEED-003 | 0–0 | 4–3 | 5 | 0 | 84 | 4 | Sim |

Em todas as três execuções o relógio chegou a 90:00 e `onFinish` foi disparado.

## Regressão do travamento em `receive`

Foi iniciada uma ação PASS e, durante o trajeto, a bola foi forçada artificialmente para `state = dead`, `vx = 0`, `vy = 0`.

Resultado:
- callback executado: sim;
- ação pendente ao final: nenhuma;
- bola voltou para `controlled`;
- receptor virou portador;
- fila não ficou presa.

## Verificações estáticas

- todos os arquivos `.js`: `node --check` OK;
- 18 scripts do `index.html`: todos existem;
- `Math.random`: 0 ocorrências;
- `Date.now`: 0 ocorrências;
- `alert(`: 0 ocorrências;
- `confirm(`: 0 ocorrências.

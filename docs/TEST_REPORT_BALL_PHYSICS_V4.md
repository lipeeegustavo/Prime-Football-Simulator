# Ball Physics v4 — Test Report

## Verificações estáticas

- Todos os arquivos em `js/**/*.js` passaram em `node --check`.
- `Math.random()` na lógica: 0 ocorrências.
- `Date.now()` na lógica: 0 ocorrências.

## Testes isolados de física

Os testes carregaram `js/world/ball.js` em Node + VM, com campo 68×105 m e integração em `dt = 0.01 s`.

### Passe rasteiro

- origem: (10, 50)
- destino: (35, 50)
- velocidade inicial: 17.5 m/s
- loft: 0
- altura máxima: 0 m
- trajetória permaneceu no solo e desacelerou por atrito.

### Cruzamento

- velocidade inicial: 24 m/s
- loft: 0.62
- spin: 7.5
- altura máxima observada: ~2.88 m
- houve queda e quique amortecido, além de desvio lateral por spin.

### Chute com curva

- velocidade inicial: 36.5 m/s
- loft: 0.18
- spin: -5.4
- altura máxima observada: ~1.18 m
- trajetória apresentou desvio lateral e perda gradual de velocidade.

## Regressões preservadas

- A recepção continua com timeout/fallback.
- A fila visual continua limitada.
- A física não altera o resultado definido pelo `matchEngine`.
- O jogo continua abrindo por `file://` com scripts clássicos.

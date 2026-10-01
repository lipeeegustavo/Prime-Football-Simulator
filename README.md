# Prime Football Simulator

Simulador de futebol em HTML/CSS/JavaScript puro, sem build e sem dependências externas. Pode abrir via `file://` e também é compatível com hospedagem estática no Vercel.

## Recursos

- Jogador x Máquina e Jogador x Jogador local
- Desafio “vencer por 3 gols”
- montagem de titulares, banco, técnico e cobradores
- jogadores circulares vistos de cima com direção e intenção de passe
- movimentação coletiva, recomposição, pressão e transição
- física visual da bola com altura, gravidade, quique, curva e atrito
- intervalo manual, troca de lado, faltas, cartões e expulsões
- substituições e cards de técnico
- pênaltis interativos por clique
- câmera da jogada/campo inteiro e minimapa
- estatísticas, craque da partida, linha do tempo e histórico local
- persistência via `localStorage`
- RNG seeded: mesmas condições produzem a mesma lógica de simulação

## Executar

Abra `index.html` diretamente ou sirva a pasta em qualquer servidor estático.

## Testes

```bash
node tests/simulations.js
```

Os testes de Node validam o motor com stubs. Interação visual, touch e Canvas devem ser conferidos no navegador.

## Estrutura

- `js/config/`: balanceamento
- `js/data/`: jogadores, técnicos e formações
- `js/state/`: estado e persistência
- `js/squad/`: montagem/validação
- `js/world/`: bola, geometria e movimentação
- `js/render/`: Canvas
- `js/simulation/`: regras e motor da partida
- `tests/`: testes determinísticos
- `docs/`: changelogs e relatórios históricos

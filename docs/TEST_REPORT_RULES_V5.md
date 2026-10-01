# Test Report — Match Rules v5

Validação realizada em Node + VM com stubs de Canvas/GameLoop.

- Todos os arquivos JS: `node --check` OK.
- Intervalo: trava em 45:00 e exige `startSecondHalf()`.
- Segundo tempo: `secondHalf=true` e o renderer reconstrói os lados invertidos.
- Final da partida: 90:00 e término garantido.
- Pênaltis: fluxo por cobrança testado; 10 cobranças no cenário de empate.
- Numeração: sem repetição dentro do elenco.
- Técnicos: CPU evita o técnico do jogador; validação também impede duplicidade.
- Revanche: `prepareRematch()` preserva os objetos de equipe e não reconstrói a CPU.
- Substituições automáticas: somente em janelas de bola parada/intervalo.

Resultado do cenário de teste:

```json
{
  "started": true,
  "finished": true,
  "halftime": true,
  "secondHalf": true,
  "minute": 90,
  "refreshes": 0,
  "penalties": 10,
  "uniqueNumbers": true,
  "coachDifferent": true,
  "cards": 0,
  "subs": 1,
  "score": {
    "A": 0,
    "B": 0
  },
  "shootout": {
    "A": 3,
    "B": 2
  }
}
```

Observação: a interação visual de clique em zonas de pênalti precisa ser validada também no navegador, pois o teste acima usa stubs mínimos de DOM/Canvas.

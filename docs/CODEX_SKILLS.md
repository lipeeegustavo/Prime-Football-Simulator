# Skills do projeto — Codex

Este projeto usa duas extensoes de workflow para desenvolvimento assistido por IA:

1. **Impeccable** — revisao e melhoria de UX/UI, layout, responsividade, motion, acessibilidade e polimento visual.
2. **Matt Pocock skills: `grilling` + `grill-me`** — entrevista estruturada para pressionar decisoes e remover ambiguidades antes de implementar mudancas grandes.

## Instalacao automatica no Windows

Na raiz do projeto, execute:

```powershell
.\tools\install-codex-skills.ps1
```

Ou execute:

```cmd
tools\install-codex-skills.cmd
```

## Comandos equivalentes

Estes sao os comandos adaptados para **Codex** e para instalacao local apenas neste projeto:

```bash
npx -y impeccable install -y --providers=codex --scope=project
npx -y skills add mattpocock/skills --skill grilling --skill grill-me --agent codex --copy -y
```

O `--copy` foi escolhido para evitar problemas de symlink no Windows e deixar as skills fisicamente dentro do projeto.

## Como usar neste projeto

### Antes de uma mudanca grande de gameplay/animacao

Use `$grill-me` ou `$grilling` para fechar decisoes como:

- camera e leitura da partida;
- ritmo das sequencias;
- quando um passe deve ser animado vs. comprimido;
- comportamento de transicao e recomposicao;
- diferenca visual entre construcao, contra-ataque e defesa;
- regras de controle do usuario vs. simulacao.

### Ao trabalhar na interface

Use `$impeccable` com comandos como:

- `$impeccable critique` — revisar UX/UI existente;
- `$impeccable animate` — revisar motion/microinteracoes;
- `$impeccable adapt` — celular/desktop;
- `$impeccable layout` — hierarquia e espacamento;
- `$impeccable polish` — passe final antes de entregar.

## Observacao

Essas skills sao lidas pelo Codex/agent que abrir este repositorio. Instalar arquivos no projeto nao altera automaticamente um chat ja aberto; recarregue o agent apos a instalacao.

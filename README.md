# Jogo dos Números — Kuromi Edition

Aplicação web de adivinhação de números com temática visual da Kuromi, 3 níveis progressivos de dificuldade e registro persistente de recordes por tentativas em banco de dados PostgreSQL.

## Funcionalidades

- **3 Níveis de Desafio**:
  - Nível 1: Intervalo de 1 a 10
  - Nível 2: Intervalo de 1 a 100
  - Nível 3: Intervalo de 1 a 1000
- **Lógica de Palpites**:
  - Validação no servidor sem exposição do número sorteado no cliente.
  - Indicadores comparativos (maior ou menor) a cada tentativa.
  - Histórico de palpites da rodada.
- **Placar de Recordes**:
  - Persistência das partidas e ranking ordenado pelo menor número de tentativas.
  - Filtros por nível e visão geral.
- **Identidade Visual**:
  - Tema inspirado na personagem Kuromi com expressões dinâmicas da mascote.
  - Interface responsiva com suporte a redução de movimento (`prefers-reduced-motion`).

## Requisitos

- Node.js 18 ou superior
- Instância PostgreSQL (local ou em nuvem)

## Instalação e Execução Local

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente criando um arquivo `.env` com base no `.env.example`:
   ```env
   DATABASE_URL=postgresql://usuario:senha@host/neondb?sslmode=require
   PORT=3000
   ```

3. Inicie a aplicação:
   ```bash
   npm start
   ```

4. Acesse pelo navegador em `http://localhost:3000`.

## Estrutura do Projeto

```text
├── api/
│   └── index.js       # Endpoints e lógica da API (compatível com serverless)
├── public/
│   ├── assets/        # Imagens da mascote
│   ├── favicon.svg    # Ícone da aplicação
│   ├── index.html     # Marcação semântica
│   ├── robots.txt     # Diretivas de rastreamento
│   ├── script.js      # Lógica de interface e interações
│   └── style.css      # Folha de estilos e acessibilidade
├── db.js              # Inicialização do pool PostgreSQL e tabelas
├── package.json       # Metadados e dependências
├── server.js          # Ponto de entrada do servidor HTTP local
└── vercel.json        # Configuração de rotas para deploy
```

## Licença

MIT

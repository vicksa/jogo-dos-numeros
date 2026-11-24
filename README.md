# 🎲 Jogo dos Números

Um jogo web moderno e interativo de adivinhação de números integrado ao banco de dados serverless **Neon PostgreSQL**, registrando e classificando os recordes de quem acertou o número secreto em menos tentativas!

---

## 🚀 Funcionalidades

- **3 Níveis de Dificuldade**:
  - **Nível 1 (Fácil)**: Números de `1 a 10`
  - **Nível 2 (Médio)**: Números de `1 a 100`
  - **Nível 3 (Difícil)**: Números de `1 a 1000`
- **Mecânica de Jogo Inteligente**:
  - O backend randomiza o número secreto e não revela ao jogador.
  - A cada palpite, a aplicação informa se o número secreto é **MAIOR** ou **MENOR** que o valor digitado.
  - Histórico visual de tentativas com badges indicando as dicas.
  - Efeitos sonoros dinâmicos sintetizados via Web Audio API e animação de confetes ao vencer.
- **Hall da Fama (Neon Postgres)**:
  - Registra automaticamente no banco Neon o nome do jogador, o nível, a quantidade de tentativas e a data.
  - Ranking em tempo real filtrável por nível ou classificação geral (os jogadores com menos tentativas ficam no topo).

---

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js & Express
- **Banco de Dados**: [Neon Serverless PostgreSQL](https://neon.com/) (`pg`)
- **Frontend**: HTML5, CSS3 moderno (Glassmorphism & Neon theme), JavaScript Vanilla
- **Áudio & Efeitos**: Web Audio API & HTML5 Canvas

---

## ⚙️ Instalação e Execução

### 1. Clonar o repositório
```bash
git clone https://github.com/vicksa/jogo-dos-numeros.git
cd jogo-dos-numeros
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Configurar as variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:
```env
DATABASE_URL=postgresql://usuario:senha@ep-exemplo.aws.neon.tech/neondb?sslmode=require
PORT=3000
```

### 4. Iniciar a aplicação
```bash
npm start
```

Abra seu navegador em [http://localhost:3000](http://localhost:3000).

# FakeDC

Um clone simplificado e levíssimo do Discord, focado em chamadas de voz e compartilhamento de tela de altíssima qualidade (1080p 60fps) usando conexões Peer-to-Peer diretas.

## Funcionalidades
- **Salas Privadas:** Crie ou entre em salas especificando apenas o nome.
- **Chamada de Voz P2P:** Chat de voz com latência ultra-baixa usando WebRTC.
- **Compartilhamento de Tela 1080p 60fps:** Sem engasgos graças à otimização para aceleração de hardware (H.264) e fallback inteligente (`contentHint = 'detail'`).
- **Modo Teatro (Focus Mode):** O layout se adapta perfeitamente ao focar na transmissão de tela, ocultando outras distrações.
- **Controles de Usuário:**
  - Ajuste individual de volume (deslize na miniatura do usuário).
  - Mutar localmente o áudio de uma pessoa ou transmissão.
  - Seleção de qualidade antes da transmissão (1080p ou 720p).
  - Aviso visual global para indicar quando o microfone de alguém está mudo.
- **Chat de Texto** embutido via Socket.io.
- **Responsivo (Mobile):** Funciona perfeitamente em telas de celular.

## Tecnologias Utilizadas
- **Backend:** Node.js, Express, Socket.io (Apenas sinalização e chat)
- **Frontend:** HTML, CSS, Vanilla JavaScript, WebRTC nativo (Sem frameworks pesados)

## Como Rodar Localmente
1. Tenha o [Node.js](https://nodejs.org/) instalado.
2. Clone este repositório ou baixe os arquivos.
3. No terminal (dentro da pasta do projeto), instale as dependências:
   ```bash
   npm install
   ```
4. Inicie o servidor:
   ```bash
   npm start
   ```
5. Abra no navegador: `http://localhost:3000`

## Como Hospedar
Este aplicativo é ideal para serviços gratuitos de Node.js como **Render.com** ou **Koyeb**, pois a carga pesada de vídeo passa direto entre os computadores dos usuários. Ao fazer o deploy no Render, ele executará o `npm install` e `npm start` automaticamente.
*Nota:* Não utilize serviços Serverless (como Vercel) pois o Socket.io exige conexões persistentes (WebSockets).

---
Criado para uso com amigos. Divirta-se!

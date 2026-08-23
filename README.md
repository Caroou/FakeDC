# FakeDC

Um clone simplificado e levíssimo do Discord, focado em chamadas de voz e compartilhamento de tela de altíssima qualidade (1080p 60fps) usando conexões Peer-to-Peer diretas.

## Funcionalidades
- **Interface Premium (Tailwind CSS):** Design System totalmente refeito seguindo fielmente a paleta de cores e estilo visual moderno do Discord, totalmente responsivo para celular.
- **Salas Privadas e Segurança:** Crie ou entre em salas de forma fácil. O servidor bloqueia automaticamente usuários com o mesmo nome na sala.
- **Notificações Toast:** Sistema moderno de alertas deslizantes que substituem os popups nativos feios do navegador.
- **Detector de Voz Dinâmico:** Anéis verdes iluminam automaticamente a foto de quem está falando na call (usando `AudioContext`).
- **Compartilhamento de Tela Absoluto (1080p 60FPS):**
  - **SDP Munging:** Injeção forçada de `b=AS:8000` para iniciar a transmissão travada em 8 Megabits, ignorando o limitador padrão do Chrome e garantindo que filmes e séries já comecem em Full HD no segundo zero.
  - **H.264:** Utilização estrita do codec H.264 para assegurar aceleração de hardware (GPU), removendo lag e estabilizando 60 quadros por segundo.
  - **Modo Cinema Automático:** Fique 3 segundos com o mouse parado e todos os botões e informações desaparecerão suavemente da tela.
- **Controles de Usuário (Dock Flutuante):**
  - Ajuste individual de volume (deslizador na miniatura).
  - Mutar localmente o áudio e aviso de microfone cortado sincronizado.
- **Chat de Texto** em tempo real via Socket.io.

## Tecnologias Utilizadas
- **Backend:** Node.js, Express, Socket.io (Apenas sinalização P2P e chat de texto)
- **Frontend:** HTML, Tailwind CSS, Vanilla JavaScript, WebRTC nativo avançado.

## Como Rodar Localmente
1. Tenha o [Node.js](https://nodejs.org/) instalado.
2. No terminal (dentro da pasta do projeto), instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor:
   ```bash
   npm start
   ```
4. Abra no navegador: `http://localhost:3000`

## Como Hospedar (Deploy)
Este aplicativo é ultra-leve para a nuvem. Como o vídeo viaja de forma P2P (entre os computadores das pessoas) e não pelo servidor, serviços gratuitos como **Koyeb** ou **Render** rodam o site perfeitamente.
O Render instala os pacotes com `npm install` e inicia com `npm start` de forma automática.
*Aviso:* Serviços Serverless puros (como a Vercel tradicional) não suportam WebSockets longos do Socket.io. Use Render/Koyeb.

---
Criado para curtir séries e conversar com a mais alta qualidade possível direto do navegador.

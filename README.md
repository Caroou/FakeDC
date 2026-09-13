<div align="center">
  <img src="https://cdn-icons-png.flaticon.com/256/2111/2111370.png" width="100" alt="Faketz Logo">
  <h1>Faketz</h1>
  <p><b>Chamadas de voz e compartilhamento de tela de altíssima qualidade (1080p 60fps).</b></p>
</div>

Um clone simplificado e levíssimo focado no que importa: transmissão de tela fluida usando conexões Peer-to-Peer diretas. Disponível pelo Navegador e em Aplicativo Desktop.

## ✨ Destaques

- 🚀 **Aplicativo Desktop Dedicado:** Feito com Electron, o `.exe` nativo burla as limitações de economia de energia dos navegadores para entregar compartilhamento de tela cravado em **60 FPS constantes**, ideal para jogos e vídeos.
- 📺 **Qualidade "Nitro" Gratuita:** SDP modificado para injetar bitrate máximo no WebRTC, forçando a transmissão a começar em alta definição sem demora.
- 🎨 **Design Moderno:** Interface polida (Tailwind CSS) com detecção dinâmica de voz, modo cinema imersivo e métricas de rede em tempo real.
- 🔒 **Leve e Seguro:** As transmissões de vídeo são P2P (ponto a ponto). Seu vídeo viaja criptografado direto para seus amigos sem pesar no servidor.

## 📥 Instalação

### Usando o Aplicativo Desktop (Recomendado para 60 FPS)
Baixe a versão mais recente em [Releases](https://github.com/Caroou/Faketz/releases/download/setup/Faketz.Setup.1.0.0.exe) e instale no Windows.

### Rodando o Servidor (Desenvolvimento)
1. Instale as dependências: `npm install`
2. Inicie o servidor Web e de Sinalização: `npm start`
3. Acesse `http://localhost:3000`

### Gerando o Instalador (.exe)
Para compilar o aplicativo para o Windows a partir do código fonte:
```bash
# Abra o terminal como Administrador
npm run build
```
O executável será gerado na pasta `dist/`.

## ☁️ Hospedagem
O servidor atua apenas conectando os usuários (sinalização via Socket.io). Sendo assim, o consumo de banda é ínfimo. Recomenda-se hospedar o código em plataformas como **Render** ou **Koyeb** (Vercel Serverless não é compatível com WebSockets longos).

---
*Feito para gamers e amigos que não abrem mão de qualidade.*

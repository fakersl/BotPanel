const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mineflayer = require("mineflayer");
const {
  Movements,
  pathfinder,
  goals: { GoalBlock },
} = require("mineflayer-pathfinder");
const fs = require("fs");
const config = require("./settings.json");

const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server);

let botInstance = null;
let nomeBot = null; // Variável para armazenar o nome do bot

// Middleware para servir arquivos estáticos
app.use(express.static("public"));
app.use(express.json());

// Rota para obter as configurações atuais
app.get("/getConfig", (req, res) => {
  res.json({
    username: config["bot-account"].username,
    serverIP: config.server.ip,
    serverPort: config.server.port,
  });
});

// Rota para salvar as configurações
app.post("/saveConfig", (req, res) => {
  const { username, serverIP, serverPort } = req.body;

  console.log(`Salvando nome do bot: ${username}`);

  // Atualizar configurações
  config["bot-account"].username = username;
  config.server.ip = serverIP;
  config.server.port = serverPort;

  // Salvar no arquivo settings.json
  fs.writeFile("./settings.json", JSON.stringify(config, null, 2), (err) => {
    if (err) {
      console.error("Erro ao salvar configurações:", err);
      return res
        .status(500)
        .json({ message: "Erro ao salvar as configurações" });
    }

    io.emit("configUpdated", { username, serverIP, serverPort });

    // Se o bot estiver rodando, reiniciar com o novo nome
    if (botInstance) {
      botInstance.quit();
      botInstance = null;
      createBot(username);
    }

    res.json({ message: "Configurações salvas com sucesso!" });
  });
});

// Função para criar o bot
function createBot(username) {
  if (botInstance) return;

  botInstance = mineflayer.createBot({
    username,
    auth: "offline", // Modo offline
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  botInstance.loadPlugin(pathfinder);
  const mcData = require("minecraft-data")(botInstance.version);
  const defaultMove = new Movements(botInstance, mcData);

  botInstance.once("spawn", () => {
    console.log(`[AfkBot] Bot entrou no servidor com o nome: ${username}`);
    io.emit("log", `[AfkBot] Bot entrou no servidor com o nome: ${username}`);
    io.emit("botStarted"); // Enviar evento de bot iniciado para o frontend
  });

  botInstance.on("goal_reached", () => {
    const position = botInstance.entity.position;
    console.log(`[AfkBot] Bot chegou ao destino. Posição: ${position}`);
    io.emit("log", `[AfkBot] Bot chegou ao destino. Posição: ${position}`);
  });

  botInstance.on("death", () => {
    const position = botInstance.entity.position;
    console.log(`[AfkBot] Bot morreu e foi respawnado em ${position}`);
    io.emit("log", `[AfkBot] Bot morreu e foi respawnado em ${position}`);
  });

  botInstance.on("end", () => {
    console.log("[AfkBot] Conexão encerrada, tentando reconectar...");
    io.emit("log", "[AfkBot] Conexão encerrada, tentando reconectar...");
    botInstance = null;
    setTimeout(() => createBot(username), config.utils["auto-reconnect-delay"]);
  });

  botInstance.on("error", (err) => {
    console.log(`[ERROR] ${err.message}`);
    io.emit("log", `[ERROR] ${err.message}`);
    io.emit("botError"); // Enviar evento de erro para o frontend
  });

  botInstance.on("kicked", (reason) => {
    console.log(`[AfkBot] Bot foi expulso do servidor. Motivo: ${reason}`);
    io.emit("log", `[AfkBot] Bot foi expulso do servidor. Motivo: ${reason}`);
  });
}

// Iniciar ou parar o bot dependendo do estado atual
io.on("connection", (socket) => {
  console.log("Cliente conectado");

  socket.on("setNomeBot", (nome) => {
    if (!nome) {
      return socket.emit("erro", "Nome do bot é obrigatório!");
    }

    nomeBot = nome;
    console.log(`Nome do bot definido para: ${nomeBot}`);
    socket.emit("nomeBotSet", nomeBot); // Enviar confirmação para o frontend
  });

  socket.on("startBot", () => {
    if (!nomeBot) {
      return socket.emit("erro", "Nome do bot não foi definido!");
    }

    if (!botInstance) {
      createBot(nomeBot);
      socket.emit("log", `[AfkBot] Bot iniciado com o nome: ${nomeBot}`);
    }
  });

  socket.on("stopBot", () => {
    if (botInstance) {
      botInstance.quit();
      botInstance = null;
      socket.emit("log", "[AfkBot] Bot parado!");
      io.emit("botStopped"); // Enviar evento de bot parado para o frontend
    }
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
  });
});

server.listen(8000, () => {
  console.log("Servidor iniciado na porta 8000");
});

// Rota para parar o bot
app.post("/stop-bot", (req, res) => {
  if (botInstance) {
    botInstance.quit();
    botInstance = null;
    console.log("Bot parado.");
    res.json({ success: true, message: "Bot parado com sucesso." });
  } else {
    res.json({ success: false, message: "Nenhum bot rodando." });
  }
});
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mineflayer = require("mineflayer");
const fs = require("fs");
const path = require("path");
const {
  Movements,
  pathfinder,
  goals: { GoalBlock },
} = require("mineflayer-pathfinder");

const configPath = path.join(__dirname, "settings.json");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let botInstance = null;
let reconnectAttempts = 0;
let isManuallyStopped = false; // Controla se o bot foi parado manualmente
const maxReconnectAttempts = 5;

// Middleware
app.use(express.static("public"));
app.use(express.json());

function loadConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(newConfig) {
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}

// Carregar config e garantir que o nome comece vazio
let config = loadConfig();
config["bot-account"].username = "";
saveConfig(config);

// Rota para obter configurações
app.get("/getConfig", (req, res) => {
  res.json({
    username: config["bot-account"].username,
    serverIP: config.server.ip,
    serverPort: config.server.port,
  });
});

// Rota para salvar configurações
app.post("/saveConfig", (req, res) => {
  const { username, serverIP, serverPort } = req.body;
  console.log(`Salvando nome do bot: ${username}`);

  config["bot-account"].username = username;
  config.server.ip = serverIP;
  config.server.port = serverPort;

  saveConfig(config);

  io.emit("configUpdated", { username, serverIP, serverPort });

  if (botInstance) {
    botInstance.quit();
    botInstance = null;
    createBot(username);
  }

  res.json({ message: "Configurações salvas com sucesso!" });
});

// Criar o bot
function createBot(username) {
  if (botInstance) return;

  config = loadConfig();

  config["bot-account"].username = username; // Salvar nome temporário
  saveConfig(config);

  botInstance = mineflayer.createBot({
    username,
    auth: "offline",
    host: config.server.ip, // Usar o IP/domínio do servidor Aternos
    port: config.server.port, // Usar a porta do servidor Aternos
    version: config.server.version,
    connectTimeout: 10000, // Timeout de 10 segundos
  });

  botInstance.loadPlugin(pathfinder);

  botInstance.once("spawn", () => {
    console.log(`[AfkBot] Bot conectado como: ${username}`);
    io.emit("log", `[AfkBot] Bot conectado como: ${username}`);
    io.emit("botStarted");

    reconnectAttempts = 0;

    const mcData = require("minecraft-data")(botInstance.version);
    const defaultMove = new Movements(botInstance, mcData);
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

  botInstance.on("kicked", (reason) => {
    console.log(`[AfkBot] Bot foi expulso do servidor. Motivo: ${reason}`);
    io.emit("log", `[AfkBot] Bot foi expulso do servidor. Motivo: ${reason}`);

    resetBotName(); // Resetar nome quando for expulso
    io.emit("clearBotName"); // Emitir para o frontend limpar o campo
  });

  botInstance.on("end", () => {
    console.log("[AfkBot] Conexão perdida");
    io.emit("log", "[AfkBot] Conexão perdida");

    if (!isManuallyStopped) {
      resetBotName(); // Resetar nome se não foi parado manualmente
      io.emit("clearBotName"); // Emitir para o frontend limpar o campo

      botInstance = null;
      if (
        config.utils["auto-reconnect"] &&
        reconnectAttempts < maxReconnectAttempts
      ) {
        reconnectAttempts++;
        setTimeout(
          () => createBot(config["bot-account"].username),
          config.utils["auto-reconnect-delay"]
        );
      }
    } else {
      console.log(
        "[AfkBot] Reconexão desabilitada, bot foi parado manualmente."
      );
      isManuallyStopped = false; // Resetar a variável após verificar
    }
  });

  botInstance.on("error", (err) => {
    console.log(`[ERROR] ${err.message}`);
    io.emit("log", `[ERROR] ${err.message}`);
    io.emit("botError");

    if (err.code === "ECONNREFUSED") {
      console.log(
        "[ERROR] Conexão recusada. Verifique o IP e a porta do servidor."
      );
      io.emit(
        "log",
        "[ERROR] Conexão recusada. Verifique o IP e a porta do servidor."
      );
    }

    resetBotName(); // Resetar nome quando ocorrer erro
    io.emit("clearBotName");  // Emitir para o frontend limpar o campo
  });
}

// Resetar nome do bot no settings.json
function resetBotName() {
  config = loadConfig();
  config["bot-account"].username = "";
  saveConfig(config);

  // Emitir o evento para o frontend limpar o campo de nome
  io.emit("clearBotName");
}

// WebSocket
io.on("connection", (socket) => {
  console.log("Cliente conectado");

  socket.on("setNomeBot", (data) => {
    const { nomeBot, serverIP, serverPort } = data;

    if (!nomeBot || !serverIP || !serverPort) {
      return socket.emit("erro", "Todos os campos são obrigatórios!");
    }

    // Carregar configurações atuais
    const config = loadConfig();

    // Atualizar configurações
    config["bot-account"].username = nomeBot;
    config.server.ip = serverIP;
    config.server.port = serverPort;

    // Salvar configurações atualizadas
    saveConfig(config);

    // Enviar confirmação para o cliente
    socket.emit("nomeBotSet", nomeBot);
    socket.emit("log", `[AfkBot] Nome do bot definido para: ${nomeBot}`);

    // Emitir evento para o frontend exibir o toast
    io.emit("showToast", {
      message: "Configurações salvas com sucesso!",
      color: "green",
    });
  });

  socket.on("startBot", () => {
    const config = loadConfig();

    if (!config["bot-account"].username) {
      return socket.emit("erro", "Nome do bot não foi definido!");
    }

    if (!botInstance) {
      createBot(config["bot-account"].username);
      socket.emit(
        "log",
        `[AfkBot] Bot iniciado com o nome: ${config["bot-account"].username}`
      );
    }
  });

  socket.on("stopBot", () => {
    if (botInstance) {
      botInstance.quit();
      botInstance = null;
      socket.emit("log", "[AfkBot] Bot parado!");
      io.emit("botStopped");
      resetBotName(); // Resetar nome ao parar o bot
      io.emit("clearBotName");  // Emitir para o frontend limpar o campo
      isManuallyStopped = true; // Marcar como parado manualmente
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
    resetBotName(); // Resetar nome ao parar via API
    io.emit("clearBotName");  // Emitir para o frontend limpar o campo
    res.json({ success: true, message: "Bot parado com sucesso." });
  } else {
    res.json({ success: false, message: "Nenhum bot rodando." });
  }
});

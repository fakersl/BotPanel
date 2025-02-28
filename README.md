# AfkBot - Bot para Aternos (Minecraft)

Esse projeto cria um bot de Minecraft utilizando `mineflayer` para se conectar ao servidor Aternos e manter-se online, mesmo quando o jogador estiver AFK (sem atividade). Ele possui uma interface web simples para configuração e controle do bot.

## Funcionalidades

- **Configuração fácil**: Defina o nome do bot, o IP e a porta do servidor através da interface web.
- **Controle do bot**: Inicie e pare o bot diretamente pela interface web.
- **Logs em tempo real**: Mensagens do bot e de erro são enviadas tanto para o console quanto para o frontend via WebSocket.
- **Reconexão automática**: Quando o bot perde a conexão com o servidor, ele pode tentar reconectar automaticamente.

## Requisitos

- **Node.js** (versão 14 ou superior)
- **NPM** (ou Yarn, caso prefira)
- **Minecraft Aternos Server**: Você precisa de um servidor Aternos com as informações de IP e porta.

## Como usar

### Passo 1: Clone o repositório

Primeiro, faça o clone deste repositório para sua máquina local.

```bash
git clone https://github.com/fakersl/BotPanel
cd afk-bot
```

### Passo 2: Instale as dependências

Instale todas as dependências necessárias utilizando npm ou yarn.

```bash
npm install
```
### Passo 3: Execute o servidor

Inicie o servidor localmente com o comando abaixo. Isso irá iniciar tanto o servidor web quanto o bot.

```bash
npm start
```

O servidor estará rodando na porta 8000 por padrão.

### Passo 4: Acesse a interface web

Abra seu navegador e acesse http://localhost:8000. Na interface, você pode:

Configurar o bot: Defina o nome do bot, o IP e a porta do servidor.
Iniciar o bot: Clique no botão para iniciar o bot.
Parar o bot: Clique no botão para parar o bot.

### Passo 5: Logs em tempo real

Os logs do bot serão exibidos em tempo real na interface web. Eles também estarão visíveis no console de onde o servidor está rodando.

# Licença
Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para mais detalhes.

# Contribuição
Se você encontrar problemas ou quiser melhorar o projeto, sinta-se à vontade para abrir um pull request ou issue.

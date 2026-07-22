import { world, system } from "@minecraft/server";

export const CommandBridge = {
    commands: new Map(),
    register(name, callback) {
        this.commands.set(name.toLowerCase(), callback);
    }
};

const COMMAND_MAPPINGS = {
    "menu": "labsdev:menu",
    "admin": "labsdev:admin",
    "adm": "labsdev:adm",
    "adminpanel": "labsdev:adminpanel",
    "clan": "labsdev:clan",
    "warps": "labsdev:warps",
    "warp": "labsdev:warp",
    "setwarp": "labsdev:setwarp",
    "delwarp": "labsdev:delwarp",
    "homes": "labsdev:homesui",
    "homesui": "labsdev:homesui",
    "home": "labsdev:home",
    "sethome": "labsdev:sethome",
    "delhome": "labsdev:delhome",
    "tpa": "labsdev:tpa",
    "tpahere": "labsdev:tpahere",
    "tpaccept": "labsdev:tpaccept",
    "tpdeny": "labsdev:tpdeny",
    "back": "labsdev:back",
    "rtp": "labsdev:rtp",
    "spawn": "labsdev:spawn",
    "resgatar": "warden:resgatar",
    "help": "labsdev:help"
};

// ===================================================
// Funcao central de execucao de comandos do bridge
// Usada tanto pelo prefixo ! quanto pelo prefixo /
// ===================================================
async function executeBridgeCommand(player, cmdName, args, prefix) {
    try {
        // Caso especial: home list
        if (
            cmdName === "home" &&
            args[0]?.toLowerCase() === "list"
        ) {
            const callback =
                CommandBridge.commands.get("homesui") ||
                CommandBridge.commands.get("homes");
            if (callback) {
                callback(player, []);
            } else {
                player.sendMessage("§cHomes UI nao encontrada.");
            }
            return;
        }

        // CALLBACK DIRETO (registrado via CommandBridge.register)
        if (CommandBridge.commands.has(cmdName)) {
            const callback = CommandBridge.commands.get(cmdName);
            
            // Como agora passamos o resto da linha como um único argumento no bridge,
            // mas muitos callbacks esperam um array de palavras, fazemos o split aqui 
            // se o callback não for inteligente o suficiente para lidar com a string cheia.
            // No caso do setwarp, ele faz args.join(" "), então um array com a string cheia funciona.
            callback(player, args);
            return;
        }

        // COMANDO OFICIAL (labsdev:xxx)
        const officialCommand = COMMAND_MAPPINGS[cmdName];
        if (!officialCommand) {
            player.sendMessage(
                `§cComando ${prefix}${cmdName} nao encontrado.`
            );
            return;
        }

        const fullCommand = args.length
            ? `${officialCommand} ${args.join(" ")}`
            : officialCommand;

        player.sendMessage(`§7Executando: §a${fullCommand}`);
        await player.runCommandAsync(fullCommand);

    } catch (e) {
        console.warn(`[Bridge ERROR] ${e} ${e?.stack ?? ""}`);
        player.sendMessage(`§cErro ao executar ${prefix}${cmdName}`);
    }
}

// ===================================================
// Listener de chat - captura tanto "!" quanto "/"
// como prefixo de comandos do bridge
// ===================================================
world.beforeEvents.chatSend.subscribe((data) => {
    const message = data.message.trim();

    // Verifica se comeca com ! ou /
    const startsWithBang  = message.startsWith("!");
    const startsWithSlash = message.startsWith("/");

    if (!startsWithBang && !startsWithSlash) return;

    const prefix = startsWithBang ? "!" : "/";

    // Extrai o nome do comando e os argumentos preservando espaços internos (importante para cores § e &)
    const content = message.slice(1).trim();
    if (!content) return;

    const parts = content.split(/\s+/);
    const cmdName = parts.shift()?.toLowerCase();
    
    // Reconstrói os argumentos mantendo a fidelidade da mensagem original
    // Isso evita que o split por múltiplos espaços quebre formatações de cores complexas
    const args = content.slice(cmdName.length).trim() ? [content.slice(cmdName.length).trim()] : [];

    if (!cmdName) return;

    // Verifica se e um comando do bridge (callback ou mapeamento)
    const isBridgeCommand =
        CommandBridge.commands.has(cmdName) ||
        Object.prototype.hasOwnProperty.call(COMMAND_MAPPINGS, cmdName);

    // Se for prefixo "/" e nao for um comando do bridge,
    // deixa o jogo processar normalmente (comandos nativos do Minecraft)
    if (startsWithSlash && !isBridgeCommand) return;

    // Cancela a mensagem de chat e processa o comando
    data.cancel = true;

    const player = data.sender;

    // Delay de 1 tick para liberar UI
    system.runTimeout(async () => {
        await executeBridgeCommand(player, cmdName, args, prefix);
    }, 1);
});

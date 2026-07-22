// ================= COMMAND BRIDGE =================
import "./core/bridge.js";

// ================= CORE =================
import "./core/telagem.js";
import "./core/clearLag.js";
import "./core/combatlog.js";
import "./core/container.js";
import "./core/spawn.js";
import "./core/antiTrouxa.js";
import "./core/kb.js";
import "./core/cpslimiter.js";
import "./core/ranks.js";
import "./core/mobStacker.js";
import "./core/CPS_Config.js";
import "./core/topPlayers.js";

// ================= ESSENTIALS =================
import "./essentials/spawn.js";
import "./essentials/homes.js";
import "./essentials/rtp.js";
import "./essentials/tpa.js";
import "./essentials/back.js";
// warps carregado antes do adminpanel para resolver dependência de openCreateWarpForm
import "./essentials/warps.js";
import "./essentials/help.js";
import "./essentials/menu.js";
import "./essentials/legacyHomesMigration.js";

// adminpanel carregado após warps para que openCreateWarpForm esteja disponível
import "./core/adminpanel.js";

// ================= CLAN =================
import "./clan/main.js";
import "./clan/command.js";
import "./clan/team.js";
import "./clan/teamManager.js";
import "./clan/friendlyFire.js";

// ================= DISCORD BRIDGE =================
import { setupDiscordBridge } from "./clan/discordBridge.js";
setupDiscordBridge();

// ================= WARDEN =================
import "./warden/wardenapi.js";

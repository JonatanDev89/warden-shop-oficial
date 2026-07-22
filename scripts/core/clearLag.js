import { world, system } from "@minecraft/server";
import { getAdminSetting, isModuleEnabled } from "./moduleState.js";

const PREFIX = "§f[§l§3WARDEN§r§f]";
const DIMENSION_IDS = ["overworld", "nether", "the_end"];
const STACK_NAME_MARKER = "§7x§f";

const WARNINGS = new Map([
    [5, `${PREFIX} §lLIMPEZA EM: 5`],
    [4, `${PREFIX} §lLIMPEZA EM: 4`],
    [3, `${PREFIX} §lLIMPEZA EM: 3`],
    [2, `${PREFIX} §lLIMPEZA EM: 2`],
    [1, `${PREFIX} §lLIMPEZA EM: 1`],
    [0, `${PREFIX} §lLIMPANDO ENTIDADES...`],
]);

let secondsUntilClear = 240;

function getClearLagSettings() {
    const settings = getAdminSetting("clearlag");

    return {
        intervalSeconds: Math.max(
            10,
            Math.floor(Number(settings.intervalSeconds) || 240)
        ),
        removeItems: settings.removeItems !== false,
        removeMonsters: settings.removeMobs !== false,
        removeXpOrbs: settings.removeXpOrbs !== false,
        announceStart: settings.announceStart !== false,
    };
}

export function runClearLag() {
    const settings = getClearLagSettings();

    let itemsRemoved = 0;
    let monstersRemoved = 0;
    let xpOrbsRemoved = 0;

    for (const dimId of DIMENSION_IDS) {
        try {
            const dimension = world.getDimension(dimId);

            if (settings.removeItems) {
                for (const entity of dimension.getEntities({
                    type: "minecraft:item",
                })) {
                    entity.remove();
                    itemsRemoved++;
                }
            }

            if (settings.removeXpOrbs) {
                for (const entity of dimension.getEntities({
                    type: "minecraft:xp_orb",
                })) {
                    entity.remove();
                    xpOrbsRemoved++;
                }

                for (const entity of dimension.getEntities({
                    type: "minecraft:experience_orb",
                })) {
                    entity.remove();
                    xpOrbsRemoved++;
                }
            }

            if (settings.removeMonsters) {
                for (const entity of dimension.getEntities({
                    families: ["monster"],
                })) {

                    // Protege Endermans
                    if (entity.typeId === "minecraft:enderman") continue;

                    if (
                        entity.nameTag &&
                        entity.nameTag !== "" &&
                        !entity.nameTag.includes(STACK_NAME_MARKER)
                    ) {
                        continue;
                    }

                    entity.remove();
                    monstersRemoved++;
                }
            }
        } catch {}
    }

    world.sendMessage(
        `${PREFIX} §lFORAM LIMPOS:\n§f[ ${monstersRemoved} MOBS, ${xpOrbsRemoved} ORBS, ${itemsRemoved} ITENS ]`
    );

    return {
        itemsRemoved,
        xpOrbsRemoved,
        monstersRemoved,
    };
}

system.runInterval(() => {
    if (!isModuleEnabled("clearlag")) return;

    const settings = getClearLagSettings();

    if (secondsUntilClear > settings.intervalSeconds) {
        secondsUntilClear = settings.intervalSeconds;
    }

    secondsUntilClear--;

    if (WARNINGS.has(secondsUntilClear)) {
        world.sendMessage(WARNINGS.get(secondsUntilClear));
    }

    if (secondsUntilClear <= 0) {
        runClearLag();
        secondsUntilClear = settings.intervalSeconds;
    }

    // AUTO-CLEAR DINÂMICO (OTIMIZADO)
    if (system.currentTick % 200 === 0) {
        try {
            const overworld = world.getDimension("overworld");
            const entities = overworld.getEntities({
                families: ["monster"],
            });

            if (entities.length >= 400) {
                world.sendMessage(
                    `${PREFIX} LIMITE DE 400 MOBS ATINGIDO! INICIANDO LIMPEZA...`
                );

                runClearLag();
                secondsUntilClear = settings.intervalSeconds;
            }
        } catch {}
    }
}, 20);
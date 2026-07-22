import { world } from "@minecraft/server";
import { Teams } from "./team.js";

let _teamSystem = null;

export function getTeamSystem() {
    return _teamSystem;
}

export function isTeamSystemReady() {
    return _teamSystem !== null;
}

export function initializeTeamSystem() {
    if (!_teamSystem) {
        _teamSystem = new Teams();
    }

    return _teamSystem;
}

world.afterEvents.worldLoad.subscribe(() => {
    initializeTeamSystem();
});

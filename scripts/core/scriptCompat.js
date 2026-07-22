import { world } from "@minecraft/server";

export function isValidEntity(entity) {
    if (!entity) return false;

    try {
        const isValid = entity.isValid;
        return typeof isValid === "function" ? isValid.call(entity) : isValid !== false;
    } catch {
        return false;
    }
}

export function getOnlinePlayers() {
    try {
        if (typeof world.getAllPlayers === "function") {
            return world.getAllPlayers();
        }
    } catch {}

    try {
        if (typeof world.getPlayers === "function") {
            return world.getPlayers();
        }
    } catch {}

    return [];
}

export function getCommandSourceEntity(origin) {
    return origin?.sourceEntity ?? origin?.initiator ?? null;
}

/**
 * Aplica knockback a uma entidade de forma compatível.
 * Para entidades que não suportam applyKnockback (mobs, etc.),
 * usa applyImpulse como fallback para simular o efeito.
 */
export function applyKnockbackCompat(entity, direction, horizontalStrength = 1, verticalStrength = 0) {
    if (!isValidEntity(entity) || typeof entity.applyKnockback !== "function") return false;

    const x = Number(direction?.x ?? 0);
    const z = Number(direction?.z ?? 0);

    // Tenta applyKnockback com a assinatura nova (objeto VectorXZ)
    try {
        entity.applyKnockback(
            { x: x * horizontalStrength, z: z * horizontalStrength },
            verticalStrength
        );
        return true;
    } catch (newSignatureError) {
        // Tenta applyKnockback com a assinatura antiga (4 parâmetros)
        try {
            entity.applyKnockback(x, z, horizontalStrength, verticalStrength);
            return true;
        } catch (oldSignatureError) {
            // Se o erro for UnsupportedFunctionalityError (entidade não suporta knockback,
            // como mobs em certas versões), usa applyImpulse como fallback
            const errorName = (newSignatureError?.name ?? "") + (newSignatureError?.message ?? "");
            const isUnsupported =
                errorName.includes("UnsupportedFunctionality") ||
                errorName.includes("não suportada") ||
                errorName.includes("not supported");

            if (isUnsupported && typeof entity.applyImpulse === "function") {
                try {
                    entity.applyImpulse({
                        x: x * horizontalStrength,
                        y: verticalStrength,
                        z: z * horizontalStrength
                    });
                    return true;
                } catch {
                    return false;
                }
            }

            return false;
        }
    }
}

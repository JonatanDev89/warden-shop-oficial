export function normalizeCommandText(command) {
    return String(command ?? "").trim().replace(/^\/+/, "");
}

export function runCommandCompat(source, command) {
    const normalized = normalizeCommandText(command);
    if (!source || !normalized) {
        throw new Error("Command source or command text is missing.");
    }

    if (typeof source.runCommand === "function") {
        return source.runCommand(normalized);
    }

    if (typeof source.runCommandAsync === "function") {
        return source.runCommandAsync(normalized);
    }

    throw new Error("Command source does not support runCommand.");
}

export async function runCommandCompatAsync(source, command) {
    return await runCommandCompat(source, command);
}

export function tryRunCommand(source, command) {
    try {
        const result = runCommandCompat(source, command);
        if (result && typeof result.catch === "function") {
            result.catch(() => {});
        }
        return true;
    } catch {
        return false;
    }
}

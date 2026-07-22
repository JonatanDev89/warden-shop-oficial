import {
    CommandPermissionLevel,
    CustomCommandStatus,
    CustomCommandParamType,
    system,
} from "@minecraft/server";

export class CustomCommandBuilder {
    constructor(name) {
        this.cmd = {
            name,
            description: "",
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false,
            mandatoryParameters: [],
            optionalParameters: [],
        };

        this.handler = () => undefined;
    }

    description(text) {
        this.cmd.description = text;
        return this;
    }

    permission(level) {
        this.cmd.permissionLevel = level;
        return this;
    }

    cheatsRequired(required = true) {
        this.cmd.cheatsRequired = required;
        return this;
    }

    string(name, required = false) {
        return this.addParam(name, CustomCommandParamType.String, required);
    }

    integer(name, required = false) {
        return this.addParam(name, CustomCommandParamType.Integer, required);
    }

    float(name, required = false) {
        return this.addParam(name, CustomCommandParamType.Float, required);
    }

    boolean(name, required = false) {
        return this.addParam(name, CustomCommandParamType.Boolean, required);
    }

    enum(name, values, required = false) {
        const enumName = String(name);
        const parameterName = enumName.includes(":")
            ? enumName.slice(enumName.lastIndexOf(":") + 1)
            : enumName;

        return this.addParam(parameterName, CustomCommandParamType.Enum, required, {
            enumName,
            values,
        });
    }

    entity(name, required = false) {
        return this.addParam(name, CustomCommandParamType.EntitySelector, required);
    }

    player(name, required = false) {
        return this.addParam(name, CustomCommandParamType.PlayerSelector, required);
    }

    position(name, required = false) {
        return this.addParam(name, CustomCommandParamType.Location, required);
    }

    blockType(name, required = false) {
        return this.addParam(name, CustomCommandParamType.BlockType, required);
    }

    itemType(name, required = false) {
        return this.addParam(name, CustomCommandParamType.ItemType, required);
    }

    onExecute(fn) {
        this.handler = fn;
        return this;
    }

    addParam(name, type, required, options = undefined) {
        const list = required ? this.cmd.mandatoryParameters : this.cmd.optionalParameters;
        const param = { name, type };

        if (options?.enumName) {
            param.enumName = options.enumName;
            param.values = Array.isArray(options.values) ? options.values : [];
        }

        list.push(param);
        return this;
    }

    register(registry) {
        const full = {
            ...this.cmd,
            mandatoryParameters: this.cmd.mandatoryParameters.map(({ values, ...param }) => param),
            optionalParameters: this.cmd.optionalParameters.map(({ values, ...param }) => param),
        };

        for (const param of [
            ...(this.cmd.mandatoryParameters ?? []),
            ...(this.cmd.optionalParameters ?? []),
        ]) {
            if (param.type === CustomCommandParamType.Enum) {
                registry.registerEnum(param.enumName ?? param.name, param.values ?? []);
            }
        }

        registry.registerCommand(full, (origin, args = []) => {
            try {
                const values = Array.isArray(args) ? args : [args];

                system.run(() => {
                    try {
                        this.handler(origin, ...values);
                    } catch (error) {
                        console.warn(`[CustomCommand] Erro em ${full.name}:`, error);
                    }
                });

                return { status: CustomCommandStatus.Success };
            } catch (error) {
                console.warn(`[CustomCommand] Erro em ${full.name}:`, error);
                return {
                    status: CustomCommandStatus.Failure,
                    message: "Erro interno ao executar o comando.",
                };
            }
        });
    }
}

class _SlashCommandManager {
    constructor() {
        this.builders = [];
        this.registry = null;

        system.beforeEvents.startup.subscribe((event) => {
            this.registry = event.customCommandRegistry;
            if (!this.registry) return;

            for (const builder of this.builders) {
                this.registerBuilder(builder);
            }
        });
    }

    registerBuilder(builder) {
        try {
            builder.register(this.registry);
        } catch (error) {
            console.warn(`[CustomCommand] Nao foi possivel registrar ${builder.cmd.name}:`, error);
        }
    }

    create(name) {
        const builder = new CustomCommandBuilder(name);
        this.builders.push(builder);

        if (this.registry) {
            this.registerBuilder(builder);
        }

        return builder;
    }
}

export const SlashCommandManager = new _SlashCommandManager();

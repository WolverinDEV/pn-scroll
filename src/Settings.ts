import SettingsBackend from "./SettingsBackend";

export interface SettingsBackend {
    loadSettings() : Promise<{ [key: string]: string }>;
    saveSetting(key: string, value: string): void;
    deleteSetting(key: string): void;
}

type SettingNumber = {
    type: "number",

    minValue?: number,
    maxValue?: number,
}

type SettingString = {
    type: "string",
}

type SettingValueDepended<T> =
    T extends number ? SettingNumber :
        T extends string ? SettingString :
            (SettingNumber | SettingString);

export type Setting<T = number | string> = {
    key: string,
    default: T,
    validator?: (value: T) => string | null
} & SettingValueDepended<T>;

export namespace Setting {
    export const WebProxyServerAddress: Setting<string> = {
        key: "web-proxy.address",
        default: "ws://192.168.40.135:8055/",
        type: "string",
        validator: value => value.match(/^wss?:\/\/.*$/g) ? null : "invalid url"
    };

    export const PreviewOpacity: Setting<number> = {
        key: "preview.opacity",
        type: "number",

        default: .5,
        minValue: 0,
        maxValue: 1
    };

    export const AllKeys: Setting<any>[] = Object.keys(Setting)
            .map(setting => (Setting as any)[setting])
            .filter(setting => typeof setting === "object" && 'key' in setting);

    export function validateSettingValue<V>(setting: Setting, value: any) : string | null {
        switch (setting.type) {
            case "number":
                if(typeof value !== "number" || isNaN(value)) {
                    return "value is not a number";
                }

                if(typeof setting.minValue === "number" && value < setting.minValue) {
                    return "value must be at least " + setting.minValue;
                }

                if(typeof setting.maxValue === "number" && value > setting.maxValue) {
                    return "value should be less or equal to " + setting.maxValue;
                }

                break;

            case "string":
                break;

            default:
                return "invalid value type";
        }

        if(setting.validator) {
            return setting.validator(value);
        }

        return null;
    }
}

type SettingChangeCallback<V> = (newValue: V) => void;
class Settings {
    private initialized: boolean;
    private callbacks: { [key: string]: SettingChangeCallback<any>[] } = {};
    private cachedValues: { [key: string]: any } = {};

    constructor(private readonly backend: SettingsBackend) {
        this.initialized = false;
    }

    async initialize() {
        if(this.initialized) {
            return;
        }

        this.initialized = true;
        const values = await this.backend.loadSettings();

        for(const setting of Setting.AllKeys) {
            if(!(setting.key in values)) {
                continue;
            }

            switch (setting.type) {
                case "number":
                    this.cachedValues[setting.key] = parseFloat(values[setting.key]);
                    break;

                case "string":
                    this.cachedValues[setting.key] = values[setting.key];
                    break;
            }
        }
    }

    getValue<V>(setting: Setting<V>) : V {
        if(setting.key in this.cachedValues) {
            return this.cachedValues[setting.key];
        }

        return setting.default;
    }

    setValue<V>(setting: Setting<V>, value: V) {
        if(this.getValue(setting) === value) {
            return;
        }

        if(typeof value === "number") {
            this.backend.saveSetting(setting.key, value.toString());
        } else if(typeof value === "string") {
            this.backend.saveSetting(setting.key, value);
        } else {
            throw new Error("invalid value");
        }

        this.cachedValues[setting.key] = value;
        this.triggerChangeCallbacks(setting, value);
    }

    deleteValue<V>(setting: Setting<V>) {
        this.backend.deleteSetting(setting.key);
        delete this.cachedValues[setting.key];

        this.triggerChangeCallbacks(setting, setting.default);
    }

    registerChangeCallback<V>(setting: Setting<V>, callback: SettingChangeCallback<V>) : () => void {
        const callbacks = this.callbacks[setting.key] || (this.callbacks[setting.key] = []);
        callbacks.push(callback);
        return () => this.removeChangeCallback(setting, callback);
    }

    removeChangeCallback<V>(setting: Setting<V>, callback: SettingChangeCallback<V>) : boolean {
        const callbacks = this.callbacks[setting.key];
        if(!callbacks) {
            return false;
        }

        const index = callbacks.indexOf(callback);
        if(index === -1) {
            return false;
        }

        if(callbacks.length === 1) {
            delete this.callbacks[setting.key];
        } else {
            callbacks.splice(index, 1);
        }
        return true;
    }

    private triggerChangeCallbacks<V>(setting: Setting<V>, newValue: V) {
        const callbacks = this.callbacks[setting.key];
        if(!callbacks || !callbacks.length) {
            return;
        }

        for(const callback of [...callbacks]) {
            callback(newValue);
        }
    }
}

export const AppSettings = new Settings(SettingsBackend);
AppSettings.initialize();
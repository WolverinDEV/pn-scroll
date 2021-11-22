import {SettingsBackend} from "./Settings";

export default new class implements SettingsBackend {
    async loadSettings(): Promise<{ [key: string]: string }> {
        const result: { [key: string]: string } = {};

        for(let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if(typeof key !== "string") {
                continue;
            }

            result[key] = localStorage.getItem(key)!;
        }

        return result;
    }

    saveSetting(key: string, value: string): void {
        localStorage.setItem(key, value);
    }

    deleteSetting(key: string) {
        localStorage.removeItem(key);
    }
};
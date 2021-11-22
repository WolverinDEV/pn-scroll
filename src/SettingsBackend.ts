import {SettingsBackend} from "./Settings";

export default new class implements SettingsBackend {
    async loadSettings(): Promise<{ [key: string]: string }> {
        throw new Error("Method not implemented.");
    }

    saveSetting(key: string, value: string): void {
        throw new Error("Method not implemented.");
    }

    deleteSetting(key: string) {
        throw new Error("Method not implemented.");
    }
};
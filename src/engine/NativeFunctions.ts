import { NativeModules } from 'react-native';
const { PNScrollNativeFunctions } = NativeModules;

type NativeDownloadResult = {
    status: "success",
    uri: string
} | {
    status: "failure",
    message: string
};

interface NativeFunctions {
    downloadImage(url: string, headers: { [key: string]: string }): Promise<NativeDownloadResult>;
    toggleFullScreen(enabled: boolean): void;
}

export const NativeFunctions: NativeFunctions = PNScrollNativeFunctions;

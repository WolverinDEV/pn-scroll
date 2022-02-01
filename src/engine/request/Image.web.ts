import { worker } from "../web/WebProxy";
import { ImageLoadResult } from "../types/PostImage";

export async function downloadImage(url: string, headers: { [key: string]: string }): Promise<ImageLoadResult> {
    if (!worker) {
        return { status: "failure", message: "missing worker" };
    }

    /*
     * Images will be proxied via the service worker.
     * We only register the custom headers.
     */
    await worker.registerImage(url, headers);

    return {
        status: "success",
        imageUri: url,
        unload: () => {
        }
    };
}

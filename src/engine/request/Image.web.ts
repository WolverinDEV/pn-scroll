import {PostImage} from "../index";
import ImageLoadResult = PostImage.ImageLoadResult;
import {worker} from "../web/WebProxy";

export async function downloadImage(url: string, headers: { [key: string]: string }): Promise<ImageLoadResult> {
    if(!worker) {
        return { status: "failure", message: "missing worker" };
    }

    return await worker.downloadImage(url, headers);
}

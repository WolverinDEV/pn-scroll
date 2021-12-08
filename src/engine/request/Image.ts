import {NativeFunctions} from "../NativeFunctions";
import {PostImage} from "../index";
import ImageLoadResult = PostImage.ImageLoadResult;

export async function downloadImage(url: string, headers: { [key: string]: string }): Promise<ImageLoadResult> {
    const result = await NativeFunctions.downloadImage(url, headers);
    switch(result.status) {
        case "failure":
            return { status: "failure", message: result.message };

        case "success":
            return { status: "success", imageUri: result.uri, unload: () => {} };

        default:
            return { status: "failure", message: "unknown response" };
    }
}

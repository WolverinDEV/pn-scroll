export type ImageLoadResult = {
    status: "success",
    imageUri: string,

    unload: () => void,
} | {
    status: "failure",
    message: string,
    recoverable?: boolean,
};

export type ImageInfo = {
    identifier: string,
    metadata: { [key: string]: string },

    width: number | null,
    height: number | null,
};

export type PostImage = {
    preview: ImageInfo | null,
    detailed: ImageInfo,
    other: ImageInfo[]
};

export const extractErrorMessage = (error: unknown): string => {
    let message: string;
    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === "string") {
        message = error;
    } else {
        message = "lookup the console";
        console.error(error);
    }
    return message;
}

import { v4 as uuidv4 } from "uuid";

export function extractErrorMessage(error: unknown) : string {
    if(error instanceof Error) {
        return error.message;
    } else if(typeof error === "string") {
        return error;
    } else {
        const id = uuidv4();
        console.error("Received error of unknown type.\nReference ID: %s\n Error: %o", id, error);
        return "lookup the console (" + id + ")";
    }
}

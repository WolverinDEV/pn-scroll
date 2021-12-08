import { v4 as uuidv4 } from "uuid";
import { Logger, default as defaultLogger } from "loglevel";

export function extractErrorMessage(error: unknown, logger?: Logger) : string {
    logger = logger || defaultLogger;

    if(error instanceof Error) {
        return error.message;
    } else if(typeof error === "string") {
        return error;
    } else {
        const id = uuidv4();
        logger.error("Received error of unknown type.\nReference ID: %s\n Error: %o", id, error);
        return "lookup the console (" + id + ")";
    }
}

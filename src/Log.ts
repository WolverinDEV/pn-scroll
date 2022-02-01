import { Platform } from "react-native";

let scope = "window";

export enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error
}

export interface Logger {
    readonly parent: Logger | undefined;
    readonly name: string;

    /**
     * Output trace message to console.
     * This will also include a full stack trace
     *
     * @param msg any data to log to the console
     */
    trace(...msg: any[]): void;

    /**
     * Output debug message to console including appropriate icons
     *
     * @param msg any data to log to the console
     */
    debug(...msg: any[]): void;

    /**
     * Output debug message to console including appropriate icons
     *
     * @param msg any data to log to the console
     */
    log(...msg: any[]): void;

    /**
     * Output info message to console including appropriate icons
     *
     * @param msg any data to log to the console
     */
    info(...msg: any[]): void;

    /**
     * Output warn message to console including appropriate icons
     *
     * @param msg any data to log to the console
     */
    warn(...msg: any[]): void;

    /**
     * Output error message to console including appropriate icons
     *
     * @param msg any data to log to the console
     */
    error(...msg: any[]): void;

    /**
     * This disables all logging below the given level, so that after a log.setLevel("warn") call log.warn("something")
     * or log.error("something") will output messages, but log.info("something") will not.
     *
     * @param level as a string, like 'error' (case-insensitive) or as a number from 0 to 5 (or as log.levels. values)
     */
    setLevel(level: LogLevel): void;

    /**
     * Returns the current logging level, as a value from LogLevel.
     * It's very unlikely you'll need to use this for normal application logging; it's provided partly to help plugin
     * development, and partly to let you optimize logging code as below, where debug data is only generated if the
     * level is set such that it'll actually be logged. This probably doesn't affect you, unless you've run profiling
     * on your code and you have hard numbers telling you that your log data generation is a real performance problem.
     */
    getLevel(): LogLevel;

    getLogger(name: string): Logger;
}

class DefaultLogger implements Logger {
    readonly parent: Logger | undefined;
    readonly name: string;
    private lastDate: Date;

    constructor(name: string, parent: Logger | undefined) {
        this.name = name;
        this.parent = parent;
        this.lastDate = new Date();
    }

    trace(...msg: any[]): void {
        this.logMessage(LogLevel.Trace, ...msg);
    }

    debug(...msg: any[]): void {
        this.logMessage(LogLevel.Debug, ...msg);
    }

    info(...msg: any[]): void {
        this.logMessage(LogLevel.Info, ...msg);
    }

    log(...msg: any[]): void {
        this.logMessage(LogLevel.Info, ...msg);
    }

    warn(...msg: any[]): void {
        this.logMessage(LogLevel.Warn, ...msg);
    }

    error(...msg: any[]): void {
        this.logMessage(LogLevel.Error, ...msg);
    }

    getLevel(): LogLevel {
        /* TODO! */
        return LogLevel.Trace;
    }

    setLevel(level: LogLevel): void {
    }

    getLogger(name: string): Logger {
        return new DefaultLogger(name, this);
    }

    private logMessage(level: LogLevel, ...msg: any[]) {
        const methodMap = {
            [LogLevel.Trace]: console.debug,
            [LogLevel.Debug]: console.debug,
            [LogLevel.Info]: console.info,
            [LogLevel.Warn]: console.warn,
            [LogLevel.Error]: console.error,
        };

        const timestamp = this.logTimestamp();
        if(Platform.OS === "web") {
            methodMap[level]("[%s][%s][%s][%s]: %s", scope, timestamp, LogLevel[level], this.name ?? "global", ...msg);
        } else {
            methodMap[level](`[${scope}][${timestamp}][${LogLevel[level]}][${this.name ?? "global"}]: `, ...msg);
        }
    }

    private logTimestamp(): string {
        const date = new Date();
        const diff = date.getTime() - this.lastDate.getTime();
        this.lastDate = date;
        return "+" + diff.toString().padStart(3, "0");
    }
}

const globalLogger = new DefaultLogger("global", undefined);
export function initializeLogScope(targetScope: "window" | "worker" | "service-worker") {
    scope = targetScope;
}

export function getLogger(name: string): Logger {
    return globalLogger.getLogger(name);
}

/**
 * Logger used to debug which functions have been rendered.
 * Used only for development.
 */
const RenderLogger = getLogger("render");

export function logComponentRendered(name: string) {
    if (__DEV__) {
        RenderLogger.log("Rendered %s", name);
    }
}

//RenderLogger.disableAll();

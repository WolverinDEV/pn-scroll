import loglevel, {Logger} from "loglevel";
import loglevelPrefix from "loglevel-plugin-prefix";

export function getLogger(name: string): Logger {
    return loglevel.getLogger(name);
}

loglevel.enableAll(true);

let lastDate = new Date();
loglevelPrefix.reg(loglevel);
loglevelPrefix.apply(loglevel, {
    template: "[%t][%l][%n]:",
    levelFormatter: level => level.toUpperCase(),
    nameFormatter: name => name || "global",
    timestampFormatter: date => {
        const diff = date.getTime() - lastDate.getTime();
        lastDate = date;
        return "+" + diff.toString().padStart(3, "0");
    }
});

/**
 * Logger used to debug which functions have been rendered.
 * Used only for development.
 */
const RenderLogger = getLogger("render");
export function logComponentRendered(name: string) {
    if(__DEV__) {
        RenderLogger.log("Rendered %s", name);
    }
}
RenderLogger.disableAll();

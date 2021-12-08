import loglevel, {Logger} from "loglevel";
import loglevelPrefix from "loglevel-plugin-prefix";

export function getLogger(name: string): Logger {
    return loglevel.getLogger(name);
}

loglevel.enableAll(true);

loglevelPrefix.reg(loglevel);
loglevelPrefix.apply(loglevel, {
    template: "[%l][%n]:",
    levelFormatter: level => level.toUpperCase(),
    nameFormatter: name => name || "global",
});

import {useEffect, useState} from "react";
import {AppSettings, Setting} from "../../Settings";

export function useSetting<V>(setting: Setting<V>) : V {
    const [ value, setValue ] = useState(() => AppSettings.getValue(setting));
    useEffect(() => AppSettings.registerChangeCallback(setting, setValue), [ ]);
    return value;
}
import React, {useContext, useEffect, useRef, useState} from "react";
import {
    StyleSheet,
    TextInput,
    Text,
    View,
    TouchableWithoutFeedback, Animated
} from "react-native";
import {AppSettings, Setting} from "../../Settings";
import {HoverAnimatedView, SimpleAnimatedValue} from "../components/Hoverable";
import {useAnimation} from "../hooks/UseAnimation";
import {useHistory} from "react-router-native";
import Easing from "../Animations";

type ValueUpdateCallback<V> = (newValue: V) => void;
class ObservableValue<V> {
    private readonly listener: ValueUpdateCallback<V>[];
    private currentValue: V;

    constructor(initialValue: V) {
        this.currentValue = initialValue;
        this.listener = [];
    }

    getValue() { return this.currentValue; }
    setValue(newValue: V) {
        if(newValue === this.currentValue) {
            return;
        }

        this.currentValue = newValue;
        this.triggerUpdate();
    }

    registerListener(listener: ValueUpdateCallback<V>) : () => void {
        this.listener.push(listener);
        return () => this.removeListener(listener);
    }

    removeListener(listener: ValueUpdateCallback<V>) {
        const index = this.listener.indexOf(listener);
        if(index === -1) {
            return;
        }

        this.listener.splice(1);
    }

    triggerUpdate() {
        for(const listener of [...this.listener]) {
            listener(this.currentValue);
        }
    }

    use() : V {
        const [ value, setValue ] = useState<V>(this.currentValue);
        useEffect(() => this.registerListener(setValue), [ ]);
        return value;
    }
}

type SettingsState = {
    settingRefs: { [key: string]: Setting },
    originalValues: { [key: string]: any },
    changedValues: { [key: string]: ObservableValue<any | typeof kUnchangedValue | typeof kValueEditing> },
    changedValueCount: ObservableValue<number>
    invalidValueCount: ObservableValue<number>
}
const kUnchangedValue = Symbol("unedited-value");
const kValueEditing = Symbol("changed-unknown-value");
const StateContext = React.createContext<SettingsState>(undefined as any);

function useEditableSetting<V>(setting: Setting<V>) : [ currentValue: V | typeof kValueEditing, setValue: (newValue: V | typeof kValueEditing) => void, originalValue: V ] {
    const { settingRefs, originalValues, changedValues, changedValueCount, invalidValueCount } = useContext(StateContext);
    if(!(setting.key in originalValues)) {
        settingRefs[setting.key] = setting as any;
        originalValues[setting.key] = AppSettings.getValue(setting);
        changedValues[setting.key] = new ObservableValue<any>(kUnchangedValue);
    }

    let value = changedValues[setting.key].use();
    if(value === kUnchangedValue) {
        value = originalValues[setting.key];
    }

    return [
        value,
        newValue => {
            const originalValue = originalValues[setting.key];
            if(originalValue === newValue) {
                changedValues[setting.key].setValue(kUnchangedValue);
            } else {
                changedValues[setting.key].setValue(newValue);
            }

            let newChangedValueCount = 0, newInvalidValueCount = 0;
            for(const key of Object.keys(changedValues)) {
                switch (changedValues[key].getValue()) {
                    case kUnchangedValue:
                        /* nothing to do */
                        break;

                    case kValueEditing:
                        newInvalidValueCount++;
                        break;

                    default:
                        newChangedValueCount++;
                        break;
                }
            }

            invalidValueCount.setValue(newInvalidValueCount);
            changedValueCount.setValue(newChangedValueCount);
        },
        originalValues[setting.key],
    ]
}

function SettingBase<V>(props: {
    setting: Setting<V>,
    title: string,
    valueConverter: (textValue: string, setting: Setting<V>) => { status: "valid", value: V } | { status: "invalid", message: string },
}) {
    const refInput = useRef<TextInput>(null);
    const [ value, setValue ] = useEditableSetting(props.setting);
    const [ localValue, setLocalValue ] = useState<string | typeof kUnchangedValue>(kUnchangedValue);
    const [ valueValid, setValueValid ] = useState<string | null>(null);

    const isInvalid = value === kValueEditing && localValue !== kUnchangedValue && !!valueValid;
    const textValue = value === kValueEditing ? localValue === kUnchangedValue ? "value error" : localValue : (value as any).toString();
    return (
        <View style={{ maxWidth: 300 }}>
            <Text style={style.inputLabel}>
                {props.title}
            </Text>
            <TextInput
                ref={refInput}
                style={[style.input, isInvalid && { borderColor: "#rgb(232, 48, 48)" }]}
                placeholder={"0.5"}

                value={textValue}
                onKeyPress={event => {
                    if(event.nativeEvent.key === "Enter") {
                        refInput.current?.blur();
                    }
                }}
                onChange={event => {
                    setValue(kValueEditing);
                    setValueValid(null);
                    setLocalValue(event.nativeEvent.text);
                }}
                onBlur={() => {
                    if(localValue === kUnchangedValue || value !== kValueEditing) {
                        return;
                    }

                    const result = props.valueConverter(localValue, props.setting);
                    if(result.status === "invalid") {
                        setValueValid(result.message);
                        refInput.current?.focus();
                        return;
                    }

                    setLocalValue(kUnchangedValue);
                    setValue(result.value);
                }}
            />
            <Text style={style.inputError} numberOfLines={1}>
                {isInvalid ? valueValid : " "}
            </Text>
        </View>
    );
}

const SettingNumber = React.memo((props: {
    setting: Setting<number>,
    title: string
}) => (
    <SettingBase
        setting={props.setting}
        title={props.title}
        valueConverter={(text, setting) => {
            if(!text.match(/^[0-9]+(\.[0-9]+)?$/g)) {
                return { status: "invalid", message: "value is not a number" };
            }

            const newValue = parseFloat(text);
            const invalidReason = Setting.validateSettingValue(setting as any, newValue);
            if(invalidReason) {
                return { status: "invalid", message: invalidReason };
            }

            return { status: "valid", value: newValue };
        }}
    />
));

const SettingString = React.memo((props: {
    setting: Setting<string>,
    title: string
}) => (
    <SettingBase
        setting={props.setting}
        title={props.title}
        valueConverter={(newValue, setting) => {
            const invalidReason = Setting.validateSettingValue(setting as any, newValue);
            if(invalidReason) {
                return { status: "invalid", message: invalidReason };
            }

            return { status: "valid", value: newValue };
        }}
    />
));

const SettingServerAddress = React.memo(() => (
    <SettingString
        setting={Setting.WebProxyServerAddress}
        title={"WebProxy Server Address"}
    />
));

const SettingPreviewOpacity = React.memo(() => (
    <SettingNumber
        setting={Setting.PreviewOpacity}
        title={"Preview Opacity"}
    />
));

export const PageSettings = React.memo(() => {
    const state: SettingsState = {
        settingRefs: {},
        originalValues: {},
        changedValues: {},
        changedValueCount: new ObservableValue(0),
        invalidValueCount: new ObservableValue(0)
    };

    return (
        <StateContext.Provider value={state}>
            <View style={style.container}>
                <SettingServerAddress />
                <SettingPreviewOpacity />
                <ChangeIndicator />
            </View>
        </StateContext.Provider>
    )
});

const ChangeIndicatorButton = React.memo((props: {
    onPress: () => void,
    type: "reset" | "save",
    children: React.ReactNode,
    disabled?: boolean
}) => (
    <TouchableWithoutFeedback
        onPress={() => {
            if(props.disabled) {
                return;
            }

            props.onPress();
        }}
    >
        <HoverAnimatedView
            duration={200}
            hoverStyle={animation => [
                style.changedButton,
                {
                    backgroundColor: animation.interpolate([0, 100], props.type === "reset" ? ["#00000000", "#0000001f"] : [ props.disabled ? "#136c16" : "#17821b", "#136c16"])
                }
            ]}
        >
            <Text style={[style.changedButtonText, { color: props.type === "reset" ? "#e83030" : "#fff" }]}>
                {props.children}
            </Text>
        </HoverAnimatedView>
    </TouchableWithoutFeedback>
))

const ChangeIndicator = React.memo(() => {
    const { settingRefs, changedValues, changedValueCount, originalValues, invalidValueCount } = useContext(StateContext);
    const invalidCount = invalidValueCount.use();
    const changeCount = changedValueCount.use() + invalidCount; /* Add invalid changes as well */
    const animationShow = useAnimation(SimpleAnimatedValue, 0);
    const animationWiggle = useAnimation(SimpleAnimatedValue, 0);

    const history = useHistory();

    useEffect(() => {
        Animated.timing(animationShow, {
            duration: 250,
            easing: Easing.easeInOut,
            useNativeDriver: false,
            toValue: changeCount > 0 ? 100 : 0
        }).start();

        if(changeCount > 0) {
            return history.block(() => {
                animationWiggle.setValue(0);
                Animated.timing(animationWiggle, {
                    toValue: 100,
                    easing: Easing.linear,
                    duration: 450,
                    useNativeDriver: false
                }).start();

                return false;
            });
        }
    }, [ changeCount ]);

    return (
        <Animated.View
            style={[
                style.changeIndicator,
                {
                    bottom: animationShow.interpolate([ 0, 100 ], [ -50, 20 ]),
                }
            ]}
        >
            <Animated.View
                style={[
                    style.changeIndicatorInner,
                    {
                        marginLeft: animationWiggle.interpolate([ 0, 20, 40, 60, 80, 100 ], [ 0, -50, 50, -25, 25, 0 ]),
                        backgroundColor: animationWiggle.interpolate([ 0, 50, 100 ], [ '#222222', '#a11212', '#222222' ])
                    }
                ]}
            >
                <Text style={style.indicatorText}>Settings changed</Text>
                <View style={style.containerButtons}>
                    <ChangeIndicatorButton
                        onPress={() => {
                            for(const key of Object.keys(changedValues)) {
                                changedValues[key].setValue(kUnchangedValue);
                            }

                            invalidValueCount.setValue(0);
                            changedValueCount.setValue(0);
                        }}
                        type={"reset"}
                    >
                        Reset
                    </ChangeIndicatorButton>
                    <ChangeIndicatorButton
                        onPress={() => {
                            for(const key of Object.keys(changedValues)) {
                                const value = changedValues[key].getValue();
                                if(value === kUnchangedValue || value === kValueEditing) {
                                    continue;
                                }

                                AppSettings.setValue(settingRefs[key], value);
                                originalValues[key] = AppSettings.getValue(settingRefs[key]);

                                changedValues[key].setValue(kUnchangedValue);
                            }

                            changedValueCount.setValue(0);
                        }}
                        disabled={invalidCount > 0}
                        type={"save"}
                    >
                        Save
                    </ChangeIndicatorButton>
                </View>
            </Animated.View>
        </Animated.View>
    )
});

const style = StyleSheet.create({
    container: {
        position: "relative",

        flex: 1,

        display: "flex",
        flexDirection: "column",

        backgroundColor: "#000",
        padding: 10
    },

    input: {
        borderRadius: 3,
        borderColor: "#333",
        borderWidth: 1,
        padding: 5,
        color: "#fff"
    },

    inputLabel: {
        color: "#fff",
        fontSize: 16,
        marginBottom: 5
    },

    inputError: {
        color: "#rgb(232, 48, 48)",
        fontSize: 12,
        textAlign: "right"
    },

    changeIndicator: {
        position: "absolute",
        bottom: 20,
        left: 20,
        right: 20,

        display: "flex",
        flexDirection: "row",
        justifyContent: "center"
    },

    changeIndicatorInner: {
        padding: 10,

        flex: 1,
        maxWidth: 450,

        backgroundColor: "#222",
        borderRadius: 3,

        flexDirection: "row",
        justifyContent: "space-between"
    },

    containerButtons: {
        flexDirection: "row"
    },

    indicatorText: {
        color: "#fff",
        alignSelf: "center"
    },

    changedButton: {
        width: 80,
        borderRadius: 2,
        cursor: "pointer",
        textAlign: "center",
        marginLeft: 10,
    },

    changedButtonText: {
        padding: 5,
        color: "#fff"
    }
});
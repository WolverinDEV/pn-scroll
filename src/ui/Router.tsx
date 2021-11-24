import React from "react";
import { PlatformRouter } from "./SetupPlatform";

export const AppRouter = (props: { children: React.ReactNode }) => (
    <PlatformRouter>
        {props.children}
    </PlatformRouter>
)

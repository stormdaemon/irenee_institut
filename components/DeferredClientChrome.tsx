"use client";
import dynamic from "next/dynamic";
const OnboardingGate=dynamic(()=>import("./OnboardingGate").then(m=>m.OnboardingGate),{ssr:false});
export function DeferredClientChrome(){return <OnboardingGate/>}

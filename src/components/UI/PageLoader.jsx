import { useEffect, useState } from "react";
import {Spinner} from "./Spinner.jsx";

export function PageLoader({ message = "Cargando"}) {
    const [dots, setDots] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            setDots((prev) => {
                if (prev.length >= 3) return "";
                return prev + ".";
            });
        }, 500);
        return () => clearInterval(interval);
    }, [])
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/30 backdrop-blur-md animate-fade-in">
            <Spinner size="xl"/>
            <p className="text-sm text-muted-foreground">
                {message}
                <span className="inline-block w-6 text-left">
                    {dots}
                </span>
            </p>
        </div>
    );
}
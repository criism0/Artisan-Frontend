
export function Spinner({ size = "md", label = "Cargando..." }) {
    const sizes = {
        sm: "h-5 w-5 border-2",
        md: "h-9 w-9 border-4",
        lg: "h-14 w-14 border-6",
        xl: "h-20 w-20 border-8"
    };

    return (
        <div role="status" className="flex flex-col items-center gap-3">
        <div
            className={`
                ${sizes[size]}
                animate-spin rounded-full
                border-4 border-primary
                border-t-transparent
            `}
        />
        { label && (
            <span className="text-sm text-muted-foreground sr-only">{label}</span>
        )}
        </div>
    );
};

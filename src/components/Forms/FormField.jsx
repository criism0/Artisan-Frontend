/**
 * FormField - Componente reutilizable para inputs en formularios wizard
 * Soporta: text, number, email, password, select, textarea
 * Incluye validación en tiempo real y styling uniforme
 */

export default function FormField({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  onBlur,
  disabled = false,
  required = false,
  readOnly = false,
  error,
  helperText,
  options = [], // para select
  containerClassName = "",
  inputClassName = "",
}) {
  const hasError = Boolean(error);

  const baseInputClass =
    "w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition-colors";

  const inputStateClass = readOnly
    ? "bg-gray-50 text-gray-600 cursor-not-allowed"
    : hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:border-primary focus:ring-primary";

  const inputDisabledClass = disabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "";

  const finalInputClass = `${baseInputClass} ${inputStateClass} ${inputDisabledClass} ${inputClassName}`;

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {type === "select" ? (
        <select
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled || readOnly}
          required={required}
          className={finalInputClass}
        >
          <option value="">Seleccionar...</option>
          {Array.isArray(options) &&
            options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled || readOnly}
          required={required}
          className={`${finalInputClass} min-h-[100px] resize-vertical`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled || readOnly}
          required={required}
          className={finalInputClass}
        />
      )}

      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
      {helperText && !error && <span className="text-xs text-gray-500">{helperText}</span>}
    </div>
  );
}

import { useState, useCallback } from "react";

/**
 * useWizardState - Hook centralizado para manejar estado del wizard
 * Centraliza: form data, errores, validación y transiciones de estado
 */

export function useWizardState(initialForm = {}) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Actualizar un campo del formulario
  const setField = useCallback((fieldName, value) => {
    setForm((prev) => ({ ...prev, [fieldName]: value }));
    // Limpiar error del campo cuando el usuario lo edita
    if (errors[fieldName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }, [errors]);

  // Marcar campo como tocado (para mostrar errores)
  const setFieldTouched = useCallback((fieldName, isTouched = true) => {
    setTouched((prev) => ({ ...prev, [fieldName]: isTouched }));
  }, []);

  // Establecer error de un campo específico
  const setFieldError = useCallback((fieldName, errorMsg) => {
    setErrors((prev) => ({ ...prev, [fieldName]: errorMsg }));
  }, []);

  // Establecer múltiples errores
  const setFieldErrors = useCallback((errorsObj) => {
    setErrors((prev) => ({ ...prev, ...errorsObj }));
  }, []);

  // Limpiar todos los errores
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Resetear formulario
  const resetForm = useCallback((newInitial = initialForm) => {
    setForm(newInitial);
    setErrors({});
    setTouched({});
  }, [initialForm]);

  // Validar un campo según reglas
  const validateField = useCallback(
    (fieldName, value, rules) => {
      if (!rules) return null;

      if (rules.required && (!value || String(value).trim() === "")) {
        return `${rules.label || fieldName} es requerido`;
      }

      if (rules.type === "number" && value) {
        const num = Number(value);
        if (isNaN(num)) {
          return `${rules.label || fieldName} debe ser un número válido`;
        }
        if (rules.min !== undefined && num < rules.min) {
          return `${rules.label || fieldName} debe ser mayor o igual a ${rules.min}`;
        }
        if (rules.max !== undefined && num > rules.max) {
          return `${rules.label || fieldName} debe ser menor o igual a ${rules.max}`;
        }
      }

      if (rules.type === "email" && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return `${rules.label || fieldName} no es un email válido`;
        }
      }

      if (rules.minLength && value && String(value).length < rules.minLength) {
        return `${rules.label || fieldName} debe tener al menos ${rules.minLength} caracteres`;
      }

      if (rules.maxLength && value && String(value).length > rules.maxLength) {
        return `${rules.label || fieldName} debe tener como máximo ${rules.maxLength} caracteres`;
      }

      if (rules.custom && typeof rules.custom === "function") {
        return rules.custom(value);
      }

      return null;
    },
    []
  );

  // Validar todo el formulario
  const validateForm = useCallback(
    (validationRules) => {
      const newErrors = {};

      Object.entries(validationRules).forEach(([fieldName, rules]) => {
        const error = validateField(fieldName, form[fieldName], rules);
        if (error) {
          newErrors[fieldName] = error;
        }
      });

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [form, validateField]
  );

  return {
    form,
    setForm,
    setField,
    errors,
    setFieldError,
    setFieldErrors,
    clearErrors,
    touched,
    setFieldTouched,
    resetForm,
    validateField,
    validateForm,
  };
}

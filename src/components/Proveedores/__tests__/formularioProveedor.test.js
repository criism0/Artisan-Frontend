import { describe, it, expect } from "vitest";
import {
  FORM_PROVEEDOR_VACIO,
  aplicarMedioDePago,
  payloadProveedor,
  validarProveedor,
} from "../formularioProveedor";

const base = { ...FORM_PROVEEDOR_VACIO, nombre_empresa: "Proveedor SA", rut_empresa: "76.123.456-7" };

describe("validarProveedor", () => {
  it("sólo razón social, RUT y medio de pago son obligatorios", () => {
    const e = validarProveedor({ ...FORM_PROVEEDOR_VACIO });
    expect(Object.keys(e).sort()).toEqual(["banco", "nombre_empresa", "rut_empresa"]);
  });

  it("un banco normal exige cuenta, tipo y correo", () => {
    const e = validarProveedor({ ...base, banco: "Banco Estado" });
    expect(Object.keys(e).sort()).toEqual(["cuenta", "cuenta_corriente", "email_transferencia"]);
  });

  it("Webpay NO pide cuenta ni correo: pide el sitio web", () => {
    const form = aplicarMedioDePago(base, "Webpay");
    expect(Object.keys(validarProveedor(form))).toEqual(["sitio_web"]);
    expect(validarProveedor({ ...form, sitio_web: "https://tienda.cl" })).toEqual({});
  });

  it("el formato del RUT sólo se exige al crear", () => {
    const form = { ...aplicarMedioDePago(base, "Webpay"), sitio_web: "x.cl", rut_empresa: "761234567" };
    expect(validarProveedor(form, { rutEstricto: true }).rut_empresa).toBeTruthy();
    expect(validarProveedor(form).rut_empresa).toBeUndefined();
  });

  it("un teléfono corto se rechaza, pero vacío es válido", () => {
    const form = { ...aplicarMedioDePago(base, "Webpay"), sitio_web: "x.cl" };
    expect(validarProveedor({ ...form, telefono: "123" }).telefono).toBeTruthy();
    expect(validarProveedor({ ...form, telefono: "" }).telefono).toBeUndefined();
  });
});

describe("aplicarMedioDePago / payloadProveedor", () => {
  it("al volver de Webpay a un banco se limpian los «-»", () => {
    const web = aplicarMedioDePago(base, "Webpay");
    const banco = aplicarMedioDePago(web, "Banco Estado");
    expect(banco.cuenta_corriente).toBe("");
    expect(banco.cuenta).toBe("");
    expect(banco.email_transferencia).toBe("");
  });

  it("Webpay manda «-» en la cuenta y conserva el sitio", () => {
    const p = payloadProveedor({ ...aplicarMedioDePago(base, "Webpay"), sitio_web: "https://tienda.cl" });
    expect(p).toMatchObject({ cuenta_corriente: "-", cuenta: "-", email_transferencia: "-", sitio_web: "https://tienda.cl" });
  });

  it("un tipo de proveedor vacío no se manda (el backend lo rechaza vacío)", () => {
    expect("tipo_proveedor" in payloadProveedor({ ...base, banco: "Banco Estado" })).toBe(false);
    expect(payloadProveedor({ ...base, tipo_proveedor: " Leche " }).tipo_proveedor).toBe("Leche");
  });
});

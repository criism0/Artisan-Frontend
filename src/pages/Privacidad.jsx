/**
 * Política de privacidad pública (2026-11-19): la pide Apple para publicar la app móvil en la App
 * Store, y vale también para la web. Sin sesión: se abre desde la ficha de la app.
 */
const ACTUALIZADA = "19 de noviembre de 2026";

function Seccion({ titulo, children }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
      <div className="mt-2 space-y-2 text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

export default function Privacidad() {
  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">Política de privacidad de Artisan</h1>
        <p className="mt-1 text-sm text-gray-500">Actualizada el {ACTUALIZADA}</p>

        <p className="mt-6 text-gray-700 leading-relaxed">
          Artisan es el sistema de gestión interno de Elaboradora de Alimentos Gourmet Ltda. (Santiago, Chile). La web y la
          app móvil las usa sólo el personal de la empresa, con una cuenta que crea un administrador: no hay registro abierto
          al público. Esta política explica qué datos maneja el sistema y para qué.
        </p>

        <Seccion titulo="Qué datos se guardan">
          <p>
            De cada usuario, el nombre, el correo de trabajo y el rol, que deciden a qué partes del sistema tiene acceso. Del
            trabajo diario, lo que el propio usuario registra: pedidos, inventario, despachos y entregas, con la fecha, la hora
            y quién lo hizo.
          </p>
          <p>
            Las fotos que se toman en la app (pedidos armados, carga del camión, documentos firmados y entregas) quedan
            guardadas como respaldo de la operación. De los clientes de la empresa se guardan los datos comerciales necesarios
            para venderles y despacharles: razón social, RUT, direcciones de despacho y contacto.
          </p>
        </Seccion>

        <Seccion titulo="Para qué se usa la cámara">
          <p>
            La app usa la cámara sólo cuando el usuario la abre, para escanear los códigos QR de los bultos y para tomar las
            fotos de despachos y entregas. No graba audio ni video, no usa la ubicación del teléfono y no accede a otras fotos
            del dispositivo.
          </p>
        </Seccion>

        <Seccion titulo="Con quién se comparte">
          <p>
            Con nadie fuera de la empresa, salvo los servicios que el sistema necesita para funcionar: el alojamiento de los
            datos y de las fotos (Amazon Web Services) y la emisión de documentos tributarios ante el Servicio de Impuestos
            Internos. Los datos no se venden ni se usan para publicidad, y la app no incluye herramientas de seguimiento ni de
            publicidad de terceros.
          </p>
        </Seccion>

        <Seccion titulo="Cuánto tiempo se guardan">
          <p>
            Los registros de la operación y los documentos tributarios se conservan mientras lo exija la ley y la gestión de la
            empresa. Una cuenta de usuario se desactiva cuando la persona deja de trabajar con Artisan.
          </p>
        </Seccion>

        <Seccion titulo="Seguridad">
          <p>
            La comunicación entre la app, la web y el servidor va cifrada (HTTPS). El acceso exige usuario y contraseña, y cada
            rol ve sólo lo que le corresponde.
          </p>
        </Seccion>

        <Seccion titulo="Contacto">
          <p>
            Para consultar, corregir o eliminar datos personales, o por cualquier duda sobre esta política, escribe a{" "}
            <a className="text-primary underline" href="mailto:proyectos@artisan.cl">proyectos@artisan.cl</a>.
          </p>
        </Seccion>
      </article>
    </main>
  );
}

# Ficha

CRM para entrenadores personales en Perú. Un solo archivo estático, sin build.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La aplicación completa |
| `supabase.sql` | El esquema de base de datos, se pega una vez |
| `icon.svg` | Ícono de la app |
| `manifest.webmanifest` | Permite instalarla en el celular |

## Dos modos

Ficha arranca en **modo local**: cada cuenta vive en el navegador de quien la crea.
Sirve para probar y para mandar demos. En la pantalla de entrada dice "Modo local".

Cuando pegas las claves de Supabase pasa a **modo nube**: cuentas reales,
recuperación de contraseña y los mismos datos en celular y laptop.
La pantalla de entrada pasa a decir "Cuenta en la nube".

## Conectar Supabase, paso a paso

**1. Crea el proyecto.** Entra a supabase.com, New project. Elige la región
`South America (São Paulo)`, que es la más cercana a Perú. Guarda la contraseña
de la base de datos que te pide.

**2. Corre el esquema.** Menú SQL Editor, New query, pega todo `supabase.sql`, Run.
Debe decir "Success". Esto crea la tabla y las políticas de seguridad que hacen
que cada entrenador solo vea su propia cartera.

**3. Copia las dos claves.** Project Settings, API. Necesitas:
- Project URL, algo como `https://abcdefgh.supabase.co`
- La clave pública (`anon` / `publishable`). Es segura de poner en el HTML:
  sin las políticas del paso 2 no sirve para nada.

**4. Pégalas en `index.html`.** Están al inicio del bloque `<script>`, busca
`SUPABASE_URL`. Quedan así:

```js
const SUPABASE_URL = "https://abcdefgh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOi...";
```

**5. Configura el correo.** Authentication, Providers, Email. Deja
"Confirm email" activado para producción. Para probar rápido, apágalo y las
cuentas entran de una.

**6. Autoriza tu dominio.** Authentication, URL Configuration. Pon tu URL de
Cloudflare Pages en Site URL y en Redirect URLs. Sin esto, el enlace de
recuperación de contraseña no funciona.

## Desplegar

**Cloudflare Pages.** Gratis, ancho de banda ilimitado y permite uso comercial.
Entra a dash.cloudflare.com, Workers & Pages, Create, Pages, Upload assets,
arrastra esta carpeta.

**No uses Vercel Hobby.** Sus Fair Use Guidelines dicen que el plan gratuito es
solo para uso personal no comercial y que vender algo requiere Pro, 20 USD al mes.

## Probar en local

```
npx serve .
```

## Instalar en el celular

Abre la URL en Chrome o Safari y elige "Agregar a pantalla de inicio".
Se abre a pantalla completa, sin barra del navegador.

## Costos reales

| Servicio | Plan | Costo |
|---|---|---|
| Cloudflare Pages | Free | S/ 0 |
| Supabase | Free: 500 MB, 50,000 usuarios activos | S/ 0 |
| Supabase | Pro, cuando crezcas | 25 USD al mes |

Ojo con el plan gratis de Supabase: **los proyectos sin actividad se pausan a la
semana**. Con clientes reales usándolo a diario no pasa, pero si lo dejas quieto
un tiempo tienes que reactivarlo a mano desde el panel.

Cada entrenador ocupa unos pocos KB en la base. Con 500 MB entran miles.

## Cómo está guardado

Todo el CRM de un entrenador es un solo JSON en la columna `datos` de su fila.
Simple de leer, de respaldar y de migrar. Si algún día necesitas consultas
cruzadas (por ejemplo, cuánto factura toda la plataforma), ahí sí conviene
normalizar en tablas separadas.

Los datos también quedan en el navegador como copia. Si te quedas sin internet
sigues viendo tu cartera, y al volver la conexión se sincroniza.

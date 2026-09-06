#!/usr/bin/env node
/**
 * Ficha · configuracion automatica de Supabase
 *
 * Uso:
 *   SUPABASE_TOKEN=sbp_xxx node setup-supabase.cjs
 *
 * Que hace, en orden:
 *   1. Busca tu organizacion
 *   2. Reusa el proyecto "ficha" si existe, o lo crea en Sao Paulo
 *   3. Espera a que la base este lista
 *   4. Corre supabase.sql (tabla + politicas de seguridad)
 *   5. Baja la clave publica
 *   6. La pega en index.html
 *
 * El token NUNCA se guarda en disco. Sale del entorno y muere con el proceso.
 */
const fs = require("fs");
const path = require("path");

const API = "https://api.supabase.com/v1";
const TOKEN = process.env.SUPABASE_TOKEN;
const NOMBRE = process.env.SUPABASE_PROJECT || "ficha";
const REGION = process.env.SUPABASE_REGION || "sa-east-1"; // Sao Paulo, lo mas cerca de Peru
const DIR = __dirname;

if (!TOKEN) {
  console.error("\nFalta el token.\n");
  console.error("  1. Entra a https://supabase.com/dashboard/account/tokens");
  console.error("  2. Generate new token, ponle el nombre que quieras");
  console.error("  3. Corre:  SUPABASE_TOKEN=sbp_xxx node setup-supabase.cjs\n");
  process.exit(1);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(ruta, opciones = {}) {
  const res = await fetch(API + ruta, {
    ...opciones,
    headers: {
      Authorization: "Bearer " + TOKEN,
      "Content-Type": "application/json",
      ...(opciones.headers || {}),
    },
  });
  const texto = await res.text();
  let cuerpo = null;
  try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = texto; }
  if (!res.ok) {
    const detalle = cuerpo && cuerpo.message ? cuerpo.message : texto.slice(0, 300);
    throw new Error(`${res.status} en ${ruta}: ${detalle}`);
  }
  return cuerpo;
}

function clave(n) {
  const abc = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
}

(async () => {
  console.log("\n=== Ficha · configuracion de Supabase ===\n");

  // 1. organizacion
  const orgs = await api("/organizations");
  if (!orgs.length) throw new Error("Tu cuenta no tiene ninguna organizacion.");
  const org = process.env.SUPABASE_ORG
    ? orgs.find((o) => o.slug === process.env.SUPABASE_ORG || o.name === process.env.SUPABASE_ORG)
    : orgs[0];
  if (!org) throw new Error("No encontre esa organizacion.");
  console.log(`Organizacion: ${org.name}  (${org.slug})`);
  if (orgs.length > 1) console.log(`  Hay ${orgs.length}. Para usar otra: SUPABASE_ORG=<slug>`);

  // 2. proyecto
  const proyectos = await api("/projects");
  let proy = proyectos.find((p) => p.name === NOMBRE && p.organization_id === org.id);
  let dbPass = null;

  if (proy) {
    console.log(`Proyecto: ${proy.name} ya existe (${proy.id}), lo reuso.`);
  } else {
    dbPass = clave(24);
    console.log(`Creando proyecto "${NOMBRE}" en ${REGION}...`);
    proy = await api("/projects", {
      method: "POST",
      body: JSON.stringify({
        name: NOMBRE,
        organization_slug: org.slug,
        db_pass: dbPass,
        region: REGION,
        plan: "free",
      }),
    });
    console.log(`Creado: ${proy.id}`);
    console.log("\n  >>> GUARDA ESTA CONTRASENA DE LA BASE, no se vuelve a mostrar:");
    console.log("  >>> " + dbPass + "\n");
  }

  // 3. esperar a que este sana
  process.stdout.write("Esperando a que la base arranque");
  let estado = proy.status;
  for (let i = 0; i < 60 && estado !== "ACTIVE_HEALTHY"; i++) {
    await dormir(5000);
    process.stdout.write(".");
    try {
      const p = await api(`/projects/${proy.id}`);
      estado = p.status;
    } catch { /* todavia no responde */ }
  }
  console.log("");
  if (estado !== "ACTIVE_HEALTHY") {
    console.log(`Sigue en estado "${estado}". Espera unos minutos y vuelve a correr esto.`);
    process.exit(1);
  }
  console.log("Base lista.");

  // 4. esquema
  const sql = fs.readFileSync(path.join(DIR, "supabase.sql"), "utf8");
  console.log("Corriendo supabase.sql...");
  await api(`/projects/${proy.id}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: sql }),
  });
  const pol = await api(`/projects/${proy.id}/database/query`, {
    method: "POST",
    body: JSON.stringify({
      query: "select policyname from pg_policies where tablename = 'entrenadores' order by policyname;",
    }),
  });
  const nombres = (Array.isArray(pol) ? pol : []).map((r) => r.policyname);
  console.log(`Tabla y politicas creadas: ${nombres.length ? nombres.join(", ") : "(revisa el panel)"}`);
  if (nombres.length !== 4) console.log("  Ojo: esperaba 4 politicas. Revisa el SQL Editor.");

  // 5. clave publica
  const keys = await api(`/projects/${proy.id}/api-keys`);
  const pub =
    keys.find((k) => k.type === "publishable") ||
    keys.find((k) => k.name === "anon") ||
    keys.find((k) => /anon|publishable/i.test(k.name || ""));
  if (!pub || !pub.api_key) throw new Error("No pude leer la clave publica del proyecto.");
  const url = `https://${proy.id}.supabase.co`;
  console.log(`URL:   ${url}`);
  console.log(`Clave: ${pub.api_key.slice(0, 14)}...  (${pub.name || pub.type})`);

  // 6. pegarlas en index.html
  const archivo = path.join(DIR, "index.html");
  let html = fs.readFileSync(archivo, "utf8");
  const antes = html;
  html = html
    .replace(/const SUPABASE_URL = "[^"]*";/, `const SUPABASE_URL = "${url}";`)
    .replace(/const SUPABASE_KEY = "[^"]*";/, `const SUPABASE_KEY = "${pub.api_key}";`);
  if (html === antes) {
    console.log("\nNo encontre las lineas de configuracion en index.html. Pegalas a mano:");
    console.log(`  const SUPABASE_URL = "${url}";`);
    console.log(`  const SUPABASE_KEY = "${pub.api_key}";`);
  } else {
    fs.writeFileSync(archivo, html);
    console.log("index.html actualizado.");
  }

  console.log("\n=== Listo ===");
  console.log("Falta solo esto, que se hace desde el panel:");
  console.log(`  1. Authentication > URL Configuration: pon la URL de tu sitio`);
  console.log(`     en Site URL y en Redirect URLs (si no, el correo de recuperacion no vuelve).`);
  console.log(`  2. Authentication > Providers > Email: para probar rapido, apaga "Confirm email".`);
  console.log(`\n  Panel: https://supabase.com/dashboard/project/${proy.id}\n`);
  console.log("Y borra el token que usaste:");
  console.log("  https://supabase.com/dashboard/account/tokens\n");
})().catch((e) => {
  console.error("\nFallo: " + e.message + "\n");
  process.exit(1);
});

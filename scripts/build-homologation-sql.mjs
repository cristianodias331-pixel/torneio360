import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseline = resolve(root, "supabase/homologation/000000000000_initial_schema.sql");
const migrationsDirectory = resolve(root, "supabase/migrations");
const output = resolve(root, "tmp/torneio360-homologation.sql");

const migrationFiles = (await readdir(migrationsDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right));

const sections = [
  "-- Torneio360 - banco vazio de homologação",
  "-- Não contém dados da produção.",
  await readFile(baseline, "utf8"),
];

for (const migrationFile of migrationFiles) {
  sections.push(`\n-- Início: ${migrationFile}\n`);
  sections.push(await readFile(resolve(migrationsDirectory, migrationFile), "utf8"));
  sections.push(`\n-- Fim: ${migrationFile}\n`);
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, sections.join("\n"), "utf8");

console.log(`SQL de homologação criado em ${output}`);
console.log(`${migrationFiles.length} migrações incluídas após a estrutura inicial.`);

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const conventions = {
  feature: { prefix: "feature", types: ["feat"] },
  bug: { prefix: "bug", types: ["fix"] },
  documentation: { prefix: "documentation", types: ["docs"] },
  enhancement: { prefix: "enhancement", types: ["feat", "perf", "refactor"] },
  maintenance: { prefix: "maintenance", types: ["chore", "refactor", "build", "ci", "test"] },
  "UI/UX": { prefix: "ui-ux", types: ["style", "feat", "fix"] },
};

export function validateConventions({ branch, labels, subjects }) {
  const errors = [];
  const primary = Object.entries(conventions).find(([, rule]) =>
    branch.startsWith(`${rule.prefix}/`),
  );
  if (!primary || !/^[a-z-]+\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branch)) {
    errors.push("Branch deve usar um prefixo documentado e descrição em kebab-case.");
  }
  for (const label of labels) {
    if (!Object.hasOwn(conventions, label)) errors.push(`Label desconhecida: ${label}`);
  }
  if (primary && !labels.includes(primary[0])) {
    errors.push(`A branch ${branch} exige a label ${primary[0]}.`);
  }
  const types = new Set(labels.flatMap(label => conventions[label]?.types ?? []));
  if (subjects.length === 0) errors.push("Informe um título ou ao menos um commit para validar.");
  for (const subject of subjects) {
    const match = /^([a-z]+)(?:\([a-z0-9-]+\))?!?: (\S.*)$/.exec(subject);
    if (!match || !types.has(match[1])) {
      errors.push(`Commit/título incompatível com as labels: ${subject}`);
    }
  }
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--branch", "--labels", "--base", "--title"].includes(args[i]) || !args[i + 1]) {
      throw new Error("Uso: --labels maintenance,documentation [--base origin/main] [--title \"chore: descrição\"] [--branch maintenance/descricao]");
    }
    options[args[i].slice(2)] = args[i + 1];
  }
  if (!options.labels) throw new Error("Informe --labels com as labels reais/propostas do PR.");
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const branch = options.branch ?? git("branch", "--show-current");
  const labels = options.labels.split(",").map(label => label.trim());
  const subjects = options.title ? [options.title] : [];
  if (options.base) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(options.base)) throw new Error("Base Git inválida.");
    const commits = git("log", "--no-merges", "--format=%s", `${options.base}..HEAD`, "--");
    if (commits) subjects.push(...commits.split("\n"));
  }
  const errors = validateConventions({ branch, labels, subjects });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Convenção válida: ${branch}; labels ${labels.join(", ")}; ${subjects.length} título(s)/commit(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

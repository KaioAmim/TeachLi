import test from "node:test";
import assert from "node:assert/strict";
import { validateConventions } from "./check-conventions.mjs";

test("aceita manutenção e documentação na mesma revisão", () => {
  assert.deepEqual(validateConventions({ branch: "maintenance/limpeza-repositorio", labels: ["maintenance", "documentation"], subjects: ["chore: limpar arquivos", "docs: explicar estrutura"] }), []);
});
test("rejeita feature sem a label correspondente", () => {
  assert.notEqual(validateConventions({ branch: "feature/salas", labels: ["maintenance"], subjects: ["chore: criar salas"] }).length, 0);
});
test("rejeita commit incompatível com a classificação", () => {
  assert.notEqual(validateConventions({ branch: "bug/camera", labels: ["bug"], subjects: ["feat: adicionar salas"] }).length, 0);
});
test("aceita UI/UX com prefixo seguro para branch", () => {
  assert.deepEqual(validateConventions({ branch: "ui-ux/contraste", labels: ["UI/UX"], subjects: ["style(aluno): ajustar contraste"] }), []);
});
test("rejeita branches antigas, labels desconhecidas e validações vazias", () => {
  assert.notEqual(validateConventions({ branch: "feat/ProjetoAlteradov1.1", labels: ["feature"], subjects: ["feat: exemplo"] }).length, 0);
  assert.notEqual(validateConventions({ branch: "feature/salas", labels: ["feature", "unknown"], subjects: ["feat: salas"] }).length, 0);
  assert.notEqual(validateConventions({ branch: "feature/salas", labels: ["feature"], subjects: [] }).length, 0);
});

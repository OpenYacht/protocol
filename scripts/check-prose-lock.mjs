// Prose↔example lock: the fenced complete-example block in
// spec/listing-schema.md must be byte-identical to examples/valid/sale-full.json.
// The doc keeps its inline example for readability; this guarantees it IS the
// validated file.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const spec = readFileSync(join(root, "spec/listing-schema.md"), "utf8");
const example = readFileSync(join(root, "examples/valid/sale-full.json"), "utf8");

const m = spec.match(/## Complete example \(sale\)\n\n```json\n([\s\S]*?)\n```/);
if (!m) {
  console.error("FAIL  fenced example block not found under '## Complete example (sale)'");
  process.exit(1);
}

// The file ends with a single trailing newline; the fence content does not.
if (m[1] + "\n" !== example) {
  console.error("FAIL  spec/listing-schema.md complete example differs from examples/valid/sale-full.json");
  const fence = (m[1] + "\n").split("\n"), file = example.split("\n");
  for (let i = 0; i < Math.max(fence.length, file.length); i++) {
    if (fence[i] !== file[i]) {
      console.error(`      first difference at line ${i + 1}:`);
      console.error(`      spec: ${JSON.stringify(fence[i])}`);
      console.error(`      file: ${JSON.stringify(file[i])}`);
      break;
    }
  }
  process.exit(1);
}
console.log("ok    prose example is byte-identical to examples/valid/sale-full.json");

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/models/onnx-community/whisper-tiny");
const base = "https://huggingface.co/onnx-community/whisper-tiny/resolve/main";
const files = [
  "config.json",
  "generation_config.json",
  "preprocessor_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "vocab.json",
  "merges.txt",
  "added_tokens.json",
  "normalizer.json",
  "quantize_config.json",
  "onnx/encoder_model_q4.onnx",
  "onnx/decoder_model_merged_q4.onnx",
];

await mkdir(path.join(root, "onnx"), { recursive: true });
await Promise.all(files.map(async (file) => {
  const response = await fetch(`${base}/${file}`);
  if (!response.ok) throw new Error(`${response.status} ${file}`);
  await writeFile(path.join(root, file), Buffer.from(await response.arrayBuffer()));
  console.log(file);
}));

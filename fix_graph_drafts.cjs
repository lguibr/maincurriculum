const fs = require('fs');
let text = fs.readFileSync('src/agent/graph.ts', 'utf8');

const anchor1 = 'async function draftDocs(';
const anchor2 = 'async function critiqueAggregator';

const idx1 = text.indexOf(anchor1);
const idx2 = text.indexOf(anchor2);

if (idx1 !== -1 && idx2 !== -1) {
  text = text.substring(0, idx1) + '\n' + text.substring(idx2);
  text = text.replace('import { critiqueTruth', 'import { draftDocs } from "./draftDocs";\nimport { critiqueTruth');
  fs.writeFileSync('src/agent/graph.ts', text);
}

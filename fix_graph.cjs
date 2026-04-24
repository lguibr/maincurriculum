const fs = require('fs');
let text = fs.readFileSync('src/agent/graph.ts', 'utf8');

const anchor1 = '// -------------------------------------------------------------\n// MULTI-LAYERED CRITIQUES (Run in parallel)\n// -------------------------------------------------------------';

const anchor2 = 'async function compileFeedback(state: AgentStateType, config?: RunnableConfig) {';

const idx1 = text.indexOf(anchor1);
const idx2 = text.indexOf(anchor2);

if (idx1 !== -1 && idx2 !== -1) {
  text = text.substring(0, idx1) + '\n' + text.substring(idx2);
  fs.writeFileSync('src/agent/graph.ts', text);
}

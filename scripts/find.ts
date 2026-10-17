import { rollBirth } from '../src/engine';
const [loc, off] = [process.argv[2], Number(process.argv[3])];
for (let i = 0; i < 400; i++) { const b = rollBirth('mouse', i + 11); if (b.loc === loc && b.startOffset === off) { console.log(i + 11); break; } }

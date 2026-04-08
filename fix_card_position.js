const fs = require('fs');
const filePath = 'frontend/app/dashboard/orcamentos/page.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find key line indices
const SIDEBAR_START = '        <div className="xl:col-span-4 space-y-4">';
const IMAGEM_CARD = '          {/* Card: Imagem do Circuito / Evento */}';
const TERMOS_CARD = '          {/* Card: Termos e Condições */}';

const sidebarLineIdx = lines.findIndex(l => l.trimEnd() === SIDEBAR_START.trimEnd() || l.includes('xl:col-span-4 space-y-4'));
const imagemLineIdx = lines.findIndex(l => l.includes('Card: Imagem do Circuito'));
const termosLineIdx = lines.findIndex(l => l.includes('Card: Termos e Condi'));

console.log('sidebar:', sidebarLineIdx, 'imagem:', imagemLineIdx, 'termos:', termosLineIdx);

if (sidebarLineIdx === -1 || imagemLineIdx === -1 || termosLineIdx === -1) {
  console.error('Não encontrou índices necessários'); process.exit(1);
}

// The cards (Imagem + Termos) are currently between lines imagemLineIdx and sidebarLineIdx-1
// Find where col-span-8 closes (just before imagemLineIdx, skipping blank and comment lines)
let col8CloseIdx = imagemLineIdx - 1;
while (col8CloseIdx > 0 && (lines[col8CloseIdx].trim() === '' || lines[col8CloseIdx].trim().startsWith('{/*'))) {
  col8CloseIdx--;
}
// col8CloseIdx should now point to the </div> of col-span-8
console.log('col8 close line:', col8CloseIdx, JSON.stringify(lines[col8CloseIdx]));

if (lines[col8CloseIdx].trim() !== '</div>') {
  console.error('Esperava </div>, encontrou:', JSON.stringify(lines[col8CloseIdx]));
  process.exit(1);
}

// Extract the two cards block: from imagemLineIdx to sidebarLineIdx (exclusive)
// but find the end of termos card (last non-empty line before sidebar)
let cardsEndIdx = sidebarLineIdx - 1;
while (cardsEndIdx > termosLineIdx && lines[cardsEndIdx].trim() === '') cardsEndIdx--;
// cardsEndIdx now points to last line of Termos card block

const cardsBlock = lines.slice(imagemLineIdx, cardsEndIdx + 1).join('\n');
console.log('Cards block lines:', imagemLineIdx, 'to', cardsEndIdx);

// New structure:
// 1. Everything up to and including the line before col8CloseIdx
// 2. The two cards block  
// 3. The col8 closing </div>
// 4. Blank + comment (whatever was between col8Close and imagemLine - skip corrupted comment)
// 5. The sidebar div and everything after

const part1 = lines.slice(0, col8CloseIdx).join('\n');
const part2 = '\n' + cardsBlock + '\n';
const part3 = '\n' + lines[col8CloseIdx]; // </div>
const part4 = '\n\n        {/* Coluna lateral */}';
const part5 = '\n' + lines.slice(sidebarLineIdx).join('\n');

const newContent = part1 + part2 + part3 + part4 + part5;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Arquivo reorganizado. Tamanho:', newContent.length);

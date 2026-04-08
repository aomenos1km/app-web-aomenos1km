const fs = require('fs');
const f = 'frontend/app/dashboard/orcamentos/page.tsx';
let c = fs.readFileSync(f, 'utf8');

const startMarker = "categoria || '";
const startIdx = c.indexOf(startMarker);
if (startIdx === -1) { console.error('startMarker not found'); process.exit(1); }

const cellEndMarker = '</TableCell>';
const firstCellEnd = c.indexOf(cellEndMarker, startIdx) + cellEndMarker.length;
const secondCellEnd = c.indexOf(cellEndMarker, firstCellEnd) + cellEndMarker.length;

console.log('OLD block:', JSON.stringify(c.substring(startIdx, secondCellEnd)));

const NEW_BLOCK = "categoria || '\u2014'}</TableCell>\n                            <TableCell className=\"flex items-center gap-1\">\n                              <Button\n                                variant=\"ghost\"\n                                size=\"icon\"\n                                onClick={() => iniciarEditarRegra(r)}\n                              >\n                                <Pencil className=\"h-3 w-3 text-muted-foreground\" />\n                              </Button>\n                              <Button variant=\"ghost\" size=\"icon\" onClick={() => removerRegra(r.id)}>\n                                <Trash2 className=\"h-3 w-3 text-destructive\" />\n                              </Button>\n                            </TableCell>";

c = c.substring(0, startIdx) + NEW_BLOCK + c.substring(secondCellEnd);
fs.writeFileSync(f, c, 'utf8');
console.log('Salvo OK. Tamanho:', c.length);

// Find and replace the entire TableCell for categoria + the next TableCell with just trash
const startMarker = "categoria || '";
const endMarker = "</TableCell>\n                          </TableRow>";

const startIdx = c.indexOf(startMarker);
if (startIdx === -1) { console.error('startMarker not found'); process.exit(1); }

// Find the end of the first cell (after the corrupted char + '}')
const cellEndMarker = '</TableCell>';
const firstCellEnd = c.indexOf(cellEndMarker, startIdx) + cellEndMarker.length;

// Now find the next </TableCell> which closes the trash button cell
const secondCellEnd = c.indexOf(cellEndMarker, firstCellEnd) + cellEndMarker.length;

console.log('OLD block:', JSON.stringify(c.substring(startIdx, secondCellEnd)));

const NEW_BLOCK = `categoria || '—'}</TableCell>
                            <TableCell className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => iniciarEditarRegra(r)}
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => removerRegra(r.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </TableCell>`;

c = c.substring(0, startIdx) + NEW_BLOCK + c.substring(secondCellEnd);
fs.writeFileSync(f, c, 'utf8');
console.log('Salvo OK. Tamanho:', c.length);
let c = fs.readFileSync(f, 'utf8');

// The corrupted character is U+FFFD followed by 0x1D (control char)
// Replace the categoria cell + old trash button with pencil + trash
const OLD_SEG = "categoria || '\uFFFD\x1D'}</TableCell>\n                            <TableCell>\n                              <Button variant=\"ghost\" size=\"icon\" onClick={() => removerRegra(r.id)}>\n                                <Trash2 className=\"h-3 w-3 text-destructive\" />\n                              </Button>\n                            </TableCell>";

const NEW_SEG = `categoria || '—'}</TableCell>
                            <TableCell className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => iniciarEditarRegra(r)}
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => removerRegra(r.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </TableCell>`;

console.log('Found:', c.includes(OLD_SEG));
if (c.includes(OLD_SEG)) {
  c = c.replace(OLD_SEG, NEW_SEG);
  fs.writeFileSync(f, c, 'utf8');
  console.log('Salvo OK');
} else {
  // Try finding partial
  const partial = "categoria || '\uFFFD\x1D'";
  console.log('Partial found:', c.includes(partial));
  const idx = c.indexOf("categoria || '");
  console.log('Partial idx:', idx, 'bytes around:', JSON.stringify(c.substring(idx, idx+20)));
}

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/app/dashboard/orcamentos/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find SIDEBAR_DIV then walk back to find the </div> that closes the main column
const SIDEBAR_DIV = '        <div className="xl:col-span-4 space-y-4">';
const sidebarIdx = content.indexOf(SIDEBAR_DIV);
if (sidebarIdx === -1) { console.error('NENHUM MATCH para SIDEBAR_DIV'); process.exit(1); }

// Walk backwards from sidebarIdx to find "</div>" line (skipping comment and blank lines)
const beforeSidebar = content.substring(0, sidebarIdx);
const lines = beforeSidebar.split('\n');

// Find the last line that contains </div> (it closes the main column)
let closingDivLineIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  const trimmed = lines[i].trim();
  if (trimmed === '</div>') {
    closingDivLineIdx = i;
    break;
  }
  if (trimmed && !trimmed.startsWith('{/*')) break;
}

if (closingDivLineIdx === -1) { console.error('Nao encontrou </div>'); process.exit(1); }
console.log('Linha do </div>:', closingDivLineIdx, JSON.stringify(lines[closingDivLineIdx]));

// Insert new cards BEFORE that closing </div>
const before = lines.slice(0, closingDivLineIdx).join('\n');
const after = lines.slice(closingDivLineIdx).join('\n');

const NOVOS_CARDS = `
          {/* Card: Imagem do Circuito / Evento */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> Mapa do Circuito / Imagem do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Anexar imagem do circuito (Google Maps ou Arquivo)
                  </Label>
                  <input
                    type="file"
                    accept="image/*"
                    id="input-imagem-circuito"
                    className="hidden"
                    onChange={handleImagemCircuito}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('input-imagem-circuito')?.click()}
                  >
                    <ImageIcon className="h-3.5 w-3.5 mr-1" /> Selecionar Imagem
                  </Button>
                  <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG. Será inserido no PDF final.</p>
                  {imagemCircuito && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive px-0"
                      onClick={() => setImagemCircuito('')}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Remover Imagem
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-center rounded-lg border bg-muted/30 overflow-hidden" style={{ minHeight: 120 }}>
                  {imagemCircuito ? (
                    <img
                      src={imagemCircuito}
                      alt="Preview do circuito"
                      className="max-w-full max-h-48 object-contain rounded"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem imagem</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Termos e Condições */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Termos e Condições
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Forma de Pagamento">
                  <Input
                    value={condPagto}
                    onChange={e => setCondPagto(e.target.value)}
                    placeholder="Ex: 50% no aceite"
                  />
                </Field>
                <Field label="Validade da Proposta">
                  <Input
                    value={condValidade}
                    onChange={e => setCondValidade(e.target.value)}
                    placeholder="Ex: 10 dias corridos"
                  />
                </Field>
                <Field label="Prazo de Entrega">
                  <Input
                    value={condEntrega}
                    onChange={e => setCondEntrega(e.target.value)}
                    placeholder="Ex: Até 2 dias antes"
                  />
                </Field>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Regras do Mini-Contrato (Editável)</Label>
                <textarea
                  className="w-full min-h-[160px] rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground leading-relaxed"
                  value={termos}
                  onChange={e => setTermos(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
`;

const newContent = before + '\n' + NOVOS_CARDS + '\n' + after;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Salvo com sucesso. Tamanho:', newContent.length);

let content = fs.readFileSync(filePath, 'utf8');

// The target: find the closing </div> of the main column, right before the sidebar div
// We search for the unique xl:col-span-4 pattern and insert before its enclosing comment+div
const SIDEBAR_DIV = '        <div className="xl:col-span-4 space-y-4">';
const idx = content.indexOf(SIDEBAR_DIV);
if (idx === -1) {
  console.error('NENHUM MATCH para SIDEBAR_DIV');
  process.exit(1);
}

// Find start of the line before (the comment line) then go back to find the </div> before it
// Walk backwards from idx to find the start of the line
let lineStart = idx;
while (lineStart > 0 && content[lineStart - 1] !== '\n') lineStart--;

// The content before the sidebar is everything up to lineStart
// We need to find the block: "        </div>\n\n        {/* ... Coluna lateral ... */}\n"
// which is 3 lines before the sidebar div. Let's find the </div> that closes the main column.
// We'll insert the new cards between that </div> and the sidebar div comment.

// Find where the block starts: go back from lineStart to find the previous non-empty line
// which should be the closing </div> of the col-span-8
let pos = lineStart - 1; // at the \n before the comment line
while (pos > 0 && content[pos] === '\n') pos--;
// now pos points to the last char of the previous line
let prevLineEnd = pos + 1; // exclusive
let prevLineStart = prevLineEnd;
while (prevLineStart > 0 && content[prevLineStart - 1] !== '\n') prevLineStart--;
const prevLine = content.substring(prevLineStart, prevLineEnd);
console.log('Linha antes do comentário:', JSON.stringify(prevLine));

// The previous line should be "        </div>" - the closing of xl:col-span-8
// We insert new cards AFTER that </div> line and BEFORE the sidebar comment+div
const insertPosAfterDiv = prevLineEnd;
console.log('Inserindo após posição:', insertPosAfterDiv);
console.log('Conteúdo ao redor:', JSON.stringify(content.substring(insertPosAfterDiv - 30, insertPosAfterDiv + 60)));

const NOVOS_CARDS = `

          {/* Card: Imagem do Circuito / Evento */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> Mapa do Circuito / Imagem do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Anexar imagem do circuito (Google Maps ou Arquivo)
                  </Label>
                  <input
                    type="file"
                    accept="image/*"
                    id="input-imagem-circuito"
                    className="hidden"
                    onChange={handleImagemCircuito}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('input-imagem-circuito')?.click()}
                  >
                    <ImageIcon className="h-3.5 w-3.5 mr-1" /> Selecionar Imagem
                  </Button>
                  <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG. Será inserido no PDF final.</p>
                  {imagemCircuito && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive px-0"
                      onClick={() => setImagemCircuito('')}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Remover Imagem
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-center rounded-lg border bg-muted/30 overflow-hidden" style={{ minHeight: 120 }}>
                  {imagemCircuito ? (
                    <img
                      src={imagemCircuito}
                      alt="Preview do circuito"
                      className="max-w-full max-h-48 object-contain rounded"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem imagem</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Termos e Condições */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Termos e Condições
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Forma de Pagamento">
                  <Input
                    value={condPagto}
                    onChange={e => setCondPagto(e.target.value)}
                    placeholder="Ex: 50% no aceite"
                  />
                </Field>
                <Field label="Validade da Proposta">
                  <Input
                    value={condValidade}
                    onChange={e => setCondValidade(e.target.value)}
                    placeholder="Ex: 10 dias corridos"
                  />
                </Field>
                <Field label="Prazo de Entrega">
                  <Input
                    value={condEntrega}
                    onChange={e => setCondEntrega(e.target.value)}
                    placeholder="Ex: Até 2 dias antes"
                  />
                </Field>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Regras do Mini-Contrato (Editável)</Label>
                <textarea
                  className="w-full min-h-[160px] rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground leading-relaxed"
                  value={termos}
                  onChange={e => setTermos(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>`;

const newContent = content.substring(0, insertPosAfterDiv) + NOVOS_CARDS + content.substring(insertPosAfterDiv);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Arquivo salvo com sucesso. Tamanho:', newContent.length);

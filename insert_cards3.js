const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/app/dashboard/orcamentos/page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Find where the sidebar column starts
const SIDEBAR_DIV = '        <div className="xl:col-span-4 space-y-4">';
const sidebarIdx = content.indexOf(SIDEBAR_DIV);
if (sidebarIdx === -1) { console.error('NENHUM MATCH para SIDEBAR_DIV'); process.exit(1); }

// Everything before the sidebar div
const beforeSidebar = content.substring(0, sidebarIdx);
const lines = beforeSidebar.split('\n');

// Find the closing </div> of the main column (walk backwards, skip blank/comment lines)
let closingDivLineIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  const trimmed = lines[i].trim();
  if (trimmed === '</div>') { closingDivLineIdx = i; break; }
  if (trimmed && !trimmed.startsWith('{/*')) break;
}
if (closingDivLineIdx === -1) { console.error('Nao encontrou </div>'); process.exit(1); }
console.log('Inserindo antes da linha:', closingDivLineIdx, JSON.stringify(lines[closingDivLineIdx]));

// Reconstruct:
// parts[0] = everything before the closing div
// parts[1] = new cards
// parts[2] = closing div + comment + empty + (sidebar handled by sidebarIdx)
const partBefore = lines.slice(0, closingDivLineIdx).join('\n');
const partAfterDiv = lines.slice(closingDivLineIdx).join('\n'); // includes the </div> and comment

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

const newContent = partBefore + NOVOS_CARDS + '\n' + partAfterDiv + '\n' + content.substring(sidebarIdx);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Salvo com sucesso. Tamanho:', newContent.length);

const fs = require("fs");
const f = "frontend/app/dashboard/orcamentos/page.tsx";
let c = fs.readFileSync(f, "utf8");
const sm = "categoria || '";
const idx = c.indexOf(sm);
if (idx === -1) { console.log("NOT FOUND"); process.exit(1); }
const ce = "</TableCell>";
const f1 = c.indexOf(ce, idx) + ce.length;
const f2 = c.indexOf(ce, f1) + ce.length;
console.log("Found block len:", f2 - idx);
const NEW = "categoria || " + "'" + "\u2014" + "'" + "}</TableCell>\n                            <TableCell className=" + '"' + "flex items-center gap-1" + '"' + ">\n                              <Button\n                                variant=" + '"' + "ghost" + '"' + "\n                                size=" + '"' + "icon" + '"' + "\n                                onClick={() => iniciarEditarRegra(r)}\n                              >\n                                <Pencil className=" + '"' + "h-3 w-3 text-muted-foreground" + '"' + " />\n                              </Button>\n                              <Button variant=" + '"' + "ghost" + '"' + " size=" + '"' + "icon" + '"' + " onClick={() => removerRegra(r.id)}>\n                                <Trash2 className=" + '"' + "h-3 w-3 text-destructive" + '"' + " />\n                              </Button>\n                            </TableCell>";
c = c.substring(0, idx) + NEW + c.substring(f2);
fs.writeFileSync(f, c, "utf8");
console.log("OK. Size:", c.length);

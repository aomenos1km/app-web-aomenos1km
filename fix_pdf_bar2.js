const fs = require('fs');
const path = 'frontend/app/dashboard/orcamentos/page.tsx';
const raw = fs.readFileSync(path, 'utf8');
const lines = raw.split('\n');

// Verify target range
const l931 = lines[930] || '';
if (!l931.includes('Abre nova aba')) {
  console.error('Target line 931 mismatch:', l931);
  process.exit(1);
}

const printBarLines = [
  '    // Abre nova aba com o HTML da proposta\r',
  "    const nomeArquivo = `Proposta_${(empresaSelecionada?.razao_social || 'Cliente').substring(0, 20).trim().replace(/\\s+/g, '_')}_${agora.getTime().toString().slice(-6)}`\r",
  '\r',
  '    const printBarHtml = `\r',
  '      <style>\r',
  '        #print-bar{\r',
  '          position:fixed;top:0;left:0;right:0;z-index:9999;\r',
  '          background:#1a1a1a;color:white;padding:10px 24px;\r',
  '          display:flex;align-items:center;justify-content:space-between;gap:12px;\r',
  '          font-family:Helvetica,sans-serif;font-size:13px;\r',
  '          box-shadow:0 2px 8px rgba(0,0,0,0.4);\r',
  '        }\r',
  '        #print-bar span{opacity:0.75;}\r',
  '        #btn-pdf{\r',
  '          background:#F25C05;color:white;border:none;border-radius:6px;\r',
  '          padding:9px 22px;font-size:13px;font-weight:bold;cursor:pointer;\r',
  '          display:flex;align-items:center;gap:8px;\r',
  '        }\r',
  '        #btn-pdf:hover{background:#d94f00;}\r',
  '        body{padding-top:56px;background:#d0d0d0;margin:0;}\r',
  '        .pw{max-width:900px;margin:24px auto;background:white;box-shadow:0 0 24px rgba(0,0,0,0.18);}\r',
  '        @media print{\r',
  '          #print-bar{display:none!important;}\r',
  '          body{padding-top:0!important;background:white!important;margin:0;}\r',
  '          .pw{max-width:none;box-shadow:none;margin:0;}\r',
  '        }\r',
  '      </style>\r',
  '      <div id="print-bar">\r',
  '        <span>${nomeArquivo}</span>\r',
  '        <button id="btn-pdf" onclick="window.print()">\r',
  '          \uD83D\uDDA8\uFE0F &nbsp;Imprimir / Salvar PDF\r',
  '        </button>\r',
  '      </div>\r',
  '      <div class="pw">`\r',
  '\r',
  '    const scriptTag = `<script>window.addEventListener(\'load\',function(){document.title=\'${nomeArquivo}\';});<\\/script>`\r',
  '    const htmlComPrint = htmlContent\r',
  "      .replace('</head>', scriptTag + '\\n</head>')\r",
  "      .replace('<body>', '<body>' + printBarHtml)\r",
  "      .replace('</body>', '</div></body>')\r",
  '\r',
  "    const newTab = window.open('', '_blank')\r",
  '    if (!newTab) {\r',
  "      toast.error('Bloqueador de pop-ups ativo. Permita pop-ups para este site e tente novamente.')\r",
  '      return\r',
  '    }\r',
  '    newTab.document.open()\r',
  '    newTab.document.write(htmlComPrint)\r',
  '    newTab.document.close()\r',
  '  }',
];

// Remove lines 930..950 (21 lines) and insert new ones
lines.splice(930, 21, ...printBarLines);
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Done! Replaced with', printBarLines.length, 'lines.');

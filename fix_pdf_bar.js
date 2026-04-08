const fs = require('fs');
const path = 'frontend/app/dashboard/orcamentos/page.tsx';
const content = fs.readFileSync(path, 'utf8');

const oldBlock = `    // Abre nova aba com o HTML da proposta e dispara o dialog de impressão/salvar PDF automaticamente
    const nomeArquivo = \`Proposta_\${(empresaSelecionada?.razao_social || 'Cliente').substring(0, 20).trim().replace(/\\s+/g, '_')}_\${agora.getTime().toString().slice(-6)}\`

    const htmlComPrint = htmlContent.replace(
      '</head>',
      \`<style>@media print{header,nav,aside,.no-print{display:none!important}}</style>\` +
      \`<script>window.addEventListener('load',function(){\` +
        \`document.title='\${nomeArquivo}';\` +
        \`setTimeout(function(){window.print();},800);\` +
      \`});</script>\\n</head>\`
    )

    const newTab = window.open('', '_blank')
    if (!newTab) {
      toast.error('Bloqueador de pop-ups ativo. Permita pop-ups para este site e tente novamente.')
      return
    }
    newTab.document.open()
    newTab.document.write(htmlComPrint)
    newTab.document.close()
  }`;

const newBlock = `    // Abre nova aba com o HTML da proposta
    const nomeArquivo = \`Proposta_\${(empresaSelecionada?.razao_social || 'Cliente').substring(0, 20).trim().replace(/\\s+/g, '_')}_\${agora.getTime().toString().slice(-6)}\`

    const printBar = \`
      <style>
        #print-bar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
          background: #1a1a1a; color: white; padding: 10px 24px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          font-family: Helvetica, sans-serif; font-size: 13px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        #print-bar span { opacity: 0.75; }
        #btn-imprimir {
          background: #F25C05; color: white; border: none; border-radius: 6px;
          padding: 9px 22px; font-size: 13px; font-weight: bold; cursor: pointer;
          display: flex; align-items: center; gap: 8px; letter-spacing: 0.3px;
        }
        #btn-imprimir:hover { background: #d94f00; }
        body { padding-top: 56px; background: #d0d0d0; margin: 0; }
        .page-wrapper { max-width: 900px; margin: 24px auto; background: white; box-shadow: 0 0 24px rgba(0,0,0,0.18); }
        @media print {
          #print-bar { display: none !important; }
          body { padding-top: 0 !important; background: white !important; margin: 0; }
          .page-wrapper { max-width: none; box-shadow: none; margin: 0; }
        }
      </style>
      <div id="print-bar">
        <span>\${nomeArquivo}</span>
        <button id="btn-imprimir" onclick="window.print()">
          🖨️ &nbsp;Imprimir / Salvar PDF
        </button>
      </div>
      <div class="page-wrapper">\`

    const htmlComPrint = htmlContent
      .replace('</head>', \`<script>window.addEventListener('load',function(){document.title='\${nomeArquivo}';});<\\/script>\\n</head>\`)
      .replace('<body>', '<body>' + printBar)
      .replace('</body>', '</div></body>')

    const newTab = window.open('', '_blank')
    if (!newTab) {
      toast.error('Bloqueador de pop-ups ativo. Permita pop-ups para este site e tente novamente.')
      return
    }
    newTab.document.open()
    newTab.document.write(htmlComPrint)
    newTab.document.close()
  }`;

if (!content.includes(oldBlock.substring(0, 80))) {
  console.error('Target not found. First 80 chars:', oldBlock.substring(0, 80));
  process.exit(1);
}

const result = content.replace(oldBlock, newBlock);
fs.writeFileSync(path, result, 'utf8');
console.log('Done!');

const fs = require('fs');
const path = 'frontend/app/dashboard/orcamentos/page.tsx';
const content = fs.readFileSync(path, 'utf8');

// 1. Replace the blob/window.open block with html2pdf approach
const oldEnd = `    const pdfBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(pdfBlob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  }`;

const newEnd = `    // Cria elemento temporário invisível, renderiza com html2pdf e faz download
    const container = document.createElement('div')
    container.innerHTML = htmlContent
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    document.body.appendChild(container)

    // @ts-expect-error html2pdf.js sem tipagem
    const html2pdf = (await import('html2pdf.js')).default
    const nomeArquivo = \`Proposta_\${(empresaSelecionada?.razao_social || 'Cliente').substring(0, 20).trim().replace(/\\s+/g, '_')}_\${agora.getTime().toString().slice(-6)}.pdf\`
    await html2pdf()
      .set({
        margin: [10, 15],
        filename: nomeArquivo,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(container.querySelector('body') || container)
      .save()

    document.body.removeChild(container)
  }`;

if (!content.includes(oldEnd.substring(0, 60))) {
  console.error('Target not found!');
  process.exit(1);
}

const result = content.replace(oldEnd, newEnd);
fs.writeFileSync(path, result, 'utf8');
console.log('Done! html2pdf download approach applied.');

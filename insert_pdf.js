const fs = require('fs');
const path = 'frontend/app/dashboard/orcamentos/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Line 763 (index 762): add abrirPDF() call after setPropostasRecentes
const callLine = lines[762];
if (!callLine.includes('setPropostasRecentes(prev => [novaProposta')) {
  console.error('Line 763 mismatch:', callLine);
  process.exit(1);
}
lines[762] = callLine.replace(
  'setPropostasRecentes(prev => [novaProposta, ...prev].slice(0, 8))',
  'setPropostasRecentes(prev => [novaProposta, ...prev].slice(0, 8))\r\n        void abrirPDF()'
);

// After line 767 (index 766, the closing `}` of gerarPrevia), insert abrirPDF function
// We'll insert after index 767 (the blank line after `}`)
const abrirPDFFn = `
  async function abrirPDF() {
    let logoUrl = ''
    try {
      const resp = await fetch('/logo-aomenos1km.png')
      const blob = await resp.blob()
      logoUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch { logoUrl = '' }

    const agora = new Date()
    const dataEmissao = agora.toLocaleDateString('pt-BR')
    const horaEmissao = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const refId = agora.getTime().toString().slice(-8)

    const dataEventoFmt = dataEvento
      ? new Date(dataEvento + 'T12:00:00').toLocaleDateString('pt-BR')
      : 'A Definir'

    const enderecoEmpresa = empresaSelecionada
      ? [empresaSelecionada.logradouro, empresaSelecionada.numero, empresaSelecionada.bairro,
          \`\${empresaSelecionada.cidade}/\${empresaSelecionada.uf}\`].filter(Boolean).join(', ')
      : 'Não informado'

    const blocoMapaHtml = imagemCircuito
      ? \`<div style="margin-top:25px;text-align:center;page-break-inside:avoid;">
          <div class="label" style="margin-bottom:12px;">MAPA DO CIRCUITO / LOCALIZAÇÃO</div>
          <img src="\${imagemCircuito}" style="max-width:100%;max-height:350px;border-radius:8px;border:1px solid #ddd;">
        </div>\`
      : ''

    let linhasTabela = ''
    items.filter(i => i.nome.trim()).forEach((item, index) => {
      const sub = Math.max(item.qtd || 0, 0) * Math.max(item.valorUnit || 0, 0)
      const bg = index % 2 === 0 ? '#f9f9f9' : '#ffffff'
      linhasTabela += \`
        <tr style="background-color:\${bg};">
          <td style="padding:10px 8px;border-bottom:1px solid #eee;">\${item.nome}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:10px;color:#555;">\${item.descricao || '-'}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">\${item.qtd}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">\${formatCurrency(item.valorUnit)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">\${formatCurrency(sub)}</td>
        </tr>\`
    })

    const termosHtml = termos.replace(/\\n/g, '<br>')
    const nomeEmpresa = (empresaSelecionada?.razao_social || 'Cliente não informado').toUpperCase()

    const htmlContent = \`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 15px 30px; }
    body { font-family: Helvetica, sans-serif; color: #333; font-size: 11px; margin: 0; line-height: 1.4; }
    .header-real { position: fixed; top: 0; left: 0; right: 0; height: 130px; background-color: white; border-bottom: 2px solid #F25C05; padding-bottom: 5px; z-index: 1000; }
    .footer-real { position: fixed; bottom: 0; left: 0; right: 0; height: 30px; background-color: white; border-top: 1px solid #ccc; text-align: center; padding-top: 10px; font-size: 9px; color: #999; z-index: 1000; }
    .header-space { height: 150px; }
    .footer-space { height: 40px; }
    .header-title { font-size: 20px; font-weight: bold; color: #333; }
    .header-meta { font-size: 10px; color: #555; }
    .label { font-weight: bold; font-size: 10px; color: #F25C05; text-transform: uppercase; margin-bottom: 8px; }
    .info-text { font-size: 11px; color: #333; margin-bottom: 4px; }
    .info-title { font-size: 12px; font-weight: bold; color: #000; margin-bottom: 6px; display: block; }
    .table-container { border: 1px solid #ccc; border-radius: 8px; overflow: hidden; margin-top: 5px; }
    .terms-box { border: 1px solid #ccc; border-radius: 8px; padding: 15px; margin-top: 20px; }
    .terms-text { font-size: 9px; line-height: 1.5; color: #444; text-align: justify; }
    .linha-separadora { border-top: 1px dashed #ddd; margin: 15px 0; }
    table { width: 100%; border-collapse: collapse; }
    tr { page-break-inside: avoid; }
  </style>
</head><body>
  <div class="header-real">
    <table style="width:100%;"><tr>
      <td style="width:50%;vertical-align:middle;">\${logoUrl ? \`<img src="\${logoUrl}" width="130">\` : '<b style="font-size:18px;color:#F25C05;">AOMENOS1KM</b>'}</td>
      <td style="width:50%;text-align:right;vertical-align:middle;">
        <div class="header-title">PROPOSTA COMERCIAL</div>
        <div class="header-meta">Ref: #\${refId}</div>
        <div class="header-meta">Emissão: \${dataEmissao}</div>
      </td>
    </tr></table>
  </div>
  <div class="footer-real">Gerado por Sistema AOMENOS1KM em \${dataEmissao} às \${horaEmissao}</div>
  <table>
    <thead><tr><td><div class="header-space">&nbsp;</div></td></tr></thead>
    <tfoot><tr><td><div class="footer-space">&nbsp;</div></td></tr></tfoot>
    <tbody><tr><td>
      <table style="width:100%;margin-bottom:25px;table-layout:fixed;"><tr>
        <td style="width:55%;padding-right:25px;vertical-align:top;border-right:1px solid #eee;">
          <div class="label">DADOS DO CLIENTE</div>
          <span class="info-title">\${nomeEmpresa}</span>
          <div class="info-text"><b>CNPJ/CPF:</b> \${empresaSelecionada?.documento || '-'}</div>
          <div class="info-text"><b>Aos cuidados de:</b> \${responsavel || 'Responsável'}</div>
          <div class="info-text"><b>Endereço:</b> \${enderecoEmpresa}</div>
        </td>
        <td style="width:45%;padding-left:25px;vertical-align:top;">
          <div class="label">SOBRE O EVENTO</div>
          <span class="info-title">\${eventoNome || 'Evento não informado'}</span>
          <div class="info-text"><b>Data Prevista:</b> \${dataEventoFmt}</div>
          <div class="info-text"><b>Público Alvo:</b> \${qtdPessoas} pessoas</div>
          <div class="info-text"><b>Quilometragem:</b> \${kmEvento} km</div>
          <div class="info-text"><b>Local:</b> \${localSelecionado?.nome || 'A Definir'}</div>
          <div class="info-text"><b>Cidade:</b> \${cidadeEvento || localSelecionado?.cidade || '-'}</div>
        </td>
      </tr></table>

      \${blocoMapaHtml}

      <div class="label" style="margin-top:20px;">DETALHAMENTO DOS SERVIÇOS</div>
      <div class="table-container">
        <table>
          <thead><tr>
            <th style="background-color:#F25C05;color:white;padding:10px 8px;text-align:left;font-size:10px;">ITEM / SERVIÇO</th>
            <th style="background-color:#F25C05;color:white;padding:10px 8px;text-align:left;font-size:10px;">DESCRIÇÃO</th>
            <th style="background-color:#F25C05;color:white;padding:10px 8px;text-align:center;font-size:10px;">QTD</th>
            <th style="background-color:#F25C05;color:white;padding:10px 8px;text-align:right;font-size:10px;">UNIT.</th>
            <th style="background-color:#F25C05;color:white;padding:10px 8px;text-align:right;font-size:10px;">TOTAL</th>
          </tr></thead>
          <tbody>\${linhasTabela}</tbody>
        </table>
      </div>

      <div style="text-align:right;margin-top:15px;margin-bottom:25px;font-size:16px;font-weight:bold;color:#198754;">
        INVESTIMENTO TOTAL: \${formatCurrency(totalGeral)}
      </div>

      <div class="terms-box">
        <div class="label" style="margin-top:0;">CONDIÇÕES COMERCIAIS</div>
        <div class="terms-text">
          <b>Pagamento:</b> \${condPagto || 'A combinar'} &nbsp;&bull;&nbsp;
          <b>Validade:</b> \${condValidade || 'A combinar'} &nbsp;&bull;&nbsp;
          <b>Entrega:</b> \${condEntrega || 'A combinar'}
        </div>
        <div class="linha-separadora"></div>
        <div class="label">TERMOS GERAIS</div>
        <div class="terms-text">\${termosHtml}</div>
      </div>

      <div style="margin-top:60px;page-break-inside:avoid;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="width:45%;text-align:center;vertical-align:top;">
            <div style="width:90%;margin:0 auto;border-top:1px solid #000;padding-top:8px;">
              <span style="font-weight:bold;font-size:11px;display:block;margin-bottom:2px;">AOMENOS1KM</span>
              <span style="font-size:10px;color:#555;">Consultor</span>
            </div>
          </td>
          <td style="width:10%;"></td>
          <td style="width:45%;text-align:center;vertical-align:top;">
            <div style="width:90%;margin:0 auto;border-top:1px solid #000;padding-top:8px;">
              <span style="font-weight:bold;font-size:11px;display:block;margin-bottom:2px;">\${nomeEmpresa}</span>
              <span style="font-size:10px;color:#555;">Contratante</span>
            </div>
          </td>
        </tr></table>
      </div>
    </td></tr></tbody>
  </table>
</body></html>\`

    const pdfBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(pdfBlob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  }
`;

// Insert after line index 768 (blank line after closing brace of gerarPrevia)
// Line 767 = index 766 = '  }', line 768 = index 767 = ''
// We insert the function at index 768 (after the blank line)
lines.splice(768, 0, ...abrirPDFFn.split('\n'));

const result = lines.join('\n');
fs.writeFileSync(path, result, 'utf8');
console.log('Done! abrirPDF function inserted after gerarPrevia.');

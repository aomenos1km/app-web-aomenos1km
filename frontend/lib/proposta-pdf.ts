export type PropostaPdfItem = {
  nome: string
  descricao: string
  qtd: number
  valorUnit: number
}

export type PropostaPdfData = {
  nomeEmpresa: string
  documentoEmpresa?: string
  responsavel?: string
  consultorNome?: string
  enderecoEmpresa?: string
  eventoNome: string
  dataEvento?: string
  qtdPessoas: number
  kmEvento: number
  localNome?: string
  cidadeEvento?: string
  imagemCircuito?: string
  condPagto?: string
  condValidade?: string
  condEntrega?: string
  termos?: string
  subtotalServicos?: number
  honorariosGestao?: number
  ticketMedio?: number
  totalGeral: number
  itens: PropostaPdfItem[]
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function loadLogoDataUrl() {
  try {
    const resp = await fetch('/logo-aomenos1km.png')
    const blob = await resp.blob()
    return await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

function buildHtmlContent(data: PropostaPdfData, logoUrl: string, refId: string, dataEmissao: string, horaEmissao: string) {
  const dataEventoFmt = data.dataEvento
    ? new Date(data.dataEvento + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'A Definir'

  const blocoMapaHtml = data.imagemCircuito
    ? `<div style="margin-top:25px;text-align:center;page-break-inside:avoid;">
          <div class="label" style="margin-bottom:12px;">MAPA DO CIRCUITO / LOCALIZAÇÃO</div>
          <img src="${data.imagemCircuito}" style="max-width:100%;max-height:350px;border-radius:8px;border:1px solid #ddd;">
        </div>`
    : ''

  const linhasTabela = data.itens
    .filter(i => i.nome.trim())
    .map((item, index) => {
      const sub = Math.max(item.qtd || 0, 0) * Math.max(item.valorUnit || 0, 0)
      const bg = index % 2 === 0 ? '#f9f9f9' : '#ffffff'
      return `
        <tr style="background-color:${bg};">
          <td style="padding:10px 8px;border-bottom:1px solid #eee;">${item.nome}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:10px;color:#555;">${item.descricao || '-'}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;">${item.qtd}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.valorUnit)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">${formatCurrency(sub)}</td>
        </tr>`
    })
    .join('')

  const termosHtml = (data.termos || '').replace(/\n/g, '<br>')
  const subtotalServicos = Number(data.subtotalServicos || 0)
  const honorariosGestao = Number(data.honorariosGestao || 0)
  const ticketMedio = Number(data.ticketMedio || 0)
  const consultorNome = String(data.consultorNome || '').trim()
  const assinaturaConsultor = consultorNome ? `Consultor: ${consultorNome}` : 'Consultor'

  return `<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 15px 30px; }
    body { font-family: Helvetica, sans-serif; color: #333; font-size: 11px; margin: 0; line-height: 1.4; }
    .header-real { background-color: white; border-bottom: 2px solid #F25C05; padding-bottom: 8px; margin-bottom: 18px; }
    .footer-real { border-top: 1px solid #ccc; text-align: center; padding-top: 10px; margin-top: 18px; font-size: 9px; color: #999; }
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
      <td style="width:50%;vertical-align:middle;">${logoUrl ? `<img src="${logoUrl}" width="130">` : '<b style="font-size:18px;color:#F25C05;">AOMENOS1KM</b>'}</td>
      <td style="width:50%;text-align:right;vertical-align:middle;">
        <div class="header-title">PROPOSTA COMERCIAL</div>
        <div class="header-meta">Ref: #${refId}</div>
        <div class="header-meta">Emissão: ${dataEmissao}</div>
      </td>
    </tr></table>
  </div>
  <table style="width:100%;margin:20px 0 25px;table-layout:fixed;"><tr>
        <td style="width:55%;padding-right:25px;vertical-align:top;border-right:1px solid #eee;">
          <div class="label">DADOS DO CLIENTE</div>
          <span class="info-title">${(data.nomeEmpresa || 'Cliente não informado').toUpperCase()}</span>
          <div class="info-text"><b>CNPJ/CPF:</b> ${data.documentoEmpresa || '-'}</div>
          <div class="info-text"><b>Aos cuidados de:</b> ${data.responsavel || 'Responsável'}</div>
          <div class="info-text"><b>Endereço:</b> ${data.enderecoEmpresa || 'Não informado'}</div>
        </td>
        <td style="width:45%;padding-left:25px;vertical-align:top;">
          <div class="label">SOBRE O EVENTO</div>
          <span class="info-title">${data.eventoNome || 'Evento não informado'}</span>
          <div class="info-text"><b>Data Prevista:</b> ${dataEventoFmt}</div>
          <div class="info-text"><b>Público Alvo:</b> ${data.qtdPessoas || 0} pessoas</div>
          <div class="info-text"><b>Quilometragem:</b> ${data.kmEvento || 0} km</div>
          <div class="info-text"><b>Local:</b> ${data.localNome || 'A Definir'}</div>
          <div class="info-text"><b>Cidade:</b> ${data.cidadeEvento || '-'}</div>
        </td>
      </tr></table>

      ${blocoMapaHtml}

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
          <tbody>${linhasTabela}</tbody>
        </table>
      </div>

      <div style="margin-top:14px;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:10px 12px;background:#fafafa;font-weight:bold;color:#333;">Subtotal dos serviços</td>
            <td style="padding:10px 12px;background:#fafafa;text-align:right;font-weight:bold;color:#333;">${formatCurrency(subtotalServicos)}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;font-weight:bold;color:#d35400;">Honorários de Gestão AoMenos1km</td>
            <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#d35400;">${formatCurrency(honorariosGestao)}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;background:#fafafa;font-weight:bold;color:#333;">Ticket por pessoa</td>
            <td style="padding:10px 12px;background:#fafafa;text-align:right;font-weight:bold;color:#333;">${formatCurrency(ticketMedio)}/pessoa</td>
          </tr>
          <tr>
            <td style="padding:12px;background:#fff7f0;font-size:16px;font-weight:bold;color:#198754;">INVESTIMENTO TOTAL</td>
            <td style="padding:12px;background:#fff7f0;text-align:right;font-size:16px;font-weight:bold;color:#198754;">${formatCurrency(data.totalGeral || 0)}</td>
          </tr>
        </table>
      </div>

      <div class="terms-box">
        <div class="label" style="margin-top:0;">CONDIÇÕES COMERCIAIS</div>
        <div class="terms-text">
          <b>Pagamento:</b> ${data.condPagto || 'A combinar'} &nbsp;&bull;&nbsp;
          <b>Validade:</b> ${data.condValidade || 'A combinar'} &nbsp;&bull;&nbsp;
          <b>Entrega:</b> ${data.condEntrega || 'A combinar'}
        </div>
        <div class="linha-separadora"></div>
        <div class="label">TERMOS GERAIS</div>
        <div class="terms-text">${termosHtml}</div>
      </div>

      <div style="margin-top:60px;page-break-inside:avoid;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="width:45%;text-align:center;vertical-align:top;">
            <div style="width:90%;margin:0 auto;border-top:1px solid #000;padding-top:8px;">
              <span style="font-weight:bold;font-size:11px;display:block;margin-bottom:2px;">AOMENOS1KM</span>
              <span style="font-size:10px;color:#555;">${assinaturaConsultor}</span>
            </div>
          </td>
          <td style="width:10%;"></td>
          <td style="width:45%;text-align:center;vertical-align:top;">
            <div style="width:90%;margin:0 auto;border-top:1px solid #000;padding-top:8px;">
              <span style="font-weight:bold;font-size:11px;display:block;margin-bottom:2px;">${(data.nomeEmpresa || 'Cliente não informado').toUpperCase()}</span>
              <span style="font-size:10px;color:#555;">Contratante</span>
            </div>
          </td>
        </tr></table>
      </div>
  <div class="footer-real">Gerado por Sistema AOMENOS1KM em ${dataEmissao} às ${horaEmissao}</div>
</body></html>`
}

function wrapHtmlForPreview(htmlContent: string, nomeArquivo: string) {
  const printBarHtml = `
      <style>
        #print-bar{
          position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:9999;
          display:flex;align-items:center;justify-content:center;
          font-family:Helvetica,sans-serif;
        }
        #btn-pdf{
          background:#F25C05;color:white;border:none;border-radius:6px;
          padding:9px 22px;font-size:13px;font-weight:bold;cursor:pointer;
          box-shadow:0 2px 8px rgba(0,0,0,0.25);
        }
        #btn-pdf:hover{background:#d94f00;}
        body{padding-top:24px;background:#d0d0d0;margin:0;}
        .pw{max-width:900px;margin:0 auto 24px;background:white;box-shadow:0 0 24px rgba(0,0,0,0.18);padding:0 20px 20px;box-sizing:border-box;}
        @media print{
          #print-bar{display:none!important;}
          body{padding-top:0!important;background:white!important;margin:0;}
          .pw{max-width:none;box-shadow:none;margin:0;padding:0;}
        }
      </style>
      <div id="print-bar">
        <button id="btn-pdf" onclick="window.print()">Imprimir / Salvar PDF</button>
      </div>
      <div class="pw">`

  const scriptTag = `<script>window.addEventListener('load',function(){document.title='${nomeArquivo}';});<\/script>`

  return htmlContent
    .replace('</head>', scriptTag + '\n</head>')
    .replace('<body>', '<body>' + printBarHtml)
    .replace('</body>', '</div></body>')
}

export async function abrirPreviewProposta(data: PropostaPdfData, nomeArquivo: string, preOpenedWindow?: Window) {
  const now = new Date()
  const dataEmissao = now.toLocaleDateString('pt-BR')
  const horaEmissao = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const refId = now.getTime().toString().slice(-8)
  const logoUrl = await loadLogoDataUrl()

  const html = buildHtmlContent(data, logoUrl, refId, dataEmissao, horaEmissao)
  const htmlComPrint = wrapHtmlForPreview(html, nomeArquivo)

  const newTab = preOpenedWindow && !preOpenedWindow.closed ? preOpenedWindow : window.open('', '_blank')
  if (!newTab) {
    return false
  }
  newTab.document.open()
  newTab.document.write(htmlComPrint)
  newTab.document.close()
  return true
}

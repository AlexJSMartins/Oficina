export function printWorkshopBudgetPdf(order: any, workshop: any, customMechanicNotes?: string) {
  const wName = workshop?.name || 'OFICINA PRO';
  const wSlogan = workshop?.slogan || 'Orçamento Técnico e Ordem de Serviço';
  const wDoc = workshop?.document ? `CNPJ/CPF: ${workshop.document}` : '';
  const wPhone = workshop?.phone ? `Tel/WhatsApp: ${workshop.phone}` : '';
  const wAddress = workshop?.address || '';
  const wLogo = workshop?.logoUrl || '';
  const primaryColor = workshop?.primaryColor || '#0f172a';
  const secondaryColor = workshop?.secondaryColor || '#16a34a';
  const warranty = workshop?.warrantyTerms || '';

  const mechNotes = customMechanicNotes !== undefined ? customMechanicNotes : order.mechanicNotes;

  const partsTotal = (order.items || [])
    .filter((i: any) => i.type === 'PART')
    .reduce((acc: number, i: any) => acc + Number(i.totalPrice), 0);
  const laborTotal = (order.items || [])
    .filter((i: any) => i.type === 'LABOR')
    .reduce((acc: number, i: any) => acc + Number(i.totalPrice), 0);

  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Orçamento OS #${order.number} - ${order.vehicle?.plate || ''}</title>
        <style>
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          body { font-family: Arial, sans-serif; color: #1e293b; padding: 28px; margin: 0; }
          .header-banner {
            background-color: ${primaryColor};
            color: #ffffff;
            padding: 20px 24px;
            border-radius: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          .brand-left { display: flex; align-items: center; gap: 16px; }
          .brand-logo {
            max-height: 64px;
            max-width: 150px;
            background: #ffffff;
            padding: 6px;
            border-radius: 8px;
            object-fit: contain;
          }
          .box {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-left: 5px solid ${primaryColor};
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 20px;
            font-size: 13px;
            line-height: 1.5;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
          th { background-color: ${primaryColor}; color: #ffffff; text-align: left; padding: 10px; }
          td { border-bottom: 1px solid #e2e8f0; padding: 10px; }
          .totals { margin-top: 24px; text-align: right; font-size: 14px; line-height: 1.6; }
          .totals .final {
            font-size: 20px;
            font-weight: bold;
            color: ${secondaryColor};
            margin-top: 6px;
          }
          .warranty {
            margin-top: 32px;
            padding-top: 12px;
            border-top: 1px dashed #cbd5e1;
            font-size: 11px;
            color: #64748b;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <div class="brand-left">
            ${wLogo ? `<img src="${wLogo}" class="brand-logo" alt="Logo" />` : ''}
            <div>
              <h1 style="margin:0; font-size: 22px;">${wName}</h1>
              <p style="margin:3px 0 0; font-size:12px; opacity: 0.9;">${wSlogan}</p>
              <p style="margin:4px 0 0; font-size:11px; opacity: 0.8;">
                ${[wDoc, wPhone, wAddress].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>
          <div style="text-align:right;">
            <h2 style="margin:0; font-size: 20px;">OS #${order.number}</h2>
            <p style="margin:4px 0 0; font-size:12px; opacity: 0.9;">
              Data: ${new Date(order.entryDate).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <div class="box">
          <strong>Cliente:</strong> ${order.customer?.name || ''} ${order.customer?.phone ? `(${order.customer.phone})` : ''}<br/>
          <strong>Veículo:</strong> ${order.vehicle?.brand} ${order.vehicle?.model} (${order.vehicle?.year}) — <strong>Placa:</strong> ${order.vehicle?.plate} — <strong>KM:</strong> ${order.currentKm} km<br/><br/>
          
          <strong>Relato Inicial do Cliente:</strong><br/>
          ${order.customerNotes || 'Nenhuma observação informada.'}
          
          ${mechNotes ? `
            <br/><br/>
            <strong>Laudo / Parecer Técnico:</strong><br/>
            ${String(mechNotes).replace(/\n/g, '<br/>')}
          ` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descrição da Peça / Serviço</th>
              <th>Qtd</th>
              <th>Vlr. Unitário</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || [])
              .map(
                (item: any) => `
              <tr>
                <td><strong>${item.type === 'PART' ? 'PEÇA' : 'MÃO DE OBRA'}</strong></td>
                <td>${item.description}</td>
                <td>${item.quantity}</td>
                <td>R$ ${Number(item.unitPrice).toFixed(2)}</td>
                <td><strong>R$ ${Number(item.totalPrice).toFixed(2)}</strong></td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>

        <div class="totals">
          <div>Total em Peças: R$ ${partsTotal.toFixed(2)}</div>
          <div>Total em Mão de Obra: R$ ${laborTotal.toFixed(2)}</div>
          <div>Desconto Aplicado: - R$ ${Number(order.discount || 0).toFixed(2)}</div>
          <div class="final">VALOR TOTAL: R$ ${Number(order.totalAmount || 0).toFixed(2)}</div>
        </div>

        ${warranty ? `<div class="warranty"><strong>Termos e Garantia:</strong> ${warranty}</div>` : ''}

        <script>window.onload = () => { setTimeout(() => window.print(), 250); }</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
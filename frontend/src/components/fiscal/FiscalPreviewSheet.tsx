

interface Props {
  docType: 'NFSE' | 'NFE' | 'NFCE';
  emitter: {
    name: string;
    document: string;
    ie?: string;
    im?: string;
    address?: string;
    neighborhood?: string;
    cep?: string;
    regimeTributario?: string;
  };
  payload: any;
  serviceOrder: any;
}

const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FiscalPreviewSheet({ docType, emitter, payload, serviceOrder }: Props) {
  const now = new Date();
  const today = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const nowTime = now.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isService = docType === 'NFSE';
  const numero = isService ? payload?.rps?.numero || 1 : payload?.numero || 1;
  const serie = isService ? payload?.rps?.serie || '1' : payload?.serie || 1;
  const totalValue = isService
    ? Number(payload?.servico?.valores?.valor || 0)
    : (payload?.itens || []).reduce(
      (acc: number, item: any) =>
        acc + Number(item.quantidade || 1) * Number(item.valorUnitario || 0) - Number(item.desconto || 0),
      0,
    );

  const client = isService ? payload?.tomador : payload?.cliente || serviceOrder?.customer;

  return (
    <div className="relative bg-white text-black font-sans border border-black p-3 text-[10px] leading-tight select-none overflow-hidden rounded">
      {/* MARCA D'ÁGUA CENTRAL IGUAL AO MODELO DANFE */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-10 px-4 text-center">
        <span className="text-2xl sm:text-4xl font-serif font-bold tracking-wide text-black/20 uppercase">
          {isService ? 'NFS-e NÃO PROTOCOLADA' : `${docType} NÃO PROTOCOLADA`}
        </span>
        <span className="text-2xl sm:text-4xl font-serif font-bold tracking-wide text-black/20 uppercase mt-1">
          SEM VALOR FISCAL
        </span>
      </div>

      {/* CANHOTO SUPERIOR */}
      <div className="grid grid-cols-12 border border-black mb-2">
        <div className="col-span-9 border-r border-black">
          <div className="p-1 border-b border-black text-[8px] uppercase">
            RECEBEMOS DE <strong>{emitter?.name || 'OFICINA'}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA ABAIXO.
            EMISSÃO: {today} • VALOR TOTAL: R$ {fmtMoney(totalValue)} • DESTINATÁRIO: {client?.nome || serviceOrder?.customer?.name || 'CONSUMIDOR'}
          </div>
          <div className="grid grid-cols-12 h-7">
            <div className="col-span-4 border-r border-black p-1 text-[7px] uppercase text-slate-600">
              DATA DE RECEBIMENTO
            </div>
            <div className="col-span-8 p-1 text-[7px] uppercase text-slate-600">
              IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR
            </div>
          </div>
        </div>
        <div className="col-span-3 flex flex-col items-center justify-center p-1 text-center">
          <strong className="text-sm">{docType}</strong>
          <span className="font-bold">Nº {String(numero).padStart(9, '0')}</span>
          <span>Série {String(serie).padStart(3, '0')}</span>
        </div>
      </div>

      {/* CABEÇALHO PRINCIPAL */}
      <div className="grid grid-cols-12 border border-black mb-1.5">
        {/* Identificação do Emitente */}
        <div className="col-span-5 border-r border-black p-2 flex flex-col justify-center">
          <span className="text-[7px] uppercase text-slate-600 mb-0.5">IDENTIFICAÇÃO DO EMITENTE</span>
          <strong className="text-xs uppercase">{emitter?.name || 'OFICINA MECÂNICA'}</strong>
          <span>{emitter?.address}</span>
          <span>
            {[emitter?.neighborhood, emitter?.cep ? `CEP: ${emitter.cep}` : ''].filter(Boolean).join(' • ')}
          </span>
        </div>

        {/* Bloco DANFE / DANFSE */}
        <div className="col-span-3 border-r border-black p-2 text-center flex flex-col justify-center">
          <strong className="text-sm">{isService ? 'PRÉ-DANFSE' : 'DANFE'}</strong>
          <span className="text-[8px]">
            {isService ? 'Prévia da Nota de Serviço' : 'Documento Auxiliar da Nota Fiscal Eletrônica'}
          </span>
          {!isService && (
            <div className="flex items-center justify-center gap-2 my-1">
              <div className="text-left text-[8px]">
                <div>0 - ENTRADA</div>
                <div>1 - SAÍDA</div>
              </div>
              <div className="border border-black px-2 py-0.5 font-bold text-xs">1</div>
            </div>
          )}
          <div className="font-bold mt-0.5">Nº {String(numero).padStart(9, '0')}</div>
          <div>Série {String(serie).padStart(3, '0')} • Folha 1/1</div>
        </div>

        {/* Código de Barras / Chave Fictícia */}
        <div className="col-span-4 p-2 flex flex-col justify-between">
          <div className="h-9 bg-[repeating-linear-gradient(90deg,#000,#000_2px,#fff_2px,#fff_4px)] opacity-25 mb-1" />
          <div>
            <span className="text-[7px] uppercase text-slate-600 block">CHAVE DE ACESSO (GERADA APÓS AUTORIZAÇÃO)</span>
            <span className="font-mono text-[9px] text-slate-500">
              0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000
            </span>
          </div>
          <span className="text-[7px] text-slate-600 mt-1">
            PRÉ-VISUALIZAÇÃO PARA CONFERÊNCIA ANTES DA TRANSMISSÃO À SEFAZ/PREFEITURA
          </span>
        </div>
      </div>

      {/* NATUREZA / IE / CNPJ */}
      <div className="grid grid-cols-12 border border-black mb-1.5">
        <div className="col-span-7 border-r border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block">NATUREZA DA OPERAÇÃO</span>
          <strong className="uppercase">
            {isService ? 'PRESTAÇÃO DE SERVIÇOS AUTOMOTIVOS' : payload?.pedido?.naturezaOperacao || 'VENDA DE MERCADORIA'}
          </strong>
        </div>
        <div className="col-span-5 p-1">
          <span className="text-[7px] uppercase text-slate-600 block">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
          <span className="text-slate-500 italic">AGUARDANDO TRANSMISSÃO</span>
        </div>
        <div className="col-span-4 border-t border-r border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block">INSCRIÇÃO ESTADUAL</span>
          <strong>{emitter?.ie || 'ISENTO'}</strong>
        </div>
        <div className="col-span-4 border-t border-r border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block">INSCRIÇÃO MUNICIPAL</span>
          <strong>{emitter?.im || '—'}</strong>
        </div>
        <div className="col-span-4 border-t border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block">CNPJ DO EMITENTE</span>
          <strong>{emitter?.document || '—'}</strong>
        </div>
      </div>

      {/* DESTINATÁRIO / TOMADOR */}
      <div className="text-[8px] font-bold uppercase mb-0.5">
        {isService ? 'TOMADOR DO SERVIÇO' : 'DESTINATÁRIO / REMETENTE'}
      </div>
      <div className="grid grid-cols-12 border border-black mb-1.5">
        <div className="col-span-7 border-r border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block">NOME / RAZÃO SOCIAL</span>
          <strong className="uppercase">{client?.nome || serviceOrder?.customer?.name || 'CONSUMIDOR FINAL'}</strong>
        </div>
        <div className="col-span-3 border-r border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block">CPF / CNPJ</span>
          <strong>{client?.cpfCnpj || serviceOrder?.customer?.document || 'NÃO INFORMADO'}</strong>
        </div>
        <div className="col-span-2 p-1">
          <span className="text-[7px] uppercase text-slate-600 block">DATA EMISSÃO</span>
          <strong>{today}</strong>
        </div>
        <div className="col-span-5 border-t border-r border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block">TELEFONE</span>
          <span>{client?.telefone || serviceOrder?.customer?.phone || '—'}</span>
        </div>
        <div className="col-span-5 border-t border-r border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block">E-MAIL</span>
          <span>{client?.email || serviceOrder?.customer?.email || '—'}</span>
        </div>
        <div className="col-span-2 border-t border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block">HORA</span>
          <strong>{nowTime}</strong>
        </div>
      </div>

      {/* CÁLCULO DO IMPOSTO / TOTAIS */}
      <div className="text-[8px] font-bold uppercase mb-0.5">VALORES E TOTAIS</div>
      <div className="grid grid-cols-12 border border-black mb-1.5 text-right">
        <div className="col-span-3 border-r border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block text-left">BASE DE CÁLCULO</span>
          <strong>R$ {fmtMoney(totalValue)}</strong>
        </div>
        <div className="col-span-3 border-r border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block text-left">
            {isService ? 'ALÍQUOTA ISS' : 'DESCONTO'}
          </span>
          <strong>
            {isService ? `${payload?.servico?.valores?.aliquotaIss ?? 5}%` : 'R$ 0,00'}
          </strong>
        </div>
        <div className="col-span-3 border-r border-black p-1">
          <span className="text-[7px] uppercase text-slate-600 block text-left">PAGAMENTO</span>
          <strong className="uppercase">
            {isService ? 'À COMBINAR' : payload?.pedido?.pagamento?.formas?.[0]?.tipo || 'PIX'}
          </strong>
        </div>
        <div className="col-span-3 p-1 bg-slate-100">
          <span className="text-[7px] uppercase text-slate-600 block text-left">VALOR TOTAL DA NOTA</span>
          <strong className="text-xs">R$ {fmtMoney(totalValue)}</strong>
        </div>
      </div>

      {/* TABELA DE PRODUTOS OU SERVIÇOS */}
      <div className="text-[8px] font-bold uppercase mb-0.5">
        {isService ? 'DISCRIMINAÇÃO DOS SERVIÇOS' : 'DADOS DOS PRODUTOS / PEÇAS'}
      </div>
      <div className="border border-black mb-1.5 min-h-[120px]">
        {isService ? (
          <div className="p-2 space-y-1.5">
            <div className="flex justify-between border-b border-slate-300 pb-1">
              <span>
                <strong>Cód. Serviço Nacional (cTribNac):</strong> {payload?.servico?.codigoServico || '—'}
              </span>
              <span>
                <strong>Cód. Interno:</strong> {payload?.servico?.codigoInterno || '—'}
              </span>
            </div>
            <p className="text-xs whitespace-pre-wrap">{payload?.servico?.discriminacao || 'Nenhum serviço informado.'}</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr className="border-b border-black bg-slate-100 text-left">
                <th className="p-1 border-r border-black">CÓD</th>
                <th className="p-1 border-r border-black">DESCRIÇÃO DO PRODUTO</th>
                <th className="p-1 border-r border-black">NCM</th>
                <th className="p-1 border-r border-black">CFOP</th>
                <th className="p-1 border-r border-black">UN</th>
                <th className="p-1 border-r border-black text-right">QTD</th>
                <th className="p-1 border-r border-black text-right">V. UNIT</th>
                <th className="p-1 text-right">V. TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {(payload?.itens || []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-500">
                    Nenhuma peça lançada nesta Ordem de Serviço.
                  </td>
                </tr>
              ) : (
                (payload?.itens || []).map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-1 border-r border-black">{item.codigo}</td>
                    <td className="p-1 border-r border-black font-semibold">{item.descricao}</td>
                    <td className="p-1 border-r border-black">{item.ncm}</td>
                    <td className="p-1 border-r border-black">{item.cfop}</td>
                    <td className="p-1 border-r border-black">{item.unidadeMedida}</td>
                    <td className="p-1 border-r border-black text-right">{item.quantidade}</td>
                    <td className="p-1 border-r border-black text-right">{fmtMoney(item.valorUnitario)}</td>
                    <td className="p-1 text-right font-bold">
                      {fmtMoney(Number(item.quantidade || 1) * Number(item.valorUnitario || 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* DADOS ADICIONAIS */}
      <div className="text-[8px] font-bold uppercase mb-0.5">DADOS ADICIONAIS</div>
      <div className="grid grid-cols-12 border border-black">
        <div className="col-span-8 border-r border-black p-1.5 min-h-[44px]">
          <span className="text-[7px] uppercase text-slate-600 block">INFORMAÇÕES COMPLEMENTARES</span>
          <span>
            {isService
              ? payload?.servico?.informacoesComplementares
              : payload?.pedido?.informacoesComplementares || '—'}
          </span>
        </div>
        <div className="col-span-4 p-1.5">
          <span className="text-[7px] uppercase text-slate-600 block">RESERVADO AO FISCO</span>
          <span className="text-[8px] text-slate-500">
            Regime: {emitter?.regimeTributario || 'SIMPLES'} • OS #{serviceOrder?.number}
          </span>
        </div>
      </div>
    </div>
  );
}
import { Injectable, BadRequestException } from '@nestjs/common';

export interface ParsedXmlSupplier {
  cnpj: string;
  ie: string | null;
  name: string;
  fantasyName: string | null;
  phone: string | null;
  cep: string | null;
  logradouro: string | null;
  numeroEndereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  codigoIbge: string | null;
}
export interface ParsedXmlItem {
  index: number;
  codigoFornecedor: string;
  ean: string | null;
  name: string;
  ncm: string;
  cest: string | null;
  cfop: string;
  unidadeMedida: string;
  quantity: number;
  unitCost: number;
  totalPrice: number;
  origem: string;
  icmsCst: string;
  icmsBase: number;
  icmsAliquota: number;
  icmsValor: number;
  icmsStBase: number;
  icmsStAliquota: number;
  icmsStValor: number;
  ipiBase: number;
  ipiAliquota: number;
  ipiValor: number;
}

export interface ParsedInboundXml {
  chaveAcesso: string;
  numero: number;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  supplier: ParsedXmlSupplier;
  items: ParsedXmlItem[];
}

@Injectable()
export class XmlParserService {
  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
  }

  private getBlock(xml: string, tag: string): string {
    const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : '';
  }

  private getTag(xml: string, tag: string): string {
    const raw = this.getBlock(xml, tag);
    return raw ? this.decodeEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')) : '';
  }

  private getNum(xml: string, tag: string): number {
    const val = this.getTag(xml, tag).replace(',', '.');
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  parseNfeXml(xmlContent: string): ParsedInboundXml {
    const xml = String(xmlContent || '').trim();
    if (!xml || (!xml.includes('<infNFe') && !xml.includes(':infNFe'))) {
      throw new BadRequestException(
        'Arquivo XML inválido. Envie o XML oficial de uma NF-e de compra (tag <infNFe>).',
      );
    }

    // Chave de 44 dígitos: primeiro tenta <chNFe>, depois o atributo Id="NFe..."
    let chaveAcesso = this.getTag(xml, 'chNFe').replace(/\D/g, '');
    if (chaveAcesso.length !== 44) {
      const idMatch = xml.match(/infNFe[^>]*Id=["']NFe(\d{44})["']/i);
      if (idMatch) chaveAcesso = idMatch[1];
    }
    if (chaveAcesso.length !== 44) {
      throw new BadRequestException('Não foi possível localizar a Chave de Acesso (44 dígitos) no XML.');
    }

    const ideBlock = this.getBlock(xml, 'ide');
    const emitBlock = this.getBlock(xml, 'emit');
    const enderEmit = this.getBlock(emitBlock, 'enderEmit');
    const icmsTotBlock = this.getBlock(xml, 'ICMSTot');

    const numero = Number(this.getTag(ideBlock, 'nNF') || 0);
    const serie = this.getTag(ideBlock, 'serie') || '1';
    const dataEmissao =
      this.getTag(ideBlock, 'dhEmi') ||
      this.getTag(ideBlock, 'dEmi') ||
      new Date().toISOString();

    const supplierCnpj = (this.getTag(emitBlock, 'CNPJ') || this.getTag(emitBlock, 'CPF')).replace(/\D/g, '');
    const supplierName = this.getTag(emitBlock, 'xNome') || this.getTag(emitBlock, 'xFant') || 'Fornecedor XML';

    if (!supplierCnpj) {
      throw new BadRequestException('Tag <emit> sem CNPJ/CPF do fornecedor no XML.');
    }

    const supplier: ParsedXmlSupplier = {
      cnpj: supplierCnpj,
      ie: this.getTag(emitBlock, 'IE') || null,
      name: supplierName,
      fantasyName: this.getTag(emitBlock, 'xFant') || null,
      phone: this.getTag(enderEmit, 'fone').replace(/\D/g, '') || null,
      cep: this.getTag(enderEmit, 'CEP').replace(/\D/g, '') || null,
      logradouro: this.getTag(enderEmit, 'xLgr') || null,
      numeroEndereco: this.getTag(enderEmit, 'nro') || null,
      bairro: this.getTag(enderEmit, 'xBairro') || null,
      cidade: this.getTag(enderEmit, 'xMun') || null,
      uf: this.getTag(enderEmit, 'UF') || null,
      codigoIbge: this.getTag(enderEmit, 'cMun').replace(/\D/g, '') || null,
    };

    // Extrai todos os itens (<det nItem="...">...</det>)
    const detRegex = /<(?:[a-zA-Z0-9_-]+:)?det\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?det>/gi;
    const items: ParsedXmlItem[] = [];
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = detRegex.exec(xml)) !== null) {
      // Cada bloco <det> contém um item da nota fiscal
      const detBlock = match[1];
      const prodBlock = this.getBlock(detBlock, 'prod');
      const impostoBlock = this.getBlock(detBlock, 'imposto');
      const icmsBlock = this.getBlock(impostoBlock, 'ICMS');
      const ipiBlock = this.getBlock(impostoBlock, 'IPI');

      // Código do produto e EAN (GTIN)
      const rawEan = this.getTag(prodBlock, 'cEAN');
      const ean = rawEan && rawEan.toUpperCase() !== 'SEM GTIN' ? rawEan.replace(/\D/g, '') : null;

      // Quantidade, valor unitário e valor total
      const qty = this.getNum(prodBlock, 'qCom') || 1;
      const unitCost = this.getNum(prodBlock, 'vUnCom');
      const totalPrice = this.getNum(prodBlock, 'vProd') || qty * unitCost;

      // ICMS
      const origem = this.getTag(icmsBlock, 'orig') || '0';
      const icmsCst = this.getTag(icmsBlock, 'CSOSN') || this.getTag(icmsBlock, 'CST') || '102';
      const icmsStBase = this.getNum(icmsBlock, 'vBCST') || this.getNum(icmsBlock, 'vBCSTRet');
      const icmsStAliquota = this.getNum(icmsBlock, 'pICMSST') || this.getNum(icmsBlock, 'pST');
      const icmsStValor = this.getNum(icmsBlock, 'vICMSST') || this.getNum(icmsBlock, 'vICMSSTRet');

      items.push({
        index: idx++,
        codigoFornecedor: this.getTag(prodBlock, 'cProd') || `ITEM-${idx}`,
        ean,
        name: this.getTag(prodBlock, 'xProd') || `Peça ${idx}`,
        ncm: this.getTag(prodBlock, 'NCM').replace(/\D/g, '') || '87089990',
        cest: this.getTag(prodBlock, 'CEST').replace(/\D/g, '') || null,
        cfop: this.getTag(prodBlock, 'CFOP').replace(/\D/g, '') || '5102',
        unidadeMedida: (this.getTag(prodBlock, 'uCom') || 'UN').toUpperCase().slice(0, 6),
        quantity: qty,
        unitCost,
        totalPrice,
        origem,
        icmsCst,
        icmsBase: this.getNum(icmsBlock, 'vBC'),
        icmsAliquota: this.getNum(icmsBlock, 'pICMS'),
        icmsValor: this.getNum(icmsBlock, 'vICMS'),
        icmsStBase,
        icmsStAliquota,
        icmsStValor,
        ipiBase: this.getNum(ipiBlock, 'vBC'),
        ipiAliquota: this.getNum(ipiBlock, 'pIPI'),
        ipiValor: this.getNum(ipiBlock, 'vIPI'),
      });
    }

    if (items.length === 0) {
      throw new BadRequestException('Nenhum item (<det>) foi encontrado neste XML.');
    }

    const valorTotal =
      this.getNum(icmsTotBlock, 'vNF') ||
      items.reduce((acc, i) => acc + Number(i.totalPrice || 0), 0);

    return {
      chaveAcesso,
      numero,
      serie,
      dataEmissao,
      valorTotal,
      supplier,
      items,
    };
  }
}
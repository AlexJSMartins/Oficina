import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class DevNotaApiService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.DEVNOTA_BASE_URL || 'https://api.devnota.com.br',
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${process.env.DEVNOTA_API_KEY || ''}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  getDefaultEnvironment(): string {
    return process.env.DEVNOTA_ENVIRONMENT || 'sandbox';
  }

  private buildHeaders(companyUuid?: string) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.DEVNOTA_API_KEY || ''}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (companyUuid) {
      headers['Company-uuid'] = companyUuid;
    }
    return headers;
  }

  async post(endpoint: string, data: any, companyUuid?: string) {
    try {
      const response = await this.client.post(endpoint, data, {
        headers: this.buildHeaders(companyUuid),
      });
      return response.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || { message: 'Erro ao comunicar com a API DevNota' },
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  async put(endpoint: string, data: any, companyUuid?: string) {
    try {
      const response = await this.client.put(endpoint, data, {
        headers: this.buildHeaders(companyUuid),
      });
      return response.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || { message: 'Erro ao atualizar recurso na API DevNota' },
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  async get(endpoint: string, companyUuid?: string) {
    try {
      const response = await this.client.get(endpoint, {
        headers: this.buildHeaders(companyUuid),
      });
      return response.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || { message: 'Erro ao consultar a API DevNota' },
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Empresas
  listCompanies() {
    return this.get('/v2/empresas');
  }

  createCompany(data: any) {
    return this.post('/v2/empresas', data);
  }

  updateCompany(companyUuid: string, data: any) {
    return this.put(`/v2/empresas/${companyUuid}`, data);
  }

  // Certificado Digital A1 (PFX/P12 em Base64)
  uploadCertificate(
    companyUuid: string,
    payload: { cert_file: string; cert_pass: string; valid_ultil: string },
  ) {
    return this.post(`/v2/empresas/${companyUuid}/certificado`, payload);
  }

  // Serviços da Empresa (NFS-e)
  listCompanyServices(companyUuid: string) {
    return this.get(`/v2/empresas/${companyUuid}/servicos`);
  }

  createCompanyService(companyUuid: string, data: any) {
    return this.post(`/v2/empresas/${companyUuid}/servicos`, data);
  }

  // Emissão de documentos
  emitNfse(payload: any, companyUuid?: string) {
    return this.post('/v2/nfse/gerar', payload, companyUuid);
  }

  emitNfe(payload: any, companyUuid?: string) {
    return this.post('/v2/nfe/gerar', payload, companyUuid);
  }

  emitNfce(payload: any, companyUuid?: string) {
    return this.post('/v2/nfc/gerar', payload, companyUuid);
  }

  // Consulta de documentos, PDF e XML
  getDocument(tipo: 'nfe' | 'nfc' | 'nfse', uuid: string, companyUuid?: string) {
    const prefix = tipo === 'nfc' ? 'nfc' : tipo;
    return this.get(`/v2/${prefix}/${uuid}`, companyUuid);
  }

  getDocumentPdf(tipo: 'nfe' | 'nfc' | 'nfse', uuid: string, companyUuid?: string) {
    const prefix = tipo === 'nfc' ? 'nfc' : tipo;
    return this.get(`/v2/${prefix}/${uuid}/pdf`, companyUuid);
  }

  getDocumentXml(tipo: 'nfe' | 'nfc' | 'nfse', uuid: string, companyUuid?: string) {
    const prefix = tipo === 'nfc' ? 'nfc' : tipo;
    return this.get(`/v2/${prefix}/${uuid}/xml`, companyUuid);
  }

  // Protocolos e referência externa
  getProtocol(protocolo: number | string) {
    return this.get(`/v2/consulta/protocolo/${protocolo}`);
  }

  reprocessProtocol(protocolo: number | string) {
    return this.post(`/v2/consulta/reprocessar/${protocolo}`, {});
  }

  getByExternalRef(referenciaExterna: string, companyUuid: string) {
    return this.get(
      `/v2/consulta/referencia/${encodeURIComponent(referenciaExterna)}`,
      companyUuid,
    );
  }

  // Cancelamento e Carta de Correção (companyUuid opcional para suportar sandbox)
  cancelNfe(
    uuid: string,
    companyUuid: string | undefined,
    data: { ambiente: string; justificativa: string; callback?: string },
  ) {
    return this.post(`/v2/nfe/${uuid}/cancelar`, data, companyUuid);
  }

  cancelNfce(
    uuid: string,
    companyUuid: string | undefined,
    data: { ambiente: string; justificativa: string; callback?: string },
  ) {
    return this.post(`/v2/nfc/${uuid}/cancelar`, data, companyUuid);
  }

  cancelNfse(
    uuid: string,
    companyUuid: string | undefined,
    data: {
      ambiente: string;
      codigoCancelamento: 'ERRO_EMISSAO' | 'SERVICO_NAO_PRESTADO' | 'DUPLICIDADE' | 'OUTROS';
      motivoCancelamento?: string;
      callback?: string;
    },
  ) {
    return this.post(`/v2/nfse/${uuid}/cancelar`, data, companyUuid);
  }

  sendCceNfe(
    uuid: string,
    companyUuid: string | undefined,
    data: { ambiente: string; correcao: string; callback?: string },
  ) {
    return this.post(`/v2/nfe/${uuid}/cce`, data, companyUuid);
  }

  // Consumo do plano e exportação em lote de notas (Contador)
  getPlanUsage() {
    return this.get('/v2/plano/consumo');
  }

  listExports(companyUuid: string) {
    return this.get('/v2/nota-exports', companyUuid);
  }

  createExport(
    companyUuid: string,
    data: {
      tipo: 'nfse' | 'nfe' | 'nfce';
      filtro_data: 'emissao' | 'competencia';
      data_inicial: string;
      data_final: string;
    },
  ) {
    return this.post('/v2/nota-exports', data, companyUuid);
  }

  async downloadExport(exportUuid: string, companyUuid: string): Promise<Buffer> {
    try {
      const response = await this.client.get(`/v2/nota-exports/${exportUuid}/download`, {
        headers: this.buildHeaders(companyUuid),
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || { message: 'Erro ao baixar arquivo ZIP na API DevNota.' },
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }
}
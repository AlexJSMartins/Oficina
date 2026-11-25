import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class AsaasApiService {
  private readonly client: AxiosInstance;

  constructor() {
    const baseURL = (process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3')
      .trim()
      .replace(/\/$/, '');

    this.client = axios.create({
      baseURL,
      timeout: 60000, // Recomendado pelo Asaas para captura de cartão
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'OficinaPro/1.0.0',
      },
    });
  }

  private getHeaders() {
    const apiKey = (process.env.ASAAS_API_KEY || '').trim();
    if (!apiKey) {
      throw new HttpException(
        'ASAAS_API_KEY não configurada no arquivo .env do servidor.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      access_token: apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'OficinaPro/1.0.0',
    };
  }

  private handleError(error: any, fallbackMessage: string): never {
    const asaasErrors = error?.response?.data?.errors;
    const description =
      Array.isArray(asaasErrors) && asaasErrors.length > 0
        ? asaasErrors.map((e: any) => e.description || e.code).join(' | ')
        : error?.response?.data?.message || fallbackMessage;

    throw new HttpException(
      { message: description, details: error?.response?.data || null },
      error?.response?.status || HttpStatus.BAD_REQUEST,
    );
  }

  // Clientes
  async findCustomerByCpfCnpj(cpfCnpj: string) {
    try {
      const { data } = await this.client.get('/customers', {
        params: { cpfCnpj },
        headers: this.getHeaders(),
      });
      return data?.data?.[0] || null;
    } catch (error) {
      this.handleError(error, 'Erro ao consultar cliente no Asaas.');
    }
  }

  async createCustomer(payload: {
    name: string;
    cpfCnpj: string;
    email?: string;
    mobilePhone?: string;
    postalCode?: string;
    addressNumber?: string;
    externalReference?: string;
    notificationDisabled?: boolean;
  }) {
    try {
      const { data } = await this.client.post('/customers', payload, {
        headers: this.getHeaders(),
      });
      return data;
    } catch (error) {
      this.handleError(error, 'Erro ao cadastrar cliente no Asaas.');
    }
  }

  // Assinaturas Recorrentes (Ciclo Mensal)
  async createSubscription(payload: Record<string, any>) {
    try {
      const { data } = await this.client.post('/subscriptions', payload, {
        headers: this.getHeaders(),
      });
      return data;
    } catch (error) {
      this.handleError(error, 'Erro ao criar assinatura mensal no Asaas.');
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Busca as cobranças da assinatura com retry (em produção o Asaas pode levar 1-3s para criar a 1ª parcela)
  async listSubscriptionPayments(subscriptionId: string, maxAttempts = 5) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data } = await this.client.get(`/subscriptions/${subscriptionId}/payments`, {
          headers: this.getHeaders(),
        });
        const list = data?.data || [];
        if (list.length > 0 || attempt === maxAttempts) {
          return list;
        }
      } catch (error) {
        if (attempt === maxAttempts) {
          this.handleError(error, 'Erro ao buscar cobranças da assinatura no Asaas.');
        }
      }
      await this.sleep(attempt * 900); // 900ms, 1.8s, 2.7s, 3.6s
    }
    return [];
  }

  // Busca o QR Code PIX com retry progressivo (evita retorno vazio por latência do BACEN/DICT)
  async getPixQrCode(
    paymentId: string,
    maxAttempts = 2,
  ): Promise<{
    encodedImage?: string;
    payload?: string;
    expirationDate?: string;
    permanentError?: boolean;
    errorMessage?: string;
  } | null> {
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data } = await this.client.get(`/payments/${paymentId}/pixQrCode`, {
          headers: this.getHeaders(),
        });
        if (data?.encodedImage && data?.payload) {
          return data;
        }
      } catch (error: any) {
        const status = error?.response?.status;
        const asaasErrors = error?.response?.data?.errors;
        const firstErr = Array.isArray(asaasErrors) ? asaasErrors[0] : null;
        lastError = error?.response?.data || error?.message;

        // Erro 400/401/403 (ex.: conta sem chave PIX ativa) não resolve com retry
        if (status === 400 || status === 401 || status === 403) {
          console.warn(
            `[Asaas] Erro definitivo ao gerar QR Code PIX (${paymentId}):`,
            lastError,
          );
          return {
            permanentError: true,
            errorMessage:
              firstErr?.description ||
              'O Asaas recusou o QR Code PIX. Verifique se há uma Chave PIX ativa na conta Asaas.',
          };
        }
      }

      if (attempt < maxAttempts) {
        await this.sleep(attempt * 800);
      }
    }

    console.warn(
      `[Asaas] QR Code PIX ainda indisponível para ${paymentId} após ${maxAttempts} tentativas:`,
      lastError,
    );
    return null;
  }
  async deleteSubscription(subscriptionId: string) {
    try {
      const { data } = await this.client.delete(`/subscriptions/${subscriptionId}`, {
        headers: this.getHeaders(),
      });
      return data;
    } catch (error) {
      this.handleError(error, 'Erro ao cancelar assinatura no Asaas.');
    }
  }

  // Cobranças Avulsas / Parceladas (Ciclo Anual: PIX, Boleto ou Cartão 1x..12x)
  async createPayment(payload: Record<string, any>) {
    try {
      const { data } = await this.client.post('/payments', payload, {
        headers: this.getHeaders(),
      });
      return data;
    } catch (error) {
      this.handleError(error, 'Erro ao gerar cobrança no Asaas.');
    }
  }

  async getPayment(paymentId: string) {
    try {
      const { data } = await this.client.get(`/payments/${paymentId}`, {
        headers: this.getHeaders(),
      });
      return data;
    } catch (error) {
      this.handleError(error, 'Erro ao consultar cobrança no Asaas.');
    }
  }


}
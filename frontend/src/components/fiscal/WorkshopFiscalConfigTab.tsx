import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Save,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileKey2,
  Wrench,
} from 'lucide-react';
import { api } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function WorkshopFiscalConfigTab() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [creatingService, setCreatingService] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const [form, setForm] = useState({
    workshopName: '',
    email: '',
    document: '',
    devnotaCompanyUuid: '',
    ambienteFiscal: 'sandbox',
    naturezaJuridica: 'PJ',
    regimeTributario: 'SIMPLES',
    cnae: '',
    inscricaoEstadual: '',
    inscricaoMunicipal: '',
    cep: '',
    logradouro: '',
    numeroEndereco: '',
    bairro: '',
    complemento: '',
    codigoIbge: '',
    serieNfe: 1,
    proximoNumeroNfe: 1,
    serieNfce: 1,
    proximoNumeroNfce: 1,
    serieRps: '1',
    proximoNumeroRps: 1,
    cscId: '',
    cscHomologacao: '',
    cscProducao: '',
    codigoServicoPadrao: '140101',
    certificadoVencimento: '',
  });

  // Certificado A1
  const [certBase64, setCertBase64] = useState('');
  const [certFileName, setCertFileName] = useState('');
  const [certPassword, setCertPassword] = useState('');
  const [certValidUntil, setCertValidUntil] = useState('');

  // Serviço padrão DevNota
  const [serviceTitle, setServiceTitle] = useState('Manutenção e reparação mecânica de veículos');
  const [serviceCode, setServiceCode] = useState('14.01');
  const [serviceMunicipalCode, setServiceMunicipalCode] = useState('1401');

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fiscal/status');
      setForm((prev) => ({
        ...prev,
        workshopName: data.workshopName || '',
        document: data.document || '',
        devnotaCompanyUuid: data.devnotaCompanyUuid || '',
        ambienteFiscal: data.ambienteFiscal || data.ambienteAtivo || 'sandbox',
        naturezaJuridica: data.naturezaJuridica || 'PJ',
        regimeTributario: data.regimeTributario || 'SIMPLES',
        cnae: data.cnae || '',
        inscricaoEstadual: data.inscricaoEstadual || '',
        inscricaoMunicipal: data.inscricaoMunicipal || '',
        cep: data.cep || '',
        logradouro: data.logradouro || '',
        numeroEndereco: data.numeroEndereco || '',
        bairro: data.bairro || '',
        complemento: data.complemento || '',
        codigoIbge: data.codigoIbge || '',
        serieNfe: data.serieNfe ?? 1,
        proximoNumeroNfe: data.proximoNumeroNfe ?? 1,
        serieNfce: data.serieNfce ?? 1,
        proximoNumeroNfce: data.proximoNumeroNfce ?? 1,
        serieRps: data.serieRps || '1',
        proximoNumeroRps: data.proximoNumeroRps ?? 1,
        cscId: data.cscId || '',
        cscHomologacao: data.cscHomologacao || '',
        cscProducao: data.cscProducao || '',
        codigoServicoPadrao: data.codigoServicoPadrao || '140101',
        certificadoVencimento: data.certificadoVencimento
          ? String(data.certificadoVencimento).slice(0, 10)
          : '',
      }));
    } catch {
      showToast('Erro ao carregar configurações fiscais.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleLookupCep = async (value: string) => {
    const clean = value.replace(/\D/g, '');
    setForm((p) => ({ ...p, cep: clean }));
    if (clean.length !== 8) return;

    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) {
        showToast('CEP não encontrado.', 'error');
        return;
      }
      setForm((p) => ({
        ...p,
        logradouro: data.logradouro || p.logradouro,
        bairro: data.bairro || p.bairro,
        codigoIbge: data.ibge || p.codigoIbge,
      }));
    } catch {
      showToast('Erro ao consultar ViaCEP.', 'error');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSaveLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/fiscal/settings', form);
      showToast('Configurações fiscais salvas com sucesso!', 'success');
      await loadStatus();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao salvar configurações fiscais.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncDevNota = async () => {
    setSyncing(true);
    try {
      await api.patch('/fiscal/settings', form);
      const { data } = await api.post('/fiscal/company/sync', {
        natureza: form.naturezaJuridica,
        nome: form.workshopName,
        nomeFantasia: form.workshopName,
        email: form.email || undefined,
        cnpj: form.document,
        cnae: form.cnae || undefined,
        codigoIbge: form.codigoIbge || undefined,
        cep: form.cep || undefined,
        endereco: form.logradouro || undefined,
        numero: form.numeroEndereco || undefined,
        bairro: form.bairro || undefined,
        complemento: form.complemento || undefined,
        regime: form.regimeTributario,
        im: form.inscricaoMunicipal || undefined,
        ie: form.inscricaoEstadual || undefined,
        cscId: form.cscId || undefined,
        cscHomologacao: form.cscHomologacao || undefined,
        cscProducao: form.cscProducao || undefined,
      });
      showToast(data?.message || 'Empresa sincronizada com a DevNota!', 'success');
      await loadStatus();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Falha ao sincronizar empresa na DevNota.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleCertFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCertFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setCertBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certBase64 || !certPassword || !certValidUntil) {
      showToast('Selecione o arquivo .pfx, digite a senha e informe a data de validade.', 'error');
      return;
    }
    setUploadingCert(true);
    try {
      await api.post('/fiscal/certificate', {
        certBase64,
        password: certPassword,
        validUntil: certValidUntil,
      });
      showToast('Certificado Digital A1 enviado com sucesso!', 'success');
      setCertPassword('');
      setCertBase64('');
      setCertFileName('');
      await loadStatus();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao enviar certificado A1.', 'error');
    } finally {
      setUploadingCert(false);
    }
  };

  const handleCreateDefaultService = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingService(true);
    try {
      await api.post('/fiscal/services', {
        titulo: serviceTitle,
        codigoServico: serviceCode,
        codigoTributacaoMunicipio: serviceMunicipalCode || undefined,
        tributacaoIssqn: 1,
        padrao: true,
      });
      showToast('Serviço padrão cadastrado na DevNota!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erro ao cadastrar serviço na DevNota.', 'error');
    } finally {
      setCreatingService(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-400">Carregando dados fiscais...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status de Integração */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="font-bold text-sm flex items-center gap-2">
              <span>Integração Fiscal DevNota v2</span>
              {form.devnotaCompanyUuid ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                  <CheckCircle2 className="w-3 h-3" /> Empresa Vinculada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                  <AlertTriangle className="w-3 h-3" /> Somente Sandbox (sem Company-uuid)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              UUID DevNota: <code className="text-slate-200">{form.devnotaCompanyUuid || 'Ainda não sincronizado'}</code>
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={syncing}
          onClick={handleSyncDevNota}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Sincronizando...' : 'Sincronizar Empresa na DevNota'}</span>
        </button>
      </div>

      {/* Formulário Principal */}
      <form onSubmit={handleSaveLocal} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-600 block mb-1">Ambiente Fiscal</label>
            <select
              value={form.ambienteFiscal}
              onChange={(e) => setForm((p) => ({ ...p, ambienteFiscal: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl bg-white font-semibold"
            >
              <option value="sandbox">SANDBOX (Testes fictícios sem certificado)</option>
              <option value="homologacao">HOMOLOGAÇÃO (Testes na SEFAZ/Prefeitura)</option>
              <option value="producao">PRODUÇÃO (Validade Fiscal Real)</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Regime Tributário</label>
            <select
              value={form.regimeTributario}
              onChange={(e) => setForm((p) => ({ ...p, regimeTributario: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl bg-white"
            >
              <option value="SIMPLES">Simples Nacional</option>
              <option value="MEI">MEI</option>
              <option value="SIMPLES_EXCESSO">Simples (Excesso Sublimite)</option>
              <option value="PRESUMIDO">Lucro Presumido</option>
              <option value="REAL">Lucro Real</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">CNPJ da Oficina</label>
            <input
              value={form.document}
              onChange={(e) => setForm((p) => ({ ...p, document: e.target.value }))}
              placeholder="Somente números"
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Inscrição Estadual (IE — NF-e/NFC-e)</label>
            <input
              value={form.inscricaoEstadual}
              onChange={(e) => setForm((p) => ({ ...p, inscricaoEstadual: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Inscrição Municipal (IM — NFS-e)</label>
            <input
              value={form.inscricaoMunicipal}
              onChange={(e) => setForm((p) => ({ ...p, inscricaoMunicipal: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">CNAE Principal</label>
            <input
              value={form.cnae}
              onChange={(e) => setForm((p) => ({ ...p, cnae: e.target.value }))}
              placeholder="Ex: 4520001"
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">E-mail Fiscal da Empresa</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="fiscal@suaoficina.com.br"
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">
              CEP {loadingCep && <span className="text-blue-600">(buscando...)</span>}
            </label>
            <input
              value={form.cep}
              maxLength={9}
              onChange={(e) => handleLookupCep(e.target.value)}
              placeholder="00000000"
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Código IBGE do Município (7 dígitos)</label>
            <input
              value={form.codigoIbge}
              maxLength={7}
              onChange={(e) => setForm((p) => ({ ...p, codigoIbge: e.target.value }))}
              placeholder="Ex: 3549805"
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>

          <div className="md:col-span-2">
            <label className="font-bold text-slate-600 block mb-1">Logradouro</label>
            <input
              value={form.logradouro}
              onChange={(e) => setForm((p) => ({ ...p, logradouro: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Número / Bairro</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Nº"
                value={form.numeroEndereco}
                onChange={(e) => setForm((p) => ({ ...p, numeroEndereco: e.target.value }))}
                className="px-3 py-2 border rounded-xl"
              />
              <input
                placeholder="Bairro"
                value={form.bairro}
                onChange={(e) => setForm((p) => ({ ...p, bairro: e.target.value }))}
                className="px-3 py-2 border rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Séries, Numeração e CSC */}
        <div className="pt-4 border-t grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-600 block mb-1">Série NF-e</label>
            <input
              type="number"
              value={form.serieNfe}
              onChange={(e) => setForm((p) => ({ ...p, serieNfe: Number(e.target.value) }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">Próx. NF-e</label>
            <input
              type="number"
              value={form.proximoNumeroNfe}
              onChange={(e) => setForm((p) => ({ ...p, proximoNumeroNfe: Number(e.target.value) }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">Série NFC-e</label>
            <input
              type="number"
              value={form.serieNfce}
              onChange={(e) => setForm((p) => ({ ...p, serieNfce: Number(e.target.value) }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">Próx. NFC-e</label>
            <input
              type="number"
              value={form.proximoNumeroNfce}
              onChange={(e) => setForm((p) => ({ ...p, proximoNumeroNfce: Number(e.target.value) }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">Série RPS</label>
            <input
              value={form.serieRps}
              onChange={(e) => setForm((p) => ({ ...p, serieRps: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">Próx. RPS</label>
            <input
              type="number"
              value={form.proximoNumeroRps}
              onChange={(e) => setForm((p) => ({ ...p, proximoNumeroRps: Number(e.target.value) }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs pt-2">
          <div>
            <label className="font-bold text-slate-600 block mb-1">ID do CSC (NFC-e)</label>
            <input
              placeholder="Ex: 000001"
              value={form.cscId}
              onChange={(e) => setForm((p) => ({ ...p, cscId: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">CSC Homologação</label>
            <input
              value={form.cscHomologacao}
              onChange={(e) => setForm((p) => ({ ...p, cscHomologacao: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">CSC Produção</label>
            <input
              value={form.cscProducao}
              onChange={(e) => setForm((p) => ({ ...p, cscProducao: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">Cód. Serviço Nacional (6 díg.)</label>
            <input
              maxLength={6}
              placeholder="140101"
              value={form.codigoServicoPadrao}
              onChange={(e) => setForm((p) => ({ ...p, codigoServicoPadrao: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações Fiscais'}</span>
          </button>
        </div>
      </form>

      {/* Certificado A1 + Serviço Padrão */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleUploadCertificate}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs shadow-xs"
        >
          <div className="flex items-center justify-between border-b pb-2.5">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <FileKey2 className="w-4 h-4 text-blue-600" />
              <span>Certificado Digital A1 (.pfx / .p12)</span>
            </h3>
            {form.certificadoVencimento && (
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                Válido até {form.certificadoVencimento}
              </span>
            )}
          </div>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Arquivo do Certificado (.pfx / .p12)</label>
            <input
              type="file"
              accept=".pfx,.p12"
              onChange={handleCertFile}
              className="w-full text-xs border rounded-xl p-2 bg-slate-50"
            />
            {certFileName && <span className="text-emerald-700 mt-1 block">Selecionado: {certFileName}</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-600 block mb-1">Senha do Certificado *</label>
              <input
                type="password"
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 block mb-1">Data de Validade *</label>
              <input
                type="date"
                value={certValidUntil}
                onChange={(e) => setCertValidUntil(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={uploadingCert || !form.devnotaCompanyUuid}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{uploadingCert ? 'Enviando...' : 'Enviar Certificado A1 para DevNota'}</span>
          </button>
        </form>

        <form
          onSubmit={handleCreateDefaultService}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-xs shadow-xs"
        >
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b pb-2.5">
            <Wrench className="w-4 h-4 text-blue-600" />
            <span>Serviço Padrão de NFS-e na DevNota</span>
          </h3>

          <div>
            <label className="font-bold text-slate-600 block mb-1">Descrição do Serviço</label>
            <input
              value={serviceTitle}
              onChange={(e) => setServiceTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-600 block mb-1">Código LC 116 (ex: 14.01)</label>
              <input
                value={serviceCode}
                onChange={(e) => setServiceCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 block mb-1">Cód. Tributação Municipal</label>
              <input
                value={serviceMunicipalCode}
                onChange={(e) => setServiceMunicipalCode(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creatingService || !form.devnotaCompanyUuid}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold cursor-pointer"
          >
            {creatingService ? 'Cadastrando...' : 'Vincular Serviço Padrão na DevNota'}
          </button>
        </form>
      </div>
    </div>
  );
}
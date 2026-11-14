import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Building2, Palette, Upload, Save, Trash2, FileText } from 'lucide-react';

export default function WorkshopSettingsPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('Oficina Pro');
  const [slogan, setSlogan] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0f172a');
  const [secondaryColor, setSecondaryColor] = useState('#16a34a');
  const [warrantyTerms, setWarrantyTerms] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      if (data) {
        setName(data.name || '');
        setSlogan(data.slogan || '');
        setDocument(data.document || '');
        setPhone(data.phone || '');
        setAddress(data.address || '');
        setLogoUrl(data.logoUrl || '');
        setPrimaryColor(data.primaryColor || '#0f172a');
        setSecondaryColor(data.secondaryColor || '#16a34a');
        setWarrantyTerms(data.warrantyTerms || '');
      }
    });
  }, []);

  // Converte a logo para Base64 leve (máx 400px de largura) para carregar instantaneamente no PDF
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = window.document.createElement('canvas');
        const maxW = 400;
        const scale = img.width > maxW ? maxW / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setLogoUrl(canvas.toDataURL('image/png', 0.9));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/settings', {
        name,
        slogan,
        document,
        phone,
        address,
        logoUrl,
        primaryColor,
        secondaryColor,
        warrantyTerms,
      });
      showToast('Identidade visual e dados da oficina salvos com sucesso!', 'success');
    } catch {
      showToast('Erro ao salvar configurações da oficina.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-blue-600" />
          Perfil & Identidade Visual da Oficina
        </h1>
        <p className="text-sm text-slate-500">
          Personalize a logo, cores, dados comerciais e termos de garantia exibidos nos PDFs e no Portal do Cliente.
        </p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 e 2: Dados Comerciais e Termos */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b pb-2">
            1. Dados da Empresa (Cabeçalho do PDF e Portal)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-600">Nome Fantasia da Oficina *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-bold"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-slate-600">Slogan / Especialidade</label>
              <input
                placeholder="Ex: Especializada em Injeção e Suspensão"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-600">CNPJ / CPF</label>
              <input
                placeholder="00.000.000/0001-00"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-600">Telefone / WhatsApp da Oficina</label>
              <input
                placeholder="(17) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="font-semibold text-slate-600">Endereço Completo</label>
            <input
              placeholder="Av. Brasil, 1500 - Centro - São José do Rio Preto/SP"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div className="text-xs pt-2">
            <label className="font-semibold text-slate-600 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Termos de Garantia / Rodapé do Orçamento em PDF
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Garantia de 90 dias sobre a mão de obra. Orçamento válido por 7 dias."
              value={warrantyTerms}
              onChange={(e) => setWarrantyTerms(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Coluna 3: Logo e Cores da Marca */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5 h-fit">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b pb-2 flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-blue-600" />
            2. Logo & Cores do PDF
          </h2>

          {/* Upload da Logo */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600">Logotipo da Oficina</label>
            {logoUrl ? (
              <div className="p-4 border rounded-xl bg-slate-50 flex flex-col items-center gap-3">
                <img src={logoUrl} alt="Logo Oficina" className="max-h-20 object-contain" />
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="text-xs text-red-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remover Logo
                </button>
              </div>
            ) : (
              <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400">
                Nenhuma logo enviada
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Enviar Imagem da Logo (PNG/JPG)
            </button>
          </div>

          {/* Seletor de Cores */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t text-xs">
            <div>
              <label className="font-semibold text-slate-600 block mb-1">Cor Principal</label>
              <div className="flex items-center gap-2 border p-1.5 rounded-lg">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <span className="font-mono font-bold text-slate-700">{primaryColor}</span>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-600 block mb-1">Cor Destaque (Total)</label>
              <div className="flex items-center gap-2 border p-1.5 rounded-lg">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <span className="font-mono font-bold text-slate-700">{secondaryColor}</span>
              </div>
            </div>
          </div>

          {/* Mini-Preview ao vivo do Cabeçalho */}
          <div className="pt-2">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
              Prévia do Cabeçalho (PDF e Portal)
            </span>
            <div
              style={{ backgroundColor: primaryColor }}
              className="p-3.5 rounded-xl text-white flex items-center gap-3 shadow-sm"
            >
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Preview"
                  className="h-10 w-auto bg-white p-1 rounded object-contain shrink-0"
                />
              )}
              <div className="truncate">
                <div className="font-extrabold text-sm truncate">{name || 'Nome da Oficina'}</div>
                <div className="text-[11px] opacity-80 truncate">{slogan || 'Centro Automotivo'}</div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Identidade da Oficina'}
          </button>
        </div>
      </form>
    </div>
  );
}
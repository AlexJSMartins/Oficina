// frontend/src/components/MaskedInputs.tsx
import React from 'react';
import { NumericFormat, PatternFormat } from 'react-number-format';

// 1. INPUT MONETÁRIO EM REAIS (R$)
interface CurrencyInputProps {
  value: number | string;
  onChangeValue: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  title?: string;
}

export function CurrencyInput({
  value,
  onChangeValue,
  placeholder = 'R$ 0,00',
  className = 'w-full px-3 py-2 border rounded-lg text-sm',
  required = false,
  title,
}: CurrencyInputProps) {
  return (
    <NumericFormat
      value={value}
      onValueChange={(values) => {
        // Devolve a string numérica padrão (ex: "150.50") para não quebrar seus estados atuais
        onChangeValue(values.value);
      }}
      thousandSeparator="."
      decimalSeparator=","
      prefix="R$ "
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      placeholder={placeholder}
      className={className}
      required={required}
      title={title}
    />
  );
}

// 2. INPUT DE TELEFONE / WHATSAPP ((00) 90000-0000)
interface MaskedTextInputProps {
  value: string;
  onChangeValue: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  onBlur?: () => void;
}

export function PhoneInput({
  value,
  onChangeValue,
  placeholder = '(17) 99999-9999',
  className = 'w-full px-3 py-2 border rounded-lg text-sm',
  required = false,
}: MaskedTextInputProps) {
  // Se tiver mais de 10 dígitos numéricos, usa máscara de 9 dígitos (celular), senão fixo
  const cleanDigits = String(value || '').replace(/\D/g, '');
  const format = cleanDigits.length > 10 ? '(##) #####-####' : '(##) ####-#####';

  return (
    <PatternFormat
      format={format}
      mask="_"
      value={value}
      onValueChange={(values) => {
        // Salva formatado "(17) 99999-9999" (ou use values.value se preferir salvar só números)
        onChangeValue(values.formattedValue);
      }}
      placeholder={placeholder}
      className={className}
      required={required}
    />
  );
}

// 3. INPUT DINÂMICO DE CPF OU CNPJ
export function DocumentInput({
  value,
  onChangeValue,
  placeholder = 'CPF ou CNPJ',
  className = 'w-full px-3 py-2 border rounded-lg text-sm',
  required = false,
}: MaskedTextInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
    let formatted = digits;

    if (digits.length <= 11) {
      // Máscara de CPF: 000.000.000-00
      formatted = digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // Máscara de CNPJ: 00.000.000/0000-00
      formatted = digits
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }

    onChangeValue(formatted);
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      required={required}
    />
  );
}

// 4. INPUT DE PLACA AUTOMOTIVA (MERCOSUL E ANTIGA)
export function PlateInput({
  value,
  onChangeValue,
  onBlur,
  placeholder = 'ABC1D23',
  className = 'w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase',
  required = false,
}: MaskedTextInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Mantém apenas letras e números, converte para maiúsculo e limita a 7 caracteres
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    onChangeValue(clean);
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder={placeholder}
      maxLength={7}
      className={className}
      required={required}
    />
  );
}
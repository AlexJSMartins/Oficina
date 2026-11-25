import React, { useEffect, useRef, useState } from 'react';
import { sysApi, SYS_TOKEN_KEY } from './sysApi';

interface ConsoleLoginTerminalProps {
  onAuthenticated: (user: { id: string; name: string; email: string; role: string }) => void;
}

interface TerminalLine {
  id: number;
  text: string;
  tone?: 'muted' | 'normal' | 'error' | 'success';
}

export default function ConsoleLoginTerminal({ onAuthenticated }: ConsoleLoginTerminalProps) {
  const [step, setStep] = useState<'LOGIN' | 'PASSWORD' | 'AUTH'>('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 1, text: 'OficinaPro OS 2.6 LTS (GNU/Linux x86_64) — tty1', tone: 'muted' },
    { id: 2, text: 'Restricted administrative console. Unauthorized access is prohibited.', tone: 'muted' },
    { id: 3, text: '', tone: 'muted' },
  ]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step, lines]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, step]);

  const appendLine = (text: string, tone: TerminalLine['tone'] = 'normal') => {
    setLines((prev) => [...prev, { id: Date.now() + Math.random(), text, tone }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === 'LOGIN') {
      const trimmed = username.trim();
      if (trimmed.toLowerCase() === 'clear') {
        setLines([]);
        setUsername('');
        return;
      }
      if (!trimmed) {
        appendLine('oficinapro login: ', 'normal');
        return;
      }
      appendLine(`oficinapro login: ${trimmed}`, 'normal');
      setPassword('');
      setStep('PASSWORD');
      return;
    }

    if (step === 'PASSWORD') {
      // Nunca exibe nem grava a senha no histórico da tela
      appendLine('Password: ', 'normal');
      setStep('AUTH');

      try {
        const { data } = await sysApi.post('/sys-auth/login', {
          email: username.trim(),
          password,
        });

        localStorage.setItem(SYS_TOKEN_KEY, data.accessToken);
        appendLine(`Welcome, ${data.user.email} (uid=0 root). Loading master console...`, 'success');

        setTimeout(() => {
          onAuthenticated(data.user);
        }, 450);
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Login incorrect';
        appendLine(typeof msg === 'string' ? msg : 'Login incorrect', 'error');
        appendLine('', 'muted');
        setUsername('');
        setPassword('');
        setStep('LOGIN');
      }
    }
  };

  const handleFocusTerminal = () => {
    inputRef.current?.focus();
  };

  return (
    <div
      onClick={handleFocusTerminal}
      className="min-h-screen w-full bg-[#07090d] text-[#d4e1d4] font-mono text-sm sm:text-[15px] p-5 sm:p-8 cursor-text select-none flex flex-col justify-between"
    >
      <div className="max-w-3xl w-full space-y-1">
        {lines.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap break-all leading-relaxed ${
              line.tone === 'muted'
                ? 'text-slate-500'
                : line.tone === 'error'
                ? 'text-red-400'
                : line.tone === 'success'
                ? 'text-emerald-400'
                : 'text-emerald-100'
            }`}
          >
            {line.text || '\u00A0'}
          </div>
        ))}

        {step !== 'AUTH' && (
          <form onSubmit={handleSubmit} className="relative flex items-center flex-wrap">
            <span className="text-emerald-400 mr-2">
              {step === 'LOGIN' ? 'oficinapro login:' : 'Password:'}
            </span>

            {/* Visualização fiel ao tty Linux: login visível, senha 100% invisível */}
            <span className="text-emerald-100 break-all">
              {step === 'LOGIN' ? username : ''}
            </span>

            {/* Cursor bloco piscante */}
            <span className="inline-block w-2.5 h-5 bg-emerald-400 animate-pulse ml-0.5 align-middle" />

            {/* Input real transparente para capturar teclado físico e mobile */}
            <input
              ref={inputRef}
              type={step === 'LOGIN' ? 'text' : 'password'}
              value={step === 'LOGIN' ? username : password}
              onChange={(e) =>
                step === 'LOGIN' ? setUsername(e.target.value) : setPassword(e.target.value)
              }
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              aria-label={step === 'LOGIN' ? 'Login' : 'Password'}
              className="opacity-0 absolute inset-0 w-full h-full cursor-text"
            />
          </form>
        )}

        {step === 'AUTH' && (
          <div className="text-slate-400 animate-pulse">Authenticating...</div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="text-[11px] text-slate-700 pt-8">
        tty1 • press Enter to submit • type &quot;clear&quot; to reset screen
      </div>
    </div>
  );
}
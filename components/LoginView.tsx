
import React, { useState } from 'react';
import { ShieldCheck, User, Lock, ArrowRight, Zap, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginViewProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  logoUrl: string;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, logoUrl }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await onLogin(email, password);
    } catch (err: any) {
      console.error("Login Error:", err);
      setError("E-mail ou senha incorretos. Verifique seus dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 mb-6 shadow-2xl animate-pulse-slow">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white text-center">
            CONCURSEIRO<span className="text-red-600">PRO</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-2 font-medium">Acesso Restrito ao Ecossistema</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900/40 border border-zinc-800/60 p-8 rounded-[2.5rem] backdrop-blur-xl shadow-2xl space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Endereço de E-mail</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-red-500 transition-colors" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="admin@exemplo.com"
                  className={`w-full bg-zinc-950 border ${error ? 'border-red-600/50' : 'border-zinc-800'} rounded-2xl pl-12 pr-4 py-4 text-white focus:border-red-600 outline-none transition-all placeholder:text-zinc-800`}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Senha de Acesso</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-red-500 transition-colors" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••••••"
                  className={`w-full bg-zinc-950 border ${error ? 'border-red-600/50' : 'border-zinc-800'} rounded-2xl pl-12 pr-12 py-4 text-white focus:border-red-600 outline-none transition-all placeholder:text-zinc-800`}
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-600/10 border border-red-600/50 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <p className="text-[11px] font-bold text-red-200 uppercase tracking-tight leading-tight">
                {error}
              </p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-red-600/30 group disabled:opacity-50"
          >
            {loading ? <Zap className="animate-spin" size={20} /> : (
              <>
                ENTRAR NO SISTEMA
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em]">
          <ShieldCheck size={14} />
          <span>Ambiente Criptografado</span>
        </div>
      </div>
    </div>
  );
};

export default LoginView;

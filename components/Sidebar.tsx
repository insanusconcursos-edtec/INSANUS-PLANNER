
import React, { useState } from 'react';
import { 
  Settings, Calendar, CheckCircle2, ShieldAlert,
  LogOut, Menu, X, ChevronRight, Maximize2
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentView: 'admin' | 'routine' | 'planning' | 'daily';
  setView: (view: 'admin' | 'routine' | 'planning' | 'daily') => void;
  logoUrl: string;
  role: UserRole;
  onLogout: () => void;
  isPreview?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, logoUrl, role, onLogout, isPreview }) => {
  const [isOpen, setIsOpen] = useState(false);

  const userItems = [
    { id: 'daily', label: 'Metas Diárias', icon: CheckCircle2 },
    { id: 'planning', label: 'Planejamento', icon: Calendar },
    { id: 'routine', label: 'Configurações', icon: Settings },
  ];

  const adminItems = isPreview ? userItems : [
    { id: 'admin', label: 'Dashboard Admin', icon: ShieldAlert },
    ...userItems
  ];

  const itemsToShow = role === 'ADMIN' ? adminItems : userItems;

  const navigate = (id: any) => {
    setView(id);
    setIsOpen(false);
  };

  const handleFullScreen = () => {
    // Abre a URL atual (seja do iframe ou direta) em uma nova aba
    window.open(window.location.href, '_blank');
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-[110] md:hidden bg-red-600 p-2 rounded-xl text-white shadow-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className={`
        fixed left-0 top-0 h-screen w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col z-[105] transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-8 flex flex-col items-center">
          <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 p-3 shadow-2xl mb-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-red-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain relative z-10" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-white">CONCURSEIRO<span className="text-red-600">PRO</span></h1>
          <div className="mt-2 text-[8px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Ambiente Seguro</div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {itemsToShow.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 translate-x-1' 
                    : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-white' : 'group-hover:text-red-500'} />
                  <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                </div>
                {isActive && <ChevronRight size={14} className="animate-pulse" />}
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-zinc-900 space-y-3">
          {/* Botão Tela Cheia */}
          <button 
            onClick={handleFullScreen}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-all font-bold text-xs"
            title="Abrir em uma nova aba"
          >
            <Maximize2 size={18} className="text-red-600" /> TELA CHEIA
          </button>

          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-600 hover:bg-red-950/20 hover:text-red-500 transition-all font-bold text-xs"
          >
            <LogOut size={18} /> SAIR DA CONTA
          </button>
          
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-zinc-800 font-black">Insanus v2.0-PRO</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

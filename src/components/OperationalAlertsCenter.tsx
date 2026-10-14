import React, { useState } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Volume2, 
  VolumeX, 
  X, 
  Clock, 
  ArrowRight,
  Filter,
  CheckCheck,
  PlusCircle,
  Radio,
  Wrench,
  Truck
} from 'lucide-react';
import { OperationalAlert } from '../types';
import { playOperationalSound, isSoundAlertsMuted, setSoundAlertsMuted } from '../utils/soundAlert';

interface OperationalAlertsCenterProps {
  alerts: OperationalAlert[];
  onTriggerAlert: (alert: Omit<OperationalAlert, 'id' | 'timestamp'>) => void;
  onMarkAsRead: (alertId: string) => void;
  onMarkAllAsRead: () => void;
  selectedBranchId: string;
  onSelectEquipment?: (equipmentTag: string) => void;
}

export const OperationalAlertsCenter: React.FC<OperationalAlertsCenterProps> = ({
  alerts,
  onTriggerAlert,
  onMarkAsRead,
  onMarkAllAsRead,
  selectedBranchId,
  onSelectEquipment
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => isSoundAlertsMuted());
  const [filterSeverity, setFilterSeverity] = useState<string>('todos');
  const [showManualModal, setShowManualModal] = useState(false);

  // Formulário de novo alerta manual
  const [manualForm, setManualForm] = useState({
    titulo: '',
    mensagem: '',
    severidade: 'alta' as OperationalAlert['severidade'],
    equipamento_tag: '',
    novo_status: 'Manutenção Corretiva'
  });

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    setSoundAlertsMuted(next);
    if (!next) {
      playOperationalSound('info');
    }
  };

  const unreadCount = alerts.filter(a => !a.lido).length;

  const filteredAlerts = alerts.filter(a => {
    if (filterSeverity !== 'todos' && a.severidade !== filterSeverity) return false;
    return true;
  });

  const latestAlert = alerts[0];

  const handleCreateManualAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.titulo || !manualForm.mensagem) return;

    onTriggerAlert({
      tipo: manualForm.equipamento_tag ? 'equipamento_status' : 'geral',
      titulo: manualForm.titulo,
      mensagem: manualForm.mensagem,
      severidade: manualForm.severidade,
      equipamento_tag: manualForm.equipamento_tag || undefined,
      novo_status: manualForm.novo_status || undefined,
      branchId: selectedBranchId !== 'all' ? selectedBranchId : 'vr',
      lido: false
    });

    setManualForm({
      titulo: '',
      mensagem: '',
      severidade: 'alta',
      equipamento_tag: '',
      novo_status: 'Manutenção Corretiva'
    });
    setShowManualModal(false);
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Agora mesmo';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Há ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Há ${diffHours}h`;
      return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Ticker / Barra Superior de Alertas Operacionais On-Time */}
      <div className="bg-gradient-to-r from-titam-deep via-[#1e3b33] to-titam-deep border border-titam-lime/20 rounded-2xl p-3 shadow-md text-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Lado Esquerdo: Indicador de Live Telemetria e Alerta Mais Recente */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <button
              onClick={() => setIsOpen(true)}
              className="relative p-2.5 bg-white/10 hover:bg-white/20 text-titam-lime rounded-xl transition flex items-center justify-center border border-titam-lime/30"
              title="Ver Central de Alertas Operacionais"
            >
              <Bell size={18} className={unreadCount > 0 ? 'animate-bounce' : ''} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-titam-deep animate-pulse shadow">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-titam-lime/15 text-titam-lime text-[10px] font-black tracking-wider uppercase border border-titam-lime/30">
                <span className="w-1.5 h-1.5 rounded-full bg-titam-lime animate-ping" />
                Live Feed Operacional
              </span>
              <span className="text-white/60 text-[11px] hidden sm:inline">
                Monitoramento instantâneo de status e máquinas
              </span>
            </div>

            {latestAlert ? (
              <div className="flex items-center gap-2 mt-1 truncate">
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 ${
                  latestAlert.severidade === 'critica' ? 'bg-rose-600 text-white' :
                  latestAlert.severidade === 'alta' ? 'bg-amber-500 text-white' :
                  'bg-emerald-600 text-white'
                }`}>
                  {latestAlert.severidade === 'critica' ? 'Crítico' : latestAlert.severidade === 'alta' ? 'Atenção' : 'Operacional'}
                </span>
                <span className="text-xs font-semibold text-white truncate">
                  {latestAlert.titulo}:
                </span>
                <span className="text-xs text-white/80 truncate hidden md:inline">
                  {latestAlert.mensagem}
                </span>
                <span className="text-[11px] text-white/50 shrink-0 font-mono">
                  ({formatTimeAgo(latestAlert.timestamp)})
                </span>
              </div>
            ) : (
              <p className="text-xs text-white/80 mt-1">
                Operação 100% estabilizada. Nenhuma ocorrência crítica registrada nas últimas horas.
              </p>
            )}
          </div>
        </div>

        {/* Lado Direito: Ações Rápidas */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition border ${
              isMuted 
                ? 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10' 
                : 'bg-titam-lime/20 text-titam-lime border-titam-lime/40 hover:bg-titam-lime/30'
            }`}
            title={isMuted ? 'Ativar avisos sonoros' : 'Silenciar avisos sonoros'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span className="hidden sm:inline">{isMuted ? 'Mudo' : 'Bip Ativo'}</span>
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition"
          >
            <PlusCircle size={15} className="text-titam-lime" />
            <span>+ Reportar Ocorrência</span>
          </button>

          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-titam-lime text-titam-deep text-xs font-black hover:bg-titam-lime/90 transition shadow"
          >
            <span>Ver Central ({alerts.length})</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* DRAWER / MODAL LATERAL DE ALERTAS OPERACIONAIS */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl border-l border-gray-200">
            {/* Header do Drawer */}
            <div className="p-4 bg-titam-deep text-white flex items-center justify-between border-b border-titam-lime/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-titam-lime/20 text-titam-lime border border-titam-lime/30">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">
                    Central de Alertas & Mudanças Operacionais
                  </h3>
                  <p className="text-[11px] text-white/70">
                    Linha do tempo de alterações de máquinas, manutenções e turnos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className={`p-1.5 rounded-lg border transition ${isMuted ? 'text-white/40 border-white/10' : 'text-titam-lime border-titam-lime/40 bg-titam-lime/10'}`}
                  title={isMuted ? 'Ativar som' : 'Mutar som'}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Barra de Filtros e Ações */}
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Filter size={14} className="text-gray-400" />
                <select
                  value={filterSeverity}
                  onChange={e => setFilterSeverity(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-2 py-1 font-bold text-gray-700"
                >
                  <option value="todos">Todos os Alertas ({alerts.length})</option>
                  <option value="critica">Apenas Críticos</option>
                  <option value="alta">Alta Severidade</option>
                  <option value="media">Média</option>
                  <option value="baixa">Informativos / Baixa</option>
                </select>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="flex items-center gap-1 text-titam-deep font-bold hover:underline"
                >
                  <CheckCheck size={14} />
                  <span>Marcar lidos ({unreadCount})</span>
                </button>
              )}
            </div>

            {/* Lista de Alertas */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <CheckCircle size={40} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                  <p className="font-bold text-gray-600">Nenhum alerta registrado no filtro selecionado</p>
                  <p className="text-xs text-gray-400 mt-1">O pátio está operando sem pendências ativas.</p>
                </div>
              ) : (
                filteredAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      alert.lido 
                        ? 'bg-white border-gray-200 opacity-90' 
                        : alert.severidade === 'critica'
                        ? 'bg-rose-50/80 border-rose-200 shadow-sm'
                        : alert.severidade === 'alta'
                        ? 'bg-amber-50/80 border-amber-200 shadow-sm'
                        : 'bg-emerald-50/50 border-emerald-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {alert.severidade === 'critica' && (
                          <span className="p-1 rounded-md bg-rose-600 text-white shrink-0">
                            <AlertTriangle size={14} />
                          </span>
                        )}
                        {alert.severidade === 'alta' && (
                          <span className="p-1 rounded-md bg-amber-500 text-white shrink-0">
                            <Wrench size={14} />
                          </span>
                        )}
                        {(alert.severidade === 'media' || alert.severidade === 'baixa') && (
                          <span className="p-1 rounded-md bg-emerald-600 text-white shrink-0">
                            <CheckCircle size={14} />
                          </span>
                        )}

                        <span className="font-bold text-xs text-gray-900">
                          {alert.titulo}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 shrink-0 font-mono">
                        <Clock size={12} />
                        <span>{formatTimeAgo(alert.timestamp)}</span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-700 leading-relaxed mb-2.5">
                      {alert.mensagem}
                    </p>

                    {/* Meta informações: mudança de status anterior -> novo */}
                    {(alert.status_anterior || alert.novo_status || alert.equipamento_tag) && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-[11px]">
                        {alert.equipamento_tag && (
                          <span className="px-2 py-0.5 rounded font-black bg-gray-100 text-gray-800 border border-gray-200">
                            {alert.equipamento_tag}
                          </span>
                        )}

                        {alert.status_anterior && alert.novo_status && (
                          <div className="flex items-center gap-1 font-bold">
                            <span className="text-gray-500">{alert.status_anterior}</span>
                            <ArrowRight size={11} className="text-gray-400" />
                            <span className={`px-1.5 py-0.5 rounded ${
                              alert.novo_status === 'Manutenção Corretiva' ? 'bg-rose-100 text-rose-700 font-black' :
                              alert.novo_status === 'Operando' ? 'bg-emerald-100 text-emerald-800 font-black' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {alert.novo_status}
                            </span>
                          </div>
                        )}

                        {alert.equipamento_tag && onSelectEquipment && (
                          <button
                            onClick={() => {
                              onSelectEquipment(alert.equipamento_tag!);
                              setIsOpen(false);
                            }}
                            className="ml-auto text-titam-deep font-bold hover:underline flex items-center gap-1"
                          >
                            <span>Ver Máquina</span>
                            <ArrowRight size={11} />
                          </button>
                        )}

                        {!alert.lido && (
                          <button
                            onClick={() => onMarkAsRead(alert.id)}
                            className="ml-auto text-gray-500 hover:text-titam-deep font-semibold"
                          >
                            Marcar lido
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer com botão de criar alerta */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setShowManualModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-titam-deep text-titam-lime font-black text-xs hover:bg-titam-deep/90 transition shadow"
              >
                <PlusCircle size={15} />
                <span>+ Reportar Nova Ocorrência Operacional</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE NOVO ALERTA OPERACIONAL MANUAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
            <div className="bg-titam-deep p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio size={18} className="text-titam-lime" />
                <h3 className="font-bold text-sm uppercase">Reportar Alerta Operacional</h3>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateManualAlert} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Título do Alerta</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Parada de Máquina ou Fila no Carregamento"
                  value={manualForm.titulo}
                  onChange={e => setManualForm({ ...manualForm, titulo: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Severidade</label>
                  <select
                    value={manualForm.severidade}
                    onChange={e => setManualForm({ ...manualForm, severidade: e.target.value as any })}
                    className="w-full p-2 border border-gray-200 rounded-xl font-bold"
                  >
                    <option value="critica">🚨 Crítica (Parada Geral)</option>
                    <option value="alta">⚠️ Alta (Parada Máquina)</option>
                    <option value="media">🟡 Média (Atenção)</option>
                    <option value="baixa">🟢 Baixa (Informativa)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">TAG Equipamento (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: RS-01, EF-03"
                    value={manualForm.equipamento_tag}
                    onChange={e => setManualForm({ ...manualForm, equipamento_tag: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-xl font-mono font-bold uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Descrição Detalhada / Motivo</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva o motivo da ocorrência, operador envolvido ou impacto no pátio..."
                  value={manualForm.mensagem}
                  onChange={e => setManualForm({ ...manualForm, mensagem: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-500 font-bold hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-titam-deep text-titam-lime font-black shadow-md hover:bg-titam-deep/90 transition"
                >
                  Disparar Alerta aos Usuários
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

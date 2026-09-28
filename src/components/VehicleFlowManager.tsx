import React, { useState, useMemo } from 'react';
import { 
  Truck, Clock, CheckCircle2, ArrowDownRight, ArrowUpRight, 
  CalendarClock, Search, Filter, QrCode, Play, Check, 
  UserCheck, AlertCircle, FileText, ChevronRight
} from 'lucide-react';
import { Entry, Appointment, AppointmentStatus, Branch } from '../types';

interface VehicleFlowManagerProps {
  yardEntries: Entry[];
  appointments: Appointment[];
  selectedBranchId: string;
  branches: Branch[];
  onQuickEntryStatusUpdate: (id: string | number, type: 'chegada' | 'entrada' | 'saida') => Promise<void>;
  onUpdateAppointmentStatus: (appointmentId: string, status: AppointmentStatus) => Promise<void>;
  onCreateEntryOrExitFromAppointment: (appointment: Appointment) => Promise<void>;
  onOpenTransporterAccessModal: () => void;
  onNavigateToScheduling: () => void;
  calculateTimeDiff: (start?: string, end?: string) => string;
}

export const VehicleFlowManager: React.FC<VehicleFlowManagerProps> = ({
  yardEntries,
  appointments,
  selectedBranchId,
  branches,
  onQuickEntryStatusUpdate,
  onUpdateAppointmentStatus,
  onCreateEntryOrExitFromAppointment,
  onOpenTransporterAccessModal,
  onNavigateToScheduling,
  calculateTimeDiff
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [operationFilter, setOperationFilter] = useState<'all' | 'carga' | 'descarga'>('all');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filtrar agendamentos de hoje relevantes para a filial
  const todayAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (a.data_agendamento !== todayStr) return false;
      if (a.status === 'cancelado') return false;
      if (selectedBranchId !== 'all' && a.branchId && a.branchId !== selectedBranchId) return false;
      return true;
    });
  }, [appointments, todayStr, selectedBranchId]);

  // Agendados Aguardando Chegada
  const scheduledAwaiting = useMemo(() => {
    return todayAppointments.filter(a => a.status === 'agendado').filter(a => {
      if (operationFilter !== 'all' && a.tipo_operacao !== operationFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          a.placa_veiculo?.toLowerCase().includes(term) ||
          a.motorista_nome?.toLowerCase().includes(term) ||
          a.transportadora?.toLowerCase().includes(term) ||
          a.protocolo?.toLowerCase().includes(term)
        );
      }
      return true;
    }).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }, [todayAppointments, operationFilter, searchTerm]);

  // Fila Externa (Pátio de Espera)
  // Combina entries com hora_chegada && !hora_entrada e appointments em_patio
  const externalQueue = useMemo(() => {
    const list: Array<{
      type: 'entry' | 'appointment';
      id: string | number;
      placa: string;
      carreta?: string;
      motorista?: string;
      transportadora: string;
      produto?: string;
      peso?: number;
      horaChegada: string;
      operation: 'carga' | 'descarga';
      rawAppointment?: Appointment;
    }> = [];

    // Agendamentos em pátio
    todayAppointments.filter(a => a.status === 'em_patio').forEach(a => {
      list.push({
        type: 'appointment',
        id: a.id,
        placa: a.placa_veiculo,
        carreta: a.placa_carreta,
        motorista: a.motorista_nome,
        transportadora: a.transportadora,
        produto: a.descricao_produto,
        peso: a.peso_estimado_toneladas,
        horaChegada: a.hora_chegada_real || a.hora_inicio,
        operation: a.tipo_operacao,
        rawAppointment: a
      });
    });

    // Yard entries que não correspondam à mesma placa já adicionada
    const existingPlacas = new Set(list.map(i => i.placa.toUpperCase().replace(/[^A-Z0-9]/g, '')));
    yardEntries
      .filter(e => e.hora_chegada && !e.hora_entrada)
      .forEach(e => {
        const cleanPlaca = (e.placa_veiculo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!existingPlacas.has(cleanPlaca)) {
          list.push({
            type: 'entry',
            id: e.id,
            placa: e.placa_veiculo || 'SEM PLACA',
            carreta: e.container,
            transportadora: e.transportador || e.fornecedor || 'Não informado',
            produto: e.descricao_produto,
            peso: Number(e.tonelada) || 0,
            horaChegada: e.hora_chegada || '',
            operation: (e.status === 'Embarcado' || (e as any).tipo_operacao === 'carga') ? 'carga' : 'descarga'
          });
        }
      });

    return list.filter(item => {
      if (operationFilter !== 'all' && item.operation !== operationFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.placa.toLowerCase().includes(term) ||
          item.transportadora.toLowerCase().includes(term) ||
          item.motorista?.toLowerCase().includes(term)
        );
      }
      return true;
    }).sort((a, b) => (b.horaChegada || '').localeCompare(a.horaChegada || ''));
  }, [todayAppointments, yardEntries, operationFilter, searchTerm]);

  // Fila Interna (Em Operação)
  const internalQueue = useMemo(() => {
    const list: Array<{
      type: 'entry' | 'appointment';
      id: string | number;
      placa: string;
      carreta?: string;
      motorista?: string;
      transportadora: string;
      produto?: string;
      peso?: number;
      horaChegada?: string;
      horaEntrada: string;
      operation: 'carga' | 'descarga';
      rawAppointment?: Appointment;
    }> = [];

    todayAppointments.filter(a => a.status === 'em_operacao').forEach(a => {
      list.push({
        type: 'appointment',
        id: a.id,
        placa: a.placa_veiculo,
        carreta: a.placa_carreta,
        motorista: a.motorista_nome,
        transportadora: a.transportadora,
        produto: a.descricao_produto,
        peso: a.peso_estimado_toneladas,
        horaChegada: a.hora_chegada_real,
        horaEntrada: a.hora_inicio_operacao || a.hora_inicio,
        operation: a.tipo_operacao,
        rawAppointment: a
      });
    });

    const existingPlacas = new Set(list.map(i => i.placa.toUpperCase().replace(/[^A-Z0-9]/g, '')));
    yardEntries
      .filter(e => e.hora_entrada && !e.hora_saida)
      .forEach(e => {
        const cleanPlaca = (e.placa_veiculo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!existingPlacas.has(cleanPlaca)) {
          list.push({
            type: 'entry',
            id: e.id,
            placa: e.placa_veiculo || 'SEM PLACA',
            carreta: e.container,
            transportadora: e.transportador || e.fornecedor || 'Não informado',
            produto: e.descricao_produto,
            peso: Number(e.tonelada) || 0,
            horaChegada: e.hora_chegada,
            horaEntrada: e.hora_entrada || '',
            operation: (e.status === 'Embarcado' || (e as any).tipo_operacao === 'carga') ? 'carga' : 'descarga'
          });
        }
      });

    return list.filter(item => {
      if (operationFilter !== 'all' && item.operation !== operationFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.placa.toLowerCase().includes(term) ||
          item.transportadora.toLowerCase().includes(term) ||
          item.motorista?.toLowerCase().includes(term)
        );
      }
      return true;
    }).sort((a, b) => (b.horaEntrada || '').localeCompare(a.horaEntrada || ''));
  }, [todayAppointments, yardEntries, operationFilter, searchTerm]);

  // Saídas de Hoje
  const completedQueue = useMemo(() => {
    const list: Array<{
      type: 'entry' | 'appointment';
      id: string | number;
      placa: string;
      carreta?: string;
      motorista?: string;
      transportadora: string;
      produto?: string;
      peso?: number;
      horaChegada?: string;
      horaEntrada?: string;
      horaSaida: string;
      operation: 'carga' | 'descarga';
      stockCreated?: boolean;
      rawAppointment?: Appointment;
    }> = [];

    todayAppointments.filter(a => a.status === 'concluido').forEach(a => {
      list.push({
        type: 'appointment',
        id: a.id,
        placa: a.placa_veiculo,
        carreta: a.placa_carreta,
        motorista: a.motorista_nome,
        transportadora: a.transportadora,
        produto: a.descricao_produto,
        peso: a.peso_estimado_toneladas,
        horaChegada: a.hora_chegada_real,
        horaEntrada: a.hora_inicio_operacao,
        horaSaida: a.hora_conclusao_operacao || a.hora_fim,
        operation: a.tipo_operacao,
        stockCreated: (a as any).stock_entry_created || false,
        rawAppointment: a
      });
    });

    const existingPlacas = new Set(list.map(i => i.placa.toUpperCase().replace(/[^A-Z0-9]/g, '')));
    yardEntries
      .filter(e => e.hora_saida)
      .forEach(e => {
        const cleanPlaca = (e.placa_veiculo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!existingPlacas.has(cleanPlaca)) {
          list.push({
            type: 'entry',
            id: e.id,
            placa: e.placa_veiculo || 'SEM PLACA',
            carreta: e.container,
            transportadora: e.transportador || e.fornecedor || 'Não informado',
            produto: e.descricao_produto,
            peso: Number(e.tonelada) || 0,
            horaChegada: e.hora_chegada,
            horaEntrada: e.hora_entrada,
            horaSaida: e.hora_saida || '',
            operation: (e.status === 'Embarcado' || (e as any).tipo_operacao === 'carga') ? 'carga' : 'descarga',
            stockCreated: true
          });
        }
      });

    return list.filter(item => {
      if (operationFilter !== 'all' && item.operation !== operationFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.placa.toLowerCase().includes(term) ||
          item.transportadora.toLowerCase().includes(term) ||
          item.motorista?.toLowerCase().includes(term)
        );
      }
      return true;
    }).sort((a, b) => (b.horaSaida || '').localeCompare(a.horaSaida || ''));
  }, [todayAppointments, yardEntries, operationFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Banner de Integração */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-titam-deep tracking-tight">
              Fluxo de Veículos & Controle de Pátio
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-titam-lime text-titam-deep uppercase">
              Operação Integrada
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Gestão ponta a ponta: Agendamento prévio ➔ Portaria externa ➔ Balança & Operação ➔ Integração com Estoque (Entrada / Saída).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenTransporterAccessModal}
            className="px-3.5 py-2 bg-titam-deep text-white hover:bg-titam-deep/90 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
          >
            <QrCode size={16} className="text-titam-lime" />
            <span>Link / QR Code Transportador</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToScheduling}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <CalendarClock size={16} />
            <span>Painel de Janelas</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas em Tempo Real */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
            <CalendarClock size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase">Agendados Hoje</span>
            <p className="text-xl font-black text-gray-900">{todayAppointments.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase">Fila Externa</span>
            <p className="text-xl font-black text-blue-700">{externalQueue.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
            <Truck size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase">Em Operação</span>
            <p className="text-xl font-black text-amber-700">{internalQueue.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-400 uppercase">Saídas Hoje</span>
            <p className="text-xl font-black text-emerald-700">{completedQueue.length}</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-500 flex items-center gap-1 mr-1">
            <Filter size={14} />
            <span>Operação:</span>
          </span>
          <button
            type="button"
            onClick={() => setOperationFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              operationFilter === 'all'
                ? 'bg-titam-deep text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setOperationFilter('descarga')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              operationFilter === 'descarga'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <ArrowDownRight size={13} />
            <span>Descarga (Entrada)</span>
          </button>
          <button
            type="button"
            onClick={() => setOperationFilter('carga')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              operationFilter === 'carga'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            <ArrowUpRight size={13} />
            <span>Carga (Saída)</span>
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por placa, motorista ou transportadora..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-xs rounded-xl pl-8 pr-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none"
          />
        </div>
      </div>

      {/* Quadro Kanban Operacional de 4 Colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">

        {/* 1. AGENDADOS HOJE (AGUARDANDO CHEGADA) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3.5 bg-indigo-700 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} />
              <h3 className="font-black text-xs uppercase tracking-wider">Agendados Hoje</h3>
            </div>
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-black">
              {scheduledAwaiting.length}
            </span>
          </div>

          <div className="p-3 space-y-3 max-h-[680px] overflow-y-auto">
            {scheduledAwaiting.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-xs italic">
                Nenhum agendamento pendente de chegada para hoje
              </p>
            ) : (
              scheduledAwaiting.map(appt => (
                <div key={appt.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2.5 hover:border-indigo-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-black text-gray-900 tracking-wide">{appt.placa_veiculo}</span>
                      {appt.placa_carreta && (
                        <span className="text-[10px] text-gray-500 font-bold ml-1.5">/ {appt.placa_carreta}</span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {appt.hora_inicio} - {appt.hora_fim}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-0.5 ${
                      appt.tipo_operacao === 'descarga'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {appt.tipo_operacao === 'descarga' ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                      {appt.tipo_operacao === 'descarga' ? 'Descarga (Entrada)' : 'Carga (Saída)'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-600 truncate">
                      {appt.peso_estimado_toneladas} t • {appt.descricao_produto}
                    </span>
                  </div>

                  <div className="text-[11px] text-gray-600 leading-tight">
                    <p className="font-bold text-gray-800 truncate">{appt.motorista_nome}</p>
                    <p className="text-[10px] text-gray-500 truncate">{appt.transportadora}</p>
                    {(appt.pedido_lote || appt.nf_numero) && (
                      <p className="text-[9px] text-titam-deep font-bold mt-0.5 truncate">
                        {[appt.pedido_lote ? `Ped: ${appt.pedido_lote}` : '', appt.nf_numero ? `NF: ${appt.nf_numero}` : ''].filter(Boolean).join(' | ')}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateAppointmentStatus(appt.id, 'em_patio')}
                    className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-[10px] font-black rounded-lg transition-colors uppercase flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <UserCheck size={13} />
                    <span>Registrar Chegada na Portaria</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. FILA EXTERNA (PÁTIO DE ESPERA) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3.5 bg-blue-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <h3 className="font-black text-xs uppercase tracking-wider">Fila Externa</h3>
            </div>
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-black">
              {externalQueue.length}
            </span>
          </div>

          <div className="p-3 space-y-3 max-h-[680px] overflow-y-auto">
            {externalQueue.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-xs italic">
                Nenhum veículo aguardando no pátio externo
              </p>
            ) : (
              externalQueue.map(item => (
                <div key={`${item.type}-${item.id}`} className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2.5 hover:border-blue-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-black text-gray-900 tracking-wide">{item.placa}</span>
                      {item.carreta && (
                        <span className="text-[10px] text-gray-500 font-bold ml-1.5">/ {item.carreta}</span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Chegada: {item.horaChegada}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-0.5 ${
                      item.operation === 'descarga'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.operation === 'descarga' ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                      {item.operation === 'descarga' ? 'Descarga' : 'Carga'}
                    </span>
                    {item.type === 'appointment' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-titam-deep text-titam-lime">
                        Agendado
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-600 leading-tight">
                    {item.motorista && <p className="font-bold text-gray-800 truncate">{item.motorista}</p>}
                    <p className="text-[10px] text-gray-500 truncate">{item.transportadora}</p>
                    {item.produto && (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {item.peso ? `${item.peso}t • ` : ''}{item.produto}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (item.type === 'appointment') {
                        onUpdateAppointmentStatus(String(item.id), 'em_operacao');
                      } else {
                        onQuickEntryStatusUpdate(item.id, 'entrada');
                      }
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-lg transition-colors uppercase flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Play size={13} />
                    <span>Registrar Entrada / Iniciar</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. FILA INTERNA (EM OPERAÇÃO) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3.5 bg-amber-500 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Truck size={16} />
              <h3 className="font-black text-xs uppercase tracking-wider">Fila Interna</h3>
            </div>
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-black">
              {internalQueue.length}
            </span>
          </div>

          <div className="p-3 space-y-3 max-h-[680px] overflow-y-auto">
            {internalQueue.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-xs italic">
                Nenhum veículo em operação interna
              </p>
            ) : (
              internalQueue.map(item => (
                <div key={`${item.type}-${item.id}`} className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2.5 hover:border-amber-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-black text-gray-900 tracking-wide">{item.placa}</span>
                      {item.carreta && (
                        <span className="text-[10px] text-gray-500 font-bold ml-1.5">/ {item.carreta}</span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Entrada: {item.horaEntrada}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-0.5 ${
                      item.operation === 'descarga'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.operation === 'descarga' ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                      {item.operation === 'descarga' ? 'Descarga (Recebimento)' : 'Carga (Expedição)'}
                    </span>
                    {item.type === 'appointment' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-titam-deep text-titam-lime">
                        Agendado
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-600 leading-tight">
                    {item.motorista && <p className="font-bold text-gray-800 truncate">{item.motorista}</p>}
                    <p className="text-[10px] text-gray-500 truncate">{item.transportadora}</p>
                    {item.produto && (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {item.peso ? `${item.peso}t • ` : ''}{item.produto}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (item.type === 'appointment' && item.rawAppointment) {
                        await onUpdateAppointmentStatus(String(item.id), 'concluido');
                        const isDescarga = item.operation === 'descarga';
                        const promptMsg = isDescarga
                          ? `Veículo liberado! Deseja lançar agora a ENTRADA deste material no Estoque?`
                          : `Veículo liberado! Deseja lançar agora a SAÍDA / EMBARQUE deste material no Estoque?`;
                        if (confirm(promptMsg)) {
                          await onCreateEntryOrExitFromAppointment(item.rawAppointment);
                        }
                      } else {
                        onQuickEntryStatusUpdate(item.id, 'saida');
                      }
                    }}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black rounded-lg transition-colors uppercase flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Check size={13} />
                    <span>Registrar Saída / Concluir</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. SAÍDAS DE HOJE */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3.5 bg-titam-lime text-titam-deep flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <h3 className="font-black text-xs uppercase tracking-wider">Saídas de Hoje</h3>
            </div>
            <span className="bg-titam-deep/10 px-2 py-0.5 rounded text-xs font-black">
              {completedQueue.length}
            </span>
          </div>

          <div className="p-3 space-y-3 max-h-[680px] overflow-y-auto">
            {completedQueue.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-xs italic">
                Nenhuma saída registrada hoje
              </p>
            ) : (
              completedQueue.map(item => (
                <div key={`${item.type}-${item.id}`} className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2.5 hover:border-emerald-300 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-black text-gray-900 tracking-wide">{item.placa}</span>
                      {item.carreta && (
                        <span className="text-[10px] text-gray-500 font-bold ml-1.5">/ {item.carreta}</span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Saída: {item.horaSaida}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-0.5 ${
                      item.operation === 'descarga'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.operation === 'descarga' ? 'Descarga' : 'Carga'}
                    </span>
                    {item.horaChegada && item.horaSaida && (
                      <span className="text-[10px] font-bold text-gray-500">
                        Tempo: {calculateTimeDiff(item.horaChegada, item.horaSaida)}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-600 leading-tight">
                    {item.motorista && <p className="font-bold text-gray-800 truncate">{item.motorista}</p>}
                    <p className="text-[10px] text-gray-500 truncate">{item.transportadora}</p>
                    {item.produto && (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {item.peso ? `${item.peso}t • ` : ''}{item.produto}
                      </p>
                    )}
                  </div>

                  {/* Integração com Estoque */}
                  {item.type === 'appointment' && item.rawAppointment && !item.stockCreated && (
                    <button
                      type="button"
                      onClick={() => onCreateEntryOrExitFromAppointment(item.rawAppointment!)}
                      className={`w-full py-1.5 text-white text-[10px] font-black rounded-lg transition-colors uppercase flex items-center justify-center gap-1.5 shadow-sm ${
                        item.operation === 'descarga'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <FileText size={12} />
                      <span>
                        {item.operation === 'descarga' ? 'Lançar Entrada no Estoque' : 'Lançar Saída de Estoque'}
                      </span>
                    </button>
                  )}

                  {item.stockCreated && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 size={12} />
                      <span>Registrado no Estoque</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

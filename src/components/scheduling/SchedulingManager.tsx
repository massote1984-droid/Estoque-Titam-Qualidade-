import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  FileText, 
  Download, 
  Plus, 
  Filter, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Scale, 
  Building2, 
  Settings, 
  CalendarClock, 
  Trash2, 
  ExternalLink, 
  RefreshCw, 
  Eye, 
  Check, 
  X, 
  Play, 
  CheckSquare, 
  FileSpreadsheet, 
  AlertTriangle,
  UserCheck,
  QrCode,
  ArrowDownRight,
  Share2
} from 'lucide-react';
import { Appointment, SlotConfig, Branch, Transporter, Entry } from '../../types';
import { calculateSlotAvailability, exportAppointmentsToExcel, generateAppointmentVoucherPDF, DEFAULT_HOURLY_SLOTS } from './schedulingUtils';
import { addDoc, collection, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../firebase';
import TransporterPortal from './TransporterPortal';
import { TransporterAccessModal } from './TransporterAccessModal';

interface SchedulingManagerProps {
  user: any;
  branches: Branch[];
  selectedBranchId: string;
  slotConfigs: SlotConfig[];
  appointments: Appointment[];
  transporters: Transporter[];
  onOpenTransporterPortal?: () => void;
  onAddStockEntryFromAppointment?: (appointment: Appointment) => void;
}

export default function SchedulingManager({
  user,
  branches,
  selectedBranchId,
  slotConfigs,
  appointments,
  transporters,
  onOpenTransporterPortal,
  onAddStockEntryFromAppointment
}: SchedulingManagerProps) {
  const [subTab, setSubTab] = useState<'monitor' | 'configuracao' | 'portal'>('monitor');
  const [filterDate, setFilterDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [filterOperation, setFilterOperation] = useState<'todos' | 'carga' | 'descarga'>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);

  // Estados de edição de configuração de janela
  const [isConfiguringNewSlot, setIsConfiguringNewSlot] = useState(false);
  const [slotHoraInicio, setSlotHoraInicio] = useState('07:00');
  const [slotHoraFim, setSlotHoraFim] = useState('08:00');
  const [slotTipoLimite, setSlotTipoLimite] = useState<'veiculos' | 'volume'>('veiculos');
  const [slotLimiteVeiculos, setSlotLimiteVeiculos] = useState<number>(4);
  const [slotLimiteVolume, setSlotLimiteVolume] = useState<number>(120);
  const [slotOperacaoPermitida, setSlotOperacaoPermitida] = useState<'todos' | 'carga' | 'descarga'>('todos');
  const [slotBranchId, setSlotBranchId] = useState<string>(selectedBranchId === 'all' ? (branches[0]?.id || 'titam') : selectedBranchId);
  const [isSavingSlot, setIsSavingSlot] = useState(false);

  // Filial ativa
  const currentBranch = useMemo(() => {
    return branches.find(b => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  // Janelas configuradas para a filial atual (ou padrão se vazio)
  const branchSlots = useMemo(() => {
    const targetBranch = selectedBranchId === 'all' ? (branches[0]?.id || 'titam') : selectedBranchId;
    const filtered = slotConfigs.filter(s => s.branchId === targetBranch || s.branchId === 'all');
    if (filtered.length > 0) {
      return [...filtered].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    }
    return DEFAULT_HOURLY_SLOTS.map((s, idx) => ({
      id: `mock-${targetBranch}-${idx}`,
      branchId: targetBranch,
      hora_inicio: s.hora_inicio,
      hora_fim: s.hora_fim,
      tipo_limite: s.tipo_limite,
      limite_veiculos: s.limite_veiculos,
      limite_volume_toneladas: s.limite_volume_toneladas,
      tipo_operacao_permitida: s.tipo_operacao_permitida,
      ativo: true
    })) as SlotConfig[];
  }, [slotConfigs, selectedBranchId, branches]);

  // Agendamentos filtrados
  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      // Filial
      if (selectedBranchId !== 'all' && a.branchId !== selectedBranchId) return false;
      // Data
      if (filterDate && a.data_agendamento !== filterDate) return false;
      // Operação
      if (filterOperation !== 'todos' && a.tipo_operacao !== filterOperation) return false;
      // Status
      if (filterStatus !== 'todos' && a.status !== filterStatus) return false;
      // Busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchProto = a.protocolo?.toLowerCase().includes(term);
        const matchPlaca = a.placa_veiculo?.toLowerCase().includes(term);
        const matchCarreta = a.placa_carreta?.toLowerCase().includes(term);
        const matchMotorista = a.motorista_nome?.toLowerCase().includes(term);
        const matchTransp = a.transportadora?.toLowerCase().includes(term);
        const matchProduto = a.descricao_produto?.toLowerCase().includes(term);
        const matchNf = a.nf_numero?.toLowerCase().includes(term);
        const matchPedido = a.pedido_lote?.toLowerCase().includes(term);
        if (!matchProto && !matchPlaca && !matchCarreta && !matchMotorista && !matchTransp && !matchProduto && !matchNf && !matchPedido) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }, [appointments, selectedBranchId, filterDate, filterOperation, filterStatus, searchTerm]);

  // Agendamentos na data para cálculo de ocupação das janelas
  const dateAppointments = useMemo(() => {
    return appointments.filter(a => a.data_agendamento === filterDate && a.status !== 'cancelado');
  }, [appointments, filterDate]);

  // Disponibilidade de cada janela para a data
  const slotsStatus = useMemo(() => {
    return branchSlots.map(slot => {
      return calculateSlotAvailability(slot, dateAppointments);
    });
  }, [branchSlots, dateAppointments]);

  // Métricas do dia
  const stats = useMemo(() => {
    const total = filteredAppointments.length;
    const carga = filteredAppointments.filter(a => a.tipo_operacao === 'carga').length;
    const descarga = filteredAppointments.filter(a => a.tipo_operacao === 'descarga').length;
    const totalToneladas = filteredAppointments.reduce((sum, a) => sum + (Number(a.peso_estimado_toneladas) || 0), 0);
    const emPatio = filteredAppointments.filter(a => a.status === 'em_patio' || a.status === 'em_operacao').length;
    const concluidos = filteredAppointments.filter(a => a.status === 'concluido').length;
    
    // Ocupação média das janelas ativas
    const totalSlots = slotsStatus.length;
    const avgOcupacao = totalSlots > 0 
      ? Math.round(slotsStatus.reduce((sum, s) => sum + s.percentualOcupacao, 0) / totalSlots)
      : 0;

    return { total, carga, descarga, totalToneladas, emPatio, concluidos, avgOcupacao };
  }, [filteredAppointments, slotsStatus]);

  // Ações de status do agendamento
  const handleUpdateStatus = async (appointmentId: string, newStatus: Appointment['status']) => {
    try {
      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const updates: any = {
        status: newStatus,
        updated_at: serverTimestamp()
      };

      if (newStatus === 'em_patio') {
        updates.hora_chegada_real = nowTime;
      } else if (newStatus === 'em_operacao') {
        updates.hora_inicio_operacao = nowTime;
      } else if (newStatus === 'concluido') {
        updates.hora_conclusao_operacao = nowTime;
      }

      await updateDoc(doc(db, COLLECTIONS.appointments, appointmentId), updates);
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      alert('Erro ao atualizar status: ' + err.message);
    }
  };

  // Inicializar janelas padrão no Firestore para a filial
  const handleInitializeDefaultSlots = async () => {
    if (!confirm('Deseja criar as janelas horárias recomendadas para esta filial no banco de dados?')) return;
    try {
      setIsSavingSlot(true);
      const targetBranch = selectedBranchId === 'all' ? (branches[0]?.id || 'titam') : selectedBranchId;
      const batch = writeBatch(db);

      for (const slot of DEFAULT_HOURLY_SLOTS) {
        const docRef = doc(collection(db, COLLECTIONS.slot_configs));
        batch.set(docRef, {
          branchId: targetBranch,
          hora_inicio: slot.hora_inicio,
          hora_fim: slot.hora_fim,
          tipo_limite: slot.tipo_limite,
          limite_veiculos: slot.limite_veiculos,
          limite_volume_toneladas: slot.limite_volume_toneladas,
          tipo_operacao_permitida: slot.tipo_operacao_permitida,
          ativo: true,
          created_at: serverTimestamp(),
          uid: user?.uid || 'admin'
        });
      }

      await batch.commit();
      alert('Janelas padrão salvas com sucesso no banco!');
    } catch (err: any) {
      alert('Erro ao inicializar janelas: ' + err.message);
    } finally {
      setIsSavingSlot(false);
    }
  };

  // Salvar nova configuração de janela horária
  const handleSaveSlotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingSlot(true);
      await addDoc(collection(db, COLLECTIONS.slot_configs), {
        branchId: slotBranchId,
        hora_inicio: slotHoraInicio,
        hora_fim: slotHoraFim,
        tipo_limite: slotTipoLimite,
        limite_veiculos: Number(slotLimiteVeiculos),
        limite_volume_toneladas: Number(slotLimiteVolume),
        tipo_operacao_permitida: slotOperacaoPermitida,
        ativo: true,
        created_at: serverTimestamp(),
        uid: user?.uid || 'admin'
      });
      setIsConfiguringNewSlot(false);
      alert('Janela horária configurada com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar janela: ' + err.message);
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleDeleteSlotConfig = async (slotId: string) => {
    if (!confirm('Deseja excluir esta configuração de janela?')) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.slot_configs, slotId));
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleToggleSlotActive = async (slot: SlotConfig) => {
    if (!slot.id || slot.id.startsWith('mock-')) {
      alert('Para alterar janelas pré-carregadas, clique primeiro em "Salvar Janelas Padrão no Banco".');
      return;
    }
    try {
      await updateDoc(doc(db, COLLECTIONS.slot_configs, slot.id), {
        ativo: !slot.ativo,
        updated_at: serverTimestamp()
      });
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Título e Sub-Abas do Módulo */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-titam-deep tracking-tight">
              Agendamento & Gestão de Pátio
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-titam-lime text-titam-deep">
              Módulo Nativo 100% Autocontido
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Controle de janelas horárias, limite por veículos ou volume, e gestão de portaria de carga/descarga.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSubTab('monitor')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                subTab === 'monitor'
                  ? 'bg-titam-deep text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Quadro de Agendamentos
            </button>
            <button
              type="button"
              onClick={() => setSubTab('configuracao')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                subTab === 'configuracao'
                  ? 'bg-titam-deep text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings size={14} />
              <span>Janelas por Hora</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('portal')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                subTab === 'portal'
                  ? 'bg-titam-lime text-titam-deep shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Truck size={14} />
              <span>Canal do Transportador</span>
            </button>
          </div>

            <button
              type="button"
              onClick={() => setIsAccessModalOpen(true)}
              className="px-3 py-2 bg-titam-deep text-white hover:bg-titam-deep/90 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Obter Link Direto e QR Code para os Transportadores"
            >
              <QrCode size={14} className="text-titam-lime" />
              <span>Link & QR Code</span>
            </button>
            <button
              type="button"
              onClick={() => exportAppointmentsToExcel(filteredAppointments, currentBranch?.name || 'Titam', filterDate)}
              className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              title="Exportar agendamentos do dia para Excel"
            >
              <FileSpreadsheet size={14} />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>
          </div>
        </div>

      {/* TELA 1: MONITOR E LINHA DO TEMPO DE AGENDAMENTOS */}
      {subTab === 'monitor' && (
        <div className="space-y-6">
          {/* Banner Informativo do Canal do Transportador */}
          <div className="bg-gradient-to-r from-titam-deep to-[#162d27] p-5 rounded-2xl text-white flex flex-wrap items-center justify-between gap-4 shadow-sm border border-titam-deep">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-titam-lime text-titam-deep flex items-center justify-center font-black shrink-0 shadow-md">
                <QrCode size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Canal do Transportador Disponível</span>
                  <span className="text-[10px] bg-titam-lime text-titam-deep font-black px-2 py-0.5 rounded-full uppercase">
                    Acesso Direto Sem Senha
                  </span>
                </h3>
                <p className="text-xs text-white/70 mt-0.5">
                  Motoristas e transportadoras podem agendar a <strong>Carga (Saída)</strong> ou <strong>Descarga (Entrada)</strong> diretamente pelo celular via link compartilhado ou QR Code na portaria.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAccessModalOpen(true)}
                className="px-4 py-2 bg-titam-lime hover:bg-titam-lime/90 text-titam-deep font-black text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              >
                <QrCode size={14} />
                <span>Ver Link & QR Code</span>
              </button>
            </div>
          </div>

          {/* CARDS DE INDICADORES / KPIS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Agendados no Dia</span>
              <p className="text-2xl font-black text-titam-deep mt-1">{stats.total}</p>
              <span className="text-[10px] text-gray-500">veículos esperados</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Carga (Retirada)</span>
              <p className="text-2xl font-black text-blue-700 mt-1">{stats.carga}</p>
              <span className="text-[10px] text-blue-500">veículos de saída</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Descarga (Entrega)</span>
              <p className="text-2xl font-black text-emerald-700 mt-1">{stats.descarga}</p>
              <span className="text-[10px] text-emerald-500">veículos de entrada</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Volume Total</span>
              <p className="text-2xl font-black text-gray-900 mt-1">{stats.totalToneladas.toFixed(1)} <span className="text-xs font-medium">t</span></p>
              <span className="text-[10px] text-gray-500">toneladas previstas</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Em Pátio / Operação</span>
              <p className="text-2xl font-black text-amber-700 mt-1">{stats.emPatio}</p>
              <span className="text-[10px] text-amber-500">presentes no terminal</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-bold text-titam-deep uppercase tracking-wider">Ocupação das Janelas</span>
              <p className="text-2xl font-black text-titam-deep mt-1">{stats.avgOcupacao}%</p>
              <span className="text-[10px] text-gray-500">média de lotação</span>
            </div>
          </div>

          {/* GRADE VISUAL DAS JANELAS DO DIA (OCUPAÇÃO EM TEMPO REAL) */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-titam-deep uppercase tracking-wider">
                  Ocupação das Janelas por Hora • {filterDate.split('-').reverse().join('/')}
                </h3>
                <p className="text-xs text-gray-400">
                  Capacidade configurada por veículos ou volume em toneladas para a unidade {currentBranch?.name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-titam-deep"
                />
                <button
                  type="button"
                  onClick={() => setFilterDate(new Date().toISOString().slice(0, 10))}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Hoje
                </button>
              </div>
            </div>

            {/* Linha horizontal com as janelas horárias */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-2">
              {slotsStatus.map(({ slot, veiculosAgendados, volumeAgendado, disponivel, percentualOcupacao }) => {
                const isFull = !disponivel || percentualOcupacao >= 100;
                const isWarning = percentualOcupacao >= 75 && !isFull;

                return (
                  <div
                    key={slot.hora_inicio}
                    className={`p-3 rounded-2xl border text-xs transition-all ${
                      isFull
                        ? 'bg-red-50/70 border-red-200 text-red-900'
                        : isWarning
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : 'bg-gray-50 border-gray-200 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-black mb-1">
                      <span>{slot.hora_inicio}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        isFull ? 'bg-red-200 text-red-800' : isWarning ? 'bg-amber-200 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {percentualOcupacao}%
                      </span>
                    </div>

                    <div className="space-y-0.5 text-[11px]">
                      {slot.tipo_limite === 'volume' ? (
                        <p className="font-semibold">{volumeAgendado.toFixed(1)}t / {slot.limite_volume_toneladas}t</p>
                      ) : (
                        <p className="font-semibold">{veiculosAgendados} / {slot.limite_veiculos} vagas</p>
                      )}
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-1 mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isFull ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percentualOcupacao}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FILTROS E TABELA DE AGENDAMENTOS */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Busca */}
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Placa, Protocolo, Motorista..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                  />
                </div>

                {/* Filtro Operação */}
                <select
                  value={filterOperation}
                  onChange={e => setFilterOperation(e.target.value as any)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-titam-deep"
                >
                  <option value="todos">Todas Operações</option>
                  <option value="carga">Somente Carga</option>
                  <option value="descarga">Somente Descarga</option>
                </select>

                {/* Filtro Status */}
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-titam-deep"
                >
                  <option value="todos">Todos Status</option>
                  <option value="agendado">Agendado</option>
                  <option value="em_patio">Em Pátio (Chegou)</option>
                  <option value="em_operacao">Em Operação</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div className="text-xs text-gray-500 font-bold">
                {filteredAppointments.length} agendamento(s) listado(s)
              </div>
            </div>

            {/* TABELA */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                    <th className="py-3 px-3">Janela</th>
                    <th className="py-3 px-3">Operação</th>
                    <th className="py-3 px-3">Protocolo</th>
                    <th className="py-3 px-3">Veículo / Placas</th>
                    <th className="py-3 px-3">Motorista</th>
                    <th className="py-3 px-3">Transportadora</th>
                    <th className="py-3 px-3">Carga / Volume</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Ações de Portaria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400">
                        <CalendarClock size={36} className="mx-auto mb-2 opacity-40" />
                        <p className="font-bold">Nenhum agendamento encontrado para este filtro.</p>
                        <p className="text-[11px] mt-1">
                          Use a aba "Canal do Transportador" para realizar um novo agendamento ou altere a data.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map(appointment => (
                      <tr key={appointment.id} className="hover:bg-gray-50/80 transition-colors">
                        {/* Janela */}
                        <td className="py-3 px-3 font-bold text-gray-900 whitespace-nowrap">
                          {appointment.hora_inicio} - {appointment.hora_fim}
                        </td>

                        {/* Operação */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            appointment.tipo_operacao === 'carga'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {appointment.tipo_operacao}
                          </span>
                        </td>

                        {/* Protocolo */}
                        <td className="py-3 px-3 font-mono font-bold text-titam-deep whitespace-nowrap">
                          {appointment.protocolo}
                        </td>

                        {/* Veículo */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-black text-gray-900">{appointment.placa_veiculo}</span>
                          {appointment.placa_carreta && (
                            <span className="text-gray-400 ml-1">/ {appointment.placa_carreta}</span>
                          )}
                          <div className="text-[10px] text-gray-400">{appointment.tipo_veiculo || 'Carreta'}</div>
                        </td>

                        {/* Motorista */}
                        <td className="py-3 px-3">
                          <p className="font-bold text-gray-900 truncate max-w-[140px]">{appointment.motorista_nome}</p>
                          {appointment.motorista_telefone && (
                            <p className="text-[10px] text-gray-400">{appointment.motorista_telefone}</p>
                          )}
                        </td>

                        {/* Transportadora */}
                        <td className="py-3 px-3 font-medium text-gray-700 truncate max-w-[130px]">
                          {appointment.transportadora}
                        </td>

                        {/* Carga / Volume */}
                        <td className="py-3 px-3">
                          <span className="font-black text-gray-900">{appointment.peso_estimado_toneladas} t</span>
                          <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{appointment.descricao_produto}</p>
                          {(appointment.nf_numero || appointment.pedido_lote) && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {appointment.nf_numero && (
                                <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                                  NF: {appointment.nf_numero}
                                </span>
                              )}
                              {appointment.pedido_lote && (
                                <span className="text-[9px] font-black text-titam-deep bg-titam-deep/5 border border-titam-deep/15 px-1.5 py-0.2 rounded">
                                  Ped: {appointment.pedido_lote}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            appointment.status === 'agendado' ? 'bg-amber-100 text-amber-800' :
                            appointment.status === 'em_patio' ? 'bg-sky-100 text-sky-800' :
                            appointment.status === 'em_operacao' ? 'bg-purple-100 text-purple-800' :
                            appointment.status === 'concluido' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {appointment.status.replace('_', ' ')}
                          </span>
                          {appointment.hora_chegada_real && (
                            <div className="text-[9px] text-gray-400 mt-0.5">Chegada: {appointment.hora_chegada_real}</div>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {appointment.status === 'agendado' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(appointment.id, 'em_patio')}
                                className="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-[10px] font-bold border border-sky-200 transition-all flex items-center gap-1"
                                title="Confirmar chegada do veículo na portaria"
                              >
                                <UserCheck size={12} />
                                <span>Chegou Portaria</span>
                              </button>
                            )}

                            {appointment.status === 'em_patio' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(appointment.id, 'em_operacao')}
                                className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-[10px] font-bold border border-purple-200 transition-all flex items-center gap-1"
                                title="Iniciar Carga ou Descarga"
                              >
                                <Play size={12} />
                                <span>Iniciar Operação</span>
                              </button>
                            )}

                            {appointment.status === 'em_operacao' && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateStatus(appointment.id, 'concluido');
                                  const isDescarga = appointment.tipo_operacao === 'descarga';
                                  const promptQuestion = isDescarga
                                    ? 'Operação de DESCARGA concluída! Deseja lançar a ENTRADA deste material no Estoque agora?'
                                    : 'Operação de CARGA concluída! Deseja lançar a SAÍDA / EMBARQUE deste material no Estoque agora?';
                                  if (onAddStockEntryFromAppointment && confirm(promptQuestion)) {
                                    onAddStockEntryFromAppointment(appointment);
                                  }
                                }}
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold border border-emerald-200 transition-all flex items-center gap-1"
                                title="Concluir Operação de Carga/Descarga"
                              >
                                <Check size={12} />
                                <span>Concluir</span>
                              </button>
                            )}

                            {/* Lançamento direto de Entrada (Descarga) ou Saída (Carga) */}
                            {onAddStockEntryFromAppointment && (appointment.status === 'em_patio' || appointment.status === 'em_operacao' || appointment.status === 'concluido') && !(appointment as any).stock_entry_created && (
                              <button
                                type="button"
                                onClick={() => {
                                  const isDescarga = appointment.tipo_operacao === 'descarga';
                                  const promptMsg = isDescarga
                                    ? `Deseja registrar a ENTRADA no estoque da carga de ${appointment.descricao_produto} (${appointment.peso_estimado_toneladas}t)?`
                                    : `Deseja registrar a SAÍDA do estoque (embarque) da carga de ${appointment.descricao_produto} (${appointment.peso_estimado_toneladas}t)?`;
                                  if (confirm(promptMsg)) {
                                    onAddStockEntryFromAppointment(appointment);
                                  }
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border shadow-xs ${
                                  appointment.tipo_operacao === 'descarga'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
                                }`}
                                title={appointment.tipo_operacao === 'descarga' ? 'Lançar Entrada no Estoque' : 'Lançar Saída de Estoque'}
                              >
                                {appointment.tipo_operacao === 'descarga' ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
                                <span>{appointment.tipo_operacao === 'descarga' ? 'Lançar Entrada' : 'Lançar Saída'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => generateAppointmentVoucherPDF(appointment, branches.find(b => b.id === appointment.branchId))}
                              className="p-1.5 text-gray-500 hover:text-titam-deep hover:bg-gray-100 rounded-lg"
                              title="Baixar Comprovante PDF"
                            >
                              <Download size={14} />
                            </button>

                            {appointment.status !== 'cancelado' && appointment.status !== 'concluido' && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Deseja cancelar este agendamento?')) {
                                    handleUpdateStatus(appointment.id, 'cancelado');
                                  }
                                }}
                                className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg"
                                title="Cancelar Agendamento"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TELA 2: CONFIGURAÇÃO DE JANELAS POR HORA (VEÍCULOS OU VOLUME) */}
      {subTab === 'configuracao' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-titam-deep">
                  Janelas Operacionais por Hora • Unidade {currentBranch?.name}
                </h3>
                <p className="text-xs text-gray-500">
                  Defina os horários disponíveis e se a capacidade limite é controlada por <strong>Quantidade de Veículos</strong> ou por <strong>Volume em Toneladas</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInitializeDefaultSlots}
                  disabled={isSavingSlot}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  <span>Salvar Janelas Padrão no Banco</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsConfiguringNewSlot(true)}
                  className="px-4 py-2 bg-titam-deep text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all flex items-center gap-1.5 shadow"
                >
                  <Plus size={14} />
                  <span>Nova Janela Horária</span>
                </button>
              </div>
            </div>

            {/* Modal / Formulário de Nova Janela */}
            {isConfiguringNewSlot && (
              <form onSubmit={handleSaveSlotConfig} className="p-5 bg-titam-deep text-white rounded-2xl space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-titam-lime">Configurar Nova Janela</h4>
                  <button type="button" onClick={() => setIsConfiguringNewSlot(false)} className="text-white/60 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">Filial *</label>
                    <select
                      value={slotBranchId}
                      onChange={e => setSlotBranchId(e.target.value)}
                      className="w-full p-2.5 bg-white/10 border border-white/20 rounded-xl text-white font-semibold"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id} className="text-gray-900">{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">Horário Inicial *</label>
                    <input
                      type="time"
                      required
                      value={slotHoraInicio}
                      onChange={e => setSlotHoraInicio(e.target.value)}
                      className="w-full p-2.5 bg-white/10 border border-white/20 rounded-xl text-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">Horário Final *</label>
                    <input
                      type="time"
                      required
                      value={slotHoraFim}
                      onChange={e => setSlotHoraFim(e.target.value)}
                      className="w-full p-2.5 bg-white/10 border border-white/20 rounded-xl text-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">Critério de Capacidade *</label>
                    <select
                      value={slotTipoLimite}
                      onChange={e => setSlotTipoLimite(e.target.value as any)}
                      className="w-full p-2.5 bg-white/10 border border-white/20 rounded-xl text-white font-semibold"
                    >
                      <option value="veiculos" className="text-gray-900">Por Veículos (Vagas)</option>
                      <option value="volume" className="text-gray-900">Por Volume (Toneladas)</option>
                    </select>
                  </div>

                  {slotTipoLimite === 'veiculos' ? (
                    <div>
                      <label className="block text-[11px] font-bold text-white/80 mb-1">Limite Máx. de Veículos / Hora *</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        required
                        value={slotLimiteVeiculos}
                        onChange={e => setSlotLimiteVeiculos(parseInt(e.target.value) || 1)}
                        className="w-full p-2.5 bg-white/10 border border-white/20 rounded-xl text-white font-semibold"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-white/80 mb-1">Limite Máx. Volume (Toneladas / Hora) *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={slotLimiteVolume}
                        onChange={e => setSlotLimiteVolume(parseFloat(e.target.value) || 1)}
                        className="w-full p-2.5 bg-white/10 border border-white/20 rounded-xl text-white font-semibold"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">Tipo de Operação Admitida *</label>
                    <select
                      value={slotOperacaoPermitida}
                      onChange={e => setSlotOperacaoPermitida(e.target.value as any)}
                      className="w-full p-2.5 bg-white/10 border border-white/20 rounded-xl text-white font-semibold"
                    >
                      <option value="todos" className="text-gray-900">Misto (Carga e Descarga)</option>
                      <option value="descarga" className="text-gray-900">Exclusivo Descarga (Entrega)</option>
                      <option value="carga" className="text-gray-900">Exclusivo Carga (Retirada)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsConfiguringNewSlot(false)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSlot}
                    className="px-5 py-2 bg-titam-lime text-titam-deep rounded-xl text-xs font-black shadow hover:opacity-90"
                  >
                    {isSavingSlot ? 'Salvando...' : 'Salvar Janela'}
                  </button>
                </div>
              </form>
            )}

            {/* Lista das Janelas Atuais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {branchSlots.map(slot => (
                <div
                  key={slot.id}
                  className={`p-4 rounded-2xl border text-xs relative ${
                    slot.ativo === false
                      ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-60'
                      : 'bg-gray-50 border-gray-200 text-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-black text-sm">
                    <span className="text-titam-deep">{slot.hora_inicio} às {slot.hora_fim}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      slot.tipo_limite === 'volume' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {slot.tipo_limite === 'volume' ? 'Por Volume' : 'Por Veículos'}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Capacidade Máxima:</span>
                      <strong className="text-gray-900">
                        {slot.tipo_limite === 'volume'
                          ? `${slot.limite_volume_toneladas} Toneladas`
                          : `${slot.limite_veiculos} Veículos`}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Operação:</span>
                      <span className="font-semibold capitalize text-gray-700">
                        {slot.tipo_operacao_permitida === 'todos' ? 'Misto (Carga/Descarga)' : slot.tipo_operacao_permitida}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200/60 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleToggleSlotActive(slot)}
                      className={`font-bold hover:underline ${slot.ativo !== false ? 'text-amber-600' : 'text-emerald-600'}`}
                    >
                      {slot.ativo !== false ? 'Desativar' : 'Ativar Janela'}
                    </button>

                    {!slot.id.startsWith('mock-') && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSlotConfig(slot.id)}
                        className="text-red-500 hover:text-red-700 font-bold"
                        title="Excluir janela"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TELA 3: CANAL DO TRANSPORTADOR EMBUTIDO */}
      {subTab === 'portal' && (
        <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
          <div className="p-4 bg-titam-deep border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-titam-lime">
              Ambiente do Canal do Transportador (Acesso Autônomo para Transportadoras)
            </span>
            {onOpenTransporterPortal && (
              <button
                type="button"
                onClick={onOpenTransporterPortal}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <ExternalLink size={14} />
                <span>Abrir em Tela Cheia</span>
              </button>
            )}
          </div>
          <TransporterPortal
            branches={branches}
            slotConfigs={slotConfigs}
            appointments={appointments}
            transporters={transporters}
            isEmbedded={true}
          />
        </div>
      )}

      {/* Modal de Compartilhamento e QR Code para Transportadores */}
      <TransporterAccessModal
        isOpen={isAccessModalOpen}
        onClose={() => setIsAccessModalOpen(false)}
        onOpenPortal={() => {
          setIsAccessModalOpen(false);
          if (onOpenTransporterPortal) {
            onOpenTransporterPortal();
          } else {
            setSubTab('portal');
          }
        }}
      />
    </div>
  );
}

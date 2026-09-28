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
  Copy, 
  Check, 
  ArrowLeft, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Scale, 
  MapPin, 
  ShieldCheck, 
  Phone, 
  User, 
  Building, 
  Package, 
  CalendarClock,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { Appointment, SlotConfig, Branch, Transporter } from '../../types';
import { calculateSlotAvailability, generateProtocol, generateAppointmentVoucherPDF, DEFAULT_HOURLY_SLOTS } from './schedulingUtils';
import { addDoc, collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../firebase';

interface TransporterPortalProps {
  branches: Branch[];
  slotConfigs: SlotConfig[];
  appointments: Appointment[];
  transporters?: Transporter[];
  onBackToApp?: () => void;
  onAppointmentCreated?: (appointment: Appointment) => void;
  isEmbedded?: boolean;
}

export default function TransporterPortal({
  branches,
  slotConfigs,
  appointments,
  transporters = [],
  onBackToApp,
  onAppointmentCreated,
  isEmbedded = false
}: TransporterPortalProps) {
  const [portalView, setPortalView] = useState<'agendar' | 'consultar' | 'sucesso'>('agendar');

  // Form states
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || 'titam');
  const [operationType, setOperationType] = useState<'carga' | 'descarga'>('descarga');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    // Default to today or tomorrow
    return today.toISOString().slice(0, 10);
  });
  const [selectedSlotHour, setSelectedSlotHour] = useState<string>('');
  
  // Data fields
  const [transportadora, setTransportadora] = useState('');
  const [cnpjTransportadora, setCnpjTransportadora] = useState('');
  const [placaVeiculo, setPlacaVeiculo] = useState('');
  const [placaCarreta, setPlacaCarreta] = useState('');
  const [tipoVeiculo, setTipoVeiculo] = useState('Carreta LS');
  const [motoristaNome, setMotoristaNome] = useState('');
  const [motoristaCpf, setMotoristaCpf] = useState('');
  const [motoristaTelefone, setMotoristaTelefone] = useState('');
  const [descricaoProduto, setDescricaoProduto] = useState('Bobinas de Aço / Sucata / Carga Geral');
  const [pesoEstimado, setPesoEstimado] = useState<number>(30);
  const [nfNumero, setNfNumero] = useState('');
  const [pedidoLote, setPedidoLote] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Search & Result states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<Appointment | null>(null);
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Success state
  const [lastCreatedAppointment, setLastCreatedAppointment] = useState<Appointment | null>(null);
  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Filial ativa selecionada
  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  // Lista de janelas aplicáveis para a filial selecionada
  const applicableSlots = useMemo(() => {
    const branchSlots = slotConfigs.filter(
      s => s.ativo !== false && (s.branchId === selectedBranchId || s.branchId === 'all')
    );
    if (branchSlots.length > 0) {
      return branchSlots.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
    }

    // Se a filial ainda não tiver janelas customizadas no Firestore, usa as janelas padrão com o ID da filial
    return DEFAULT_HOURLY_SLOTS.map((s, idx) => ({
      id: `default-${selectedBranchId}-${idx}`,
      branchId: selectedBranchId,
      hora_inicio: s.hora_inicio,
      hora_fim: s.hora_fim,
      tipo_limite: s.tipo_limite,
      limite_veiculos: s.limite_veiculos,
      limite_volume_toneladas: s.limite_volume_toneladas,
      tipo_operacao_permitida: s.tipo_operacao_permitida,
      ativo: true
    })) as SlotConfig[];
  }, [slotConfigs, selectedBranchId]);

  // Agendamentos na data selecionada
  const appointmentsOnDate = useMemo(() => {
    return appointments.filter(a => a.data_agendamento === selectedDate && a.status !== 'cancelado');
  }, [appointments, selectedDate]);

  // Disponibilidade calculada de cada janela
  const slotsWithAvailability = useMemo(() => {
    return applicableSlots.map(slot => {
      const avail = calculateSlotAvailability(
        slot,
        appointmentsOnDate,
        operationType,
        pesoEstimado || 0
      );
      return avail;
    });
  }, [applicableSlots, appointmentsOnDate, operationType, pesoEstimado]);

  // Validação do formulário
  const isFormValid = useMemo(() => {
    return (
      selectedBranchId &&
      selectedDate &&
      selectedSlotHour &&
      transportadora.trim() &&
      placaVeiculo.trim() &&
      motoristaNome.trim() &&
      descricaoProduto.trim() &&
      Number(pesoEstimado) > 0
    );
  }, [
    selectedBranchId,
    selectedDate,
    selectedSlotHour,
    transportadora,
    placaVeiculo,
    motoristaNome,
    descricaoProduto,
    pesoEstimado
  ]);

  // Envio do agendamento
  const handleSubmitAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const chosenSlot = applicableSlots.find(s => s.hora_inicio === selectedSlotHour);
      const horaFim = chosenSlot?.hora_fim || `${(parseInt(selectedSlotHour.split(':')[0]) + 1).toString().padStart(2, '0')}:00`;
      
      const protocolo = generateProtocol();

      const newAppointmentData: Omit<Appointment, 'id'> = {
        protocolo,
        branchId: selectedBranchId,
        data_agendamento: selectedDate,
        hora_inicio: selectedSlotHour,
        hora_fim: horaFim,
        tipo_operacao: operationType,
        transportadora: transportadora.trim(),
        cnpj_transportadora: cnpjTransportadora.trim() || undefined,
        placa_veiculo: placaVeiculo.trim().toUpperCase(),
        placa_carreta: placaCarreta.trim().toUpperCase() || undefined,
        tipo_veiculo: tipoVeiculo,
        motorista_nome: motoristaNome.trim(),
        motorista_cpf: motoristaCpf.trim() || undefined,
        motorista_telefone: motoristaTelefone.trim() || undefined,
        descricao_produto: descricaoProduto.trim(),
        peso_estimado_toneladas: Number(pesoEstimado) || 0,
        nf_numero: nfNumero.trim() || undefined,
        pedido_lote: pedidoLote.trim() || undefined,
        status: 'agendado',
        origem: 'portal_transportador',
        observacoes: observacoes.trim() || undefined,
        created_at: new Date().toISOString()
      };

      // Salva no Firestore
      const docRef = await addDoc(collection(db, COLLECTIONS.appointments), {
        ...newAppointmentData,
        created_at: serverTimestamp()
      });

      const fullAppointment: Appointment = {
        ...newAppointmentData,
        id: docRef.id
      };

      setLastCreatedAppointment(fullAppointment);
      if (onAppointmentCreated) {
        onAppointmentCreated(fullAppointment);
      }
      setPortalView('sucesso');
    } catch (err: any) {
      console.error('Erro ao agendar:', err);
      setSubmitError(err.message || 'Ocorreu um erro ao registrar o agendamento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Busca de agendamento por protocolo ou placa
  const handleSearchAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchNotFound(false);
    setSearchResult(null);

    const term = searchQuery.trim().toUpperCase().replace(/[-_ ]/g, '');

    const found = appointments.find(a => {
      const matchProto = a.protocolo?.toUpperCase().replace(/[-_ ]/g, '').includes(term);
      const matchPlaca = a.placa_veiculo?.toUpperCase().replace(/[-_ ]/g, '').includes(term);
      const matchCarreta = a.placa_carreta?.toUpperCase().replace(/[-_ ]/g, '').includes(term);
      return matchProto || matchPlaca || matchCarreta;
    });

    if (found) {
      setSearchResult(found);
    } else {
      setSearchNotFound(true);
    }
    setIsSearching(false);
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm('Deseja realmente solicitar o cancelamento deste agendamento?')) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.appointments, appointmentId), {
        status: 'cancelado',
        updated_at: serverTimestamp()
      });
      if (searchResult && searchResult.id === appointmentId) {
        setSearchResult({ ...searchResult, status: 'cancelado' });
      }
      alert('Agendamento cancelado com sucesso.');
    } catch (err: any) {
      alert('Erro ao cancelar: ' + err.message);
    }
  };

  return (
    <div className={`min-h-screen ${isEmbedded ? 'bg-transparent' : 'bg-slate-900 text-white'} flex flex-col`}>
      {/* Header Institucional do Canal do Transportador */}
      <header className="bg-titam-deep border-b border-white/10 px-4 sm:px-8 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-titam-lime text-titam-deep flex items-center justify-center font-black shadow-lg">
              <CalendarClock size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">Canal do Transportador</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-titam-lime/20 text-titam-lime border border-titam-lime/30">
                  Agendamento 100% Digital
                </span>
              </div>
              <p className="text-xs text-white/60">Titam Intermodais • Sistema Autocontido de Pátio</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPortalView('agendar');
                setSearchResult(null);
                setSearchNotFound(false);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                portalView === 'agendar'
                  ? 'bg-titam-lime text-titam-deep shadow-md'
                  : 'bg-white/5 text-white/80 hover:bg-white/10'
              }`}
            >
              Novo Agendamento
            </button>
            <button
              type="button"
              onClick={() => setPortalView('consultar')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                portalView === 'consultar'
                  ? 'bg-titam-lime text-titam-deep shadow-md'
                  : 'bg-white/5 text-white/80 hover:bg-white/10'
              }`}
            >
              <Search size={14} />
              <span>Consultar Protocolo</span>
            </button>

            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="ml-2 px-3 py-2 rounded-xl text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-all"
              >
                <ArrowLeft size={14} />
                <span>Voltar ao Sistema</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          {/* TELA DE CONSULTA DE PROTOCOLO */}
          {portalView === 'consultar' && (
            <motion.div
              key="consultar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <div className="bg-white rounded-3xl p-6 sm:p-8 text-gray-900 shadow-xl border border-gray-100">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-emerald-50 text-titam-deep rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Search size={24} />
                  </div>
                  <h2 className="text-xl font-black text-titam-deep">Consultar Agendamento</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Digite o número do protocolo (ex: AGD-20260908-1234) ou a placa do caminhão
                  </p>
                </div>

                <form onSubmit={handleSearchAppointment} className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Ex: AGD-20260908-4102 ou ABC1D23"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep transition-all uppercase"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearching || !searchQuery.trim()}
                      className="px-6 py-3 bg-titam-deep text-white font-bold text-sm rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSearching ? 'Buscando...' : 'Pesquisar'}
                    </button>
                  </div>
                </form>

                {searchNotFound && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="text-xs font-bold text-amber-900">Nenhum agendamento localizado</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Verifique se digitou o protocolo ou a placa corretamente. Se precisar agendar uma nova viagem, utilize a aba "Novo Agendamento".
                      </p>
                    </div>
                  </div>
                )}

                {searchResult && (
                  <div className="mt-6 border border-gray-100 bg-gray-50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Protocolo</span>
                        <p className="text-base font-black text-titam-deep">{searchResult.protocolo}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          searchResult.tipo_operacao === 'carga'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {searchResult.tipo_operacao === 'carga' ? 'Carga (Retirada)' : 'Descarga (Entrega)'}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          searchResult.status === 'agendado' ? 'bg-amber-100 text-amber-800' :
                          searchResult.status === 'em_patio' ? 'bg-sky-100 text-sky-800' :
                          searchResult.status === 'em_operacao' ? 'bg-purple-100 text-purple-800' :
                          searchResult.status === 'concluido' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {searchResult.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500 font-medium">Data Agendada:</span>
                        <p className="font-bold text-gray-900">{searchResult.data_agendamento.split('-').reverse().join('/')}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">Janela de Horário:</span>
                        <p className="font-bold text-gray-900">{searchResult.hora_inicio} às {searchResult.hora_fim}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">Placa do Veículo:</span>
                        <p className="font-bold text-gray-900">{searchResult.placa_veiculo} {searchResult.placa_carreta ? `/ ${searchResult.placa_carreta}` : ''}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">Motorista:</span>
                        <p className="font-bold text-gray-900">{searchResult.motorista_nome}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">Transportadora:</span>
                        <p className="font-bold text-gray-900 truncate">{searchResult.transportadora}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">Peso Estimado:</span>
                        <p className="font-bold text-gray-900">{searchResult.peso_estimado_toneladas} t</p>
                      </div>
                      {(searchResult.nf_numero || searchResult.pedido_lote) && (
                        <div>
                          <span className="text-gray-500 font-medium">NF-e / Pedido:</span>
                          <p className="font-bold text-gray-900">
                            {[searchResult.nf_numero ? `NF: ${searchResult.nf_numero}` : '', searchResult.pedido_lote ? `Ped: ${searchResult.pedido_lote}` : ''].filter(Boolean).join(' | ')}
                          </p>
                        </div>
                      )}
                    </div>

                    {searchResult.status === 'agendado' && (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        <span>Agendamento confirmado. Apresente o protocolo na portaria no horário agendado.</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => generateAppointmentVoucherPDF(searchResult, branches.find(b => b.id === searchResult.branchId))}
                        className="px-4 py-2 bg-titam-deep text-white text-xs font-bold rounded-xl hover:opacity-90 flex items-center gap-1.5"
                      >
                        <Download size={14} />
                        <span>Baixar Comprovante PDF</span>
                      </button>

                      {searchResult.status === 'agendado' && (
                        <button
                          type="button"
                          onClick={() => handleCancelAppointment(searchResult.id)}
                          className="px-3 py-2 bg-red-50 text-red-700 text-xs font-bold rounded-xl hover:bg-red-100 border border-red-200"
                        >
                          Cancelar Agendamento
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TELA DE SUCESSO APÓS AGENDAMENTO */}
          {portalView === 'sucesso' && lastCreatedAppointment && (
            <motion.div
              key="sucesso"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <div className="bg-white rounded-3xl p-6 sm:p-8 text-gray-900 shadow-2xl border border-gray-100 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <CheckCircle2 size={36} />
                </div>
                
                <h2 className="text-2xl font-black text-titam-deep">Agendamento Confirmado com Sucesso!</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Sua vaga no pátio Titam foi reservada na janela solicitada. Guarde o protocolo abaixo.
                </p>

                {/* Caixa de Destaque do Protocolo */}
                <div className="my-6 p-4 sm:p-5 bg-titam-deep text-white rounded-2xl shadow-inner flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-titam-lime uppercase tracking-widest">Protocolo Oficial</span>
                    <p className="text-2xl sm:text-3xl font-mono font-black tracking-tight">{lastCreatedAppointment.protocolo}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(lastCreatedAppointment.protocolo);
                      setCopiedProtocol(true);
                      setTimeout(() => setCopiedProtocol(false), 2000);
                    }}
                    className="px-4 py-2 bg-titam-lime text-titam-deep font-black text-xs rounded-xl hover:opacity-90 flex items-center gap-1.5 transition-all shadow cursor-pointer"
                  >
                    {copiedProtocol ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedProtocol ? 'Copiado!' : 'Copiar Protocolo'}</span>
                  </button>
                </div>

                {/* Resumo Rápido */}
                <div className="bg-gray-50 rounded-2xl p-4 text-left grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-gray-200/60 mb-6">
                  <div>
                    <span className="text-gray-400 font-medium text-[11px]">Filial:</span>
                    <p className="font-bold text-gray-900">{activeBranch?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium text-[11px]">Operação:</span>
                    <p className="font-bold text-gray-900 uppercase">
                      {lastCreatedAppointment.tipo_operacao === 'carga' ? 'Carga (Retirada)' : 'Descarga (Entrega)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium text-[11px]">Data:</span>
                    <p className="font-bold text-gray-900">{lastCreatedAppointment.data_agendamento.split('-').reverse().join('/')}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium text-[11px]">Horário:</span>
                    <p className="font-bold text-gray-900">{lastCreatedAppointment.hora_inicio} às {lastCreatedAppointment.hora_fim}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium text-[11px]">Placa:</span>
                    <p className="font-bold text-gray-900">{lastCreatedAppointment.placa_veiculo}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium text-[11px]">Motorista:</span>
                    <p className="font-bold text-gray-900 truncate">{lastCreatedAppointment.motorista_nome}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 font-medium text-[11px]">Material / Peso:</span>
                    <p className="font-bold text-gray-900 truncate">
                      {lastCreatedAppointment.descricao_produto} ({lastCreatedAppointment.peso_estimado_toneladas}t)
                    </p>
                  </div>
                  {(lastCreatedAppointment.nf_numero || lastCreatedAppointment.pedido_lote) && (
                    <div className="col-span-2">
                      <span className="text-gray-400 font-medium text-[11px]">NF-e / Pedido / Lote:</span>
                      <p className="font-bold text-gray-900 truncate">
                        {[lastCreatedAppointment.nf_numero ? `NF: ${lastCreatedAppointment.nf_numero}` : '', lastCreatedAppointment.pedido_lote ? `Ped/Lote: ${lastCreatedAppointment.pedido_lote}` : ''].filter(Boolean).join(' | ')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Instruções para o motorista */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs text-amber-900 space-y-1.5 mb-6">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <ShieldCheck size={16} className="text-amber-700" />
                    <span>Orientações para o Motorista na Chegada:</span>
                  </div>
                  <p>• Chegar com 15 minutos de antecedência na portaria da unidade.</p>
                  <p>• Uso obrigatório de EPIs completos (Capacete com jugular, óculos, colete refletivo e botina).</p>
                  <p>• Apresente este protocolo ou o comprovante baixado ao fiscal de portaria.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => generateAppointmentVoucherPDF(lastCreatedAppointment, activeBranch)}
                    className="w-full sm:w-auto px-6 py-3 bg-titam-deep text-white font-bold text-sm rounded-xl hover:opacity-90 flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Download size={16} />
                    <span>Baixar Comprovante (PDF)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPortalView('agendar');
                      setSelectedSlotHour('');
                      setLastCreatedAppointment(null);
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm rounded-xl transition-all"
                  >
                    Fazer Novo Agendamento
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* FORMULÁRIO DE NOVO AGENDAMENTO */}
          {portalView === 'agendar' && (
            <motion.div
              key="agendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Card de Boas-Vindas e Orientações */}
              <div className="bg-gradient-to-r from-titam-deep to-emerald-950 border border-white/10 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 max-w-3xl">
                  <span className="px-3 py-1 bg-titam-lime text-titam-deep text-xs font-black rounded-full uppercase tracking-wider">
                    Agendamento de Carga e Descarga
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black mt-3 tracking-tight">
                    Reserve sua Janela de Atendimento
                  </h2>
                  <p className="text-sm text-white/70 mt-1 max-w-2xl leading-relaxed">
                    Escolha a unidade, data e horário para sua operação de <strong>Carga</strong> ou <strong>Descarga</strong>.
                    Nosso sistema calcula a capacidade em tempo real por <strong>veículos ou volume em toneladas</strong>, evitando filas no pátio.
                  </p>
                </div>
              </div>

              {submitError && (
                <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-2xl text-red-200 text-xs flex items-center gap-3">
                  <AlertCircle size={18} className="shrink-0 text-red-400" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitAppointment} className="space-y-8">
                {/* ETAPA 1: UNIDADE, TIPO DE OPERAÇÃO E DATA */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 text-gray-900 shadow-xl border border-gray-100 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-xl bg-titam-lime/20 text-titam-deep font-black flex items-center justify-center text-sm">
                      1
                    </div>
                    <div>
                      <h3 className="text-base font-black text-titam-deep">Definição da Operação e Data</h3>
                      <p className="text-xs text-gray-500">Selecione onde, quando e qual operação será realizada</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Filial */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Unidade / Filial Titam *
                      </label>
                      <select
                        value={selectedBranchId}
                        onChange={e => setSelectedBranchId(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                      >
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.location || b.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tipo de Operação */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Tipo de Operação *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setOperationType('descarga')}
                          className={`p-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                            operationType === 'descarga'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <ArrowDownLeft size={16} />
                          <span>DESCARGA</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOperationType('carga')}
                          className={`p-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                            operationType === 'carga'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <ArrowUpRight size={16} />
                          <span>CARGA</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        {operationType === 'descarga' ? 'Entrega de material/produto no pátio Titam' : 'Retirada de material/bobinas no pátio Titam'}
                      </p>
                    </div>

                    {/* Data */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Data Desejada *
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                      />
                    </div>
                  </div>
                </div>

                {/* ETAPA 2: ESCOLHA DA JANELA HORÁRIA DISPONÍVEL */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 text-gray-900 shadow-xl border border-gray-100 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-titam-lime/20 text-titam-deep font-black flex items-center justify-center text-sm">
                        2
                      </div>
                      <div>
                        <h3 className="text-base font-black text-titam-deep">Selecione a Janela de Horário</h3>
                        <p className="text-xs text-gray-500">
                          Horários configurados por veículos ou limite de volume em toneladas
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Disponível
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Quase Cheio
                      </span>
                      <span className="flex items-center gap-1.5 text-red-700 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Esgotado
                      </span>
                    </div>
                  </div>

                  {/* Grid de Janelas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {slotsWithAvailability.map(({ slot, veiculosAgendados, volumeAgendado, disponivel, motivoBloqueio, percentualOcupacao }) => {
                      const isSelected = selectedSlotHour === slot.hora_inicio;
                      const isNearlyFull = percentualOcupacao >= 75 && disponivel;

                      return (
                        <button
                          key={slot.hora_inicio}
                          type="button"
                          disabled={!disponivel}
                          onClick={() => setSelectedSlotHour(slot.hora_inicio)}
                          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                            isSelected
                              ? 'bg-titam-deep text-white border-titam-deep shadow-lg ring-2 ring-titam-lime scale-[1.02]'
                              : !disponivel
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                              : isNearlyFull
                              ? 'bg-amber-50 text-gray-900 border-amber-200 hover:border-amber-400'
                              : 'bg-white text-gray-900 border-gray-200 hover:border-titam-deep/40 hover:shadow-md'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className={`text-base font-black tracking-tight ${isSelected ? 'text-titam-lime' : 'text-gray-900'}`}>
                                {slot.hora_inicio} - {slot.hora_fim}
                              </span>
                              {isSelected && (
                                <span className="w-5 h-5 rounded-full bg-titam-lime text-titam-deep flex items-center justify-center font-bold text-xs">
                                  ✓
                                </span>
                              )}
                            </div>

                            {/* Informações da Capacidade */}
                            <div className="mt-2 space-y-1">
                              {slot.tipo_limite === 'volume' ? (
                                <div className="text-[11px]">
                                  <span className={isSelected ? 'text-white/70' : 'text-gray-500'}>
                                    Volume: <strong>{volumeAgendado.toFixed(1)}t</strong> / {slot.limite_volume_toneladas}t
                                  </span>
                                </div>
                              ) : (
                                <div className="text-[11px]">
                                  <span className={isSelected ? 'text-white/70' : 'text-gray-500'}>
                                    Vagas: <strong>{veiculosAgendados}</strong> / {slot.limite_veiculos} veículos
                                  </span>
                                </div>
                              )}

                              {slot.tipo_operacao_permitida !== 'todos' && (
                                <span className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  Exclusivo {slot.tipo_operacao_permitida}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Barra de Progresso de Ocupação */}
                          <div className="mt-3 pt-2 border-t border-gray-100/50">
                            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  !disponivel
                                    ? 'bg-red-500'
                                    : percentualOcupacao >= 75
                                    ? 'bg-amber-500'
                                    : isSelected
                                    ? 'bg-titam-lime'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${percentualOcupacao}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] mt-1 text-gray-400">
                              <span>{percentualOcupacao}% ocupado</span>
                              {!disponivel && <span className="text-red-500 font-bold">Lotado</span>}
                            </div>
                          </div>

                          {motivoBloqueio && !disponivel && (
                            <p className="text-[10px] text-red-500 font-medium mt-1 leading-tight">{motivoBloqueio}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {!selectedSlotHour && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
                      <Info size={16} className="shrink-0 text-blue-600" />
                      <span>Por favor, selecione uma das janelas de horário disponíveis acima para continuar.</span>
                    </div>
                  )}
                </div>

                {/* ETAPA 3: DADOS DO TRANSPORTE, MOTORISTA E CARGA */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 text-gray-900 shadow-xl border border-gray-100 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-xl bg-titam-lime/20 text-titam-deep font-black flex items-center justify-center text-sm">
                      3
                    </div>
                    <div>
                      <h3 className="text-base font-black text-titam-deep">Dados do Veículo, Motorista e Carga</h3>
                      <p className="text-xs text-gray-500">Informações necessárias para autorização de entrada na portaria</p>
                    </div>
                  </div>

                  {/* Seção 1: Transportadora & Veículo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Nome da Transportadora *
                      </label>
                      <input
                        type="text"
                        required
                        value={transportadora}
                        onChange={e => setTransportadora(e.target.value)}
                        placeholder="Ex: Titam Logística / Transvale"
                        list="transportadoras-list"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep uppercase"
                      />
                      <datalist id="transportadoras-list">
                        {transporters.map(t => (
                          <option key={t.id} value={t.name} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        CNPJ Transportadora
                      </label>
                      <input
                        type="text"
                        value={cnpjTransportadora}
                        onChange={e => setCnpjTransportadora(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Tipo de Conjunto *
                      </label>
                      <select
                        value={tipoVeiculo}
                        onChange={e => setTipoVeiculo(e.target.value)}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                      >
                        <option value="Carreta Simples">Carreta Simples (3 eixos)</option>
                        <option value="Carreta LS">Carreta LS</option>
                        <option value="Bitrem">Bitrem</option>
                        <option value="Rodotrem">Rodotrem</option>
                        <option value="Vanderleia">Vanderleia</option>
                        <option value="Truck">Truck (6x2)</option>
                        <option value="Toco">Toco</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Placa do Cavalo *
                      </label>
                      <input
                        type="text"
                        required
                        value={placaVeiculo}
                        onChange={e => setPlacaVeiculo(e.target.value.toUpperCase())}
                        placeholder="ABC-1234 ou ABC1D23"
                        maxLength={8}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep uppercase tracking-wider"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Placa da Carreta
                      </label>
                      <input
                        type="text"
                        value={placaCarreta}
                        onChange={e => setPlacaCarreta(e.target.value.toUpperCase())}
                        placeholder="XYZ-5678"
                        maxLength={8}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep uppercase tracking-wider"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Nome do Motorista *
                      </label>
                      <input
                        type="text"
                        required
                        value={motoristaNome}
                        onChange={e => setMotoristaNome(e.target.value)}
                        placeholder="Nome Completo"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        CPF / CNH Motorista
                      </label>
                      <input
                        type="text"
                        value={motoristaCpf}
                        onChange={e => setMotoristaCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Celular / WhatsApp Motorista
                      </label>
                      <input
                        type="tel"
                        value={motoristaTelefone}
                        onChange={e => setMotoristaTelefone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Peso Estimado (Toneladas) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          required
                          value={pesoEstimado}
                          onChange={e => setPesoEstimado(parseFloat(e.target.value) || 0)}
                          className="w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                          TON
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Nº da Nota Fiscal (NF-e)
                      </label>
                      <input
                        type="text"
                        value={nfNumero}
                        onChange={e => setNfNumero(e.target.value)}
                        placeholder="Ex: NF 14502"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Nº do Pedido / Lote / OC
                      </label>
                      <input
                        type="text"
                        value={pedidoLote}
                        onChange={e => setPedidoLote(e.target.value)}
                        placeholder="Ex: PED-10492 ou OC 889"
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Descrição do Produto / Carga *
                      </label>
                      <input
                        type="text"
                        required
                        value={descricaoProduto}
                        onChange={e => setDescricaoProduto(e.target.value)}
                        placeholder="Ex: Bobinas laminadas, Sucata ferrosa, Chapas..."
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                      />
                    </div>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Observações / Orientações Especiais
                    </label>
                    <textarea
                      rows={2}
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                      placeholder="Ex: Carga com lona especial, necessidade de amarração com catraca, etc."
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-titam-deep"
                    />
                  </div>
                </div>

                {/* BOTÃO FINAL DE CONFIRMAÇÃO */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="text-xs text-white/60 text-center sm:text-left">
                    Ao confirmar, o agendamento será registrado instantaneamente na portaria Titam.
                  </div>

                  <button
                    type="submit"
                    disabled={!isFormValid || isSubmitting}
                    className="w-full sm:w-auto px-8 py-4 bg-titam-lime text-titam-deep font-black text-base rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-3 border-titam-deep/30 border-t-titam-deep rounded-full animate-spin" />
                        <span>Confirmando Agendamento...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={20} />
                        <span>Confirmar Agendamento</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeftRight, 
  Plus, 
  Search, 
  Filter, 
  MapPin, 
  Layers, 
  Clock, 
  Calendar, 
  Truck, 
  Boxes, 
  TrendingDown, 
  History, 
  X, 
  Check, 
  AlertCircle, 
  Building2, 
  FileText, 
  Trash2, 
  Edit3, 
  Warehouse, 
  Flame, 
  RotateCcw,
  Printer,
  ChevronRight,
  Info
} from 'lucide-react';
import { Entry, InternalMovement, InternalMovementType, YardLocation, Branch } from '../types';

interface InternalMovementsManagerProps {
  entries: Entry[];
  movements: InternalMovement[];
  yardLocations: YardLocation[];
  selectedBranchId: string;
  branches: Branch[];
  isAdmin: boolean;
  userEmail: string;
  onAddMovement: (movement: Omit<InternalMovement, 'id' | 'created_at' | 'uid'>) => Promise<boolean>;
  onDeleteMovement: (id: string) => Promise<boolean>;
  onAddLocation: (location: Omit<YardLocation, 'id' | 'created_at' | 'uid'>) => Promise<boolean>;
  onDeleteLocation: (id: string) => Promise<boolean>;
  onCreateFractionedExit: (entry: Entry, exitData: Partial<Entry>) => Promise<boolean>;
  onUpdateEntryLocation: (entryId: string | number, newLocation: string) => Promise<boolean>;
}

export const InternalMovementsManager: React.FC<InternalMovementsManagerProps> = ({
  entries,
  movements,
  yardLocations,
  selectedBranchId,
  branches,
  isAdmin,
  userEmail,
  onAddMovement,
  onDeleteMovement,
  onAddLocation,
  onDeleteLocation,
  onCreateFractionedExit,
  onUpdateEntryLocation
}) => {
  // Tabs
  const [activeTab, setActiveTab] = useState<'movements' | 'stock' | 'yard' | 'locations'>('movements');
  
  // Modals
  const [showAddMovementModal, setShowAddMovementModal] = useState(false);
  const [showFractionedExitModal, setShowFractionedExitModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  
  // Selected targets
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [timelineEntry, setTimelineEntry] = useState<Entry | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for New Movement
  const [movementForm, setMovementForm] = useState<{
    entryId: string;
    tipo_movimentacao: InternalMovementType;
    origem_local: string;
    destino_local: string;
    container_origem: string;
    container_destino: string;
    vagao_origem: string;
    vagao_destino: string;
    toneladas_movimentadas: number;
    data_movimentacao: string;
    hora_movimentacao: string;
    responsavel_operador: string;
    observacoes: string;
  }>({
    entryId: '',
    tipo_movimentacao: 'mudanca_baia',
    origem_local: '',
    destino_local: '',
    container_origem: '',
    container_destino: '',
    vagao_origem: '',
    vagao_destino: '',
    toneladas_movimentadas: 0,
    data_movimentacao: new Date().toISOString().split('T')[0],
    hora_movimentacao: new Date().toTimeString().slice(0, 5),
    responsavel_operador: userEmail.split('@')[0] || '',
    observacoes: ''
  });

  // Form states for Fractioned Exit
  const [exitForm, setExitForm] = useState<{
    toneladas: number;
    placa_saida: string;
    numero_vagao: string;
    container: string;
    transportador: string;
    cliente: string;
    destino: string;
    modal: 'Rodoviário' | 'Ferroviário';
    data_carregamento_rodoviario: string;
    data_posicionamento: string;
    horario_posicionamento: string;
    observacoes: string;
  }>({
    toneladas: 0,
    placa_saida: '',
    numero_vagao: '',
    container: '',
    transportador: '',
    cliente: '',
    destino: '',
    modal: 'Rodoviário',
    data_carregamento_rodoviario: new Date().toISOString().split('T')[0],
    data_posicionamento: new Date().toISOString().split('T')[0],
    horario_posicionamento: new Date().toTimeString().slice(0, 5),
    observacoes: ''
  });

  // Form states for Yard Location
  const [locationForm, setLocationForm] = useState<{
    name: string;
    tipo: 'baia' | 'silo' | 'patio' | 'moega' | 'linha_ferroviaria' | 'armazem' | 'outro';
    capacidade_toneladas: number;
    descricao: string;
  }>({
    name: '',
    tipo: 'baia',
    capacidade_toneladas: 1000,
    descricao: ''
  });

  // Default suggested locations if none configured
  const currentBranchLocations = useMemo(() => {
    const list = yardLocations.filter(loc => selectedBranchId === 'all' || loc.branchId === selectedBranchId);
    if (list.length > 0) return list;
    return [
      { id: 'def-1', name: 'Baia 1', tipo: 'baia' as const, branchId: selectedBranchId, created_at: '', uid: '' },
      { id: 'def-2', name: 'Baia 2', tipo: 'baia' as const, branchId: selectedBranchId, created_at: '', uid: '' },
      { id: 'def-3', name: 'Baia 3', tipo: 'baia' as const, branchId: selectedBranchId, created_at: '', uid: '' },
      { id: 'def-4', name: 'Silo 1', tipo: 'silo' as const, branchId: selectedBranchId, created_at: '', uid: '' },
      { id: 'def-5', name: 'Silo 2', tipo: 'silo' as const, branchId: selectedBranchId, created_at: '', uid: '' },
      { id: 'def-6', name: 'Moega Central', tipo: 'moega' as const, branchId: selectedBranchId, created_at: '', uid: '' },
      { id: 'def-7', name: 'Pátio de Containers', tipo: 'patio' as const, branchId: selectedBranchId, created_at: '', uid: '' },
      { id: 'def-8', name: 'Linha Férrea 1', tipo: 'linha_ferroviaria' as const, branchId: selectedBranchId, created_at: '', uid: '' },
      { id: 'def-9', name: 'Linha Férrea 2', tipo: 'linha_ferroviaria' as const, branchId: selectedBranchId, created_at: '', uid: '' },
      { id: 'def-10', name: 'Armazém Geral', tipo: 'armazem' as const, branchId: selectedBranchId, created_at: '', uid: '' }
    ];
  }, [yardLocations, selectedBranchId]);

  // Filter entries to show in yard / stock (Only active stock or fractioned stock entries)
  const activeStockEntries = useMemo(() => {
    return entries.filter(entry => {
      // Exclude pure exit children records
      if (entry.parent_entry_id) return false;
      if (selectedBranchId !== 'all' && entry.branchId !== selectedBranchId) return false;

      // Status must not be totally exited without balance
      const isExitStatus = entry.status === 'Embarcado' || entry.status === 'Embarcado Total' || entry.status === 'Devolvido';
      const saldo = entry.saldo_toneladas !== undefined ? Number(entry.saldo_toneladas) : Number(entry.tonelada || 0);

      // Keep if has positive balance or is not completely exited
      return saldo > 0.001 || !isExitStatus;
    });
  }, [entries, selectedBranchId]);

  // Filtered movements list
  const filteredMovements = useMemo(() => {
    return movements.filter(mov => {
      if (selectedBranchId !== 'all' && mov.branchId !== selectedBranchId) return false;
      if (filterType !== 'all' && mov.tipo_movimentacao !== filterType) return false;
      if (filterLocation !== 'all' && mov.origem_local !== filterLocation && mov.destino_local !== filterLocation) return false;
      
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (mov.nf_numero || '').toLowerCase().includes(term) ||
        (mov.id_lote || '').toLowerCase().includes(term) ||
        (mov.descricao_produto || '').toLowerCase().includes(term) ||
        (mov.origem_local || '').toLowerCase().includes(term) ||
        (mov.destino_local || '').toLowerCase().includes(term) ||
        (mov.container_origem || '').toLowerCase().includes(term) ||
        (mov.container_destino || '').toLowerCase().includes(term) ||
        (mov.responsavel_operador || '').toLowerCase().includes(term)
      );
    });
  }, [movements, selectedBranchId, filterType, filterLocation, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const totalTonsInYard = activeStockEntries.reduce((sum, e) => {
      const saldo = e.saldo_toneladas !== undefined ? Number(e.saldo_toneladas) : Number(e.tonelada || 0);
      return sum + (isNaN(saldo) ? 0 : saldo);
    }, 0);

    const fractionedCount = activeStockEntries.filter(e => e.status === 'Embarcado Parcial' || (e.total_expedido && e.total_expedido > 0)).length;
    
    // Unique occupied locations
    const occupiedLocs = new Set<string>();
    activeStockEntries.forEach(e => {
      if (e.localizacao_atual) occupiedLocs.add(e.localizacao_atual);
    });

    return {
      movementsCount: filteredMovements.length,
      activeLots: activeStockEntries.length,
      totalTonsInYard,
      fractionedCount,
      occupiedLocationsCount: occupiedLocs.size
    };
  }, [activeStockEntries, filteredMovements]);

  // Handle open movement modal with pre-selected entry
  const handleOpenMovementModal = (entry?: Entry) => {
    if (entry) {
      setSelectedEntry(entry);
      const saldo = entry.saldo_toneladas !== undefined ? Number(entry.saldo_toneladas) : Number(entry.tonelada || 0);
      setMovementForm(prev => ({
        ...prev,
        entryId: String(entry.id),
        origem_local: entry.localizacao_atual || 'Pátio Geral',
        destino_local: '',
        container_origem: entry.container || '',
        container_destino: entry.container || '',
        vagao_origem: entry.numero_vagao || '',
        vagao_destino: entry.numero_vagao || '',
        toneladas_movimentadas: saldo,
        data_movimentacao: new Date().toISOString().split('T')[0],
        hora_movimentacao: new Date().toTimeString().slice(0, 5),
        responsavel_operador: userEmail.split('@')[0] || ''
      }));
    } else {
      setSelectedEntry(null);
      setMovementForm(prev => ({
        ...prev,
        entryId: '',
        origem_local: '',
        destino_local: '',
        container_origem: '',
        container_destino: '',
        vagao_origem: '',
        vagao_destino: '',
        toneladas_movimentadas: 0
      }));
    }
    setShowAddMovementModal(true);
  };

  // Handle open fractioned exit modal
  const handleOpenFractionedExitModal = (entry: Entry) => {
    setSelectedEntry(entry);
    const saldo = entry.saldo_toneladas !== undefined ? Number(entry.saldo_toneladas) : Number(entry.tonelada || 0);
    setExitForm({
      toneladas: saldo > 27 ? 27 : saldo, // Typical road payload suggestion
      placa_saida: '',
      numero_vagao: entry.numero_vagao || '',
      container: entry.container || '',
      transportador: entry.transportador || '',
      cliente: entry.cliente || entry.destinatario || '',
      destino: entry.destino || '',
      modal: 'Rodoviário',
      data_carregamento_rodoviario: new Date().toISOString().split('T')[0],
      data_posicionamento: new Date().toISOString().split('T')[0],
      horario_posicionamento: new Date().toTimeString().slice(0, 5),
      observacoes: `Saída fracionada ref. NF ${entry.nf_numero || ''} Lote ${entry.id_lote || ''}`
    });
    setShowFractionedExitModal(true);
  };

  // Submit new internal movement
  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementForm.entryId) {
      alert('Selecione uma carga/lote para movimentar.');
      return;
    }
    if (!movementForm.destino_local) {
      alert('Informe o local interno de destino (ex: Baia 2, Silo 1).');
      return;
    }

    const targetEntry = entries.find(e => String(e.id) === movementForm.entryId);
    if (!targetEntry) {
      alert('Carga não encontrada.');
      return;
    }

    setIsSubmitting(true);
    try {
      const movementData: Omit<InternalMovement, 'id' | 'created_at' | 'uid'> = {
        entryId: String(targetEntry.id),
        nf_numero: targetEntry.nf_numero || '',
        id_lote: targetEntry.id_lote || '',
        descricao_produto: targetEntry.descricao_produto || '',
        tipo_movimentacao: movementForm.tipo_movimentacao,
        tipo_movimentacao_label: getMovementTypeLabel(movementForm.tipo_movimentacao),
        origem_local: movementForm.origem_local || targetEntry.localizacao_atual || 'Pátio',
        destino_local: movementForm.destino_local,
        container_origem: movementForm.container_origem || targetEntry.container || '',
        container_destino: movementForm.container_destino || targetEntry.container || '',
        vagao_origem: movementForm.vagao_origem || targetEntry.numero_vagao || '',
        vagao_destino: movementForm.vagao_destino || targetEntry.numero_vagao || '',
        toneladas_movimentadas: Number(movementForm.toneladas_movimentadas || 0),
        data_movimentacao: movementForm.data_movimentacao,
        hora_movimentacao: movementForm.hora_movimentacao,
        responsavel_operador: movementForm.responsavel_operador,
        observacoes: movementForm.observacoes,
        branchId: targetEntry.branchId || selectedBranchId
      };

      const success = await onAddMovement(movementData);
      if (success) {
        // Also update entry location in realtime
        await onUpdateEntryLocation(targetEntry.id, movementForm.destino_local);
        setShowAddMovementModal(false);
      }
    } catch (err) {
      console.error('Erro ao salvar movimentação:', err);
      alert('Erro ao registrar movimentação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit fractioned exit
  const handleSaveFractionedExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;

    const saldoAtual = selectedEntry.saldo_toneladas !== undefined 
      ? Number(selectedEntry.saldo_toneladas) 
      : Number(selectedEntry.tonelada || 0);

    const pesoSaida = Number(exitForm.toneladas);
    if (isNaN(pesoSaida) || pesoSaida <= 0) {
      alert('Informe um peso de saída válido maior que 0.');
      return;
    }
    if (pesoSaida > saldoAtual + 0.001) {
      alert(`O peso informado (${pesoSaida.toLocaleString('pt-BR')} t) ultrapassa o saldo disponível da carga (${saldoAtual.toLocaleString('pt-BR')} t).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const exitData: Partial<Entry> = {
        tonelada: pesoSaida,
        placa_saida: exitForm.placa_saida,
        numero_vagao: exitForm.numero_vagao,
        container: exitForm.container || selectedEntry.container,
        transportador: exitForm.transportador,
        cliente: exitForm.cliente,
        destino: exitForm.destino,
        modal: exitForm.modal,
        data_carregamento_rodoviario: exitForm.data_carregamento_rodoviario,
        data_posicionamento: exitForm.data_posicionamento,
        horario_posicionamento: exitForm.horario_posicionamento,
        status: 'Embarcado'
      };

      const success = await onCreateFractionedExit(selectedEntry, exitData);
      if (success) {
        setShowFractionedExitModal(false);
      }
    } catch (err) {
      console.error('Erro ao gerar saída fracionada:', err);
      alert('Erro ao processar saída fracionada.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit new location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationForm.name.trim()) {
      alert('Informe o nome do endereço/baia.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onAddLocation({
        name: locationForm.name.trim(),
        tipo: locationForm.tipo,
        capacidade_toneladas: Number(locationForm.capacidade_toneladas || 0),
        descricao: locationForm.descricao.trim(),
        branchId: selectedBranchId === 'all' ? (branches[0]?.id || '') : selectedBranchId
      });
      if (success) {
        setLocationForm({
          name: '',
          tipo: 'baia',
          capacidade_toneladas: 1000,
          descricao: ''
        });
        setShowAddLocationModal(false);
      }
    } catch (err) {
      console.error('Erro ao salvar local:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  function getMovementTypeLabel(type: InternalMovementType): string {
    switch (type) {
      case 'mudanca_baia': return 'Mudança de Baia / Pilha';
      case 'transferencia_silo': return 'Transferência para Silo';
      case 'troca_container': return 'Troca de Container / Estufagem';
      case 'manobra_ferroviaria': return 'Manobra / Linha Ferroviária';
      case 'ensaque_envase': return 'Ensaque / Envase / Reenvase';
      case 'pesagem_intermediaria': return 'Pesagem Intermediária';
      case 'amostragem_qualidade': return 'Amostragem / Qualidade';
      default: return 'Outra Movimentação';
    }
  }

  function getMovementTypeIcon(type: InternalMovementType) {
    switch (type) {
      case 'mudanca_baia': return <Layers className="text-amber-500" size={16} />;
      case 'transferencia_silo': return <Warehouse className="text-blue-500" size={16} />;
      case 'troca_container': return <Boxes className="text-purple-500" size={16} />;
      case 'manobra_ferroviaria': return <TrendingDown className="text-emerald-500" size={16} />;
      case 'ensaque_envase': return <Flame className="text-orange-500" size={16} />;
      default: return <ArrowLeftRight className="text-titam-deep" size={16} />;
    }
  }

  // Get timeline events for an entry
  const getEntryTimelineEvents = (entry: Entry) => {
    const events: Array<{
      date: string;
      time?: string;
      title: string;
      desc: string;
      tag: string;
      color: string;
      icon: any;
    }> = [];

    // 1. Initial Entry Event
    events.push({
      date: entry.data_nf || entry.data_descarga || entry.data_posicionamento || 'Recebimento',
      time: entry.hora_entrada || entry.hora_chegada || '',
      title: `Recebimento & Descarga: NF ${entry.nf_numero || 'S/N'}`,
      desc: `${entry.descricao_produto} • Fornecedor: ${entry.origem || entry.fornecedor || 'N/A'} • Peso Entrada: ${Number(entry.tonelada || 0).toLocaleString('pt-BR')} t • Container: ${entry.container || 'S/C'}`,
      tag: 'ENTRADA',
      color: 'bg-emerald-500 text-white',
      icon: <Building2 size={16} />
    });

    // 2. Internal Movements
    const entryMovs = movements
      .filter(m => String(m.entryId) === String(entry.id))
      .sort((a, b) => (a.data_movimentacao + (a.hora_movimentacao || '')).localeCompare(b.data_movimentacao + (b.hora_movimentacao || '')));

    entryMovs.forEach(m => {
      events.push({
        date: m.data_movimentacao,
        time: m.hora_movimentacao,
        title: m.tipo_movimentacao_label || getMovementTypeLabel(m.tipo_movimentacao),
        desc: `${m.origem_local} ➔ ${m.destino_local} • ${m.toneladas_movimentadas.toLocaleString('pt-BR')} t • Operador: ${m.responsavel_operador || 'Sistema'}${m.observacoes ? ` • Obs: ${m.observacoes}` : ''}`,
        tag: 'TERMINAL',
        color: 'bg-blue-500 text-white',
        icon: <ArrowLeftRight size={16} />
      });
    });

    // 3. Fractioned Exits
    const exits = entries
      .filter(e => String(e.parent_entry_id) === String(entry.id))
      .sort((a, b) => (a.data_carregamento_rodoviario || a.data_posicionamento || '').localeCompare(b.data_carregamento_rodoviario || b.data_posicionamento || ''));

    exits.forEach((ex, idx) => {
      events.push({
        date: ex.data_carregamento_rodoviario || ex.data_posicionamento || 'Expedição',
        time: ex.horario_posicionamento || ex.hora_saida || '',
        title: `Saída Fracionada #${idx + 1}: ${Number(ex.tonelada || 0).toLocaleString('pt-BR')} t`,
        desc: `Destino: ${ex.destino || 'N/A'} • Cliente: ${ex.cliente || ex.destinatario || 'N/A'} • Veículo/Vagão: ${ex.placa_saida || ex.numero_vagao || 'N/A'} • Container: ${ex.container || 'N/A'}`,
        tag: 'EXPEDIÇÃO',
        color: 'bg-titam-deep text-titam-lime',
        icon: <Truck size={16} />
      });
    });

    return events;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm transition-all duration-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cargas em Pátio</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Boxes size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-titam-deep">{stats.activeLots}</span>
            <span className="text-xs text-gray-400 font-bold uppercase">Lotes / NFs</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Disponíveis para movimentar ou expedir</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm transition-all duration-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo Total no Pátio</span>
            <div className="p-2 rounded-xl bg-titam-lime/20 text-titam-deep">
              <Layers size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-titam-deep">
              {stats.totalTonsInYard.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs text-titam-deep font-bold uppercase">Toneladas</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Saldo físico remanescente no terminal</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm transition-all duration-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Movimentações Feitas</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ArrowLeftRight size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600">{stats.movementsCount}</span>
            <span className="text-xs text-gray-400 font-bold uppercase">Registros</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Baias, silos, moegas e manobras</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm transition-all duration-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Endereços Ocupados</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <MapPin size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-600">{stats.occupiedLocationsCount}</span>
            <span className="text-xs text-gray-400 font-bold uppercase">Locais com Carga</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">{stats.fractionedCount} carga(s) em saída fracionada</p>
        </div>
      </div>

      {/* Main Navigation & Actions Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-xl w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'movements'
                ? 'bg-titam-deep text-white shadow-md'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <ArrowLeftRight size={16} />
            Histórico de Movimentações
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'stock'
                ? 'bg-titam-deep text-white shadow-md'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Boxes size={16} />
            Cargas & Saldo Fracionado ({activeStockEntries.length})
          </button>
          <button
            onClick={() => setActiveTab('yard')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'yard'
                ? 'bg-titam-deep text-white shadow-md'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Warehouse size={16} />
            Mapa de Pátio / Silos
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'locations'
                ? 'bg-titam-deep text-white shadow-md'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <MapPin size={16} />
            Endereços do Terminal
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setShowAddLocationModal(true)}
            className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
          >
            <Plus size={16} />
            Cadastrar Local
          </button>
          <button
            onClick={() => handleOpenMovementModal()}
            className="px-5 py-2 bg-titam-lime text-titam-deep hover:bg-titam-lime/90 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5"
          >
            <Plus size={16} />
            Nova Movimentação
          </button>
        </div>
      </div>

      {/* TAB 1: MOVIMENTAÇÕES REALIZADAS */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por NF, Lote, Produto, Local ou Operador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-titam-lime outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="border border-gray-200 bg-white rounded-lg px-3 py-2 text-xs font-medium text-gray-700 outline-none"
              >
                <option value="all">Todos os Tipos</option>
                <option value="mudanca_baia">Mudança de Baia / Pilha</option>
                <option value="transferencia_silo">Transferência para Silo</option>
                <option value="troca_container">Troca de Container</option>
                <option value="manobra_ferroviaria">Manobra Ferroviária</option>
                <option value="ensaque_envase">Ensaque / Envase</option>
                <option value="pesagem_intermediaria">Pesagem Intermediária</option>
                <option value="amostragem_qualidade">Amostragem / Qualidade</option>
                <option value="outro">Outros</option>
              </select>

              <select
                value={filterLocation}
                onChange={e => setFilterLocation(e.target.value)}
                className="border border-gray-200 bg-white rounded-lg px-3 py-2 text-xs font-medium text-gray-700 outline-none"
              >
                <option value="all">Todos os Locais</option>
                {currentBranchLocations.map(loc => (
                  <option key={loc.id} value={loc.name}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Movements Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-5 py-3.5">Data / Hora</th>
                    <th className="px-5 py-3.5">Tipo de Movimentação</th>
                    <th className="px-5 py-3.5">Carga / Lote / NF</th>
                    <th className="px-5 py-3.5">De (Origem) ➔ Para (Destino)</th>
                    <th className="px-5 py-3.5">Containers / Vagões</th>
                    <th className="px-5 py-3.5 text-right">Peso Movimentado</th>
                    <th className="px-5 py-3.5">Operador</th>
                    <th className="px-5 py-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-gray-400 italic">
                        Nenhuma movimentação interna registrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map(mov => {
                      const entryRel = entries.find(e => String(e.id) === String(mov.entryId));
                      return (
                        <tr key={mov.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="font-bold text-gray-900">{mov.data_movimentacao}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{mov.hora_movimentacao || '--:--'}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              {getMovementTypeIcon(mov.tipo_movimentacao)}
                              <span className="font-bold text-gray-800">
                                {mov.tipo_movimentacao_label || getMovementTypeLabel(mov.tipo_movimentacao)}
                              </span>
                            </div>
                            {mov.observacoes && (
                              <div className="text-[10px] text-gray-500 italic mt-0.5 max-w-xs truncate" title={mov.observacoes}>
                                {mov.observacoes}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-titam-deep">
                              NF {mov.nf_numero || entryRel?.nf_numero || 'S/N'}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Lote: {mov.id_lote || entryRel?.id_lote || '--'} • {mov.descricao_produto || entryRel?.descricao_produto || ''}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 font-bold rounded">
                                {mov.origem_local}
                              </span>
                              <span className="text-gray-400">➔</span>
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">
                                {mov.destino_local}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-[11px]">
                            {mov.container_destino ? (
                              <div className="text-gray-800 font-mono font-bold">
                                {mov.container_origem !== mov.container_destino && mov.container_origem ? (
                                  <span>{mov.container_origem} ➔ {mov.container_destino}</span>
                                ) : (
                                  <span>Cont: {mov.container_destino}</span>
                                )}
                              </div>
                            ) : null}
                            {mov.vagao_destino ? (
                              <div className="text-gray-500 font-mono text-[10px]">
                                Vagão: {mov.vagao_destino}
                              </div>
                            ) : null}
                            {!mov.container_destino && !mov.vagao_destino && (
                              <span className="text-gray-400 italic">Granel</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-gray-900 whitespace-nowrap">
                            {Number(mov.toneladas_movimentadas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-gray-600 font-medium">
                            {mov.responsavel_operador || '--'}
                          </td>
                          <td className="px-5 py-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {entryRel && (
                                <button
                                  onClick={() => {
                                    setTimelineEntry(entryRel);
                                    setShowTimelineModal(true);
                                  }}
                                  title="Ver Linha do Tempo da Carga"
                                  className="p-1.5 text-gray-400 hover:text-titam-deep hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  <History size={16} />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={async () => {
                                    if (confirm('Deseja excluir este registro de movimentação interna?')) {
                                      await onDeleteMovement(mov.id);
                                    }
                                  }}
                                  title="Excluir movimentação"
                                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ESTOQUE EM PÁTIO & SALDO FRACIONADO */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-800">
              <span className="font-bold">Controle de Saídas Fracionadas e Saldo Físico:</span> Toda carga que entra no terminal mantém seu saldo em toneladas. 
              Você pode registrar <strong>movimentações internas</strong> para novas baias/silos ou clicar em <strong>"Expedir Fracionado"</strong> para gerar saídas parciais (via carreta ou vagão).
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="px-5 py-3.5">NF / Lote</th>
                    <th className="px-5 py-3.5">Produto</th>
                    <th className="px-5 py-3.5">Origem / Fornecedor</th>
                    <th className="px-5 py-3.5">Localização Atual</th>
                    <th className="px-5 py-3.5">Container / Vagão</th>
                    <th className="px-5 py-3.5 text-right">Peso Entrada</th>
                    <th className="px-5 py-3.5 text-right">Já Expedido</th>
                    <th className="px-5 py-3.5 text-right">Saldo Restante</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Ações Operacionais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {activeStockEntries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-gray-400 italic">
                        Nenhuma carga com saldo em pátio no momento.
                      </td>
                    </tr>
                  ) : (
                    activeStockEntries.map(entry => {
                      const pesoEntrada = Number(entry.tonelada || 0);
                      const saldo = entry.saldo_toneladas !== undefined ? Number(entry.saldo_toneladas) : pesoEntrada;
                      const expedido = entry.total_expedido !== undefined ? Number(entry.total_expedido) : (pesoEntrada - saldo);

                      return (
                        <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="font-black text-titam-deep">
                              NF {entry.nf_numero || entry.chave_acesso?.slice(-8) || 'S/N'}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              Lote: {entry.id_lote || '--'}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-gray-800">
                            {entry.descricao_produto}
                          </td>
                          <td className="px-5 py-3.5 text-gray-600">
                            {entry.origem || entry.fornecedor || '--'}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 bg-titam-lime/20 text-titam-deep font-bold rounded-lg border border-titam-lime/40 flex items-center gap-1.5 w-fit">
                              <MapPin size={12} />
                              {entry.localizacao_atual || 'Pátio Geral'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] whitespace-nowrap">
                            <div className="font-bold text-gray-800">{entry.container || 'S/C'}</div>
                            {entry.numero_vagao && (
                              <div className="text-gray-400 text-[10px]">Vagão: {entry.numero_vagao}</div>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-medium text-gray-500 whitespace-nowrap">
                            {pesoEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t
                          </td>
                          <td className="px-5 py-3.5 text-right font-medium text-blue-600 whitespace-nowrap">
                            {expedido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-emerald-600 whitespace-nowrap text-sm">
                            {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t
                          </td>
                          <td className="px-5 py-3.5 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              entry.status === 'Embarcado Parcial' 
                                ? 'bg-amber-100 text-amber-800' 
                                : entry.status === 'Estoque' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-blue-100 text-blue-800'
                            }`}>
                              {entry.status || 'Estoque'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenMovementModal(entry)}
                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-xs transition-colors flex items-center gap-1"
                                title="Movimentar internamente"
                              >
                                <ArrowLeftRight size={13} />
                                Movimentar
                              </button>
                              <button
                                onClick={() => handleOpenFractionedExitModal(entry)}
                                disabled={saldo <= 0.001}
                                className={`px-2.5 py-1.5 bg-titam-deep hover:bg-titam-deep/90 text-titam-lime font-bold rounded-lg text-xs transition-colors flex items-center gap-1 ${
                                  saldo <= 0.001 ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                title="Registrar saída fracionada (carreta/vagão)"
                              >
                                <Truck size={13} />
                                Expedir Saída
                              </button>
                              <button
                                onClick={() => {
                                  setTimelineEntry(entry);
                                  setShowTimelineModal(true);
                                }}
                                className="p-1.5 text-gray-400 hover:text-titam-deep hover:bg-gray-100 rounded-lg transition-colors"
                                title="Ver Histórico / Timeline"
                              >
                                <History size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MAPA VISUAL DO PÁTIO */}
      {activeTab === 'yard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentBranchLocations.map(location => {
              // Find entries currently in this location
              const entriesInLoc = activeStockEntries.filter(
                e => (e.localizacao_atual || 'Pátio Geral') === location.name
              );
              const totalTonsInLoc = entriesInLoc.reduce((acc, curr) => {
                const s = curr.saldo_toneladas !== undefined ? Number(curr.saldo_toneladas) : Number(curr.tonelada || 0);
                return acc + (isNaN(s) ? 0 : s);
              }, 0);

              const percentCapacity = location.capacidade_toneladas 
                ? Math.min(100, Math.round((totalTonsInLoc / location.capacidade_toneladas) * 100))
                : null;

              return (
                <div key={location.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 hover:border-titam-lime/50 transition-all duration-300">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 bg-gray-50 rounded-xl text-titam-deep">
                        {location.tipo === 'silo' ? <Warehouse size={20} /> :
                         location.tipo === 'linha_ferroviaria' ? <TrendingDown size={20} /> :
                         location.tipo === 'moega' ? <Flame size={20} /> :
                         <Layers size={20} />}
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-gray-900 uppercase tracking-tight">{location.name}</h4>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Tipo: {location.tipo.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      totalTonsInLoc > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {totalTonsInLoc > 0 ? 'Ocupado' : 'Vazio'}
                    </span>
                  </div>

                  {/* Weight summary */}
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-black text-titam-deep">
                        {totalTonsInLoc.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
                      </span>
                      <span className="text-xs text-gray-500 font-bold ml-1">t estocadas</span>
                    </div>
                    {location.capacidade_toneladas ? (
                      <span className="text-xs text-gray-400 font-medium">
                        Cap: {location.capacidade_toneladas.toLocaleString('pt-BR')} t
                      </span>
                    ) : null}
                  </div>

                  {percentCapacity !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-gray-400">
                        <span>Ocupação</span>
                        <span>{percentCapacity}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            percentCapacity > 85 ? 'bg-rose-500' : percentCapacity > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percentCapacity}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* List of items inside this location */}
                  <div className="pt-2 border-t border-gray-50 space-y-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                      Produtos no Local ({entriesInLoc.length})
                    </span>
                    {entriesInLoc.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Nenhuma carga nesta localização</p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {entriesInLoc.map(entry => (
                          <div 
                            key={entry.id} 
                            onClick={() => {
                              setTimelineEntry(entry);
                              setShowTimelineModal(true);
                            }}
                            className="bg-gray-50/80 hover:bg-gray-100 p-2 rounded-lg cursor-pointer transition-colors text-xs flex items-center justify-between"
                          >
                            <div className="truncate mr-2">
                              <span className="font-bold text-gray-800 block truncate">NF {entry.nf_numero || 'S/N'} • {entry.descricao_produto}</span>
                              <span className="text-[10px] text-gray-500 font-mono">Cont: {entry.container || 'S/C'}</span>
                            </div>
                            <span className="font-black text-emerald-700 whitespace-nowrap">
                              {Number(entry.saldo_toneladas ?? entry.tonelada).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} t
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: CADASTRO DE LOCAIS / ENDEREÇOS DO TERMINAL */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Endereços Físicos do Terminal</h3>
              <p className="text-xs text-gray-500">Cadastre e organize as baias, silos, moegas, pátios e linhas férreas da unidade.</p>
            </div>
            <button
              onClick={() => setShowAddLocationModal(true)}
              className="px-4 py-2 bg-titam-lime text-titam-deep font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5"
            >
              <Plus size={16} />
              Novo Endereço
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {currentBranchLocations.map(loc => (
              <div key={loc.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="text-titam-deep" size={16} />
                    <span className="font-bold text-sm text-gray-900">{loc.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                    {loc.tipo}
                  </span>
                  {loc.capacidade_toneladas ? (
                    <span className="text-xs text-gray-600 block">Capacidade: {loc.capacidade_toneladas} t</span>
                  ) : null}
                  {loc.descricao && (
                    <p className="text-[11px] text-gray-500 italic">{loc.descricao}</p>
                  )}
                </div>

                {isAdmin && loc.id && !loc.id.startsWith('def-') && (
                  <button
                    onClick={async () => {
                      if (confirm(`Deseja remover o endereço "${loc.name}"?`)) {
                        await onDeleteLocation(loc.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTRAR NOVA MOVIMENTAÇÃO INTERNA */}
      {showAddMovementModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  <ArrowLeftRight className="text-titam-deep" size={20} />
                  Registrar Movimentação Interna
                </h3>
                <p className="text-xs text-gray-500">Mude baias, transfira para silos, troque containers ou manobre no pátio.</p>
              </div>
              <button onClick={() => setShowAddMovementModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMovement} className="p-6 space-y-4">
              {/* Seleção da Carga */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Carga / NF / Lote a Movimentar *
                </label>
                <select
                  value={movementForm.entryId}
                  onChange={e => {
                    const selId = e.target.value;
                    const ent = entries.find(x => String(x.id) === selId);
                    if (ent) {
                      const saldo = ent.saldo_toneladas !== undefined ? Number(ent.saldo_toneladas) : Number(ent.tonelada || 0);
                      setMovementForm(prev => ({
                        ...prev,
                        entryId: selId,
                        origem_local: ent.localizacao_atual || 'Pátio Geral',
                        container_origem: ent.container || '',
                        container_destino: ent.container || '',
                        vagao_origem: ent.numero_vagao || '',
                        vagao_destino: ent.numero_vagao || '',
                        toneladas_movimentadas: saldo
                      }));
                    }
                  }}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-titam-lime"
                >
                  <option value="">Selecione uma carga em pátio...</option>
                  {activeStockEntries.map(e => (
                    <option key={e.id} value={String(e.id)}>
                      NF {e.nf_numero || 'S/N'} • {e.descricao_produto} • Saldo: {Number(e.saldo_toneladas ?? e.tonelada).toLocaleString('pt-BR')} t • Local: {e.localizacao_atual || 'Pátio'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Movimentação */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Tipo de Operação Interna *
                </label>
                <select
                  value={movementForm.tipo_movimentacao}
                  onChange={e => setMovementForm(prev => ({ ...prev, tipo_movimentacao: e.target.value as any }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-titam-lime"
                >
                  <option value="mudanca_baia">Mudança de Baia / Pilha</option>
                  <option value="transferencia_silo">Transferência para Silo</option>
                  <option value="troca_container">Troca / Estufagem de Container</option>
                  <option value="manobra_ferroviaria">Manobra / Linha Ferroviária</option>
                  <option value="ensaque_envase">Ensaque / Envase / Reenvase</option>
                  <option value="pesagem_intermediaria">Pesagem Intermediária</option>
                  <option value="amostragem_qualidade">Amostragem / Qualidade</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              {/* Origem e Destino */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Local Origem (De) *
                  </label>
                  <input
                    type="text"
                    list="locations-origin-list"
                    value={movementForm.origem_local}
                    onChange={e => setMovementForm(prev => ({ ...prev, origem_local: e.target.value }))}
                    placeholder="Ex: Baia 1, Moega, Silo 1"
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-titam-lime"
                  />
                  <datalist id="locations-origin-list">
                    {currentBranchLocations.map(l => <option key={l.id} value={l.name} />)}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-titam-deep uppercase tracking-widest">
                    Local Destino (Para) *
                  </label>
                  <input
                    type="text"
                    list="locations-dest-list"
                    value={movementForm.destino_local}
                    onChange={e => setMovementForm(prev => ({ ...prev, destino_local: e.target.value }))}
                    placeholder="Ex: Baia 3, Silo 2, Linha Férrea 1"
                    required
                    className="w-full border-2 border-titam-lime rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-titam-lime"
                  />
                  <datalist id="locations-dest-list">
                    {currentBranchLocations.map(l => <option key={l.id} value={l.name} />)}
                  </datalist>
                </div>
              </div>

              {/* Containers (se houver transbordo/troca) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Container Origem
                  </label>
                  <input
                    type="text"
                    value={movementForm.container_origem}
                    onChange={e => setMovementForm(prev => ({ ...prev, container_origem: e.target.value }))}
                    placeholder="Identificação do Container"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Novo Container Destino (se trocou)
                  </label>
                  <input
                    type="text"
                    value={movementForm.container_destino}
                    onChange={e => setMovementForm(prev => ({ ...prev, container_destino: e.target.value }))}
                    placeholder="Novo Container"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-900 outline-none"
                  />
                </div>
              </div>

              {/* Peso Movimentado, Data e Hora */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Toneladas Movimentadas *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={movementForm.toneladas_movimentadas}
                    onChange={e => setMovementForm(prev => ({ ...prev, toneladas_movimentadas: parseFloat(e.target.value) || 0 }))}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-black text-gray-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Data da Movimentação
                  </label>
                  <input
                    type="date"
                    value={movementForm.data_movimentacao}
                    onChange={e => setMovementForm(prev => ({ ...prev, data_movimentacao: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={movementForm.hora_movimentacao}
                    onChange={e => setMovementForm(prev => ({ ...prev, hora_movimentacao: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                  />
                </div>
              </div>

              {/* Operador e Observações */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Operador / Responsável
                  </label>
                  <input
                    type="text"
                    value={movementForm.responsavel_operador}
                    onChange={e => setMovementForm(prev => ({ ...prev, responsavel_operador: e.target.value }))}
                    placeholder="Nome do operador"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Observações Operacionais
                  </label>
                  <input
                    type="text"
                    value={movementForm.observacoes}
                    onChange={e => setMovementForm(prev => ({ ...prev, observacoes: e.target.value }))}
                    placeholder="Ex: Motivo da mudança, lote segregado..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddMovementModal(false)}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-titam-lime text-titam-deep font-bold rounded-xl text-xs uppercase tracking-wider shadow-md hover:bg-titam-lime/90 flex items-center gap-2"
                >
                  {isSubmitting ? 'Salvando...' : 'Gravar Movimentação'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: REGISTRAR SAÍDA FRACIONADA (VINCULADA) */}
      {showFractionedExitModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  <Truck className="text-titam-deep" size={20} />
                  Registrar Saída Fracionada
                </h3>
                <p className="text-xs text-gray-500">
                  Origem: NF {selectedEntry.nf_numero || 'S/N'} • Produto: {selectedEntry.descricao_produto}
                </p>
              </div>
              <button onClick={() => setShowFractionedExitModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Saldo summary box */}
            <div className="bg-titam-deep text-white p-4 mx-6 mt-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-titam-lime tracking-widest block">Saldo Disponível em Terminal</span>
                <span className="text-2xl font-black">
                  {Number(selectedEntry.saldo_toneladas ?? selectedEntry.tonelada).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t
                </span>
              </div>
              <div className="text-right text-xs text-gray-300">
                <div>Local Atual: <strong className="text-white">{selectedEntry.localizacao_atual || 'Pátio Geral'}</strong></div>
                <div>Container Atual: <strong className="text-white">{selectedEntry.container || 'S/C'}</strong></div>
              </div>
            </div>

            <form onSubmit={handleSaveFractionedExit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-titam-deep uppercase tracking-widest">
                    Toneladas desta Saída (Carregamento) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    max={Number(selectedEntry.saldo_toneladas ?? selectedEntry.tonelada)}
                    value={exitForm.toneladas}
                    onChange={e => setExitForm(prev => ({ ...prev, toneladas: parseFloat(e.target.value) || 0 }))}
                    required
                    className="w-full border-2 border-titam-lime rounded-xl px-4 py-2.5 text-sm font-black text-gray-900 outline-none"
                  />
                  <span className="text-[10px] text-gray-400">
                    Saldo restante após saída: {(Number(selectedEntry.saldo_toneladas ?? selectedEntry.tonelada) - exitForm.toneladas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Modal de Expedição
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setExitForm(prev => ({ ...prev, modal: 'Rodoviário' }))}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        exitForm.modal === 'Rodoviário'
                          ? 'bg-titam-deep text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Rodoviário
                    </button>
                    <button
                      type="button"
                      onClick={() => setExitForm(prev => ({ ...prev, modal: 'Ferroviário' }))}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        exitForm.modal === 'Ferroviário'
                          ? 'bg-titam-deep text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Ferroviário
                    </button>
                  </div>
                </div>
              </div>

              {/* Veículo / Vagão e Container */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {exitForm.modal === 'Rodoviário' ? 'Placa do Veículo (Saída)' : 'Nº do Vagão'}
                  </label>
                  <input
                    type="text"
                    value={exitForm.modal === 'Rodoviário' ? exitForm.placa_saida : exitForm.numero_vagao}
                    onChange={e => {
                      if (exitForm.modal === 'Rodoviário') {
                        setExitForm(prev => ({ ...prev, placa_saida: e.target.value.toUpperCase() }));
                      } else {
                        setExitForm(prev => ({ ...prev, numero_vagao: e.target.value.toUpperCase() }));
                      }
                    }}
                    placeholder={exitForm.modal === 'Rodoviário' ? 'ABC-1234' : 'VAG-1029'}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-gray-900 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Container de Saída
                  </label>
                  <input
                    type="text"
                    value={exitForm.container}
                    onChange={e => setExitForm(prev => ({ ...prev, container: e.target.value.toUpperCase() }))}
                    placeholder="Número do Container"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-900 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Data do Carregamento
                  </label>
                  <input
                    type="date"
                    value={exitForm.data_carregamento_rodoviario}
                    onChange={e => setExitForm(prev => ({ ...prev, data_carregamento_rodoviario: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                  />
                </div>
              </div>

              {/* Transportador, Cliente e Destino */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Transportador
                  </label>
                  <input
                    type="text"
                    value={exitForm.transportador}
                    onChange={e => setExitForm(prev => ({ ...prev, transportador: e.target.value }))}
                    placeholder="VLI, MRS, Transnorte..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Cliente / Destinatário
                  </label>
                  <input
                    type="text"
                    value={exitForm.cliente}
                    onChange={e => setExitForm(prev => ({ ...prev, cliente: e.target.value }))}
                    placeholder="Nome do Cliente"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Destino Final
                  </label>
                  <input
                    type="text"
                    value={exitForm.destino}
                    onChange={e => setExitForm(prev => ({ ...prev, destino: e.target.value }))}
                    placeholder="Ex: Serra - ES, Cosmorama - SP"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFractionedExitModal(false)}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-titam-deep text-titam-lime font-bold rounded-xl text-xs uppercase tracking-wider shadow-md hover:bg-titam-deep/90 flex items-center gap-2"
                >
                  {isSubmitting ? 'Gerando...' : 'Confirmar Saída Fracionada'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 3: LINHA DO TEMPO / HISTÓRICO VISUAL DE RASTREABILIDADE */}
      {showTimelineModal && timelineEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  <History className="text-titam-deep" size={20} />
                  Rastreabilidade Completa do Lote
                </h3>
                <p className="text-xs text-gray-500">
                  NF {timelineEntry.nf_numero || 'S/N'} • {timelineEntry.descricao_produto} • Fornecedor: {timelineEntry.origem || timelineEntry.fornecedor}
                </p>
              </div>
              <button onClick={() => setShowTimelineModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Header stats of this entry */}
              <div className="grid grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl text-center">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Peso Entrada</span>
                  <span className="text-base font-black text-gray-900">
                    {Number(timelineEntry.tonelada || 0).toLocaleString('pt-BR')} t
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Total Já Expedido</span>
                  <span className="text-base font-black text-blue-600">
                    {Number(timelineEntry.total_expedido || 0).toLocaleString('pt-BR')} t
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Saldo Atual em Pátio</span>
                  <span className="text-base font-black text-emerald-600">
                    {Number(timelineEntry.saldo_toneladas ?? timelineEntry.tonelada).toLocaleString('pt-BR')} t
                  </span>
                </div>
              </div>

              {/* Timeline Items */}
              <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {getEntryTimelineEvents(timelineEntry).map((event, idx) => (
                  <div key={idx} className="relative flex items-start gap-4 group">
                    {/* Circle icon */}
                    <div className={`absolute -left-6 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${event.color}`}>
                      {event.icon}
                    </div>

                    {/* Content */}
                    <div className="bg-gray-50/70 hover:bg-gray-50 p-4 rounded-xl border border-gray-100 flex-1 space-y-1 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-black uppercase tracking-wider text-gray-600">
                          {event.tag}
                        </span>
                        <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                          <Calendar size={12} /> {event.date} {event.time ? `• ${event.time}` : ''}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-gray-900">{event.title}</h4>
                      <p className="text-xs text-gray-600">{event.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-400 font-medium">
                  Rastreabilidade ponta a ponta 100% nativa do terminal
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Printer size={15} />
                  Imprimir Comprovante
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL 4: CADASTRAR NOVO ENDEREÇO/BAIA */}
      {showAddLocationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                <MapPin className="text-titam-deep" size={18} />
                Novo Endereço / Baia
              </h3>
              <button onClick={() => setShowAddLocationModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Nome do Endereço *
                </label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={e => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Baia 4, Silo 3, Linha 3..."
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-titam-lime"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Tipo de Estrutura
                </label>
                <select
                  value={locationForm.tipo}
                  onChange={e => setLocationForm(prev => ({ ...prev, tipo: e.target.value as any }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 outline-none"
                >
                  <option value="baia">Baia / Box</option>
                  <option value="silo">Silo de Armazenagem</option>
                  <option value="moega">Moega de Descarga</option>
                  <option value="patio">Pátio Geral / Containers</option>
                  <option value="linha_ferroviaria">Linha Férrea</option>
                  <option value="armazem">Armazém Coberto</option>
                  <option value="outro">Outro Local</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Capacidade Estimada (Toneladas)
                </label>
                <input
                  type="number"
                  value={locationForm.capacidade_toneladas}
                  onChange={e => setLocationForm(prev => ({ ...prev, capacidade_toneladas: parseFloat(e.target.value) || 0 }))}
                  placeholder="1000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Descrição / Observação
                </label>
                <input
                  type="text"
                  value={locationForm.descricao}
                  onChange={e => setLocationForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Área pavimentada para calcário..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLocationModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-titam-lime text-titam-deep font-bold rounded-xl text-xs uppercase tracking-wider shadow-sm"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Endereço'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

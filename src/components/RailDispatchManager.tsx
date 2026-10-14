import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrainTrack, 
  Boxes, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  Trash2, 
  Printer, 
  Calendar, 
  Clock, 
  Building2, 
  X, 
  FileText, 
  Plus, 
  Share2, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Container as ContainerIcon,
  Layers,
  Package,
  Scale
} from 'lucide-react';
import { RailDispatch, Branch, Container as ContainerType, Entry } from '../types';

interface RailDispatchManagerProps {
  dispatches: RailDispatch[];
  containers: ContainerType[];
  entries: Entry[];
  selectedBranchId: string;
  branches: Branch[];
  isAdmin: boolean;
  userEmail: string;
  onSaveDispatch: (dispatch: Omit<RailDispatch, 'id' | 'created_at' | 'uid'>) => Promise<boolean>;
  onDeleteDispatch: (id: string) => Promise<boolean>;
  onUpdateDispatchStatus: (id: string, status: RailDispatch['status']) => Promise<boolean>;
}

export const RailDispatchManager: React.FC<RailDispatchManagerProps> = ({
  dispatches,
  containers,
  entries,
  selectedBranchId,
  branches,
  isAdmin,
  userEmail,
  onSaveDispatch,
  onDeleteDispatch,
  onUpdateDispatchStatus
}) => {
  // Form State
  const [numeroVagao, setNumeroVagao] = useState('');
  const [unidadeId, setUnidadeId] = useState<string>(() => {
    return selectedBranchId !== 'all' ? selectedBranchId : (branches[0]?.id || '');
  });
  
  const [container1, setContainer1] = useState('');
  const [container2, setContainer2] = useState('');
  const [lacre1, setLacre1] = useState('');
  const [lacre2, setLacre2] = useState('');
  const [pesoContainer1, setPesoContainer1] = useState<string>('');
  const [pesoContainer2, setPesoContainer2] = useState<string>('');
  const [produtoContainer1, setProdutoContainer1] = useState('');
  const [produtoContainer2, setProdutoContainer2] = useState('');
  const [nfContainer1, setNfContainer1] = useState('');
  const [nfContainer2, setNfContainer2] = useState('');
  const [destino, setDestino] = useState('Porto de Tubarão - ES');
  const [ferroviaOperadora, setFerroviaOperadora] = useState('VLI Logística');
  const [numeroComposicao, setNumeroComposicao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [dataDespacho, setDataDespacho] = useState(new Date().toISOString().split('T')[0]);
  const [horaDespacho, setHoraDespacho] = useState(new Date().toTimeString().slice(0, 5));

  // Matched entries from stock for Container 1 and Container 2
  const [matchedEntry1, setMatchedEntry1] = useState<Entry | null>(null);
  const [matchedEntry2, setMatchedEntry2] = useState<Entry | null>(null);
  
  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'novo' | 'historico'>('novo');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');
  const [filterDateQuick, setFilterDateQuick] = useState<'all' | 'today' | '7days' | 'month'>('all');
  const [showStockContainersPicker, setShowStockContainersPicker] = useState(false);
  const [modalProductFilter, setModalProductFilter] = useState<string>('all');
  const [modalSearchTerm, setModalSearchTerm] = useState<string>('');

  const applyQuickDateFilter = (type: 'all' | 'today' | '7days' | 'month') => {
    setFilterDateQuick(type);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (type === 'all') {
      setFilterDateStart('');
      setFilterDateEnd('');
    } else if (type === 'today') {
      setFilterDateStart(todayStr);
      setFilterDateEnd(todayStr);
    } else if (type === '7days') {
      const past = new Date(today);
      past.setDate(past.getDate() - 7);
      setFilterDateStart(past.toISOString().split('T')[0]);
      setFilterDateEnd(todayStr);
    } else if (type === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilterDateStart(firstDay.toISOString().split('T')[0]);
      setFilterDateEnd(todayStr);
    }
  };
  
  // High-Impact System Alert Modal
  const [dispatchAlert, setDispatchAlert] = useState<{
    show: boolean;
    vagao: string;
    c1: string;
    c2: string;
    unidade: string;
    produto1: string;
    produto2: string;
    nf1?: string;
    nf2?: string;
    data: string;
    hora: string;
    destino: string;
    operador: string;
  } | null>(null);

  // Selected for ticket preview / printing
  const [selectedTicketDispatch, setSelectedTicketDispatch] = useState<RailDispatch | null>(null);

  // Sync unidadeId if selectedBranchId changes
  useEffect(() => {
    if (selectedBranchId !== 'all') {
      setUnidadeId(selectedBranchId);
    }
  }, [selectedBranchId]);

  // Set of all dispatched container numbers currently in dispatches
  const dispatchedContainerNumbers = useMemo(() => {
    const set = new Set<string>();
    dispatches.forEach(d => {
      if (d.container_1 && d.container_1.trim()) {
        set.add(d.container_1.trim().toUpperCase());
      }
      if (d.container_2 && d.container_2.trim()) {
        set.add(d.container_2.trim().toUpperCase());
      }
    });
    return set;
  }, [dispatches]);

  // List of all containers currently in stock (Status Estoque) that have NOT been dispatched yet
  const stockEntries = useMemo(() => {
    return entries.filter(e => {
      if (!e.container || !e.container.trim()) return false;
      const statusLower = (e.status || '').toLowerCase();
      const isStock = statusLower === 'estoque' || 
             statusLower.includes('estoque') || 
             statusLower === 'estoque (cheio terminal)';
      if (!isStock) return false;

      // Retira da lista de disponíveis se já foi usado em algum despacho
      const cleanNum = e.container.trim().toUpperCase();
      if (dispatchedContainerNumbers.has(cleanNum)) {
        return false;
      }
      return true;
    });
  }, [entries, dispatchedContainerNumbers]);

  // Group stock entries by Product Type
  const stockEntriesByProduct = useMemo(() => {
    const groups: { [product: string]: { entries: Entry[]; totalTons: number; displayName: string } } = {};
    stockEntries.forEach(entry => {
      const rawProd = (entry.descricao_produto || 'Produto Não Especificado').trim();
      const prodKey = rawProd.toUpperCase();
      if (!groups[prodKey]) {
        groups[prodKey] = { entries: [], totalTons: 0, displayName: rawProd };
      }
      groups[prodKey].entries.push(entry);
      const tons = (entry.saldo_toneladas ?? entry.tonelada) || 0;
      groups[prodKey].totalTons += tons;
    });
    return groups;
  }, [stockEntries]);

  // List of unique product types sorted
  const productTypesList = useMemo(() => {
    return Object.keys(stockEntriesByProduct).sort();
  }, [stockEntriesByProduct]);

  // Helper function to search stock entry by container number
  const findStockEntry = (containerNum: string): Entry | null => {
    if (!containerNum || !containerNum.trim()) return null;
    const clean = containerNum.trim().toUpperCase();
    return stockEntries.find(e => e.container.trim().toUpperCase() === clean) || null;
  };

  // Handle Container 1 input change with automatic lookup
  const handleContainer1Change = (value: string) => {
    const upper = value.toUpperCase();
    setContainer1(upper);

    const found = findStockEntry(upper);
    if (found) {
      setMatchedEntry1(found);
      // Auto-preenche peso
      const peso = found.saldo_toneladas ?? found.tonelada;
      if (peso !== undefined && peso !== null) {
        setPesoContainer1(peso.toString());
      }
      // Auto-preenche produto / material
      if (found.descricao_produto) {
        setProdutoContainer1(found.descricao_produto);
      }
      // Auto-preenche NF
      if (found.nf_numero) {
        setNfContainer1(found.nf_numero);
      }
      // Auto-preenche Unidade (Filial)
      if (found.branchId) {
        setUnidadeId(found.branchId);
      }
    } else {
      setMatchedEntry1(null);
    }
  };

  // Handle Container 2 input change with automatic lookup
  const handleContainer2Change = (value: string) => {
    const upper = value.toUpperCase();
    setContainer2(upper);

    const found = findStockEntry(upper);
    if (found) {
      setMatchedEntry2(found);
      // Auto-preenche peso
      const peso = found.saldo_toneladas ?? found.tonelada;
      if (peso !== undefined && peso !== null) {
        setPesoContainer2(peso.toString());
      }
      // Auto-preenche produto / material
      if (found.descricao_produto) {
        setProdutoContainer2(found.descricao_produto);
      }
      // Auto-preenche NF
      if (found.nf_numero) {
        setNfContainer2(found.nf_numero);
      }
      // Auto-preenche Unidade se ainda não definida ou se container 1 não for de estoque
      if (found.branchId && (!container1 || !matchedEntry1)) {
        setUnidadeId(found.branchId);
      }
    } else {
      setMatchedEntry2(null);
    }
  };

  // Quick picker action from stock list
  const handlePickStockContainer = (entry: Entry, targetSlot: 1 | 2) => {
    const cleanNum = entry.container.trim().toUpperCase();
    if (targetSlot === 1) {
      if (container2 && cleanNum === container2.trim().toUpperCase()) {
        alert('Este container já está alocado no Container 2 deste vagão.');
        return;
      }
      handleContainer1Change(entry.container);
      if (entry.nf_numero) setNfContainer1(entry.nf_numero);
    } else {
      if (container1 && cleanNum === container1.trim().toUpperCase()) {
        alert('Este container já está alocado no Container 1 deste vagão.');
        return;
      }
      handleContainer2Change(entry.container);
      if (entry.nf_numero) setNfContainer2(entry.nf_numero);
    }
    setShowStockContainersPicker(false);
  };

  // Filtered dispatches by branch, status, date and search
  const filteredDispatches = useMemo(() => {
    return dispatches.filter(d => {
      if (selectedBranchId !== 'all' && d.branchId !== selectedBranchId) return false;
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      
      // Filtro por Data do Despacho
      if (filterDateStart && d.data_despacho < filterDateStart) return false;
      if (filterDateEnd && d.data_despacho > filterDateEnd) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        d.numero_vagao.toLowerCase().includes(term) ||
        d.container_1.toLowerCase().includes(term) ||
        d.container_2.toLowerCase().includes(term) ||
        (d.nf_container_1 || '').toLowerCase().includes(term) ||
        (d.nf_container_2 || '').toLowerCase().includes(term) ||
        (d.produto_container_1 || '').toLowerCase().includes(term) ||
        (d.produto_container_2 || '').toLowerCase().includes(term) ||
        (d.unidade_nome || '').toLowerCase().includes(term) ||
        (d.destino || '').toLowerCase().includes(term) ||
        (d.numero_composicao || '').toLowerCase().includes(term) ||
        (d.ferrovia_operadora || '').toLowerCase().includes(term) ||
        (d.data_despacho || '').includes(term)
      );
    });
  }, [dispatches, selectedBranchId, filterStatus, filterDateStart, filterDateEnd, searchTerm]);

  // Handle Save Dispatch
  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanVagao = numeroVagao.trim().toUpperCase();
    const cleanC1 = container1.trim().toUpperCase();
    const cleanC2 = container2.trim().toUpperCase();

    if (!cleanVagao) {
      alert('Por favor, informe o número do vagão.');
      return;
    }

    if (!cleanC1 && !cleanC2) {
      alert('Por favor, informe ao menos um container posicionado no vagão.');
      return;
    }

    if (cleanC1 && cleanC2 && cleanC1 === cleanC2) {
      alert('Os números dos dois containers não podem ser idênticos no mesmo vagão.');
      return;
    }

    const currentBranchName = branches.find(b => b.id === unidadeId)?.name || 'Unidade Geral';

    setIsSubmitting(true);
    try {
      const payload: Omit<RailDispatch, 'id' | 'created_at' | 'uid'> = {
        numero_vagao: cleanVagao,
        container_1: cleanC1,
        container_2: cleanC2,
        lacre_1: lacre1.trim().toUpperCase(),
        lacre_2: lacre2.trim().toUpperCase(),
        peso_container_1: pesoContainer1 ? parseFloat(pesoContainer1) : undefined,
        peso_container_2: pesoContainer2 ? parseFloat(pesoContainer2) : undefined,
        produto_container_1: produtoContainer1.trim(),
        produto_container_2: produtoContainer2.trim(),
        nf_container_1: nfContainer1.trim(),
        nf_container_2: nfContainer2.trim(),
        destino: destino.trim(),
        ferrovia_operadora: ferroviaOperadora.trim(),
        numero_composicao: numeroComposicao.trim().toUpperCase(),
        status: 'Pronto para Partida',
        data_despacho: dataDespacho,
        hora_despacho: horaDespacho,
        observacoes: observacoes.trim(),
        branchId: unidadeId || (selectedBranchId === 'all' ? (branches[0]?.id || '') : selectedBranchId),
        unidade_nome: currentBranchName,
        created_by_email: userEmail
      };

      const success = await onSaveDispatch(payload);
      if (success) {
        // Trigger high-impact system alert
        setDispatchAlert({
          show: true,
          vagao: cleanVagao,
          c1: cleanC1,
          c2: cleanC2,
          unidade: currentBranchName,
          produto1: produtoContainer1.trim() || 'Material Não Especificado',
          produto2: produtoContainer2.trim() || 'Material Não Especificado',
          nf1: nfContainer1.trim(),
          nf2: nfContainer2.trim(),
          data: dataDespacho,
          hora: horaDespacho,
          destino: destino.trim(),
          operador: userEmail.split('@')[0] || 'Operador'
        });

        // Reset form fields
        setNumeroVagao('');
        setContainer1('');
        setContainer2('');
        setLacre1('');
        setLacre2('');
        setPesoContainer1('');
        setPesoContainer2('');
        setProdutoContainer1('');
        setProdutoContainer2('');
        setNfContainer1('');
        setNfContainer2('');
        setObservacoes('');
        setNumeroComposicao('');
        setMatchedEntry1(null);
        setMatchedEntry2(null);
        setHoraDespacho(new Date().toTimeString().slice(0, 5));
      }
    } catch (err) {
      console.error('Erro ao despachar vagão:', err);
      alert('Erro ao gravar o despacho ferroviário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Headline */}
      <div className="bg-gradient-to-r from-titam-deep via-titam-navy to-titam-deep rounded-2xl p-6 text-white shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <TrainTrack size={220} className="text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-titam-lime text-titam-deep rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                <TrainTrack size={13} />
                Terminal Ferroviário
              </span>
              <span className="text-xs text-gray-300 font-mono">Modo Despacho Multimodal</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase">
              Despacho de Vagões & Containers
            </h2>
            <p className="text-xs text-gray-300 max-w-xl">
              Alocação visual de containers em vagões ferroviários com busca automática de Unidade, Peso e Produto direto do Estoque de Entrada.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('novo')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'novo'
                  ? 'bg-titam-lime text-titam-deep shadow-md font-black'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Plus size={15} />
              Novo Despacho
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'historico'
                  ? 'bg-titam-lime text-titam-deep shadow-md font-black'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <FileText size={15} />
              Histórico ({filteredDispatches.length})
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: NOVO DESPACHO INTERATIVO COM DESENHO DO VAGÃO E 2 CONTAINERS */}
      {activeTab === 'novo' && (
        <form onSubmit={handleSubmitDispatch} className="space-y-6">
          {/* PAINEL VISUAL DO VAGÃO COM OS 2 CONTAINERS */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm relative overflow-hidden transition-all duration-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-titam-deep text-titam-lime rounded-xl shadow-md">
                  <TrainTrack size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-titam-deep uppercase tracking-tight">
                    Diagrama Operacional da Plataforma Ferroviária
                  </h3>
                  <p className="text-xs text-gray-500">
                    Digite o número do container para puxar automaticamente a <strong>Unidade</strong>, o <strong>Peso</strong> e o <strong>Produto</strong> do Estoque.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalProductFilter('all');
                    setShowStockContainersPicker(true);
                  }}
                  className="px-3.5 py-1.5 bg-titam-deep hover:bg-titam-navy text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Package size={14} className="text-titam-lime" />
                  Containers em Estoque ({stockEntries.length})
                </button>
                <span className="hidden sm:inline-flex px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-widest rounded-full">
                  Pronto para Despacho
                </span>
              </div>
            </div>

            {/* BARRA DE PRODUTOS EM ESTOQUE NO PÁTIO */}
            {productTypesList.length > 0 && (
              <div className="mb-6 p-3 bg-slate-50 border border-gray-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-titam-deep text-titam-lime rounded-lg">
                    <Layers size={13} />
                  </div>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    Estoque Separado por Tipo de Produto:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setModalProductFilter('all');
                      setShowStockContainersPicker(true);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-titam-deep hover:text-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 transition-all shadow-2xs"
                  >
                    Todos ({stockEntries.length})
                  </button>
                  {productTypesList.map(prodKey => {
                    const group = stockEntriesByProduct[prodKey];
                    return (
                      <button
                        key={prodKey}
                        type="button"
                        onClick={() => {
                          setModalProductFilter(prodKey);
                          setShowStockContainersPicker(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-titam-deep hover:text-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 transition-all shadow-2xs group"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-titam-lime group-hover:bg-white" />
                        <span className="truncate max-w-[140px]">{group.displayName}</span>
                        <span className="px-1.5 py-0.2 bg-gray-100 group-hover:bg-white/20 text-[9px] font-black rounded text-gray-600 group-hover:text-white">
                          {group.entries.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ILUSTRAÇÃO TÉCNICA DO VAGÃO FERROVIÁRIO COM 2 CONTAINERS */}
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 md:p-10 rounded-2xl border-4 border-slate-800 shadow-2xl relative">
              {/* Rails (Trilhos Ferroviários no Fundo) */}
              <div className="absolute bottom-6 left-0 right-0 h-4 bg-zinc-700 border-t-2 border-b-2 border-zinc-500 shadow-inner flex items-center justify-between px-2">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="w-1.5 h-6 bg-zinc-800 -my-1 border-x border-zinc-600 shadow-sm" />
                ))}
              </div>

              {/* CONTAINER AREA (2 CONTAINERS LADO A LADO EM CIMA DO VAGÃO) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 mb-3">
                {/* CONTAINER 1 (Posição Frontal / A) */}
                <div className="relative group">
                  <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-blue-950 text-white rounded-xl p-5 border-4 border-blue-500/80 shadow-2xl relative overflow-hidden transform hover:-translate-y-1 transition-transform">
                    {/* Corrugated effect lines */}
                    <div className="absolute inset-0 opacity-15 flex justify-between pointer-events-none px-2">
                      {Array.from({ length: 18 }).map((_, i) => (
                        <div key={i} className="w-1.5 h-full bg-black/60 border-r border-white/20" />
                      ))}
                    </div>

                    {/* Corner Castings */}
                    <div className="absolute top-1 left-1 w-3 h-3 bg-zinc-300 rounded-sm border border-zinc-600" />
                    <div className="absolute top-1 right-1 w-3 h-3 bg-zinc-300 rounded-sm border border-zinc-600" />
                    <div className="absolute bottom-1 left-1 w-3 h-3 bg-zinc-300 rounded-sm border border-zinc-600" />
                    <div className="absolute bottom-1 right-1 w-3 h-3 bg-zinc-300 rounded-sm border border-zinc-600" />

                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <ContainerIcon size={16} className="text-titam-lime" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-titam-lime">
                            Container 1 (Posição A)
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-black/40 rounded border border-white/10 text-gray-200">
                          20 FT / 40 FT
                        </span>
                      </div>

                      {/* Display or Placeholder of C1 */}
                      <div className="bg-black/50 border border-white/20 rounded-lg p-2.5 text-center">
                        <span className="text-base md:text-xl font-mono font-black tracking-wider text-titam-lime block truncate">
                          {container1 ? container1.toUpperCase() : 'Nº CONTAINER 1'}
                        </span>
                        {produtoContainer1 && (
                          <span className="text-[11px] font-bold text-gray-300 block truncate mt-0.5 uppercase tracking-wide">
                            {produtoContainer1}
                          </span>
                        )}
                      </div>

                      {/* Badge if matched from stock */}
                      {matchedEntry1 && (
                        <div className="bg-emerald-500/20 border border-emerald-400 text-emerald-200 rounded-lg p-2 text-[11px] flex items-start gap-2 shadow-sm">
                          <Sparkles size={14} className="text-titam-lime shrink-0 mt-0.5 animate-pulse" />
                          <div className="flex-1 min-w-0">
                            <span className="font-black text-titam-lime uppercase tracking-wider block">
                              Identificado em Estoque!
                            </span>
                            <p className="text-white text-[10px] truncate">
                              Unidade: <strong>{branches.find(b => b.id === matchedEntry1.branchId)?.name || 'Pátio'}</strong> • Peso: <strong>{(matchedEntry1.saldo_toneladas ?? matchedEntry1.tonelada)} t</strong>{matchedEntry1.nf_numero ? ` • NF: ${matchedEntry1.nf_numero}` : ''}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Direct input inside visual container */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-200 uppercase tracking-widest block">
                          Número do Container 1 *
                        </label>
                        <input
                          type="text"
                          value={container1}
                          onChange={e => handleContainer1Change(e.target.value)}
                          placeholder="EX: TTMU-102938-4"
                          list="stock-containers-list"
                          className="w-full bg-slate-900/90 text-white font-mono font-bold text-sm px-3 py-2 rounded-lg border border-blue-400/60 focus:border-titam-lime focus:ring-2 focus:ring-titam-lime outline-none"
                        />
                      </div>

                      {/* Campo PRODUTO / MATERIAL Container 1 */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-200 uppercase font-bold flex items-center gap-1">
                          <Package size={11} className="text-titam-lime" />
                          Produto / Material (Container 1)
                        </label>
                        <input
                          type="text"
                          value={produtoContainer1}
                          onChange={e => setProdutoContainer1(e.target.value)}
                          placeholder="Ex: Cal Virgem, Fertilizante..."
                          className="w-full bg-slate-900/80 text-white text-xs px-2.5 py-1.5 rounded border border-white/20 outline-none focus:border-titam-lime"
                        />
                      </div>

                      {/* Quick Secondary Fields: NF e Peso */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] text-gray-200 uppercase font-bold flex items-center gap-1">
                            <FileText size={11} className="text-titam-lime" />
                            Nº da NF 1
                          </label>
                          <input
                            type="text"
                            value={nfContainer1}
                            onChange={e => setNfContainer1(e.target.value)}
                            placeholder="Nº NF (Auto)"
                            className="w-full bg-slate-900/80 text-white font-mono text-xs px-2 py-1.5 rounded border border-white/20 outline-none focus:border-titam-lime"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-300 uppercase font-bold flex items-center gap-1">
                            <Scale size={11} className="text-titam-lime" />
                            Peso (Ton)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={pesoContainer1}
                            onChange={e => setPesoContainer1(e.target.value)}
                            placeholder="27.50"
                            className="w-full bg-slate-900/80 text-white font-mono text-xs px-2 py-1.5 rounded border border-white/20 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Twistlock indicator under Container 1 */}
                  <div className="flex justify-between px-6 -mt-1 relative z-20">
                    <div className="w-4 h-3 bg-amber-400 border border-black rounded-sm shadow-md" title="Twistlock Travado" />
                    <div className="w-4 h-3 bg-amber-400 border border-black rounded-sm shadow-md" title="Twistlock Travado" />
                  </div>
                </div>

                {/* CONTAINER 2 (Posição Traseira / B) */}
                <div className="relative group">
                  <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 text-white rounded-xl p-5 border-4 border-emerald-500/80 shadow-2xl relative overflow-hidden transform hover:-translate-y-1 transition-transform">
                    {/* Corrugated effect lines */}
                    <div className="absolute inset-0 opacity-15 flex justify-between pointer-events-none px-2">
                      {Array.from({ length: 18 }).map((_, i) => (
                        <div key={i} className="w-1.5 h-full bg-black/60 border-r border-white/20" />
                      ))}
                    </div>

                    {/* Corner Castings */}
                    <div className="absolute top-1 left-1 w-3 h-3 bg-zinc-300 rounded-sm border border-zinc-600" />
                    <div className="absolute top-1 right-1 w-3 h-3 bg-zinc-300 rounded-sm border border-zinc-600" />
                    <div className="absolute bottom-1 left-1 w-3 h-3 bg-zinc-300 rounded-sm border border-zinc-600" />
                    <div className="absolute bottom-1 right-1 w-3 h-3 bg-zinc-300 rounded-sm border border-zinc-600" />

                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <ContainerIcon size={16} className="text-titam-lime" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-titam-lime">
                            Container 2 (Posição B)
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-black/40 rounded border border-white/10 text-gray-200">
                          20 FT / 40 FT
                        </span>
                      </div>

                      {/* Display or Placeholder of C2 */}
                      <div className="bg-black/50 border border-white/20 rounded-lg p-2.5 text-center">
                        <span className="text-base md:text-xl font-mono font-black tracking-wider text-titam-lime block truncate">
                          {container2 ? container2.toUpperCase() : 'Nº CONTAINER 2'}
                        </span>
                        {produtoContainer2 && (
                          <span className="text-[11px] font-bold text-gray-300 block truncate mt-0.5 uppercase tracking-wide">
                            {produtoContainer2}
                          </span>
                        )}
                      </div>

                      {/* Badge if matched from stock */}
                      {matchedEntry2 && (
                        <div className="bg-emerald-500/20 border border-emerald-400 text-emerald-200 rounded-lg p-2 text-[11px] flex items-start gap-2 shadow-sm">
                          <Sparkles size={14} className="text-titam-lime shrink-0 mt-0.5 animate-pulse" />
                          <div className="flex-1 min-w-0">
                            <span className="font-black text-titam-lime uppercase tracking-wider block">
                              Identificado em Estoque!
                            </span>
                            <p className="text-white text-[10px] truncate">
                              Unidade: <strong>{branches.find(b => b.id === matchedEntry2.branchId)?.name || 'Pátio'}</strong> • Peso: <strong>{(matchedEntry2.saldo_toneladas ?? matchedEntry2.tonelada)} t</strong>{matchedEntry2.nf_numero ? ` • NF: ${matchedEntry2.nf_numero}` : ''}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Direct input inside visual container */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-200 uppercase tracking-widest block">
                          Número do Container 2 *
                        </label>
                        <input
                          type="text"
                          value={container2}
                          onChange={e => handleContainer2Change(e.target.value)}
                          placeholder="EX: TTMU-987654-1"
                          list="stock-containers-list"
                          className="w-full bg-slate-900/90 text-white font-mono font-bold text-sm px-3 py-2 rounded-lg border border-emerald-400/60 focus:border-titam-lime focus:ring-2 focus:ring-titam-lime outline-none"
                        />
                      </div>

                      {/* Campo PRODUTO / MATERIAL Container 2 */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-200 uppercase font-bold flex items-center gap-1">
                          <Package size={11} className="text-titam-lime" />
                          Produto / Material (Container 2)
                        </label>
                        <input
                          type="text"
                          value={produtoContainer2}
                          onChange={e => setProdutoContainer2(e.target.value)}
                          placeholder="Ex: Cal Dolomítica, Carga Geral..."
                          className="w-full bg-slate-900/80 text-white text-xs px-2.5 py-1.5 rounded border border-white/20 outline-none focus:border-titam-lime"
                        />
                      </div>

                      {/* Quick Secondary Fields: NF e Peso */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] text-gray-200 uppercase font-bold flex items-center gap-1">
                            <FileText size={11} className="text-titam-lime" />
                            Nº da NF 2
                          </label>
                          <input
                            type="text"
                            value={nfContainer2}
                            onChange={e => setNfContainer2(e.target.value)}
                            placeholder="Nº NF (Auto)"
                            className="w-full bg-slate-900/80 text-white font-mono text-xs px-2 py-1.5 rounded border border-white/20 outline-none focus:border-titam-lime"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-300 uppercase font-bold flex items-center gap-1">
                            <Scale size={11} className="text-titam-lime" />
                            Peso (Ton)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={pesoContainer2}
                            onChange={e => setPesoContainer2(e.target.value)}
                            placeholder="28.10"
                            className="w-full bg-slate-900/80 text-white font-mono text-xs px-2 py-1.5 rounded border border-white/20 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Twistlock indicator under Container 2 */}
                  <div className="flex justify-between px-6 -mt-1 relative z-20">
                    <div className="w-4 h-3 bg-amber-400 border border-black rounded-sm shadow-md" title="Twistlock Travado" />
                    <div className="w-4 h-3 bg-amber-400 border border-black rounded-sm shadow-md" title="Twistlock Travado" />
                  </div>
                </div>
              </div>

              {/* VAGÃO PLATAFORMA (CHASSI DE AÇO, TRUQUES E RODAS NOS TRILHOS) */}
              <div className="relative z-10 pt-2 pb-6">
                {/* Chassi do Vagão */}
                <div className="bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 border-4 border-zinc-900 rounded-xl p-4 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                  {/* Engate Esquerdo */}
                  <div className="hidden md:flex items-center -ml-7">
                    <div className="w-4 h-6 bg-zinc-900 rounded-l-md border border-zinc-600 shadow-md" />
                    <div className="w-3 h-3 bg-amber-500 rounded-full" />
                  </div>

                  {/* Campo de Número do Vagão em Destaque no Chassi */}
                  <div className="flex-1 w-full flex flex-col md:flex-row items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-zinc-900 text-titam-lime rounded-lg border border-zinc-600">
                        <TrainTrack size={18} />
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] font-black uppercase tracking-widest text-titam-lime block">
                          Chassi da Plataforma Ferroviária
                        </span>
                        <span className="text-xs font-mono text-zinc-300">Vagão Porta-Container</span>
                      </div>
                    </div>

                    <div className="flex-1 w-full relative">
                      <input
                        type="text"
                        value={numeroVagao}
                        onChange={e => setNumeroVagao(e.target.value.toUpperCase())}
                        placeholder="DIGITE O NÚMERO DO VAGÃO (EX: VAG-90234)"
                        required
                        className="w-full bg-zinc-950 text-titam-lime font-mono font-black text-base md:text-lg px-4 py-2.5 rounded-xl border-2 border-titam-lime shadow-inner tracking-wider outline-none focus:ring-4 focus:ring-titam-lime/30 text-center uppercase"
                      />
                    </div>
                  </div>

                  {/* Engate Direito */}
                  <div className="hidden md:flex items-center -mr-7">
                    <div className="w-3 h-3 bg-amber-500 rounded-full" />
                    <div className="w-4 h-6 bg-zinc-900 rounded-r-md border border-zinc-600 shadow-md" />
                  </div>
                </div>

                {/* Truques (Rodas e Rodeiros do Vagão sobre os Trilhos) */}
                <div className="flex justify-between px-10 md:px-16 pt-2">
                  {/* Truque 1 (Frontal) */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border-4 border-zinc-400 shadow-xl flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-zinc-600" />
                    </div>
                    <div className="w-8 h-3 bg-zinc-800 rounded border border-zinc-600 -mx-2 z-10" />
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border-4 border-zinc-400 shadow-xl flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-zinc-600" />
                    </div>
                  </div>

                  {/* Reservatório de Ar Central */}
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-20 h-4 bg-zinc-800 rounded-full border border-zinc-600 shadow-inner" />
                  </div>

                  {/* Truque 2 (Traseiro) */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border-4 border-zinc-400 shadow-xl flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-zinc-600" />
                    </div>
                    <div className="w-8 h-3 bg-zinc-800 rounded border border-zinc-600 -mx-2 z-10" />
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border-4 border-zinc-400 shadow-xl flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-zinc-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Datalist inteligente para autocomplete com os containers em estoque separados por produto */}
          <datalist id="stock-containers-list">
            {stockEntries.map(e => {
              const bName = branches.find(b => b.id === e.branchId)?.name || 'Pátio';
              const pVal = e.saldo_toneladas ?? e.tonelada;
              const prod = (e.descricao_produto || 'GERAL').toUpperCase();
              return (
                <option 
                  key={e.id} 
                  value={e.container}
                >
                  [{prod}] {e.container} • {pVal} t ({bName})
                </option>
              );
            })}
          </datalist>

          {/* CAMPOS COMPLEMENTARES: UNIDADE (FILIAL) E DADOS OPERACIONAIS */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-xs font-black text-titam-deep uppercase tracking-widest flex items-center gap-2">
                <Building2 size={16} className="text-titam-deep" />
                Dados Operacionais do Despacho Ferroviário
              </h4>
              <span className="text-[11px] text-gray-400">
                A Unidade é preenchida automaticamente ao selecionar um container em estoque
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* CAMPO UNIDADE (FILIAL) SOLICITADO */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-titam-deep uppercase tracking-widest flex items-center gap-1.5">
                  <Building2 size={13} className="text-titam-lime" />
                  Unidade (Filial) *
                </label>
                <select
                  value={unidadeId}
                  onChange={e => setUnidadeId(e.target.value)}
                  required
                  className="w-full border-2 border-titam-deep/20 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 bg-white focus:border-titam-deep focus:ring-2 focus:ring-titam-lime outline-none"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* FERROVIA OPERADORA */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Ferrovia Operadora
                </label>
                <select
                  value={ferroviaOperadora}
                  onChange={e => setFerroviaOperadora(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 outline-none"
                >
                  <option value="VLI Logística">VLI Logística</option>
                  <option value="MRS Logística">MRS Logística</option>
                  <option value="Rumo Logística">Rumo Logística</option>
                  <option value="FCA Ferrovia Centro-Atlântica">FCA - Centro-Atlântica</option>
                  <option value="EFVM Estrada de Ferro Vitória a Minas">EFVM - Vale</option>
                </select>
              </div>

              {/* DESTINO */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Destino Ferroviário
                </label>
                <input
                  type="text"
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                  placeholder="Ex: Porto de Tubarão - ES"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none"
                />
              </div>

              {/* Nº DA COMPOSIÇÃO / TREM */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Nº da Composição / Trem
                </label>
                <input
                  type="text"
                  value={numeroComposicao}
                  onChange={e => setNumeroComposicao(e.target.value.toUpperCase())}
                  placeholder="Ex: TREM-K049"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-800 outline-none"
                />
              </div>
            </div>

            {/* DATA, HORA E OBSERVAÇÕES */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Data do Despacho
                </label>
                <input
                  type="date"
                  value={dataDespacho}
                  onChange={e => setDataDespacho(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Horário
                </label>
                <input
                  type="time"
                  value={horaDespacho}
                  onChange={e => setHoraDespacho(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Observações Gerais
                </label>
                <input
                  type="text"
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  placeholder="Ex: Containers inspecionados, twistlocks travados."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 outline-none"
                />
              </div>
            </div>
          </div>

          {/* BOTÃO DE SALVAMENTO COM ALERTA */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setNumeroVagao('');
                setContainer1('');
                setContainer2('');
                setProdutoContainer1('');
                setProdutoContainer2('');
                setPesoContainer1('');
                setPesoContainer2('');
                setMatchedEntry1(null);
                setMatchedEntry2(null);
              }}
              className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-all"
            >
              Limpar Campos
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3.5 bg-gradient-to-r from-titam-deep to-titam-navy hover:from-titam-deep/90 hover:to-titam-navy/90 text-titam-lime font-black text-sm uppercase tracking-wider rounded-xl shadow-xl flex items-center gap-2 transform active:scale-95 transition-all"
            >
              <CheckCircle2 size={18} />
              {isSubmitting ? 'Gravando e Emitindo Alerta...' : 'Salvar & Despachar Vagão'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: HISTÓRICO DE VAGÕES DESPACHADOS */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          {/* Filters Bar com Filtro por Data e Status */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por Vagão, Container, NF, Produto, Unidade ou Destino..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-titam-lime"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none"
                >
                  <option value="all">Todos os Status</option>
                  <option value="Pronto para Partida">Pronto para Partida</option>
                  <option value="Despachado">Despachado</option>
                  <option value="Em Trânsito">Em Trânsito</option>
                  <option value="Entregue">Entregue</option>
                </select>
              </div>
            </div>

            {/* SELEÇÃO E FILTRO POR DATA DO DESPACHO */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Calendar size={14} className="text-titam-deep shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Data do Despacho:
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => applyQuickDateFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterDateQuick === 'all' && !filterDateStart && !filterDateEnd
                        ? 'bg-titam-deep text-titam-lime font-black shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateFilter('today')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterDateQuick === 'today'
                        ? 'bg-titam-deep text-titam-lime font-black shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateFilter('7days')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterDateQuick === '7days'
                        ? 'bg-titam-deep text-titam-lime font-black shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Últimos 7 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateFilter('month')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterDateQuick === 'month'
                        ? 'bg-titam-deep text-titam-lime font-black shadow-2xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Este Mês
                  </button>
                </div>
              </div>

              {/* Seletor Customizado de Período De / Até */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">De:</span>
                  <input
                    type="date"
                    value={filterDateStart}
                    onChange={e => {
                      setFilterDateStart(e.target.value);
                      setFilterDateQuick('all');
                    }}
                    className="bg-transparent text-xs text-gray-800 font-mono outline-none"
                  />
                  <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">Até:</span>
                  <input
                    type="date"
                    value={filterDateEnd}
                    onChange={e => {
                      setFilterDateEnd(e.target.value);
                      setFilterDateQuick('all');
                    }}
                    className="bg-transparent text-xs text-gray-800 font-mono outline-none"
                  />
                </div>

                {(filterDateStart || filterDateEnd) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDateStart('');
                      setFilterDateEnd('');
                      setFilterDateQuick('all');
                    }}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Limpar filtro de data"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Grid de Cards Visuais dos Vagões Despachados */}
          {filteredDispatches.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <TrainTrack className="mx-auto text-gray-300" size={48} />
              <p className="text-sm font-bold text-gray-500">Nenhum vagão despachado registrado.</p>
              <button
                onClick={() => setActiveTab('novo')}
                className="px-4 py-2 bg-titam-lime text-titam-deep font-bold rounded-xl text-xs uppercase"
              >
                Criar Primeiro Despacho
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredDispatches.map(dispatch => (
                <div
                  key={dispatch.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 hover:border-titam-deep/40 transition-all group"
                >
                  {/* Header do Card */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-titam-deep text-titam-lime rounded-xl">
                        <TrainTrack size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                            Vagão Ferroviário
                          </span>
                          {dispatch.unidade_nome && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[9px] font-bold rounded-full">
                              {dispatch.unidade_nome}
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-black text-titam-deep font-mono tracking-wider">
                          {dispatch.numero_vagao}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={dispatch.status}
                        onChange={e => onUpdateDispatchStatus(dispatch.id, e.target.value as any)}
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border outline-none cursor-pointer ${
                          dispatch.status === 'Pronto para Partida' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          dispatch.status === 'Despachado' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          dispatch.status === 'Em Trânsito' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <option value="Pronto para Partida">Pronto para Partida</option>
                        <option value="Despachado">Despachado</option>
                        <option value="Em Trânsito">Em Trânsito</option>
                        <option value="Entregue">Entregue</option>
                      </select>
                    </div>
                  </div>

                  {/* Miniatura dos 2 Containers com seus Produtos e Pesos */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-900 p-3 rounded-xl">
                    {/* Container 1 Mini */}
                    <div className="bg-blue-800/90 text-white p-2.5 rounded-lg border border-blue-500/50 space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-bold text-titam-lime uppercase">
                        <span>Container 1 (A)</span>
                        <ContainerIcon size={12} />
                      </div>
                      <span className="text-xs font-mono font-black block truncate">
                        {dispatch.container_1 || 'NÃO CARREGADO'}
                      </span>
                      {dispatch.produto_container_1 && (
                        <span className="text-[10px] text-gray-200 block truncate font-medium">
                          {dispatch.produto_container_1}
                        </span>
                      )}
                      <div className="flex justify-between items-center text-[9px] text-gray-300 pt-0.5">
                        {dispatch.nf_container_1 ? (
                          <span className="text-gray-200 font-mono">NF: {dispatch.nf_container_1}</span>
                        ) : (
                          dispatch.lacre_1 && <span>Lacre: {dispatch.lacre_1}</span>
                        )}
                        {dispatch.peso_container_1 && (
                          <span className="text-titam-lime font-bold">
                            {dispatch.peso_container_1} t
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Container 2 Mini */}
                    <div className="bg-emerald-800/90 text-white p-2.5 rounded-lg border border-emerald-500/50 space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-bold text-titam-lime uppercase">
                        <span>Container 2 (B)</span>
                        <ContainerIcon size={12} />
                      </div>
                      <span className="text-xs font-mono font-black block truncate">
                        {dispatch.container_2 || 'NÃO CARREGADO'}
                      </span>
                      {dispatch.produto_container_2 && (
                        <span className="text-[10px] text-gray-200 block truncate font-medium">
                          {dispatch.produto_container_2}
                        </span>
                      )}
                      <div className="flex justify-between items-center text-[9px] text-gray-300 pt-0.5">
                        {dispatch.nf_container_2 ? (
                          <span className="text-gray-200 font-mono">NF: {dispatch.nf_container_2}</span>
                        ) : (
                          dispatch.lacre_2 && <span>Lacre: {dispatch.lacre_2}</span>
                        )}
                        {dispatch.peso_container_2 && (
                          <span className="text-titam-lime font-bold">
                            {dispatch.peso_container_2} t
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detalhes de Destino, Data e Operação */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block uppercase">Destino:</span>
                      <span className="font-bold text-gray-800">{dispatch.destino || 'Não especificado'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block uppercase">Operadora / Trem:</span>
                      <span className="font-bold text-gray-800">
                        {dispatch.ferrovia_operadora || 'VLI'} {dispatch.numero_composicao ? `• ${dispatch.numero_composicao}` : ''}
                      </span>
                    </div>
                  </div>

                  {dispatch.observacoes && (
                    <p className="text-[11px] text-gray-500 italic bg-gray-50 p-2 rounded-lg">
                      Obs: {dispatch.observacoes}
                    </p>
                  )}

                  {/* Footer com Data e Ações */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar size={12} /> {dispatch.data_despacho} {dispatch.hora_despacho ? `às ${dispatch.hora_despacho}` : ''}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTicketDispatch(dispatch)}
                        className="px-2.5 py-1 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold flex items-center gap-1 transition-colors"
                      >
                        <Printer size={13} />
                        Ticket
                      </button>

                      {isAdmin && (
                        <button
                          onClick={async () => {
                            if (confirm(`Deseja remover o despacho do vagão ${dispatch.numero_vagao}?`)) {
                              await onDeleteDispatch(dispatch.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Excluir Despacho"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE SELEÇÃO RÁPIDA DE CONTAINERS EM ESTOQUE SEPARADOS POR PRODUTO */}
      {/* ========================================================================= */}
      {showStockContainersPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-5 sm:p-6 space-y-4 border border-gray-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-titam-deep text-titam-lime rounded-2xl shadow-md">
                  <Package size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-base text-titam-deep uppercase tracking-tight">
                      Containers em Estoque ({stockEntries.length})
                    </h4>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                      Separados por Produto
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Selecione por tipo de produto para alocar diretamente no Container 1 ou Container 2
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowStockContainersPicker(false)} 
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Busca Rápida e Filtros de Tipo de Produto */}
            <div className="space-y-3">
              {/* Barra de Busca */}
              <div className="relative">
                <Search className="absolute left-3.5 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Filtrar por número do container, NF ou filial..."
                  value={modalSearchTerm}
                  onChange={e => setModalSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-titam-lime focus:bg-white transition-all font-medium"
                />
                {modalSearchTerm && (
                  <button 
                    onClick={() => setModalSearchTerm('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer font-bold"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Abas / Filtros por Tipo de Produto */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setModalProductFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    modalProductFilter === 'all'
                      ? 'bg-titam-deep text-titam-lime shadow-md font-black'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Boxes size={14} />
                  Todos os Produtos ({stockEntries.length})
                </button>

                {productTypesList.map(prodKey => {
                  const group = stockEntriesByProduct[prodKey];
                  const isSelected = modalProductFilter === prodKey;
                  return (
                    <button
                      key={prodKey}
                      type="button"
                      onClick={() => setModalProductFilter(prodKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-titam-deep text-titam-lime shadow-md font-black ring-2 ring-titam-lime/50'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-titam-lime' : 'bg-gray-400'}`} />
                      <span>{group.displayName}</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                        isSelected ? 'bg-white/20 text-titam-lime' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {group.entries.length} • {group.totalTons.toFixed(1)} t
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conteúdo Separado por Tipo de Produto */}
            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {productTypesList.length === 0 ? (
                <div className="text-center py-12 text-gray-400 space-y-2">
                  <Package className="mx-auto text-gray-300" size={40} />
                  <p className="text-xs font-bold">Nenhum container com status "Estoque" no terminal.</p>
                </div>
              ) : (
                productTypesList
                  .filter(prodKey => modalProductFilter === 'all' || modalProductFilter === prodKey)
                  .map(prodKey => {
                    const group = stockEntriesByProduct[prodKey];
                    // Filter entries by modalSearchTerm if present
                    const visibleEntries = group.entries.filter(e => {
                      if (!modalSearchTerm) return true;
                      const term = modalSearchTerm.toLowerCase();
                      const bName = (branches.find(b => b.id === e.branchId)?.name || '').toLowerCase();
                      return (
                        e.container.toLowerCase().includes(term) ||
                        (e.nf_numero || '').toLowerCase().includes(term) ||
                        bName.includes(term)
                      );
                    });

                    if (visibleEntries.length === 0 && modalSearchTerm) {
                      return null;
                    }

                    return (
                      <div 
                        key={prodKey} 
                        className="bg-white border-2 border-gray-200/90 rounded-2xl overflow-hidden shadow-xs hover:border-gray-300 transition-all"
                      >
                        {/* Header da Categoria do Produto */}
                        <div className="bg-gradient-to-r from-titam-deep via-titam-navy to-titam-deep px-4 py-2.5 text-white flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-1 bg-titam-lime text-titam-deep rounded-md">
                              <Package size={14} />
                            </span>
                            <h5 className="font-black text-sm uppercase tracking-wide text-white">
                              {group.displayName}
                            </h5>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2.5 py-0.5 bg-white/10 rounded-full font-mono text-[11px] text-gray-200 border border-white/10">
                              {visibleEntries.length} {visibleEntries.length === 1 ? 'container' : 'containers'}
                            </span>
                            <span className="px-2.5 py-0.5 bg-titam-lime text-titam-deep rounded-full font-black text-[11px]">
                              {group.totalTons.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} TONELADAS
                            </span>
                          </div>
                        </div>

                        {/* Lista de Containers pertencentes a este Produto */}
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-slate-50/50">
                          {visibleEntries.map(entry => {
                            const bName = branches.find(b => b.id === entry.branchId)?.name || 'Pátio Central';
                            const peso = (entry.saldo_toneladas ?? entry.tonelada) || 0;
                            return (
                              <div
                                key={entry.id}
                                className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col justify-between gap-2 shadow-2xs hover:shadow-sm hover:border-titam-deep/50 transition-all group"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono font-black text-base text-titam-deep tracking-wider">
                                      {entry.container}
                                    </span>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md uppercase">
                                      {peso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                                    <span className="inline-flex items-center gap-1 font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                      <Building2 size={11} className="text-gray-500" />
                                      {bName}
                                    </span>
                                    {entry.nf_numero && (
                                      <span className="bg-blue-50 text-blue-700 font-mono px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        NF: {entry.nf_numero}
                                      </span>
                                    )}
                                    {entry.fornecedor && (
                                      <span className="truncate max-w-[140px] text-gray-400">
                                        {entry.fornecedor}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Botões de Ação para Alocar no Vagão */}
                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                                  <button
                                    type="button"
                                    onClick={() => handlePickStockContainer(entry, 1)}
                                    className="w-full py-1.5 px-2 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                  >
                                    <ContainerIcon size={12} className="text-titam-lime" />
                                    No Container 1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePickStockContainer(entry, 2)}
                                    className="w-full py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                                  >
                                    <ContainerIcon size={12} className="text-titam-lime" />
                                    No Container 2
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer do Modal */}
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Mostrando <strong>{productTypesList.length}</strong> tipos de produtos com containers disponíveis
              </span>
              <button
                type="button"
                onClick={() => setShowStockContainersPicker(false)}
                className="px-5 py-2 bg-titam-deep text-white hover:bg-titam-navy rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
              >
                Concluir Seleção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ALERTA DE ALTO IMPACTO NA TELA QUANDO O FORMULÁRIO É PREENCHIDO E SALVO */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {dispatchAlert?.show && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border-4 border-titam-lime"
            >
              {/* Alerta Header com Animação */}
              <div className="bg-gradient-to-r from-titam-deep via-titam-navy to-titam-deep text-white p-6 text-center relative overflow-hidden">
                <div className="inline-flex p-3 bg-titam-lime text-titam-deep rounded-2xl mb-3 shadow-lg animate-bounce">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-titam-lime">
                  Alerta Operacional do Sistema!
                </h3>
                <p className="text-xs text-gray-200 mt-1 uppercase tracking-widest font-bold">
                  Despacho Ferroviário Registrado com Sucesso
                </p>
              </div>

              {/* Corpo do Alerta com os Dados do Vagão, Unidade, Containers e Produtos */}
              <div className="p-6 space-y-5">
                <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-4 border border-slate-700 shadow-inner">
                  {/* Vagão & Unidade */}
                  <div className="text-center border-b border-white/10 pb-3">
                    <span className="text-[10px] font-black text-titam-lime uppercase tracking-widest block">
                      Unidade Operacional: {dispatchAlert.unidade}
                    </span>
                    <span className="text-2xl font-mono font-black text-white tracking-widest block mt-0.5">
                      VAGÃO: {dispatchAlert.vagao}
                    </span>
                  </div>

                  {/* Os 2 Containers */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-900/60 p-3 rounded-xl border border-blue-400/40 text-center">
                      <span className="text-[9px] uppercase font-bold text-blue-200 block">Container 1</span>
                      <span className="text-sm font-mono font-bold text-white block truncate">
                        {dispatchAlert.c1 || 'Vazio'}
                      </span>
                      <span className="text-[10px] text-gray-300 block truncate mt-0.5">
                        {dispatchAlert.produto1}
                      </span>
                      {dispatchAlert.nf1 && (
                        <span className="text-[10px] font-mono text-titam-lime font-bold block mt-0.5">
                          NF: {dispatchAlert.nf1}
                        </span>
                      )}
                    </div>

                    <div className="bg-emerald-900/60 p-3 rounded-xl border border-emerald-400/40 text-center">
                      <span className="text-[9px] uppercase font-bold text-emerald-200 block">Container 2</span>
                      <span className="text-sm font-mono font-bold text-white block truncate">
                        {dispatchAlert.c2 || 'Vazio'}
                      </span>
                      <span className="text-[10px] text-gray-300 block truncate mt-0.5">
                        {dispatchAlert.produto2}
                      </span>
                      {dispatchAlert.nf2 && (
                        <span className="text-[10px] font-mono text-titam-lime font-bold block mt-0.5">
                          NF: {dispatchAlert.nf2}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-300 pt-1">
                    <span>Destino: <strong className="text-white">{dispatchAlert.destino}</strong></span>
                    <span className="font-mono text-titam-lime">{dispatchAlert.data} • {dispatchAlert.hora}</span>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center gap-3">
                  <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-800 font-medium">
                    O vagão foi integrado à composição ferroviária com dados sincronizados do estoque de pátio!
                  </p>
                </div>

                {/* Ações do Alerta */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setDispatchAlert(null);
                      setActiveTab('historico');
                    }}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Ver no Histórico
                  </button>

                  <button
                    onClick={() => setDispatchAlert(null)}
                    className="flex-1 py-3 bg-titam-deep hover:bg-titam-deep/90 text-titam-lime rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-lg"
                  >
                    Entendido / Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL DE IMPRESSÃO / TICKET INDIVIDUAL DO VAGÃO */}
      {/* ========================================================================= */}
      {selectedTicketDispatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-gray-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-black text-sm text-titam-deep uppercase tracking-wider flex items-center gap-2">
                <Printer size={16} />
                Comprovante de Despacho Ferroviário
              </h4>
              <button onClick={() => setSelectedTicketDispatch(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="border border-dashed border-gray-300 p-4 rounded-xl space-y-3 font-mono text-xs bg-gray-50">
              <div className="text-center border-b pb-2">
                <h5 className="font-black text-sm uppercase">TITAM INTERMODAIS INTELIGENTES</h5>
                <p className="text-[10px] text-gray-500">TERMINAL FERROVIÁRIO DE CARGAS</p>
                {selectedTicketDispatch.unidade_nome && (
                  <p className="text-[10px] font-bold text-gray-800 uppercase mt-0.5">
                    UNIDADE: {selectedTicketDispatch.unidade_nome}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span>VAGÃO:</span>
                  <span className="font-bold text-gray-900">{selectedTicketDispatch.numero_vagao}</span>
                </div>
                <div className="border-t border-gray-200 my-1 pt-1">
                  <div className="flex justify-between">
                    <span>CONTAINER 1:</span>
                    <span className="font-bold text-gray-900">{selectedTicketDispatch.container_1 || '--'}</span>
                  </div>
                  {selectedTicketDispatch.produto_container_1 && (
                    <div className="flex justify-between text-[11px] text-gray-600">
                      <span>PRODUTO 1:</span>
                      <span className="font-bold">{selectedTicketDispatch.produto_container_1}</span>
                    </div>
                  )}
                  {selectedTicketDispatch.nf_container_1 && (
                    <div className="flex justify-between text-[11px] text-gray-600">
                      <span>NF 1:</span>
                      <span className="font-bold text-gray-900">{selectedTicketDispatch.nf_container_1}</span>
                    </div>
                  )}
                  {selectedTicketDispatch.peso_container_1 && (
                    <div className="flex justify-between text-[11px] text-gray-600">
                      <span>PESO 1:</span>
                      <span>{selectedTicketDispatch.peso_container_1} t</span>
                    </div>
                  )}
                  {selectedTicketDispatch.lacre_1 && (
                    <div className="flex justify-between text-[11px] text-gray-600">
                      <span>LACRE 1:</span>
                      <span>{selectedTicketDispatch.lacre_1}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 my-1 pt-1">
                  <div className="flex justify-between">
                    <span>CONTAINER 2:</span>
                    <span className="font-bold text-gray-900">{selectedTicketDispatch.container_2 || '--'}</span>
                  </div>
                  {selectedTicketDispatch.produto_container_2 && (
                    <div className="flex justify-between text-[11px] text-gray-600">
                      <span>PRODUTO 2:</span>
                      <span className="font-bold">{selectedTicketDispatch.produto_container_2}</span>
                    </div>
                  )}
                  {selectedTicketDispatch.nf_container_2 && (
                    <div className="flex justify-between text-[11px] text-gray-600">
                      <span>NF 2:</span>
                      <span className="font-bold text-gray-900">{selectedTicketDispatch.nf_container_2}</span>
                    </div>
                  )}
                  {selectedTicketDispatch.peso_container_2 && (
                    <div className="flex justify-between text-[11px] text-gray-600">
                      <span>PESO 2:</span>
                      <span>{selectedTicketDispatch.peso_container_2} t</span>
                    </div>
                  )}
                  {selectedTicketDispatch.lacre_2 && (
                    <div className="flex justify-between text-[11px] text-gray-600">
                      <span>LACRE 2:</span>
                      <span>{selectedTicketDispatch.lacre_2}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 my-1 pt-1 space-y-1">
                  <div className="flex justify-between">
                    <span>DESTINO:</span>
                    <span className="font-bold text-gray-900">{selectedTicketDispatch.destino}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATA / HORA:</span>
                    <span>{selectedTicketDispatch.data_despacho} {selectedTicketDispatch.hora_despacho}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>OPERADORA:</span>
                    <span>{selectedTicketDispatch.ferrovia_operadora || 'VLI'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>STATUS:</span>
                    <span className="font-bold">{selectedTicketDispatch.status}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedTicketDispatch(null)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-600"
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-titam-deep text-titam-lime rounded-xl text-xs font-black uppercase flex items-center gap-1.5"
              >
                <Printer size={15} />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

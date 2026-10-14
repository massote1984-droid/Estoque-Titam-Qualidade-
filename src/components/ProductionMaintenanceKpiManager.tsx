import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gauge,
  Wrench,
  TrendingUp,
  BarChart3,
  Calendar,
  Clock,
  Plus,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Search,
  Truck,
  Edit2,
  Trash2,
  X,
  Layers,
  ChevronRight,
  Info,
  DollarSign,
  Cpu,
  Boxes,
  Activity,
  Flame,
  Building2,
  Check,
  Radio,
  Zap,
  Play,
  Pause,
  AlertOctagon,
  UserCheck,
  MapPin,
  Sliders,
  Sparkles
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import {
  ProductionKpiEntry,
  MaintenanceKpiEntry,
  EquipmentMaster,
  Branch,
  ShiftType,
  OperationalAlert
} from '../types';
import { OperationalAlertsCenter } from './OperationalAlertsCenter';
import { playOperationalSound } from '../utils/soundAlert';

interface ProductionMaintenanceKpiManagerProps {
  productionKpis: ProductionKpiEntry[];
  maintenanceKpis: MaintenanceKpiEntry[];
  equipments: EquipmentMaster[];
  branches: Branch[];
  selectedBranchId: string;
  isAdmin: boolean;
  userEmail: string;
  initialTab?: 'ontime' | 'dashboard' | 'producao' | 'manutencao' | 'equipamentos' | 'guia';
  onTabChange?: (tab: 'ontime' | 'dashboard' | 'producao' | 'manutencao' | 'equipamentos' | 'guia') => void;
  operationalAlerts?: OperationalAlert[];
  onTriggerOperationalAlert?: (alert: Omit<OperationalAlert, 'id' | 'timestamp'>) => void;
  onMarkAlertAsRead?: (alertId: string) => void;
  onMarkAllAlertsAsRead?: () => void;
  onAddProductionKpi: (entry: Omit<ProductionKpiEntry, 'id' | 'created_at'>) => void;
  onUpdateProductionKpi: (id: string, updates: Partial<ProductionKpiEntry>) => void;
  onDeleteProductionKpi: (id: string) => void;
  onAddMaintenanceKpi: (entry: Omit<MaintenanceKpiEntry, 'id' | 'created_at'>) => void;
  onUpdateMaintenanceKpi: (id: string, updates: Partial<MaintenanceKpiEntry>) => void;
  onDeleteMaintenanceKpi: (id: string) => void;
  onAddEquipment: (equipment: Omit<EquipmentMaster, 'id'>) => void;
  onUpdateEquipment: (id: string, updates: Partial<EquipmentMaster>) => void;
  onDeleteEquipment: (id: string) => void;
  onResetSeedExamples: () => void;
}

// Helper para comparação flexível de filiais (reconhece sinônimos como vr, vrd, volta-redonda, titam, serra)
function matchesBranch(recordBranchId?: string | null, targetBranchId?: string): boolean {
  if (!targetBranchId || targetBranchId === 'all') return true;
  if (!recordBranchId || !recordBranchId.trim() || recordBranchId === 'all') return true;

  const target = targetBranchId.toLowerCase().trim();
  const rec = recordBranchId.toLowerCase().trim();
  if (rec === target) return true;

  // Sinônimos de Volta Redonda
  const isTargetVR = target.includes('volta') || target.includes('vr') || target.includes('vrd') || target.includes('rj');
  const isRecVR = rec.includes('volta') || rec.includes('vr') || rec.includes('vrd') || rec.includes('rj');
  if (isTargetVR && isRecVR) return true;

  // Sinônimos de Titam / Serra - ES
  const isTargetTitam = target.includes('titam') || target.includes('serra') || target.includes('es');
  const isRecTitam = rec.includes('titam') || rec.includes('serra') || rec.includes('es');
  if (isTargetTitam && isRecTitam) return true;

  return false;
}

export const ProductionMaintenanceKpiManager: React.FC<ProductionMaintenanceKpiManagerProps> = ({
  productionKpis,
  maintenanceKpis,
  equipments,
  branches,
  selectedBranchId,
  isAdmin,
  userEmail,
  initialTab,
  onTabChange,
  operationalAlerts = [],
  onTriggerOperationalAlert,
  onMarkAlertAsRead = () => {},
  onMarkAllAlertsAsRead = () => {},
  onAddProductionKpi,
  onUpdateProductionKpi,
  onDeleteProductionKpi,
  onAddMaintenanceKpi,
  onUpdateMaintenanceKpi,
  onDeleteMaintenanceKpi,
  onAddEquipment,
  onUpdateEquipment,
  onDeleteEquipment,
  onResetSeedExamples
}) => {
  // Navigation tabs within KPI module (ontime é o primeiro para dar visibilidade em tempo real)
  const [activeKpiTab, setActiveKpiTab] = useState<'ontime' | 'dashboard' | 'producao' | 'manutencao' | 'equipamentos' | 'guia'>(initialTab || 'ontime');

  React.useEffect(() => {
    if (initialTab && initialTab !== activeKpiTab) {
      setActiveKpiTab(initialTab);
    }
  }, [initialTab]);

  const handleSelectKpiTab = (tab: 'ontime' | 'dashboard' | 'producao' | 'manutencao' | 'equipamentos' | 'guia') => {
    setActiveKpiTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'7d' | '30d' | 'mes_atual' | 'todos'>('todos');
  const [shiftFilter, setShiftFilter] = useState<string>('todos');
  const [sectorFilter, setSectorFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // On-Time Equipment View Filters
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState<string>('todos');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState<string>('todos');
  const [equipmentViewMode, setEquipmentViewMode] = useState<'cards' | 'table'>('cards');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [editingProduction, setEditingProduction] = useState<ProductionKpiEntry | null>(null);

  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceKpiEntry | null>(null);

  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentMaster | null>(null);

  // Modal para ajuste rápido de horímetro
  const [quickHorimeterEquipment, setQuickHorimeterEquipment] = useState<EquipmentMaster | null>(null);
  const [quickHorimeterValue, setQuickHorimeterValue] = useState<number>(0);

  // Helper para Filial Ativa Padrão
  const defaultBranchId = useMemo(() => {
    if (selectedBranchId && selectedBranchId !== 'all') return selectedBranchId;
    return branches[0]?.id || 'volta-redonda';
  }, [selectedBranchId, branches]);

  // Production Form State
  const [prodForm, setProdForm] = useState<{
    data: string;
    turno: ShiftType;
    setor: string;
    equipamento_id: string;
    meta_producao: number;
    producao_realizada: number;
    unidade_medida: 'Toneladas' | 'Movimentações/Viagens' | 'Containers' | 'Vagões';
    horas_programadas: number;
    horas_operacionais_efetivas: number;
    horas_parada_operacional: number;
    horas_parada_manutencao: number;
    motivo_parada_principal: string;
    observacoes: string;
    responsavel: string;
    branchId: string;
  }>({
    data: new Date().toISOString().split('T')[0],
    turno: '1º Turno' as ShiftType,
    setor: 'Pátio de Bobinas',
    equipamento_id: '',
    meta_producao: 1200,
    producao_realizada: 1150,
    unidade_medida: 'Toneladas',
    horas_programadas: 8,
    horas_operacionais_efetivas: 7.2,
    horas_parada_operacional: 0.3,
    horas_parada_manutencao: 0.5,
    motivo_parada_principal: '',
    observacoes: '',
    responsavel: userEmail?.split('@')[0] || 'Operador Líder',
    branchId: defaultBranchId
  });

  // Maintenance Form State
  const [maintForm, setMaintForm] = useState<{
    data: string;
    turno: ShiftType;
    equipamento_id: string;
    tipo_manutencao: MaintenanceKpiEntry['tipo_manutencao'];
    sistema_afetado: MaintenanceKpiEntry['sistema_afetado'];
    horas_parada: number;
    quantidade_falhas: number;
    custo_estimado: number;
    tecnico_responsavel: string;
    ordem_servico: string;
    descricao_problema: string;
    acao_realizada: string;
    status: MaintenanceKpiEntry['status'];
    branchId: string;
  }>({
    data: new Date().toISOString().split('T')[0],
    turno: '1º Turno' as ShiftType,
    equipamento_id: '',
    tipo_manutencao: 'Corretiva',
    sistema_afetado: 'Mecânica',
    horas_parada: 1.5,
    quantidade_falhas: 1,
    custo_estimado: 450,
    tecnico_responsavel: 'Equipe Técnica Titam',
    ordem_servico: `OS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    descricao_problema: '',
    acao_realizada: '',
    status: 'Concluída',
    branchId: defaultBranchId
  });

  // Equipment Form State
  const [equipForm, setEquipForm] = useState<{
    tag: string;
    nome: string;
    modelo: string;
    tipo: EquipmentMaster['tipo'];
    status: EquipmentMaster['status'];
    capacidade: string;
    horimetro_atual: number;
    ultima_revisao: string;
    proxima_revisao: string;
    branchId: string;
    localizacao_atual?: string;
    operador_atual?: string;
  }>({
    tag: '',
    nome: '',
    modelo: '',
    tipo: 'Empilhadeira Frontal',
    status: 'Operando',
    capacidade: '16t',
    horimetro_atual: 1250,
    ultima_revisao: new Date().toISOString().split('T')[0],
    proxima_revisao: '',
    branchId: defaultBranchId,
    localizacao_atual: 'Pátio de Bobinas',
    operador_atual: ''
  });

  // Auto-clear feedback notification
  React.useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // Funções para abrir formulários com dados limpos e branch correta
  const handleOpenNewProduction = () => {
    setEditingProduction(null);
    setProdForm({
      data: new Date().toISOString().split('T')[0],
      turno: '1º Turno' as ShiftType,
      setor: 'Pátio de Bobinas',
      equipamento_id: equipments[0]?.id || '',
      meta_producao: 1200,
      producao_realizada: 1150,
      unidade_medida: 'Toneladas',
      horas_programadas: 8,
      horas_operacionais_efetivas: 7.2,
      horas_parada_operacional: 0.3,
      horas_parada_manutencao: 0.5,
      motivo_parada_principal: '',
      observacoes: '',
      responsavel: userEmail?.split('@')[0] || 'Operador Líder',
      branchId: defaultBranchId
    });
    setIsProductionModalOpen(true);
  };

  const handleOpenNewMaintenance = (defaultEquipmentId?: string) => {
    setEditingMaintenance(null);
    const targetEq = equipments.find(e => e.id === defaultEquipmentId) || equipments[0];
    setMaintForm({
      data: new Date().toISOString().split('T')[0],
      turno: '1º Turno' as ShiftType,
      equipamento_id: targetEq?.id || '',
      tipo_manutencao: 'Corretiva',
      sistema_afetado: 'Mecânica',
      horas_parada: 1.5,
      quantidade_falhas: 1,
      custo_estimado: 450,
      tecnico_responsavel: 'Equipe Técnica Titam',
      ordem_servico: `OS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      descricao_problema: targetEq?.motivo_parada || '',
      acao_realizada: '',
      status: 'Em Andamento',
      branchId: defaultBranchId
    });
    setIsMaintenanceModalOpen(true);
  };

  const handleOpenNewEquipment = () => {
    setEditingEquipment(null);
    setEquipForm({
      tag: `EQ-0${equipments.length + 1}`,
      nome: '',
      modelo: '',
      tipo: 'Empilhadeira Frontal',
      status: 'Operando',
      capacidade: '16t',
      horimetro_atual: 100,
      ultima_revisao: new Date().toISOString().split('T')[0],
      proxima_revisao: '',
      branchId: defaultBranchId,
      localizacao_atual: 'Pátio Operacional',
      operador_atual: ''
    });
    setIsEquipmentModalOpen(true);
  };

  // Filtragem flexível de apontamentos de produção
  const branchFilteredProduction = useMemo(() => {
    return productionKpis.filter(e => {
      if (!matchesBranch(e.branchId, selectedBranchId)) return false;
      if (shiftFilter !== 'todos' && e.turno !== shiftFilter) return false;
      if (sectorFilter !== 'todos' && e.setor !== sectorFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchSector = e.setor?.toLowerCase().includes(term);
        const matchEquip = e.equipamento_nome?.toLowerCase().includes(term);
        const matchResp = e.responsavel?.toLowerCase().includes(term);
        if (!matchSector && !matchEquip && !matchResp) return false;
      }
      return true;
    });
  }, [productionKpis, selectedBranchId, shiftFilter, sectorFilter, searchTerm]);

  // Filtragem flexível de ordens de manutenção
  const branchFilteredMaintenance = useMemo(() => {
    return maintenanceKpis.filter(e => {
      if (!matchesBranch(e.branchId, selectedBranchId)) return false;
      if (shiftFilter !== 'todos' && e.turno !== shiftFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchEquip = e.equipamento_nome?.toLowerCase().includes(term);
        const matchOS = e.ordem_servico?.toLowerCase().includes(term);
        const matchDesc = e.descricao_problema?.toLowerCase().includes(term);
        const matchTec = e.tecnico_responsavel?.toLowerCase().includes(term);
        if (!matchEquip && !matchOS && !matchDesc && !matchTec) return false;
      }
      return true;
    });
  }, [maintenanceKpis, selectedBranchId, shiftFilter, searchTerm]);

  // Filtragem flexível de equipamentos da frota
  const branchFilteredEquipments = useMemo(() => {
    return equipments.filter(e => {
      if (!matchesBranch(e.branchId, selectedBranchId)) return false;
      return true;
    });
  }, [equipments, selectedBranchId]);

  // Equipamentos filtrados na Visão On-Time
  const onTimeEquipments = useMemo(() => {
    return branchFilteredEquipments.filter(e => {
      if (equipmentStatusFilter !== 'todos' && e.status !== equipmentStatusFilter) return false;
      if (equipmentTypeFilter !== 'todos' && e.tipo !== equipmentTypeFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTag = e.tag?.toLowerCase().includes(term);
        const matchNome = e.nome?.toLowerCase().includes(term);
        const matchMod = e.modelo?.toLowerCase().includes(term);
        const matchOp = e.operador_atual?.toLowerCase().includes(term);
        const matchLoc = e.localizacao_atual?.toLowerCase().includes(term);
        if (!matchTag && !matchNome && !matchMod && !matchOp && !matchLoc) return false;
      }
      return true;
    });
  }, [branchFilteredEquipments, equipmentStatusFilter, equipmentTypeFilter, searchTerm]);

  // Estatísticas On-Time da Frota
  const fleetStats = useMemo(() => {
    const total = branchFilteredEquipments.length;
    const operando = branchFilteredEquipments.filter(e => e.status === 'Operando').length;
    const corretiva = branchFilteredEquipments.filter(e => e.status === 'Manutenção Corretiva').length;
    const preventiva = branchFilteredEquipments.filter(e => e.status === 'Manutenção Preventiva').length;
    const standby = branchFilteredEquipments.filter(e => e.status === 'Stand-by').length;
    const aguardando = branchFilteredEquipments.filter(e => e.status === 'Aguardando Peça').length;
    
    const taxaDisponibilidade = total > 0 ? (((operando + standby) / total) * 100).toFixed(1) : '100.0';

    return {
      total,
      operando,
      corretiva,
      preventiva,
      standby,
      aguardando,
      taxaDisponibilidade
    };
  }, [branchFilteredEquipments]);

  // Métricas Calculadas Gerais
  const metrics = useMemo(() => {
    const totalProdRealizada = branchFilteredProduction.reduce((acc, curr) => acc + (curr.producao_realizada || 0), 0);
    const totalProdMeta = branchFilteredProduction.reduce((acc, curr) => acc + (curr.meta_producao || 0), 0);
    const atingimentoMeta = totalProdMeta > 0 ? (totalProdRealizada / totalProdMeta) * 100 : 100;

    const totalHorasOperacionais = branchFilteredProduction.reduce((acc, curr) => acc + (curr.horas_operacionais_efetivas || 0), 0);
    const totalHorasParadaOperacional = branchFilteredProduction.reduce((acc, curr) => acc + (curr.horas_parada_operacional || 0), 0);
    const totalHorasParadaMnt = branchFilteredMaintenance.reduce((acc, curr) => acc + (curr.horas_parada || 0), 0);
    const totalHorasProgramadas = branchFilteredProduction.reduce((acc, curr) => acc + (curr.horas_programadas || 0), 0) || (totalHorasOperacionais + totalHorasParadaOperacional + totalHorasParadaMnt);

    const disponibilidadeFisica = totalHorasProgramadas > 0 
      ? Math.max(0, Math.min(100, ((totalHorasProgramadas - totalHorasParadaMnt) / totalHorasProgramadas) * 100))
      : 100;

    const produtividadeMedia = totalHorasOperacionais > 0 ? totalProdRealizada / totalHorasOperacionais : 0;

    const totalFalhas = branchFilteredMaintenance.filter(m => m.tipo_manutencao === 'Corretiva').length;
    const mtbf = totalFalhas > 0 ? totalHorasOperacionais / totalFalhas : totalHorasOperacionais;
    const mttr = totalFalhas > 0 ? totalHorasParadaMnt / totalFalhas : totalHorasParadaMnt;

    const totalCustoMnt = branchFilteredMaintenance.reduce((acc, curr) => acc + (curr.custo_estimado || 0), 0);

    const taxaConfiabilidade = totalFalhas > 0 
      ? Math.max(0, Math.min(100, 100 - (totalFalhas * 2.5)))
      : 100;

    const oeeAprox = Math.min(100, (disponibilidadeFisica * (atingimentoMeta / 100) * 0.98));

    return {
      totalProdRealizada,
      totalProdMeta,
      atingimentoMeta,
      totalHorasOperacionais,
      totalHorasParadaMnt,
      disponibilidadeFisica,
      produtividadeMedia,
      totalFalhas,
      mtbf,
      mttr,
      totalCustoMnt,
      taxaConfiabilidade,
      oeeAprox
    };
  }, [branchFilteredProduction, branchFilteredMaintenance]);

  // Dados para gráficos temporais
  const productionChartData = useMemo(() => {
    const sorted = [...branchFilteredProduction].sort((a, b) => a.data.localeCompare(b.data));
    const grouped: { [key: string]: { data: string; meta: number; realizada: number; horas: number } } = {};

    sorted.forEach(item => {
      if (!grouped[item.data]) {
        grouped[item.data] = { data: item.data.split('-').slice(1).join('/'), meta: 0, realizada: 0, horas: 0 };
      }
      grouped[item.data].meta += item.meta_producao || 0;
      grouped[item.data].realizada += item.producao_realizada || 0;
      grouped[item.data].horas += item.horas_operacionais_efetivas || 0;
    });

    return Object.values(grouped).slice(-10);
  }, [branchFilteredProduction]);

  // Alteração On-Time de Status de Equipamento com 1 clique e Alerta Operacional
  const handleQuickStatusChange = (equip: EquipmentMaster, newStatus: EquipmentMaster['status']) => {
    const prevStatus = equip.status;
    onUpdateEquipment(equip.id, {
      status: newStatus,
      motivo_parada: newStatus === 'Operando' ? undefined : equip.motivo_parada,
      ordem_servico_ativa: newStatus === 'Operando' ? undefined : equip.ordem_servico_ativa
    });

    const isCritical = newStatus === 'Manutenção Corretiva';
    const isSuccess = newStatus === 'Operando';
    const isPreventiva = newStatus === 'Manutenção Preventiva';

    // Toca alerta sonoro instantâneo
    playOperationalSound(isCritical ? 'critical' : isSuccess ? 'success' : isPreventiva ? 'warning' : 'info');

    // Dispara alerta operacional no feed e nas notificações
    if (onTriggerOperationalAlert) {
      onTriggerOperationalAlert({
        tipo: 'equipamento_status',
        titulo: isCritical 
          ? `🚨 ALERTA OPERACIONAL: ${equip.tag} em MANUTENÇÃO CORRETIVA`
          : isSuccess
          ? `✅ NORMALIZAÇÃO: ${equip.tag} LIBERADO PARA OPERANDO`
          : `⚠️ MUDANÇA DE STATUS: ${equip.tag} colocado em ${newStatus}`,
        mensagem: isCritical
          ? `O equipamento ${equip.nome} (${equip.tag}) parou por falha mecânica/hidráulica no pátio. Abrindo Ordem de Manutenção imediata.`
          : isSuccess
          ? `O equipamento ${equip.nome} (${equip.tag}) teve manutenção/inspeção concluída e está disponível no pátio com DF de 100%.`
          : `O equipamento ${equip.nome} (${equip.tag}) teve seu status operacional alterado de "${prevStatus}" para "${newStatus}".`,
        severidade: isCritical ? 'critica' : isSuccess ? 'baixa' : 'alta',
        equipamento_tag: equip.tag,
        equipamento_id: equip.id,
        status_anterior: prevStatus,
        novo_status: newStatus,
        branchId: equip.branchId || defaultBranchId,
        autor_email: userEmail
      });
    }

    setFeedbackMessage({
      text: `Status do ${equip.tag} alterado para "${newStatus}". Alerta operacional gerado para a equipe!`,
      type: 'success'
    });

    // Se mudou para manutenção corretiva, abre a OS imediatamente com campos pré-preenchidos
    if (newStatus === 'Manutenção Corretiva') {
      setTimeout(() => {
        handleOpenNewMaintenance(equip.id);
      }, 400);
    }
  };

  // Ajuste rápido de Horímetro (+8 horas de turno ou valor digitado)
  const handleApplyQuickHorimeter = (equip: EquipmentMaster, addHours: number) => {
    const current = equip.horimetro_atual || 0;
    const updated = Math.round((current + addHours) * 10) / 10;
    onUpdateEquipment(equip.id, { horimetro_atual: updated });
    playOperationalSound('info');
    setFeedbackMessage({
      text: `Horímetro do ${equip.tag} atualizado para ${updated} h (+${addHours} h registradas)!`,
      type: 'success'
    });
    setQuickHorimeterEquipment(null);
  };

  // Submit Production com validação resiliente, garantia de branch e alerta operacional
  const handleSaveProduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.data) {
      setFeedbackMessage({ text: 'Por favor, selecione a data do turno de apontamento.', type: 'error' });
      return;
    }

    const equip = equipments.find(eq => eq.id === prodForm.equipamento_id);
    const meta = Number(String(prodForm.meta_producao).replace(',', '.')) || 0;
    const realizada = Number(String(prodForm.producao_realizada).replace(',', '.')) || 0;
    const prog = Number(String(prodForm.horas_programadas).replace(',', '.')) || 8;
    const efetivas = Number(String(prodForm.horas_operacionais_efetivas).replace(',', '.')) || 0;
    const paradaOp = Number(String(prodForm.horas_parada_operacional).replace(',', '.')) || 0;
    const paradaMnt = Number(String(prodForm.horas_parada_manutencao).replace(',', '.')) || 0;

    const entryData = {
      ...prodForm,
      meta_producao: meta,
      producao_realizada: realizada,
      horas_programadas: prog,
      horas_operacionais_efetivas: efetivas,
      horas_parada_operacional: paradaOp,
      horas_parada_manutencao: paradaMnt,
      equipamento_nome: equip ? `${equip.tag} - ${equip.nome}` : (prodForm.setor || 'Operação Titam'),
      branchId: prodForm.branchId || defaultBranchId || 'volta-redonda'
    };

    if (editingProduction) {
      onUpdateProductionKpi(editingProduction.id, entryData);
      setFeedbackMessage({ text: 'Apontamento de produção atualizado com sucesso!', type: 'success' });
    } else {
      onAddProductionKpi(entryData);
      setFeedbackMessage({ text: 'Novo apontamento de produção salvo com sucesso!', type: 'success' });
    }

    playOperationalSound('success');

    if (onTriggerOperationalAlert) {
      onTriggerOperationalAlert({
        tipo: 'producao_apontada',
        titulo: `📊 Apontamento de Produção: ${realizada}t no ${entryData.turno}`,
        mensagem: `Setor: ${entryData.setor} | Realizado: ${realizada}t de ${meta}t meta (${meta > 0 ? ((realizada/meta)*100).toFixed(1) : 100}%) com ${efetivas}h efetivas.`,
        severidade: 'baixa',
        branchId: entryData.branchId,
        autor_email: userEmail
      });
    }

    setIsProductionModalOpen(false);
    setEditingProduction(null);
  };

  // Submit Maintenance com auto-atualização de status de equipamento e alerta operacional
  const handleSaveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintForm.data || !maintForm.descricao_problema) {
      setFeedbackMessage({ text: 'Preencha a data e a descrição do problema da ordem de manutenção.', type: 'error' });
      return;
    }

    const equip = equipments.find(eq => eq.id === maintForm.equipamento_id);
    const parada = Number(String(maintForm.horas_parada).replace(',', '.')) || 0;
    const falhas = Number(String(maintForm.quantidade_falhas).replace(',', '.')) || 0;
    const custo = Number(String(maintForm.custo_estimado).replace(',', '.')) || 0;

    const maintData = {
      ...maintForm,
      horas_parada: parada,
      quantidade_falhas: falhas,
      custo_estimado: custo,
      equipamento_nome: equip ? `${equip.tag} - ${equip.nome}` : 'Equipamento Operacional Titam',
      tipo_equipamento: equip?.tipo || 'Outro',
      branchId: maintForm.branchId || defaultBranchId || 'volta-redonda'
    };

    if (editingMaintenance) {
      onUpdateMaintenanceKpi(editingMaintenance.id, maintData);
      setFeedbackMessage({ text: 'Ordem de manutenção atualizada com sucesso!', type: 'success' });
    } else {
      onAddMaintenanceKpi(maintData);
      setFeedbackMessage({ text: 'Ordem de manutenção registrada com sucesso!', type: 'success' });
    }

    const isConcluded = maintForm.status === 'Concluída';
    playOperationalSound(isConcluded ? 'success' : maintForm.tipo_manutencao === 'Corretiva' ? 'critical' : 'warning');

    // Atualiza status do equipamento em tempo real
    if (equip) {
      if (maintForm.status === 'Em Andamento' || maintForm.status === 'Aguardando Peça') {
        onUpdateEquipment(equip.id, {
          status: maintForm.tipo_manutencao === 'Preventiva' ? 'Manutenção Preventiva' : 'Manutenção Corretiva',
          motivo_parada: maintForm.descricao_problema,
          ordem_servico_ativa: maintForm.ordem_servico
        });
      } else if (isConcluded && equip.status.includes('Manutenção')) {
        onUpdateEquipment(equip.id, {
          status: 'Operando',
          motivo_parada: undefined,
          ordem_servico_ativa: undefined
        });
      }
    }

    if (onTriggerOperationalAlert) {
      onTriggerOperationalAlert({
        tipo: isConcluded ? 'manutencao_concluida' : 'manutencao_aberta',
        titulo: isConcluded 
          ? `✅ OS ${maintData.ordem_servico} Concluída: ${maintData.equipamento_nome} liberado`
          : `🚨 Nova OS ${maintData.ordem_servico} Aberta (${maintData.tipo_manutencao})`,
        mensagem: `${maintData.descricao_problema} | Técnico: ${maintData.tecnico_responsavel || 'Equipe PCM Titam'} | Status: ${maintData.status}`,
        severidade: maintData.tipo_manutencao === 'Corretiva' && !isConcluded ? 'alta' : 'baixa',
        equipamento_tag: equip?.tag,
        equipamento_id: equip?.id,
        novo_status: isConcluded ? 'Operando' : maintData.tipo_manutencao === 'Preventiva' ? 'Manutenção Preventiva' : 'Manutenção Corretiva',
        branchId: maintData.branchId,
        autor_email: userEmail
      });
    }

    setIsMaintenanceModalOpen(false);
    setEditingMaintenance(null);
  };

  // Submit Equipment
  const handleSaveEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipForm.tag || !equipForm.nome) {
      setFeedbackMessage({ text: 'Preencha a TAG e o nome do equipamento.', type: 'error' });
      return;
    }

    const equipData = {
      ...equipForm,
      horimetro_atual: Number(String(equipForm.horimetro_atual).replace(',', '.')) || 0,
      branchId: equipForm.branchId || defaultBranchId
    };

    if (editingEquipment) {
      onUpdateEquipment(editingEquipment.id, equipData);
      setFeedbackMessage({ text: `Equipamento ${equipForm.tag} atualizado!`, type: 'success' });
    } else {
      onAddEquipment(equipData);
      setFeedbackMessage({ text: `Novo equipamento ${equipForm.tag} cadastrado!`, type: 'success' });
    }

    setIsEquipmentModalOpen(false);
    setEditingEquipment(null);
  };

  // Exportar Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const prodData = branchFilteredProduction.map(p => ({
      Data: p.data,
      Turno: p.turno,
      Setor: p.setor,
      Equipamento: p.equipamento_nome || '-',
      'Meta (t)': p.meta_producao,
      'Realizado (t)': p.producao_realizada,
      'Atingimento (%)': p.meta_producao > 0 ? ((p.producao_realizada / p.meta_producao) * 100).toFixed(1) + '%' : '-',
      'Horas Programadas': p.horas_programadas,
      'Horas Efetivas': p.horas_operacionais_efetivas,
      'Parada Mnt (h)': p.horas_parada_manutencao,
      Responsável: p.responsavel || '-'
    }));
    const wsProd = XLSX.utils.json_to_sheet(prodData);
    XLSX.utils.book_append_sheet(wb, wsProd, 'Apontamentos Produção');

    const maintData = branchFilteredMaintenance.map(m => ({
      OS: m.ordem_servico || '-',
      Data: m.data,
      Turno: m.turno,
      Equipamento: m.equipamento_nome,
      Tipo: m.tipo_manutencao,
      Sistema: m.sistema_afetado,
      'Horas Parada': m.horas_parada,
      'Falhas (MTBF)': m.quantidade_falhas,
      'Custo (R$)': m.custo_estimado || 0,
      Status: m.status,
      Problema: m.descricao_problema,
      Técnico: m.tecnico_responsavel || '-'
    }));
    const wsMaint = XLSX.utils.json_to_sheet(maintData);
    XLSX.utils.book_append_sheet(wb, wsMaint, 'Ordens de Manutenção');

    const equipData = branchFilteredEquipments.map(e => ({
      TAG: e.tag,
      Nome: e.nome,
      Modelo: e.modelo,
      Tipo: e.tipo,
      Status: e.status,
      Capacidade: e.capacidade,
      Horímetro: e.horimetro_atual || 0,
      'Localização Atual': e.localizacao_atual || '-',
      'Operador Atual': e.operador_atual || '-',
      'Última Revisão': e.ultima_revisao || '-',
      'Próxima Revisão': e.proxima_revisao || '-'
    }));
    const wsEquip = XLSX.utils.json_to_sheet(equipData);
    XLSX.utils.book_append_sheet(wb, wsEquip, 'Frota On-Time');

    XLSX.writeFile(wb, `KPIs_Titam_Producao_Manutencao_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Exportar Relatório Executivo em PDF
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TITAM - RELATÓRIO DE KPIS DE PRODUÇÃO & MANUTENÇÃO', 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')} | Filial: ${selectedBranchId === 'all' ? 'Consolidado Todas' : selectedBranchId.toUpperCase()}`, 14, 26);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Indicadores Principais de Performance', 14, 45);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const kpiTexts = [
      `• Produção Total Realizada: ${metrics.totalProdRealizada.toLocaleString('pt-BR')} t (Meta: ${metrics.totalProdMeta.toLocaleString('pt-BR')} t - Atingimento: ${metrics.atingimentoMeta.toFixed(1)}%)`,
      `• Disponibilidade Física da Frota: ${metrics.disponibilidadeFisica.toFixed(1)}%`,
      `• Frota On-Time: ${fleetStats.operando} em operação, ${fleetStats.corretiva} em corretiva, ${fleetStats.standby} em espera (Total: ${fleetStats.total})`,
      `• OEE Operacional Estimado: ${metrics.oeeAprox.toFixed(1)}%`,
      `• MTBF (Tempo Médio Entre Falhas): ${metrics.mtbf.toFixed(1)} h`,
      `• MTTR (Tempo Médio Para Reparo): ${metrics.mttr.toFixed(1)} h`,
      `• Custo Total de Manutenção Acumulado: R$ ${metrics.totalCustoMnt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ];

    let yPos = 55;
    kpiTexts.forEach(line => {
      doc.text(line, 16, yPos);
      yPos += 8;
    });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Status On-Time dos Equipamentos da Frota', 14, yPos + 6);
    yPos += 16;

    branchFilteredEquipments.slice(0, 10).forEach(eq => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`[${eq.tag}] ${eq.nome} | Status: ${eq.status} | Horímetro: ${eq.horimetro_atual || '-'}h | Local: ${eq.localizacao_atual || 'Pátio'}`, 16, yPos);
      yPos += 6;
    });

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Sistema 100% Autocontido Estoque Titam - Gestão Operacional Integrada', 14, 285);

    doc.save(`Relatorio_KPIs_Titam_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-bold text-white transition-all ${
              feedbackMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {feedbackMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedbackMessage.text}</span>
            <button onClick={() => setFeedbackMessage(null)} className="ml-2 hover:opacity-75">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Central e Feed de Alertas Operacionais On-Time (Mudanças de Status em Tempo Real) */}
      <OperationalAlertsCenter
        alerts={operationalAlerts}
        onTriggerAlert={onTriggerOperationalAlert || (() => {})}
        onMarkAsRead={onMarkAlertAsRead}
        onMarkAllAsRead={onMarkAllAlertsAsRead}
        selectedBranchId={selectedBranchId}
        onSelectEquipment={(tag) => {
          setActiveKpiTab('ontime');
          setSearchTerm(tag);
        }}
      />

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-titam-deep flex items-center justify-center text-titam-lime shadow-md relative">
            <Gauge size={24} />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-titam-deep uppercase tracking-tight">
                KPIs de Produção & Manutenção
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 flex items-center gap-1">
                <Radio size={10} className="animate-pulse" />
                Telemetria On-Time Ativa
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-0.5">
              Monitoramento em tempo real do parque de máquinas, apontamento de turno, disponibilidade física (DF) e indicadores industriais nativos.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenNewProduction}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-titam-deep text-titam-lime font-bold text-xs hover:bg-titam-deep/90 transition shadow-sm"
          >
            <Plus size={15} />
            <span>+ Apontar Produção</span>
          </button>

          <button
            onClick={() => handleOpenNewMaintenance()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition shadow-sm"
          >
            <Wrench size={15} />
            <span>+ Registrar Manutenção</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition shadow-sm"
            title="Exportar dados para Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition shadow-sm"
            title="Exportar Relatório Executivo em PDF"
          >
            <FileText size={14} />
            <span>PDF</span>
          </button>

          <button
            onClick={onResetSeedExamples}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition border border-gray-200"
            title="Recarrega exemplos práticos e operacionais da Titam para demonstração imediata"
          >
            <RotateCcw size={13} />
            <span>Exemplos Práticos</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* TAB 1: VISIBILIDADE ON-TIME */}
          <button
            onClick={() => handleSelectKpiTab('ontime')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition ${
              activeKpiTab === 'ontime'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-emerald-50 border border-emerald-200'
            }`}
          >
            <Radio size={14} className={activeKpiTab === 'ontime' ? 'animate-pulse text-white' : 'text-emerald-600 animate-pulse'} />
            <span>Status On-Time da Frota</span>
            <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
              activeKpiTab === 'ontime' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {fleetStats.operando}/{fleetStats.total} Ativos
            </span>
          </button>

          <button
            onClick={() => handleSelectKpiTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition ${
              activeKpiTab === 'dashboard'
                ? 'bg-titam-deep text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <BarChart3 size={15} />
            <span>Painel Geral & Gráficos</span>
          </button>

          <button
            onClick={() => handleSelectKpiTab('producao')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition ${
              activeKpiTab === 'producao'
                ? 'bg-titam-deep text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <TrendingUp size={15} />
            <span>Apontamentos de Produção</span>
            <span className="px-1.5 py-0.2 bg-white/20 text-[10px] rounded-full">
              {branchFilteredProduction.length}
            </span>
          </button>

          <button
            onClick={() => handleSelectKpiTab('manutencao')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition ${
              activeKpiTab === 'manutencao'
                ? 'bg-titam-deep text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Wrench size={15} />
            <span>Ordens de Manutenção & Paradas</span>
            <span className="px-1.5 py-0.2 bg-white/20 text-[10px] rounded-full">
              {branchFilteredMaintenance.length}
            </span>
          </button>

          <button
            onClick={() => handleSelectKpiTab('equipamentos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition ${
              activeKpiTab === 'equipamentos'
                ? 'bg-titam-deep text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Truck size={15} />
            <span>Frotas & Equipamentos</span>
            <span className="px-1.5 py-0.2 bg-white/20 text-[10px] rounded-full">
              {branchFilteredEquipments.length}
            </span>
          </button>

          <button
            onClick={() => handleSelectKpiTab('guia')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition ${
              activeKpiTab === 'guia'
                ? 'bg-titam-lime text-titam-deep border border-titam-deep shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Info size={15} />
            <span>Guia & Metodologia de KPIs</span>
          </button>
        </div>

        {/* Global Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
            <input
              type="text"
              placeholder="Buscar TAG, setor, OS..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-titam-deep w-44"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 0: STATUS ON-TIME DOS EQUIPAMENTOS (TELEMETRIA EM TEMPO REAL)        */}
      {/* ========================================================================= */}
      {activeKpiTab === 'ontime' && (
        <div className="space-y-6">
          {/* Barra Resumo On-Time */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total de Frotas</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-gray-900">{fleetStats.total}</span>
                <span className="text-[10px] text-gray-500 font-semibold">Máquinas</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">🟢 Operando</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-700">{fleetStats.operando}</span>
                <span className="text-[10px] font-bold text-emerald-600">
                  {fleetStats.total > 0 ? Math.round((fleetStats.operando / fleetStats.total) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between ${
              fleetStats.corretiva > 0 ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20' : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider">🔴 Em Corretiva</span>
                {fleetStats.corretiva > 0 && <AlertOctagon size={14} className="text-rose-600 animate-pulse" />}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-rose-700">{fleetStats.corretiva}</span>
                <span className="text-[10px] text-rose-600 font-bold">
                  {fleetStats.corretiva > 0 ? 'Requer Atenção!' : 'Nenhuma'}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">🟡 Em Preventiva</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-amber-600">{fleetStats.preventiva}</span>
                <span className="text-[10px] text-amber-700 font-semibold">Programadas</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">🔵 Stand-by</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-blue-600">{fleetStats.standby}</span>
                <span className="text-[10px] text-blue-700 font-semibold">Prontidão</span>
              </div>
            </div>

            <div className="bg-titam-deep text-white p-4 rounded-2xl shadow-md flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-titam-lime uppercase tracking-wider">Disponibilidade</span>
                <Zap size={13} className="text-titam-lime" />
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-titam-lime">{fleetStats.taxaDisponibilidade}%</span>
                <span className="text-[10px] text-gray-300 font-medium">On-Time</span>
              </div>
            </div>
          </div>

          {/* Controles de Filtro e Busca On-Time */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
                <Filter size={13} /> Filtrar Status:
              </span>
              {[
                { id: 'todos', label: 'Todos os Equipamentos' },
                { id: 'Operando', label: '🟢 Operando' },
                { id: 'Manutenção Corretiva', label: '🔴 Corretiva' },
                { id: 'Manutenção Preventiva', label: '🟡 Preventiva' },
                { id: 'Stand-by', label: '🔵 Stand-by' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setEquipmentStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    equipmentStatusFilter === f.id
                      ? 'bg-titam-deep text-titam-lime shadow-sm'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setEquipmentViewMode(equipmentViewMode === 'cards' ? 'table' : 'cards')}
                className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-1.5"
              >
                <Sliders size={13} />
                <span>{equipmentViewMode === 'cards' ? 'Ver em Tabela' : 'Ver em Cards'}</span>
              </button>

              <button
                onClick={handleOpenNewEquipment}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-titam-deep text-titam-lime text-xs font-bold shadow-sm hover:bg-titam-deep/90 transition"
              >
                <Plus size={14} />
                <span>Cadastrar Máquina</span>
              </button>
            </div>
          </div>

          {/* MODO CARDS OPERACIONAIS ON-TIME */}
          {equipmentViewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {onTimeEquipments.map(eq => {
                const isOperando = eq.status === 'Operando';
                const isCorretiva = eq.status === 'Manutenção Corretiva';
                const isPreventiva = eq.status === 'Manutenção Preventiva';
                const isStandby = eq.status === 'Stand-by';

                return (
                  <div
                    key={eq.id}
                    className={`bg-white rounded-2xl border-2 transition-all p-5 shadow-sm flex flex-col justify-between ${
                      isCorretiva
                        ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-500/10'
                        : isOperando
                        ? 'border-emerald-300 hover:border-emerald-500'
                        : isPreventiva
                        ? 'border-amber-300'
                        : 'border-blue-200'
                    }`}
                  >
                    <div>
                      {/* Top Header do Card com TAG e Status Atual */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm px-3 py-1 bg-titam-deep text-titam-lime rounded-xl shadow-sm tracking-wider">
                            {eq.tag}
                          </span>
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">
                            {eq.tipo}
                          </span>
                        </div>

                        {/* Status Badge On-Time */}
                        <div className={`px-2.5 py-1 rounded-xl font-black text-[10px] uppercase flex items-center gap-1.5 ${
                          isOperando ? 'bg-emerald-100 text-emerald-800' :
                          isCorretiva ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                          isPreventiva ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          <span className="flex h-2 w-2 relative">
                            {isOperando && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                            {isCorretiva && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${
                              isOperando ? 'bg-emerald-500' :
                              isCorretiva ? 'bg-rose-500' :
                              isPreventiva ? 'bg-amber-500' : 'bg-blue-500'
                            }`}></span>
                          </span>
                          <span>{eq.status}</span>
                        </div>
                      </div>

                      {/* Nome e Modelo */}
                      <h4 className="text-base font-black text-gray-900 leading-snug">{eq.nome}</h4>
                      <p className="text-xs text-gray-400 mb-3">{eq.modelo} • {eq.capacidade}</p>

                      {/* Alerta de Parada Ativa se estiver em Corretiva */}
                      {isCorretiva && (
                        <div className="mb-3 p-3 bg-rose-100/70 border border-rose-200 rounded-xl text-xs text-rose-900">
                          <div className="flex items-center justify-between font-bold mb-1">
                            <span className="flex items-center gap-1 text-rose-700">
                              <AlertOctagon size={13} /> Parada por Quebra
                            </span>
                            {eq.ordem_servico_ativa && (
                              <span className="font-mono bg-rose-200 px-1.5 py-0.5 rounded text-[10px]">
                                {eq.ordem_servico_ativa}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-rose-800">
                            {eq.motivo_parada || 'Falha mecânica/hidráulica reportada pela equipe.'}
                          </p>
                          <div className="mt-2 flex gap-1.5">
                            <button
                              onClick={() => handleOpenNewMaintenance(eq.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-700 text-white font-bold text-[10px] hover:bg-rose-800 transition"
                            >
                              Ver / Atualizar OS
                            </button>
                            <button
                              onClick={() => handleQuickStatusChange(eq, 'Operando')}
                              className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-800 font-bold text-[10px] hover:bg-rose-50 transition"
                            >
                              Liberar para Operação
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Painel de Telemetria On-Time */}
                      <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-2 text-xs mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 flex items-center gap-1">
                            <Clock size={12} /> Horímetro Atual:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-gray-900 text-sm">
                              {eq.horimetro_atual ? `${eq.horimetro_atual} h` : '-'}
                            </span>
                            <button
                              onClick={() => handleApplyQuickHorimeter(eq, 8)}
                              className="px-1.5 py-0.5 rounded bg-titam-deep text-titam-lime text-[10px] font-bold hover:bg-titam-deep/80 transition"
                              title="Adicionar 8 horas de operação deste turno"
                            >
                              +8h Turno
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 flex items-center gap-1">
                            <MapPin size={12} /> Localização Atual:
                          </span>
                          <span className="font-bold text-gray-700">
                            {eq.localizacao_atual || 'Pátio Operacional'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 flex items-center gap-1">
                            <UserCheck size={12} /> Operador do Turno:
                          </span>
                          <span className="font-bold text-gray-700">
                            {eq.operador_atual || 'Líder / Escala Geral'}
                          </span>
                        </div>

                        {eq.proxima_revisao && (
                          <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
                            <span className="text-gray-400">Próx. Revisão:</span>
                            <span className="font-semibold text-gray-600">{eq.proxima_revisao}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Controle 1-Clique de Troca de Status On-Time */}
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">
                        Ação On-Time (Mudar Status Instantâneo):
                      </span>
                      <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-xl">
                        <button
                          onClick={() => handleQuickStatusChange(eq, 'Operando')}
                          className={`py-1.5 px-1 rounded-lg text-[10px] font-black uppercase transition text-center ${
                            isOperando
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-white'
                          }`}
                          title="Definir equipamento como Operando"
                        >
                          Operando
                        </button>
                        <button
                          onClick={() => handleQuickStatusChange(eq, 'Manutenção Corretiva')}
                          className={`py-1.5 px-1 rounded-lg text-[10px] font-black uppercase transition text-center ${
                            isCorretiva
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-white'
                          }`}
                          title="Reportar quebra e abrir OS corretiva"
                        >
                          Corretiva
                        </button>
                        <button
                          onClick={() => handleQuickStatusChange(eq, 'Manutenção Preventiva')}
                          className={`py-1.5 px-1 rounded-lg text-[10px] font-black uppercase transition text-center ${
                            isPreventiva
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-white'
                          }`}
                          title="Definir equipamento em Manutenção Preventiva"
                        >
                          Preventiva
                        </button>
                        <button
                          onClick={() => handleQuickStatusChange(eq, 'Stand-by')}
                          className={`py-1.5 px-1 rounded-lg text-[10px] font-black uppercase transition text-center ${
                            isStandby
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-gray-600 hover:bg-white'
                          }`}
                          title="Colocar em Stand-by / Prontidão"
                        >
                          Stand-by
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODO TABELA RESUMO OPERACIONAL ON-TIME */}
          {equipmentViewMode === 'table' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                      <th className="p-3">TAG</th>
                      <th className="p-3">Equipamento</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Status On-Time</th>
                      <th className="p-3">Horímetro</th>
                      <th className="p-3">Localização</th>
                      <th className="p-3">Operador Alocado</th>
                      <th className="p-3">Troca Rápida de Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {onTimeEquipments.map(eq => (
                      <tr key={eq.id} className="hover:bg-gray-50/80 transition">
                        <td className="p-3 font-mono font-black text-titam-deep">{eq.tag}</td>
                        <td className="p-3 font-bold text-gray-900">{eq.nome}</td>
                        <td className="p-3 text-gray-500">{eq.tipo}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                            eq.status === 'Operando' ? 'bg-emerald-100 text-emerald-800' :
                            eq.status === 'Manutenção Corretiva' ? 'bg-rose-100 text-rose-800' :
                            eq.status === 'Manutenção Preventiva' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {eq.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-gray-800">
                          {eq.horimetro_atual ? `${eq.horimetro_atual} h` : '-'}
                        </td>
                        <td className="p-3 text-gray-700">{eq.localizacao_atual || 'Pátio'}</td>
                        <td className="p-3 text-gray-700">{eq.operador_atual || 'Líder / Escala'}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleQuickStatusChange(eq, 'Operando')}
                              className={`px-2 py-1 rounded text-[10px] font-bold ${eq.status === 'Operando' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                              Operando
                            </button>
                            <button
                              onClick={() => handleQuickStatusChange(eq, 'Manutenção Corretiva')}
                              className={`px-2 py-1 rounded text-[10px] font-bold ${eq.status === 'Manutenção Corretiva' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                              Corretiva
                            </button>
                            <button
                              onClick={() => handleQuickStatusChange(eq, 'Stand-by')}
                              className={`px-2 py-1 rounded text-[10px] font-bold ${eq.status === 'Stand-by' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                              Stand-by
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: PAINEL EXECUTIVO & GRÁFICOS (DASHBOARD)                           */}
      {/* ========================================================================= */}
      {activeKpiTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Produção Realizada</span>
              <div className="my-1">
                <span className="text-2xl font-black text-gray-900">
                  {metrics.totalProdRealizada.toLocaleString('pt-BR')}
                </span>
                <span className="text-xs text-gray-500 font-semibold ml-1">t</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400">Meta: {metrics.totalProdMeta.toLocaleString('pt-BR')} t</span>
                <span className={`font-bold ${metrics.atingimentoMeta >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {metrics.atingimentoMeta.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Disponibilidade (DF)</span>
              <div className="my-1">
                <span className="text-2xl font-black text-titam-deep">
                  {metrics.disponibilidadeFisica.toFixed(1)}%
                </span>
              </div>
              <div className="text-[10px] text-gray-400">
                Meta Industrial: <strong className="text-gray-700">92.0%</strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MTBF (Horas/Falha)</span>
              <div className="my-1">
                <span className="text-2xl font-black text-blue-600">
                  {metrics.mtbf.toFixed(1)}
                </span>
                <span className="text-xs text-gray-500 font-semibold ml-1">h</span>
              </div>
              <div className="text-[10px] text-gray-400">
                Total de Falhas: <strong className="text-rose-600">{metrics.totalFalhas}</strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MTTR (Tempo Reparo)</span>
              <div className="my-1">
                <span className="text-2xl font-black text-rose-600">
                  {metrics.mttr.toFixed(1)}
                </span>
                <span className="text-xs text-gray-500 font-semibold ml-1">h</span>
              </div>
              <div className="text-[10px] text-gray-400">
                Parada Mnt: <strong className="text-gray-700">{metrics.totalHorasParadaMnt.toFixed(1)}h</strong>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Produtividade Efetiva</span>
              <div className="my-1">
                <span className="text-2xl font-black text-emerald-600">
                  {metrics.produtividadeMedia.toFixed(0)}
                </span>
                <span className="text-xs text-gray-500 font-semibold ml-1">t/h</span>
              </div>
              <div className="text-[10px] text-gray-400">
                Horas Op: <strong className="text-gray-700">{metrics.totalHorasOperacionais.toFixed(1)}h</strong>
              </div>
            </div>

            <div className="bg-titam-deep text-white p-4 rounded-2xl shadow-md flex flex-col justify-between">
              <span className="text-[10px] font-bold text-titam-lime uppercase tracking-wider">OEE Estimado</span>
              <div className="my-1">
                <span className="text-2xl font-black text-titam-lime">
                  {metrics.oeeAprox.toFixed(1)}%
                </span>
              </div>
              <div className="text-[10px] text-gray-300">
                Classe Mundial: <strong className="text-white">85.0%</strong>
              </div>
            </div>
          </div>

          {/* Gráfico de Produção vs Meta */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-titam-deep uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart3 size={16} /> Evolução de Produção Realizada vs Meta (t)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="data" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="meta" name="Meta (t)" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realizada" name="Produção Real (t)" fill="#0f172a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: APONTAMENTOS DE PRODUÇÃO                                          */}
      {/* ========================================================================= */}
      {activeKpiTab === 'producao' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-titam-deep uppercase tracking-wider">
                Apontamentos de Turno & Produtividade
              </h3>
              <p className="text-xs text-gray-400">
                Histórico detalhado de movimentação física, horas trabalhadas e ritmo operacional
              </p>
            </div>
            <button
              onClick={handleOpenNewProduction}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-titam-deep text-titam-lime text-xs font-bold shadow-sm hover:bg-titam-deep/90 transition"
            >
              <Plus size={14} />
              <span>Novo Apontamento</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                    <th className="p-3">Data</th>
                    <th className="p-3">Turno</th>
                    <th className="p-3">Setor</th>
                    <th className="p-3">Equipamento</th>
                    <th className="p-3 text-right">Meta (t)</th>
                    <th className="p-3 text-right">Realizado (t)</th>
                    <th className="p-3 text-right">Atingimento</th>
                    <th className="p-3 text-center">Horas Op.</th>
                    <th className="p-3 text-center">Parada Mnt.</th>
                    <th className="p-3">Responsável</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {branchFilteredProduction.map((item) => {
                    const ating = item.meta_producao > 0 ? (item.producao_realizada / item.meta_producao) * 100 : 100;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition">
                        <td className="p-3 font-mono font-bold text-gray-800">{item.data}</td>
                        <td className="p-3">{item.turno}</td>
                        <td className="p-3 font-semibold text-gray-800">{item.setor}</td>
                        <td className="p-3 text-gray-600">{item.equipamento_nome || '-'}</td>
                        <td className="p-3 text-right font-mono text-gray-500">{item.meta_producao}</td>
                        <td className="p-3 text-right font-mono font-bold text-gray-900">{item.producao_realizada}</td>
                        <td className="p-3 text-right font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                            ating >= 100 ? 'bg-emerald-100 text-emerald-800' :
                            ating >= 85 ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {ating.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">{item.horas_operacionais_efetivas}h</td>
                        <td className="p-3 text-center font-mono text-rose-600 font-bold">{item.horas_parada_manutencao || 0}h</td>
                        <td className="p-3 text-gray-500">{item.responsavel || '-'}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingProduction(item);
                                setProdForm({
                                  data: item.data,
                                  turno: item.turno,
                                  setor: item.setor,
                                  equipamento_id: item.equipamento_id || '',
                                  meta_producao: item.meta_producao,
                                  producao_realizada: item.producao_realizada,
                                  unidade_medida: item.unidade_medida || 'Toneladas',
                                  horas_programadas: item.horas_programadas,
                                  horas_operacionais_efetivas: item.horas_operacionais_efetivas,
                                  horas_parada_operacional: item.horas_parada_operacional || 0,
                                  horas_parada_manutencao: item.horas_parada_manutencao || 0,
                                  motivo_parada_principal: item.motivo_parada_principal || '',
                                  observacoes: item.observacoes || '',
                                  responsavel: item.responsavel || '',
                                  branchId: item.branchId || defaultBranchId
                                });
                                setIsProductionModalOpen(true);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 rounded transition"
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => onDeleteProductionKpi(item.id)}
                              className="p-1 text-gray-400 hover:text-rose-600 rounded transition"
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: ORDENS DE MANUTENÇÃO                                              */}
      {/* ========================================================================= */}
      {activeKpiTab === 'manutencao' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-titam-deep uppercase tracking-wider">
                Ordens de Serviço & Manutenção
              </h3>
              <p className="text-xs text-gray-400">
                Histórico de falhas, quebras corretivas, preventivas de rotina e MTTR
              </p>
            </div>
            <button
              onClick={() => handleOpenNewMaintenance()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-sm hover:bg-amber-600 transition"
            >
              <Plus size={14} />
              <span>Nova Ordem de Manutenção</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                    <th className="p-3">OS</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Equipamento</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Sistema</th>
                    <th className="p-3 text-center">Horas Parada</th>
                    <th className="p-3 text-right">Custo Estimado</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Problema / Causa</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {branchFilteredMaintenance.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition">
                      <td className="p-3 font-mono font-bold text-titam-deep">{item.ordem_servico || '-'}</td>
                      <td className="p-3 font-mono text-gray-600">{item.data}</td>
                      <td className="p-3 font-bold text-gray-900">{item.equipamento_nome}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.tipo_manutencao === 'Corretiva' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.tipo_manutencao}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{item.sistema_afetado}</td>
                      <td className="p-3 text-center font-mono font-bold text-rose-600">{item.horas_parada}h</td>
                      <td className="p-3 text-right font-mono font-bold text-gray-900">
                        {item.custo_estimado ? `R$ ${item.custo_estimado.toLocaleString('pt-BR')}` : '-'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'Concluída' ? 'bg-emerald-100 text-emerald-800' :
                          item.status === 'Em Andamento' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 max-w-xs truncate" title={item.descricao_problema}>
                        {item.descricao_problema}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingMaintenance(item);
                              setMaintForm({
                                data: item.data,
                                turno: item.turno,
                                equipamento_id: item.equipamento_id,
                                tipo_manutencao: item.tipo_manutencao,
                                sistema_afetado: item.sistema_afetado,
                                horas_parada: item.horas_parada,
                                quantidade_falhas: item.quantidade_falhas,
                                custo_estimado: item.custo_estimado || 0,
                                tecnico_responsavel: item.tecnico_responsavel || '',
                                ordem_servico: item.ordem_servico || '',
                                descricao_problema: item.descricao_problema,
                                acao_realizada: item.acao_realizada,
                                status: item.status,
                                branchId: item.branchId || defaultBranchId
                              });
                              setIsMaintenanceModalOpen(true);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded transition"
                            title="Editar"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => onDeleteMaintenanceKpi(item.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded transition"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: FROTAS & EQUIPAMENTOS                                              */}
      {/* ========================================================================= */}
      {activeKpiTab === 'equipamentos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-titam-deep uppercase tracking-wider">
                Parque de Máquinas & Equipamentos Titam
              </h3>
              <p className="text-xs text-gray-400">
                Cadastro de frotas ativas, horímetros e acompanhamento de planos de manutenção
              </p>
            </div>
            <button
              onClick={handleOpenNewEquipment}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-titam-deep text-titam-lime text-xs font-bold shadow-sm hover:bg-titam-deep/90 transition"
            >
              <Plus size={14} />
              <span>Novo Equipamento</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchFilteredEquipments.map(eq => {
              const statusColor = 
                eq.status === 'Operando' ? 'bg-emerald-100 text-emerald-800' :
                eq.status === 'Manutenção Corretiva' ? 'bg-rose-100 text-rose-800' :
                eq.status === 'Manutenção Preventiva' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-700';

              return (
                <div key={eq.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono font-black text-xs px-2.5 py-1 bg-titam-deep text-titam-lime rounded-lg">
                        {eq.tag}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${statusColor}`}>
                        {eq.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-gray-900 mb-0.5">{eq.nome}</h4>
                    <p className="text-xs text-gray-400 mb-3">{eq.modelo} • {eq.tipo}</p>

                    <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 mb-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Capacidade:</span>
                        <strong className="text-gray-800">{eq.capacidade}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Horímetro:</span>
                        <strong className="font-mono text-gray-800">{eq.horimetro_atual ? `${eq.horimetro_atual} h` : '-'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Localização:</span>
                        <strong className="text-gray-800">{eq.localizacao_atual || 'Pátio'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Última Revisão:</span>
                        <strong className="text-gray-800">{eq.ultima_revisao || '-'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                    <button
                      onClick={() => {
                        setEditingEquipment(eq);
                        setEquipForm({
                          tag: eq.tag,
                          nome: eq.nome,
                          modelo: eq.modelo,
                          tipo: eq.tipo,
                          status: eq.status,
                          capacidade: eq.capacidade,
                          horimetro_atual: eq.horimetro_atual || 0,
                          ultima_revisao: eq.ultima_revisao || '',
                          proxima_revisao: eq.proxima_revisao || '',
                          branchId: eq.branchId,
                          localizacao_atual: eq.localizacao_atual || '',
                          operador_atual: eq.operador_atual || ''
                        });
                        setIsEquipmentModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg font-semibold transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDeleteEquipment(eq.id)}
                      className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-semibold transition"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 5: GUIA METODOLÓGICO DE KPIS                                          */}
      {/* ========================================================================= */}
      {activeKpiTab === 'guia' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-titam-deep uppercase tracking-tight">
              Metodologia de Indicadores de Produção & Manutenção Titam
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Dicionário técnico com as fórmulas industriais nativas implementadas nesta aplicação autocontida.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-titam-deep"></span> Disponibilidade Física (DF)
              </h4>
              <p className="text-gray-500 mb-1">
                Percentual de tempo em que a frota esteve mecanicamente apta a operar no período programado.
              </p>
              <code className="block bg-white p-2 rounded border border-gray-200 font-mono text-titam-deep">
                DF (%) = ((Horas Programadas - Horas Parada Mnt) / Horas Programadas) × 100
              </code>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span> MTBF (Mean Time Between Failures)
              </h4>
              <p className="text-gray-500 mb-1">Tempo médio operacional transcorrido entre falhas corretivas da frota.</p>
              <code className="block bg-white p-2 rounded border border-gray-200 font-mono text-blue-700">
                MTBF (h) = Horas Operacionais Efetivas / Nº de Falhas Corretivas
              </code>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-600"></span> MTTR (Mean Time to Repair)
              </h4>
              <p className="text-gray-500 mb-1">Tempo médio necessário para reparar um equipamento e restabelecer sua operação.</p>
              <code className="block bg-white p-2 rounded border border-gray-200 font-mono text-rose-700">
                MTTR (h) = Horas Parada por Manutenção / Nº de Falhas Corretivas
              </code>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Produtividade de Carga/Descarga (t/h)
              </h4>
              <p className="text-gray-500 mb-1">Toneladas líquidas movimentadas por hora de operação efetiva.</p>
              <code className="block bg-white p-2 rounded border border-gray-200 font-mono text-emerald-700">
                Produtividade (t/h) = Toneladas Realizadas / Horas Operacionais Efetivas
              </code>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FORMULÁRIO DE APONTAMENTO DE PRODUÇÃO                            */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isProductionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col"
            >
              <div className="bg-titam-deep p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="text-titam-lime" size={18} />
                  <h3 className="font-bold text-sm uppercase">
                    {editingProduction ? 'Editar Apontamento de Produção' : 'Novo Apontamento de Produção'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsProductionModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveProduction} noValidate className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                {/* Filial / Unidade */}
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Filial / Terminal Operacional</label>
                  <select
                    value={prodForm.branchId}
                    onChange={e => setProdForm({ ...prodForm, branchId: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-xl bg-amber-50/40 font-semibold text-gray-800"
                  >
                    {branches && branches.length > 0 ? (
                      branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.location || b.code || b.id})</option>
                      ))
                    ) : (
                      <>
                        <option value="volta-redonda">Terminal Volta Redonda (VRD - RJ)</option>
                        <option value="titam">Terminal Titam (Serra - ES)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Data do Turno</label>
                    <input
                      type="date"
                      value={prodForm.data}
                      onChange={e => setProdForm({ ...prodForm, data: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Turno</label>
                    <select
                      value={prodForm.turno}
                      onChange={e => setProdForm({ ...prodForm, turno: e.target.value as ShiftType })}
                      className="w-full p-2 border border-gray-200 rounded-xl font-bold"
                    >
                      <option value="1º Turno">1º Turno (06h - 14h)</option>
                      <option value="2º Turno">2º Turno (14h - 22h)</option>
                      <option value="3º Turno">3º Turno (22h - 06h)</option>
                      <option value="Comercial/Geral">Comercial / Geral</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Setor Operacional</label>
                    <select
                      value={prodForm.setor}
                      onChange={e => setProdForm({ ...prodForm, setor: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl font-bold"
                    >
                      <option value="Pátio de Bobinas">Pátio de Bobinas</option>
                      <option value="Carregamento Ferroviário (VLI)">Carregamento Ferroviário (VLI)</option>
                      <option value="Terminal Volta Redonda">Terminal Volta Redonda</option>
                      <option value="Expedição Rodoviária">Expedição Rodoviária</option>
                      <option value="Armazém Geral">Armazém Geral</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Equipamento Alocado</label>
                    <select
                      value={prodForm.equipamento_id}
                      onChange={e => setProdForm({ ...prodForm, equipamento_id: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl font-bold"
                    >
                      <option value="">Nenhum / Coletivo</option>
                      {equipments.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.tag} - {eq.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Meta de Produção (t)</label>
                    <input
                      type="number"
                      step="any"
                      value={prodForm.meta_producao ?? ''}
                      onChange={e => setProdForm({ ...prodForm, meta_producao: e.target.value === '' ? 0 : Number(e.target.value) })}
                      className="w-full p-2 border border-gray-200 rounded-xl bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Produção Realizada (t)</label>
                    <input
                      type="number"
                      step="any"
                      value={prodForm.producao_realizada ?? ''}
                      onChange={e => setProdForm({ ...prodForm, producao_realizada: e.target.value === '' ? 0 : Number(e.target.value) })}
                      className="w-full p-2 border border-gray-200 rounded-xl bg-white font-black text-titam-deep text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Horas Prog. (h)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={prodForm.horas_programadas}
                      onChange={e => setProdForm({ ...prodForm, horas_programadas: Number(e.target.value) })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-center"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Horas Trab. (h)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={prodForm.horas_operacionais_efetivas}
                      onChange={e => setProdForm({ ...prodForm, horas_operacionais_efetivas: Number(e.target.value) })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-rose-600 block mb-1">Parada Mnt. (h)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={prodForm.horas_parada_manutencao}
                      onChange={e => setProdForm({ ...prodForm, horas_parada_manutencao: Number(e.target.value) })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-center text-rose-600 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Responsável / Supervisor</label>
                  <input
                    type="text"
                    value={prodForm.responsavel}
                    onChange={e => setProdForm({ ...prodForm, responsavel: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Observações do Turno</label>
                  <textarea
                    rows={2}
                    value={prodForm.observacoes}
                    onChange={e => setProdForm({ ...prodForm, observacoes: e.target.value })}
                    placeholder="Ocorrências climáticas, ritmo operacional, atrasos ferroviários..."
                    className="w-full p-2 border border-gray-200 rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsProductionModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 font-bold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-titam-deep text-titam-lime font-bold shadow-md hover:bg-titam-deep/90 transition"
                  >
                    Salvar Apontamento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: FORMULÁRIO DE ORDEM DE MANUTENÇÃO                                */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isMaintenanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col"
            >
              <div className="bg-amber-600 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench size={18} />
                  <h3 className="font-bold text-sm uppercase">
                    {editingMaintenance ? 'Editar Ordem de Manutenção' : 'Nova Ordem de Manutenção'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsMaintenanceModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveMaintenance} noValidate className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                {/* Filial */}
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Filial / Terminal</label>
                  <select
                    value={maintForm.branchId}
                    onChange={e => setMaintForm({ ...maintForm, branchId: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-xl bg-amber-50/40 font-semibold"
                  >
                    {branches && branches.length > 0 ? (
                      branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.location || b.code || b.id})</option>
                      ))
                    ) : (
                      <>
                        <option value="volta-redonda">Terminal Volta Redonda (VRD - RJ)</option>
                        <option value="titam">Terminal Titam (Serra - ES)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Nº Ordem de Serviço (OS)</label>
                    <input
                      type="text"
                      required
                      value={maintForm.ordem_servico}
                      onChange={e => setMaintForm({ ...maintForm, ordem_servico: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Data da Ocorrência</label>
                    <input
                      type="date"
                      required
                      value={maintForm.data}
                      onChange={e => setMaintForm({ ...maintForm, data: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Equipamento</label>
                    <select
                      required
                      value={maintForm.equipamento_id}
                      onChange={e => setMaintForm({ ...maintForm, equipamento_id: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl font-bold"
                    >
                      <option value="">Selecione um equipamento...</option>
                      {equipments.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.tag} - {eq.nome} ({eq.status})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Tipo de Manutenção</label>
                    <select
                      value={maintForm.tipo_manutencao}
                      onChange={e => setMaintForm({ ...maintForm, tipo_manutencao: e.target.value as any })}
                      className="w-full p-2 border border-gray-200 rounded-xl font-bold"
                    >
                      <option value="Corretiva">Corretiva (Quebra / Falha)</option>
                      <option value="Preventiva">Preventiva Programada</option>
                      <option value="Preditiva">Preditiva</option>
                      <option value="Melhoria/Reforma">Melhoria / Reforma</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Sistema Afetado</label>
                    <select
                      value={maintForm.sistema_afetado}
                      onChange={e => setMaintForm({ ...maintForm, sistema_afetado: e.target.value as any })}
                      className="w-full p-2 border border-gray-200 rounded-xl"
                    >
                      <option value="Mecânica">Mecânica</option>
                      <option value="Elétrica">Elétrica</option>
                      <option value="Hidráulica">Hidráulica</option>
                      <option value="Pneumática/Pneus">Pneumática / Pneus</option>
                      <option value="Motor/Transmissão">Motor / Transmissão</option>
                      <option value="Estrutural">Estrutural</option>
                      <option value="Preventiva de Rotina">Preventiva de Rotina</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Status da Manutenção</label>
                    <select
                      value={maintForm.status}
                      onChange={e => setMaintForm({ ...maintForm, status: e.target.value as any })}
                      className="w-full p-2 border border-gray-200 rounded-xl font-bold"
                    >
                      <option value="Concluída">Concluída (Liberar Máquina)</option>
                      <option value="Em Andamento">Em Andamento (Máquina Parada)</option>
                      <option value="Aguardando Peça">Aguardando Peça</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div>
                    <label className="font-bold text-rose-600 block mb-1">Horas Parada (h)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={maintForm.horas_parada}
                      onChange={e => setMaintForm({ ...maintForm, horas_parada: Number(e.target.value) })}
                      className="w-full p-2 border border-gray-200 rounded-xl bg-white text-rose-600 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Qtd Falhas (MTBF)</label>
                    <input
                      type="number"
                      value={maintForm.quantidade_falhas}
                      onChange={e => setMaintForm({ ...maintForm, quantidade_falhas: Number(e.target.value) })}
                      className="w-full p-2 border border-gray-200 rounded-xl bg-white text-center"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Custo Estimado (R$)</label>
                    <input
                      type="number"
                      step="any"
                      value={maintForm.custo_estimado}
                      onChange={e => setMaintForm({ ...maintForm, custo_estimado: Number(e.target.value) })}
                      className="w-full p-2 border border-gray-200 rounded-xl bg-white font-mono text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Descrição do Problema / Sintoma</label>
                  <input
                    type="text"
                    required
                    value={maintForm.descricao_problema}
                    onChange={e => setMaintForm({ ...maintForm, descricao_problema: e.target.value })}
                    placeholder="Ex: Vazamento de óleo hidráulico na torre ou mangueira rompida..."
                    className="w-full p-2 border border-gray-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Ação Realizada / Solução Técnica</label>
                  <textarea
                    rows={2}
                    value={maintForm.acao_realizada}
                    onChange={e => setMaintForm({ ...maintForm, acao_realizada: e.target.value })}
                    placeholder="Ex: Substituída mangueira de 3/4, reapertadas conexões e completado nível do fluido..."
                    className="w-full p-2 border border-gray-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Técnico / Mecânico Responsável</label>
                  <input
                    type="text"
                    value={maintForm.tecnico_responsavel}
                    onChange={e => setMaintForm({ ...maintForm, tecnico_responsavel: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsMaintenanceModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 font-bold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 text-white font-bold shadow-md hover:bg-amber-600 transition"
                  >
                    Salvar Ordem
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: FORMULÁRIO DE EQUIPAMENTO                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEquipmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100"
            >
              <div className="bg-titam-deep p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="text-titam-lime" size={18} />
                  <h3 className="font-bold text-sm uppercase">
                    {editingEquipment ? 'Editar Equipamento' : 'Novo Equipamento'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsEquipmentModalOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveEquipment} className="p-5 space-y-4 text-xs">
                {/* Filial */}
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Filial / Terminal</label>
                  <select
                    required
                    value={equipForm.branchId}
                    onChange={e => setEquipForm({ ...equipForm, branchId: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-xl bg-amber-50/40 font-semibold"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.location || b.code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Tag / Identificador</label>
                    <input
                      type="text"
                      required
                      value={equipForm.tag}
                      onChange={e => setEquipForm({ ...equipForm, tag: e.target.value })}
                      placeholder="Ex: RS-01, EMP-07"
                      className="w-full p-2 border border-gray-200 rounded-xl font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Status Operacional</label>
                    <select
                      value={equipForm.status}
                      onChange={e => setEquipForm({ ...equipForm, status: e.target.value as any })}
                      className="w-full p-2 border border-gray-200 rounded-xl font-bold"
                    >
                      <option value="Operando">Operando</option>
                      <option value="Manutenção Corretiva">Manutenção Corretiva</option>
                      <option value="Manutenção Preventiva">Manutenção Preventiva</option>
                      <option value="Stand-by">Stand-by</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Nome / Descrição</label>
                  <input
                    type="text"
                    required
                    value={equipForm.nome}
                    onChange={e => setEquipForm({ ...equipForm, nome: e.target.value })}
                    placeholder="Ex: Reach Stacker Kalmar DRG450"
                    className="w-full p-2 border border-gray-200 rounded-xl font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Modelo Comercial</label>
                    <input
                      type="text"
                      value={equipForm.modelo}
                      onChange={e => setEquipForm({ ...equipForm, modelo: e.target.value })}
                      placeholder="Ex: DRG450-65S5X"
                      className="w-full p-2 border border-gray-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Tipo de Máquina</label>
                    <select
                      value={equipForm.tipo}
                      onChange={e => setEquipForm({ ...equipForm, tipo: e.target.value as any })}
                      className="w-full p-2 border border-gray-200 rounded-xl"
                    >
                      <option value="Reach Stacker">Reach Stacker</option>
                      <option value="Empilhadeira Frontal">Empilhadeira Frontal</option>
                      <option value="Pá Carregadeira">Pá Carregadeira</option>
                      <option value="Ponte Rolante">Ponte Rolante</option>
                      <option value="Guindaste">Guindaste</option>
                      <option value="Caminhão Operacional">Caminhão Operacional</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Capacidade</label>
                    <input
                      type="text"
                      value={equipForm.capacidade}
                      onChange={e => setEquipForm({ ...equipForm, capacidade: e.target.value })}
                      placeholder="Ex: 45 toneladas, 16t"
                      className="w-full p-2 border border-gray-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Horímetro Atual (h)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={equipForm.horimetro_atual}
                      onChange={e => setEquipForm({ ...equipForm, horimetro_atual: Number(e.target.value) })}
                      className="w-full p-2 border border-gray-200 rounded-xl font-mono text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Localização no Pátio</label>
                    <input
                      type="text"
                      value={equipForm.localizacao_atual || ''}
                      onChange={e => setEquipForm({ ...equipForm, localizacao_atual: e.target.value })}
                      placeholder="Ex: Pátio de Bobinas Quadra B"
                      className="w-full p-2 border border-gray-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Operador / Turno</label>
                    <input
                      type="text"
                      value={equipForm.operador_atual || ''}
                      onChange={e => setEquipForm({ ...equipForm, operador_atual: e.target.value })}
                      placeholder="Ex: Carlos Mendes (1º Turno)"
                      className="w-full p-2 border border-gray-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Última Revisão</label>
                    <input
                      type="date"
                      value={equipForm.ultima_revisao}
                      onChange={e => setEquipForm({ ...equipForm, ultima_revisao: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Próxima Revisão</label>
                    <input
                      type="date"
                      value={equipForm.proxima_revisao}
                      onChange={e => setEquipForm({ ...equipForm, proxima_revisao: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsEquipmentModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100 font-bold transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-titam-deep text-titam-lime font-bold shadow-md hover:bg-titam-deep/90 transition"
                  >
                    Salvar Equipamento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

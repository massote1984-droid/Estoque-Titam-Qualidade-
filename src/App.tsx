import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  FileText, 
  LayoutDashboard, 
  Package, 
  Truck,
  Search,
  Filter,
  ChevronRight,
  X,
  Download,
  FileJson,
  Calendar,
  RefreshCw,
  Trash2,
  TrendingUp,
  BarChart3,
  Activity,
  Bell,
  AlertTriangle,
  AlertCircle,
  Upload,
  RefreshCw as SyncIcon,
  FileDown,
  Scale,
  Building2,
  Users,
  Square,
  CheckSquare,
  MapPin,
  Boxes,
  Edit2,
  Check,
  Award
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
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
  AreaChart,
  Area,
  Legend,
  LabelList,
  ReferenceLine
} from 'recharts';
import { Entry, StockSummary, Container, Branch } from './types';
import { useAuth } from './components/FirebaseProvider';
import TitamPresentationView from './components/TitamPresentationView';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  setDoc,
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null, user: any) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
      providerInfo: user?.providerData.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

const getStatusBadgeStyle = (status: string | undefined): string => {
  if (!status) return 'bg-gray-100 text-gray-600 group-hover:bg-white/10 group-hover:text-white';
  const val = status.toLowerCase().trim();
  if (val.includes('estoque (cheio') || val === 'estoque') {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500';
  }
  if (val.includes('descarga arcelor') || val.includes('descarga na arcelor') || val === 'em descarga') {
    return 'bg-amber-50 text-amber-700 border border-amber-200 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500';
  }
  if (val.includes('trânsito cheio') || val.includes('transito cheio')) {
    return 'bg-blue-50 text-blue-700 border border-blue-200 group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500';
  }
  if (val.includes('vazio terminal')) {
    return 'bg-purple-50 text-purple-700 border border-purple-200 group-hover:bg-purple-500 group-hover:text-white group-hover:border-purple-500';
  }
  if (val.includes('trânsito vazio') || val.includes('transito vazio')) {
    return 'bg-indigo-50 text-indigo-700 border border-indigo-200 group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-500';
  }
  if (val.includes('rejeitado')) {
    return 'bg-red-50 text-red-700 border border-red-200 group-hover:bg-red-500 group-hover:text-white group-hover:border-red-500';
  }
  if (val.includes('embarcado')) {
    return 'bg-sky-50 text-sky-700 border border-sky-200 group-hover:bg-sky-500 group-hover:text-white group-hover:border-sky-500';
  }
  if (val.includes('devolvido')) {
    return 'bg-orange-50 text-orange-700 border border-orange-200 group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-500';
  }
  return 'bg-gray-100 text-gray-600 group-hover:bg-white/10 group-hover:text-white';
};

type Tab = 'dashboard' | 'entrada' | 'saida' | 'performance' | 'faturamento' | 'lista' | 'relatorios' | 'fluxo' | 'containers' | 'filiais' | 'cadastros' | 'apresentacao';

export default function App() {
  const { user, loading: authLoading, login, logout, loginLoading, error: authError } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(localStorage.getItem('selected_branch_id') || '');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [importingNfe, setImportingNfe] = useState(false);
  const [nfeContent, setNfeContent] = useState('');
  const [formData, setFormData] = useState<Partial<Entry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateError, setLastUpdateError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | number | null>(null);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState<(string | number)[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [notifications, setNotifications] = useState<{id: string, message: string, type: 'info' | 'warning' | 'error' | 'critical', persistent?: boolean}[]>([]);
  
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      return;
    }
    
    // Fetch user role from 'users' collection
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setUserRole(snapshot.data().role || 'user');
      } else {
        setUserRole('user');
      }
    });

    return () => unsubscribe();
  }, [user]);

  const isAdmin = userRole === 'admin' || (user?.email === 'massote1984@gmail.com' && user?.emailVerified);

  // Protect admin tabs
  useEffect(() => {
    if (userRole && !isAdmin && (activeTab === 'filiais' || activeTab === 'cadastros')) {
      setActiveTab('dashboard');
    }
  }, [userRole, isAdmin, activeTab]);

  const selectedBranch = branches.find(b => b.id === selectedBranchId);
  const isTitam = selectedBranch?.name?.toLowerCase().includes('titam') || false;
  const isVoltaRedonda = selectedBranch?.name?.toLowerCase().includes('volta redonda') || false;
  const brandPrimaryColor = '#B6D932';
  const brandDeepColor = '#1E3932';

  const isExitEntry = React.useCallback((e: Entry | Partial<Entry> | null | undefined) => {
    if (!e || !e.status) return false;
    const isEntryVR = e.branchId ? branches.find(b => b.id === e.branchId)?.name?.toLowerCase().includes('volta redonda') : isVoltaRedonda;
    if (isEntryVR && (e.status === 'Em descarga na Arcelor' || (e.status as any) === 'Em Descarga Arcelor')) {
      return true;
    }
    if (isTitam && e.descricao_produto && (e.descricao_produto === 'Bobina de Aço' || e.descricao_produto.toLowerCase().includes('bobina'))) {
      return e.status === 'Embarcado';
    }
    return ['Embarcado', 'Devolvido'].includes(e.status);
  }, [isTitam, branches, isVoltaRedonda]);

  const branchUsersSummary = React.useMemo(() => {
    if (!Array.isArray(entries) || !Array.isArray(branches)) return {};

    const summary: Record<string, { email: string; count: number; lastActivity: string }[]> = {};

    branches.forEach(branch => {
      const branchEntries = entries.filter(e => e.branchId === branch.id);
      const userMap: Record<string, { count: number; lastActivity: string }> = {};

      branchEntries.forEach(e => {
        const email = e.created_by_email || (e as any).email || 'Não especificado';
        let date = '';
        if (e.created_at) {
          date = typeof e.created_at === 'string' ? e.created_at : '';
        }
        
        if (!userMap[email]) {
          userMap[email] = { count: 1, lastActivity: date };
        } else {
          userMap[email].count += 1;
          if (date && date > userMap[email].lastActivity) {
            userMap[email].lastActivity = date;
          }
        }
      });

      summary[branch.id] = Object.entries(userMap).map(([email, info]) => ({
        email,
        count: info.count,
        lastActivity: info.lastActivity
      })).sort((a, b) => b.count - a.count);
    });

    return summary;
  }, [entries, branches]);

  const [nfAuditSearch, setNfAuditSearch] = useState('17745, 17743, 17741, 17727');

  const nfAuditResults = React.useMemo(() => {
    if (!Array.isArray(entries)) return [];

    const terms = nfAuditSearch
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (terms.length === 0) return [];

    return terms.map(term => {
      const matches = entries.filter(e => e.nf_numero && e.nf_numero.toString().trim() === term);

      if (matches.length === 0) {
        return {
          nf: term,
          found: false,
          currentStatus: 'Não encontrada',
          updatedAt: '-',
          updatedBy: '-',
          changedToday: false,
          branchName: '-'
        };
      }

      const sortedMatches = [...matches].sort((a, b) => {
        const getTs = (item: Entry) => {
          if (item.updated_at) {
            return typeof item.updated_at.toDate === 'function' ? item.updated_at.toDate().getTime() : new Date(item.updated_at).getTime();
          }
          if (item.created_at) {
            return typeof item.created_at.toDate === 'function' ? item.created_at.toDate().getTime() : new Date(item.created_at).getTime();
          }
          return 0;
        };
        return getTs(b) - getTs(a);
      });

      const primary = sortedMatches[0];
      const branch = branches.find(b => b.id === primary.branchId);
      const branchName = branch ? branch.name : 'Não especificado';

      let updatedAtStr = '-';
      let updatedBy = primary.updated_by_email || primary.created_by_email || 'Não especificado';
      let isUpdatedToday = false;

      let lastDate: Date | null = null;
      if (primary.updated_at) {
        lastDate = typeof primary.updated_at.toDate === 'function' ? primary.updated_at.toDate() : new Date(primary.updated_at);
      } else if (primary.created_at) {
        lastDate = typeof primary.created_at.toDate === 'function' ? primary.created_at.toDate() : new Date(primary.created_at);
      }

      if (lastDate && !isNaN(lastDate.getTime())) {
        updatedAtStr = lastDate.toLocaleString('pt-BR');

        const lastDateISOString = new Date(lastDate.getTime() - lastDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const today = new Date();
        const todayISOString = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];

        if (lastDateISOString === todayISOString) {
          isUpdatedToday = true;
        }
      }

      return {
        nf: term,
        found: true,
        currentStatus: primary.status,
        updatedAt: updatedAtStr,
        updatedBy,
        changedToday: isUpdatedToday,
        branchName,
        details: primary
      };
    });
  }, [entries, branches, nfAuditSearch]);

  const [auditBranchId, setAuditBranchId] = useState('all');
  const [auditDate, setAuditDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [auditStartTime, setAuditStartTime] = useState('11:30');
  const [auditEndTime, setAuditEndTime] = useState('12:30');

  const auditResults = React.useMemo(() => {
    if (!Array.isArray(entries) || !Array.isArray(branches)) return [];

    const results: {
      email: string;
      branchName: string;
      createdAtUTC: string;
      createdAtLocal: string;
      action: string;
      identifier: string;
    }[] = [];

    entries.forEach(e => {
      if (auditBranchId !== 'all' && e.branchId !== auditBranchId) return;

      const branch = branches.find(b => b.id === e.branchId);
      const branchName = branch ? branch.name : 'Não especificado';

      if (!e.created_at) return;
      
      let createdDate: Date;
      if (e.created_at && typeof e.created_at.toDate === 'function') {
        createdDate = e.created_at.toDate();
      } else {
        createdDate = new Date(e.created_at);
      }

      if (isNaN(createdDate.getTime())) return;

      const localISO = new Date(createdDate.getTime() - createdDate.getTimezoneOffset() * 60000).toISOString();
      const localDatePart = localISO.split('T')[0];

      if (auditDate && localDatePart !== auditDate) return;

      const localTimeStr = createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const [hours, minutes] = localTimeStr.split(':').map(Number);
      const minutesSinceMidnight = hours * 60 + minutes;

      const [startH, startM] = auditStartTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;

      const [endH, endM] = auditEndTime.split(':').map(Number);
      const endMinutes = endH * 60 + endM;

      if (minutesSinceMidnight < startMinutes || minutesSinceMidnight > endMinutes) return;

      const email = e.created_by_email || (e as any).email || 'Não especificado';
      
      results.push({
        email,
        branchName,
        createdAtUTC: createdDate.toISOString(),
        createdAtLocal: createdDate.toLocaleString('pt-BR'),
        action: `Lançamento de Registro (${e.status || 'Estoque'})`,
        identifier: `NF: ${e.nf_numero || '-'} | Container: ${e.container || '-'}`
      });
    });

    containers.forEach(c => {
      if (auditBranchId !== 'all' && c.branchId !== auditBranchId) return;

      const branch = branches.find(b => b.id === c.branchId);
      const branchName = branch ? branch.name : 'Não especificado';

      if (!c.updated_at) return;

      let createdDate: Date;
      if (c.updated_at && typeof c.updated_at.toDate === 'function') {
        createdDate = c.updated_at.toDate();
      } else {
        createdDate = new Date(c.updated_at);
      }

      if (isNaN(createdDate.getTime())) return;

      const localISO = new Date(createdDate.getTime() - createdDate.getTimezoneOffset() * 60000).toISOString();
      const localDatePart = localISO.split('T')[0];

      if (auditDate && localDatePart !== auditDate) return;

      const localTimeStr = createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const [hours, minutes] = localTimeStr.split(':').map(Number);
      const minutesSinceMidnight = hours * 60 + minutes;

      const [startH, startM] = auditStartTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;

      const [endH, endM] = auditEndTime.split(':').map(Number);
      const endMinutes = endH * 60 + endM;

      if (minutesSinceMidnight < startMinutes || minutesSinceMidnight > endMinutes) return;

      const email = c.updated_by_email || 'Não especificado';

      results.push({
        email,
        branchName,
        createdAtUTC: createdDate.toISOString(),
        createdAtLocal: createdDate.toLocaleString('pt-BR'),
        action: `Movimentação / Atualização de Container`,
        identifier: `Container: ${c.numero}`
      });
    });

    return results.sort((a, b) => b.createdAtUTC.localeCompare(a.createdAtUTC));
  }, [entries, containers, branches, auditBranchId, auditDate, auditStartTime, auditEndTime]);

  const getExitDate = React.useCallback((e: Entry | Partial<Entry> | null | undefined, includeDescargaFallback = false) => {
    if (!e) return '';
    const isBobina = e.descricao_produto && (e.descricao_produto === 'Bobina de Aço' || e.descricao_produto.toLowerCase().includes('bobina'));
    let date = '';
    if (isTitam && isBobina) {
      date = e.data_carregamento_rodoviario || e.data_posicionamento || e.data_faturamento_vli || '';
    } else {
      date = e.data_faturamento_vli || e.data_posicionamento || '';
    }
    const isVR = e.branchId ? branches.find(b => b.id === e.branchId)?.name?.toLowerCase().includes('volta redonda') : isVoltaRedonda;
    if (isVR && (e.status === 'Em descarga na Arcelor' || (e.status as any) === 'Em Descarga Arcelor')) {
      date = e.data_carregamento_rodoviario || '';
    }
    if (!date && includeDescargaFallback) {
      date = e.data_descarga || '';
    }
    return date;
  }, [isTitam, branches, isVoltaRedonda]);

  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dates = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(`${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`);
    }
    return dates;
  });
  const [editFormData, setEditFormData] = useState<Partial<Entry>>({});
  const [editingRegistration, setEditingRegistration] = useState<{id: string, type: 'suppliers' | 'transporters' | 'customers' | 'products' | 'destinations' | 'containers', data: any} | null>(null);
  const [containerRegMode, setContainerRegMode] = useState<'individual' | 'lote'>('individual');
  const [lastBatchId, setLastBatchId] = useState<string | null>(localStorage.getItem('last_import_batch'));
  const isSyncing = React.useRef(false);
  const [isSyncingState, setIsSyncingState] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [productDestSupplierFilter, setProductDestSupplierFilter] = useState<string>('');
  const [nfSearch, setNfSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [productFilter, setProductFilter] = useState<string>('all');

  const uniqueProducts = React.useMemo(() => {
    const products = new Set(entries.map(e => e.descricao_produto).filter(Boolean));
    products.add("Cal Dolomítico");
    products.add("Cal Calcítico");
    if (isTitam) {
      products.add("Bobina de Aço");
    }
    return Array.from(products).sort();
  }, [entries, isTitam]);

  useEffect(() => {
    if (selectedEntry) {
      const isVR = branches.find(b => b.id === selectedEntry.branchId)?.name?.toLowerCase().includes('volta redonda') || false;
      let status: any = selectedEntry.status;
      if (isVR && status) {
        if (status === 'Em descarga') status = 'Em descarga na Arcelor';
        if (status === 'Estoque') status = 'Estoque (Cheio Terminal)';
        if (status === 'Transito vazio' || status === 'Trânsito Vazio') status = 'Trânsito Vazio (Arcos)';
      }
      setEditFormData({
        ...selectedEntry,
        status,
        modal: selectedEntry.modal || (isVR ? 'Rodoviário' : undefined)
      });
    } else {
      setEditFormData({});
    }
  }, [selectedEntry, branches]);

  const addNotification = (message: string, type: 'info' | 'warning' | 'error' | 'critical' = 'info', persistent: boolean = false) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [{id, message, type, persistent}, ...prev]);
    if (!persistent && type !== 'critical') {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 8000); // Increased time for better visibility
    }
  };

  // Alertas Automáticos de Impacto (Filas Estouradas)
  useEffect(() => {
    // Se não for Titam e não for visualização geral, removemos alertas de impacto existentes
    // Isso garante que os alertas de "Impacto Crítico" da TITAM não apareçam quando o usuário seleciona outra filial
    if (!isTitam && selectedBranchId !== 'all') {
      setNotifications(prev => prev.filter(n => !n.id.startsWith('impact-')));
    }

    if (activeTab !== 'dashboard' || entries.length === 0) return;

    const checkQueueImpacts = () => {
      // Identifica IDs das filiais que são TITAM (Regra de alerta registrada apenas para TITAM)
      const titamBranchIds = new Set(
        branches
          .filter(b => b.name?.toLowerCase().includes('titam'))
          .map(b => b.id)
      );

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      
      const EXTERNA_LIMIT = 120; // 2 horas
      const INTERNA_LIMIT = 60; // 1 hora
      
      const newAlerts: {id: string, message: string}[] = [];
      
      entries.forEach(entry => {
        // Apenas para registros de hoje
        if (entry.data_descarga === today) {
          // Apenas para a filial TITAM (conforme regra de alerta cadastrada)
          if (!titamBranchIds.has(entry.branchId)) return;

          // Fila Externa: Chegou mas não entrou
          if (entry.hora_chegada && !entry.hora_entrada) {
            const [h, m] = entry.hora_chegada.split(':').map(Number);
            const diff = (currentH * 60 + currentM) - (h * 60 + m);
            
            if (diff > EXTERNA_LIMIT) {
              newAlerts.push({
                id: `impact-ext-${entry.uid || entry.nf_numero}`,
                message: `ALERTA: NF ${entry.nf_numero} na Fila Externa há ${Math.floor(diff/60)}h${diff%60}m. Impacto Crítico!`
              });
            }
          }
          
          // Fila Interna: Entrou mas não saiu
          if (entry.hora_entrada && !entry.hora_saida) {
            const [h, m] = entry.hora_entrada.split(':').map(Number);
            const diff = (currentH * 60 + currentM) - (h * 60 + m);
            
            if (diff > INTERNA_LIMIT) {
              newAlerts.push({
                id: `impact-int-${entry.uid || entry.nf_numero}`,
                message: `ALERTA: NF ${entry.nf_numero} na Fila Interna há ${Math.floor(diff/60)}h${diff%60}m. Impacto Crítico!`
              });
            }
          }
        }
      });
      
      // Adicionar apenas novos alertas
      if (newAlerts.length > 0) {
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const filteredNew = newAlerts.filter(a => !existingIds.has(a.id));
          
          if (filteredNew.length === 0) return prev;
          
          const added = filteredNew.map(a => ({
            id: a.id,
            message: a.message,
            type: 'critical' as const,
            persistent: true
          }));
          
          return [...added, ...prev];
        });
      }
    };

    const interval = setInterval(checkQueueImpacts, 60000); // Check every minute
    checkQueueImpacts();
    
    return () => clearInterval(interval);
  }, [entries, activeTab, branches, isTitam, selectedBranchId]);

  const triggerTestAlert = () => {
    const alerts = isVoltaRedonda ? [
      { msg: "ALERTA CRÍTICO: Estoque (Cheio Terminal) de Cal Calcítico em Volta Redonda está abaixo do esperado!", type: 'critical' },
      { msg: "AVISO: Caminhões aguardando descarga na Arcelor.", type: 'warning' },
      { msg: "NOTIFICAÇÃO: Sincronização de Volta Redonda concluída com sucesso.", type: 'info' },
      { msg: "ERRO: Falha na sincronização de dados de Volta Redonda.", type: 'error' }
    ] : [
      { msg: "ALERTA CRÍTICO: Estoque de Cal Dolomítico (Serra-ES) está abaixo do limite mínimo (150t)!", type: 'critical' },
      { msg: "AVISO: 3 novos caminhões aguardando na portaria.", type: 'warning' },
      { msg: "NOTIFICAÇÃO: Sincronização concluída com sucesso.", type: 'info' },
      { msg: "ERRO: Falha na conexão com o banco de dados central.", type: 'error' }
    ];
    const alert = alerts[Math.floor(Math.random() * alerts.length)];
    addNotification(alert.msg, alert.type as any, alert.type === 'critical');
  };

  const exportBackup = () => {
    const data = {
      entries,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `titam_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    addNotification("Backup exportado com sucesso!", "info");
  };

  const exportDashboardPDF = async () => {
    const dashboardElement = document.getElementById('dashboard-content');
    if (!dashboardElement) {
      addNotification("Dashboard não encontrado para exportação.", "error");
      return;
    }

    addNotification("Iniciando exportação completa...", "info");
    
    try {
      // Ensure we're at the top for capture
      window.scrollTo({ top: 0, behavior: 'instant' });
      
      // Wait a bit for layout to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use html-to-image
      const imgData = await htmlToImage.toJpeg(dashboardElement, {
        quality: 0.7, // Slightly lower quality for better multi-page handling
        backgroundColor: '#F8F9FA',
        pixelRatio: 1.2, // Slightly lower pixel ratio for better multi-page handling
        style: {
          padding: '20px',
          height: 'auto',
          overflow: 'visible',
          transform: 'none',
          animation: 'none',
          transition: 'none'
        }
      });
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const img = new Image();
      img.src = imgData;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const imgWidth = pageWidth;
      const imgHeight = (img.height * pageWidth) / img.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      // Add subsequent pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      
      pdf.save(`titam_dashboard_${new Date().getTime()}.pdf`);
      addNotification("PDF exportado com sucesso!", "info");
    } catch (error: any) {
      console.error("PDF Export Error:", error);
      addNotification(`Erro na exportação: ${error.message || 'Falha técnica'}`, "error");
    }
  };

  const undoLastImport = async () => {
    if (!user) return;
    
    try {
      setIsProcessing(true);
      if (!lastBatchId) {
        addNotification("Nenhuma importação recente encontrada para desfazer.", "warning");
        return;
      }

      const q = query(collection(db, 'entries'), where('import_batch', '==', lastBatchId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        addNotification("Nenhum registro encontrado para esta importação.", "info");
        setLastBatchId(null);
        localStorage.removeItem('last_import_batch');
        return;
      }

      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      addNotification(`${snapshot.size} registros excluídos com sucesso.`, "info");
      setLastBatchId(null);
      localStorage.removeItem('last_import_batch');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'entries', user);
      addNotification(`Erro ao desfazer importação: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const fileContent = event.target?.result;
        let entriesToImport: any[] = [];

        if (file.name.endsWith('.json')) {
          const json = JSON.parse(fileContent as string);
          if (json.entries && Array.isArray(json.entries)) {
            entriesToImport = json.entries;
          }
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(fileContent, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const excelData = XLSX.utils.sheet_to_json(worksheet);
          
          // Map Excel columns to Entry fields (basic mapping, can be refined)
          entriesToImport = excelData.map((row: any) => ({
            mes: row.Mês || row.mes || row.MES || row.Mes || '',
            chave_acesso: row['Chave de Acesso'] || row.chave_acesso || row.CHAVE || row.Chave || '',
            nf_numero: row['Número NF'] || row.nf_numero || row.NF || row['N.F'] || row.Nf || '',
            tonelada: Number(row.Tonelada || row.tonelada || row.TONELADA || row.Peso || 0),
            valor: Number(row.Valor || row.valor || row.VALOR || row.Preço || 0),
            descricao_produto: row.Produto || row.descricao_produto || row.PRODUTO || row.Descricao || '',
            data_nf: row['Data NF'] || row.data_nf || row['DATA NF'] || row.Data || '',
            data_descarga: row['Data Descarga'] || row.data_descarga || row['DATA DESCARGA'] || row.Descarga || '',
            data_posicionamento: row['Data Posicionamento'] || row.data_posicionamento || row['Data Embarque'] || row.data_embarque || row['DATA EMBARQUE'] || row.Embarque || '',
            data_faturamento_vli: row['Data Fat. VLI'] || row.data_faturamento_vli || row['DATA FATURAMENTO'] || '',
            horario_posicionamento: row['Horário Posicionamento'] || row.horario_posicionamento || '',
            horario_faturamento: row['Horário Faturamento'] || row.horario_faturamento || row['CTE VLI'] || row.cte_vli || '',
            numero_vagao: row['Nº Vagão'] || row.numero_vagao || row.Vagao || '',
            hora_chegada: row['Hora Chegada'] || row.hora_chegada || '',
            hora_entrada: row['Hora Entrada'] || row.hora_entrada || '',
            hora_saida: row['Hora Saída'] || row.hora_saida || '',
            data_emissao_nf: row['Data Emissão NF'] || row.data_emissao_nf || '',
            cte_intertex: row['CTE Intertex'] || row.cte_intertex || '',
            data_emissao_cte: row['Data Emissão CTE'] || row.data_emissao_cte || '',
            data_emissao_cte_transp: row['Data Emissão CTE Transp.'] || row.data_emissao_cte_transp || '',
            cte_transportador: row['CTE Transportador'] || row.cte_transportador || '',
            status: row.Status || row.status || row.STATUS || 'Estoque',
            fornecedor: row.Fornecedor || row.fornecedor || row.FORNECEDOR || '',
            placa_veiculo: row.Placa || row.placa_veiculo || row.PLACA || '',
            container: row.Container || row.container || row.CONTAINER || '',
            destino: row.Destino || row.destino || row.DESTINO || '',
            created_at: new Date().toISOString()
          }));
        }

        if (entriesToImport.length > 0) {
          const batchId = `batch_${Date.now()}`;
          setLastBatchId(batchId);
          localStorage.setItem('last_import_batch', batchId);

          if (user) {
            addNotification(`${entriesToImport.length} registros importados. Sincronizando com Firestore...`, "info");
            const activeBranchIsVR = branches.find(b => b.id === selectedBranchId)?.name?.toLowerCase().includes('volta redonda') || false;
            Promise.all(entriesToImport.map(ent => {
              const { id, isPending, ...data } = ent;
              let finalStatus = data.status || 'Estoque';
              if (activeBranchIsVR) {
                if (finalStatus === 'Em descarga') finalStatus = 'Em descarga na Arcelor';
                if (finalStatus === 'Estoque') finalStatus = 'Estoque (Cheio Terminal)';
                if (finalStatus === 'Transito vazio' || finalStatus === 'Trânsito Vazio') finalStatus = 'Trânsito Vazio (Arcos)';
              }
              return addDoc(collection(db, 'entries'), {
                ...data,
                status: finalStatus,
                branchId: data.branchId || (selectedBranchId !== 'all' ? selectedBranchId : null),
                import_batch: batchId,
                uid: user.uid,
                created_at: serverTimestamp()
              });
            })).then(() => {
              addNotification("Importação concluída com sucesso!", "info");
            }).catch(error => {
              handleFirestoreError(error, OperationType.CREATE, 'entries', user);
              addNotification("Erro ao sincronizar alguns registros importados.", "error");
            });
          }
        } else {
          addNotification("Nenhum dado válido encontrado no arquivo.", "warning");
        }
      } catch (err) {
        addNotification("Erro ao importar arquivo. Verifique o formato.", "error");
      }
    };

    if (file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Fetch Branches
    const qBranches = query(collection(db, 'branches'), orderBy('name', 'asc'));
    const unsubscribeBranches = onSnapshot(qBranches, (snapshot) => {
      const branchesData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Branch[];
      setBranches(branchesData);
      
      // Auto-select first branch if none selected
      if (branchesData.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branchesData[0].id);
        localStorage.setItem('selected_branch_id', branchesData[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'branches', user);
    });

    // Fetch Entries (filtered by branch if selected)
    let qEntries = query(collection(db, 'entries'), orderBy('created_at', 'desc'));
    if (selectedBranchId && selectedBranchId !== 'all') {
      qEntries = query(collection(db, 'entries'), where('branchId', '==', selectedBranchId), orderBy('created_at', 'desc'));
    }
    
    const unsubscribeEntries = onSnapshot(qEntries, (snapshot) => {
      const entriesData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at
      })) as Entry[];
      
      setEntries(entriesData);
      setLoading(false);
      setServerStatus('online');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'entries', user);
      setServerStatus('offline');
      setLoading(false);
    });

    // Fetch Containers (filtered by branch if selected)
    let qContainers = query(collection(db, 'containers'), orderBy('numero', 'asc'));
    if (selectedBranchId && selectedBranchId !== 'all') {
      qContainers = query(collection(db, 'containers'), where('branchId', '==', selectedBranchId), orderBy('numero', 'asc'));
    }

    const unsubscribeContainers = onSnapshot(qContainers, (snapshot) => {
      const containersData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        updated_at: doc.data().updated_at instanceof Timestamp ? doc.data().updated_at.toDate().toISOString() : doc.data().updated_at
      })) as Container[];
      
      setContainers(containersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'containers', user);
    });

    // Fetch Suppliers
    const qSuppliers = query(collection(db, 'suppliers'), orderBy('name', 'asc'));
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'suppliers', user));

    // Fetch Transporters
    const qTransporters = query(collection(db, 'transporters'), orderBy('name', 'asc'));
    const unsubscribeTransporters = onSnapshot(qTransporters, (snapshot) => {
      setTransporters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transporters', user));

    // Fetch Customers
    const qCustomers = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customers', user));

    // Fetch Products
    const qProducts = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products', user));

    // Fetch Destinations
    const qDestinations = query(collection(db, 'destinations'), orderBy('name', 'asc'));
    const unsubscribeDestinations = onSnapshot(qDestinations, (snapshot) => {
      setDestinations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'destinations', user));

    return () => {
      unsubscribeBranches();
      unsubscribeEntries();
      unsubscribeContainers();
      unsubscribeSuppliers();
      unsubscribeTransporters();
      unsubscribeCustomers();
      unsubscribeProducts();
      unsubscribeDestinations();
    };
  }, [user, selectedBranchId]);

  useEffect(() => {
    setTimeout(() => {
      addNotification("Bem-vindo ao Sistema Titam! O monitoramento de estoque está ativo.", "info");
    }, 1500);

    return () => {
    };
  }, []);

  const calculateTimeInMinutes = (start?: string, end?: string) => {
    if (!start || !end) return 0;
    try {
      const [h1, m1] = start.split(':').map(Number);
      const [h2, m2] = end.split(':').map(Number);
      const d1 = new Date(2000, 0, 1, h1, m1);
      const d2 = new Date(2000, 0, 1, h2, m2);
      let diff = (d2.getTime() - d1.getTime()) / 1000 / 60;
      if (diff < 0) diff += 24 * 60;
      return diff;
    } catch (e) {
      return 0;
    }
  };

  const filteredEntriesForDashboard = React.useMemo(() => {
    if (!Array.isArray(entries)) return [];
    let filtered = entries;
    
    if (productFilter !== 'all') {
      filtered = filtered.filter(e => e && e.descricao_produto === productFilter);
    }
    
    if (nfSearch) {
      const search = nfSearch.toLowerCase();
      filtered = filtered.filter(e => 
        e && (
          (e.nf_numero && e.nf_numero.toString().includes(search)) ||
          (e.fornecedor && e.fornecedor.toLowerCase().includes(search)) ||
          (e.descricao_produto && e.descricao_produto.toLowerCase().includes(search)) ||
          (e.destino && e.destino.toLowerCase().includes(search))
        )
      );
    }
    
    return filtered;
  }, [entries, productFilter, nfSearch]);

  const filteredEntriesByProduct = React.useMemo(() => {
    if (productFilter === 'all') return entries;
    return entries.filter(e => e && e.descricao_produto === productFilter);
  }, [entries, productFilter]);

  const performanceChartData = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    
    const validEntries = filteredEntriesForDashboard.filter(e => 
      e && e.hora_chegada && e.hora_saida && e.data_descarga && selectedDates.includes(e.data_descarga)
    );

    if (selectedDates.length > 7) {
      const dateMap: Record<string, { label: string, rawDate: string, total: number, descarga: number, count: number }> = {};
      selectedDates.forEach(d => {
        dateMap[d] = { 
          label: new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          rawDate: d,
          total: 0, 
          descarga: 0, 
          count: 0 
        };
      });

      validEntries.forEach(e => {
        const d = e.data_descarga!;
        dateMap[d].total += calculateTimeInMinutes(e.hora_chegada, e.hora_saida);
        dateMap[d].descarga += calculateTimeInMinutes(e.hora_entrada, e.hora_saida);
        dateMap[d].count += 1;
      });

      return Object.values(dateMap)
        .filter(d => d.count > 0)
        .map(d => ({
          label: d.label,
          total: Math.round(d.total / d.count),
          descarga: Math.round(d.descarga / d.count)
        }))
        .sort((a: any, b: any) => a.label.localeCompare(b.label));
    }

    return validEntries.map(e => ({
      label: `NF ${e.nf_numero || '-'}`,
      total: calculateTimeInMinutes(e.hora_chegada, e.hora_saida),
      descarga: calculateTimeInMinutes(e.hora_entrada, e.hora_saida)
    }));
  }, [filteredEntriesForDashboard, selectedDates]);

  const queueVolumeData = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    
    if (selectedDates.length === 1) {
      const date = selectedDates[0];
      const hourlyData = Array.from({ length: 16 }, (_, i) => {
        const h = i + 6;
        return {
          label: `${h.toString().padStart(2, '0')}:00`,
          externa: 0,
          interna: 0,
          concluidos: 0
        };
      });

      filteredEntriesForDashboard.forEach(e => {
        if (e.data_descarga !== date) return;
        
        for (let i = 0; i < 16; i++) {
          const h = i + 6;
          const hourStart = `${h.toString().padStart(2, '0')}:00`;
          const hourEnd = `${(h + 1).toString().padStart(2, '0')}:00`;
          
          if (e.hora_chegada && e.hora_chegada < hourEnd && (!e.hora_entrada || e.hora_entrada > hourStart)) {
            hourlyData[i].externa += 1;
          }
          if (e.hora_entrada && e.hora_entrada < hourEnd && (!e.hora_saida || e.hora_saida > hourStart)) {
            hourlyData[i].interna += 1;
          }
          if (e.hora_saida && e.hora_saida >= hourStart && e.hora_saida < hourEnd) {
            hourlyData[i].concluidos += 1;
          }
        }
      });

      // Filter to show only hours up to now if the selected date is today
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const currentHour = now.getHours();

      if (date === todayStr) {
        return hourlyData.filter((_, i) => (i + 6) <= currentHour);
      }

      return hourlyData;
    } else {
      const volumeMap: Record<string, any> = {};
      selectedDates.forEach(date => {
        volumeMap[date] = { 
          label: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), 
          rawDate: date,
          externa: 0, 
          interna: 0, 
          concluidos: 0 
        };
      });

      filteredEntriesForDashboard.forEach(e => {
        const date = e.data_descarga;
        if (!date || !selectedDates.includes(date)) return;

        if (e.hora_chegada) volumeMap[date].externa += 1;
        if (e.hora_entrada) volumeMap[date].interna += 1;
        if (e.hora_saida) volumeMap[date].concluidos += 1;
      });

      return Object.values(volumeMap).sort((a: any, b: any) => a.rawDate.localeCompare(b.rawDate));
    }
  }, [filteredEntriesForDashboard, selectedDates]);

  const performanceAverages = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return { avgTotal: 0, avgDescarga: 0 };
    const validEntries = filteredEntriesForDashboard.filter(e => 
      e && e.hora_chegada && e.hora_saida && e.data_descarga && selectedDates.includes(e.data_descarga)
    );
    if (validEntries.length === 0) return { avgTotal: 0, avgDescarga: 0 };
    
    const totalSum = validEntries.reduce((acc, e) => acc + calculateTimeInMinutes(e.hora_chegada, e.hora_saida), 0);
    const descargaSum = validEntries.reduce((acc, e) => acc + calculateTimeInMinutes(e.hora_entrada, e.hora_saida), 0);
    
    return {
      avgTotal: Math.round(totalSum / validEntries.length),
      avgDescarga: Math.round(descargaSum / validEntries.length)
    };
  }, [filteredEntriesForDashboard, selectedDates]);

  const summary = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    let suppliers = [...new Set(filteredEntriesForDashboard.filter(e => e && e.fornecedor).map(e => e.fornecedor))];
    
    if (supplierFilter) {
      suppliers = suppliers.filter(s => s.toLowerCase().includes(supplierFilter.toLowerCase()));
    }

    return suppliers.map(s => {
      const supplierEntries = filteredEntriesForDashboard.filter(e => e && e.fornecedor === s);
      const getVal = (e: any) => e.descricao_produto === 'Minério de Ferro' ? (Number(e.tonelada) || 0) : 1;
      
      return {
        fornecedor: s,
        estoque: Math.round(supplierEntries.filter(e => e && (e.status === 'Estoque' || e.status === 'Estoque (Cheio Terminal)')).reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        vazio_terminal: Math.round(supplierEntries.filter(e => e && e.status === 'Vazio Terminal').reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        transito_vazio: Math.round(supplierEntries.filter(e => e && (e.status === 'Transito vazio' || e.status === 'Trânsito Vazio (Arcos)')).reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        em_descarga: Math.round(supplierEntries.filter(e => e && (e.status === 'Em descarga' || (e.status as any) === 'Em Descarga Arcelor' || e.status === 'Em descarga na Arcelor')).reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        rejeitado: Math.round(supplierEntries.filter(e => e && e.status === 'Rejeitado').reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        transito_cheio: Math.round(supplierEntries.filter(e => e && e.status === 'Trânsito Cheio').reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        embarcado: Math.round(supplierEntries.filter(e => e && e.status === 'Embarcado').reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        devolvido: Math.round(supplierEntries.filter(e => e && e.status === 'Devolvido').reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        total: Math.round(supplierEntries.reduce((sum, e) => sum + getVal(e), 0) * 100) / 100
      };
    });
  }, [filteredEntriesForDashboard, supplierFilter]);

  const productDestSummary = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    
    let filteredEntries = filteredEntriesForDashboard;
    if (productDestSupplierFilter) {
      filteredEntries = filteredEntriesForDashboard.filter(e => e && e.fornecedor && e.fornecedor.toLowerCase().includes(productDestSupplierFilter.toLowerCase()));
    }

    const productDests = [...new Set(filteredEntries.filter(e => e && e.descricao_produto && e.destino).map(e => `${e.descricao_produto}|${e.destino}`))];
    return productDests.map(pd => {
      const [prod, dest] = (pd as string).split('|');
      const filtered = filteredEntries.filter(e => e && e.descricao_produto === prod && e.destino === dest);
      const getVal = (e: any) => prod === 'Minério de Ferro' ? (Number(e.tonelada) || 0) : 1;
      
      return {
        descricao_produto: prod,
        destino: dest,
        estoque: Math.round(filtered.filter(e => e && (e.status === 'Estoque' || e.status === 'Estoque (Cheio Terminal)')).reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        vazio_terminal: Math.round(filtered.filter(e => e && e.status === 'Vazio Terminal').reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        transito_vazio: Math.round(filtered.filter(e => e && (e.status === 'Transito vazio' || e.status === 'Trânsito Vazio (Arcos)')).reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        em_descarga: Math.round(filtered.filter(e => e && (e.status === 'Em descarga' || (e.status as any) === 'Em Descarga Arcelor' || e.status === 'Em descarga na Arcelor')).reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        rejeitado: Math.round(filtered.filter(e => e && e.status === 'Rejeitado').reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        transito_cheio: Math.round(filtered.filter(e => e && e.status === 'Trânsito Cheio').reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        embarcado: Math.round(filtered.filter(e => e && e.status === 'Embarcado').reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        devolvido: Math.round(filtered.filter(e => e && e.status === 'Devolvido').reduce((sum, e) => sum + getVal(e), 0) * 100) / 100,
        total: Math.round(filtered.reduce((sum, e) => sum + getVal(e), 0) * 100) / 100
      };
    });
  }, [filteredEntriesForDashboard, productDestSupplierFilter]);

  const supplierStockByDate = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    const filtered = filteredEntriesForDashboard.filter(e => e && (e.status === 'Estoque' || e.status === 'Estoque (Cheio Terminal)') && e.data_descarga && selectedDates.includes(e.data_descarga));
    const supplierMap: Record<string, { total: number, tons: number, products: Record<string, { count: number, tons: number }> }> = {};
    filtered.forEach(e => {
      if (e.fornecedor) {
        if (!supplierMap[e.fornecedor]) {
          supplierMap[e.fornecedor] = { total: 0, tons: 0, products: {} };
        }
        supplierMap[e.fornecedor].total += 1;
        supplierMap[e.fornecedor].tons += (e.tonelada || 0);
        const product = e.descricao_produto || 'Não especificado';
        if (!supplierMap[e.fornecedor].products[product]) {
          supplierMap[e.fornecedor].products[product] = { count: 0, tons: 0 };
        }
        supplierMap[e.fornecedor].products[product].count += 1;
        supplierMap[e.fornecedor].products[product].tons += (e.tonelada || 0);
      }
    });
    return Object.entries(supplierMap).map(([name, data]) => ({ 
      name, 
      count: data.total,
      tons: data.tons,
      products: Object.entries(data.products).map(([pName, pData]) => ({ name: pName, count: pData.count, tons: pData.tons }))
    }));
  }, [filteredEntriesForDashboard, selectedDates]);

  const productStockByDate = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    const filtered = filteredEntriesForDashboard.filter(e => e && (e.status === 'Estoque' || e.status === 'Estoque (Cheio Terminal)') && e.data_descarga && selectedDates.includes(e.data_descarga));
    
    // Initialize with mandatory products to ensure they always show up
    const productMap: Record<string, { count: number, tons: number }> = {
      "Cal Dolomítico": { count: 0, tons: 0 },
      "Cal Calcítico": { count: 0, tons: 0 }
    };
    
    if (isTitam) {
      productMap["Bobina de Aço"] = { count: 0, tons: 0 };
    }

    filtered.forEach(e => {
      const product = e.descricao_produto || 'Não especificado';
      if (!productMap[product]) {
        productMap[product] = { count: 0, tons: 0 };
      }
      productMap[product].count += 1;
      productMap[product].tons += (e.tonelada || 0);
    });
    
    // Filter out 0 counts for other products, but maybe keep the main ones?
    // User wants to "constar a bobina de aço também", which implies visibility.
    return Object.entries(productMap)
      .map(([name, data]) => ({ name, count: data.count, tons: data.tons }))
      .filter(p => p.count > 0 || ["Cal Dolomítico", "Cal Calcítico", "Bobina de Aço"].includes(p.name));
  }, [filteredEntriesForDashboard, selectedDates, isTitam]);

  const dailyStats = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return { in_stock: 0, exited: 0, suppliers: 0 };
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    
    const arrivals = filteredEntriesForDashboard.filter(e => e && e.data_descarga && selectedDates.includes(e.data_descarga));
    const exits = filteredEntriesForDashboard.filter(e => {
      if (!e || !isExitEntry(e)) return false;
      const exitDate = getExitDate(e);
      return exitDate && selectedDates.includes(exitDate);
    });

    const queue_external = filteredEntriesForDashboard.filter(e => e && e.hora_chegada && !e.hora_entrada && e.data_descarga && selectedDates.includes(e.data_descarga)).length;
    const queue_internal = filteredEntriesForDashboard.filter(e => e && e.hora_entrada && !e.hora_saida && e.data_descarga && selectedDates.includes(e.data_descarga)).length;
    const queue_exit = filteredEntriesForDashboard.filter(e => e && e.hora_saida && e.data_descarga && selectedDates.includes(e.data_descarga)).length;
    
    const queue_external_exceeded = filteredEntriesForDashboard.filter(e => {
      if (!e || !e.hora_chegada || e.hora_entrada || e.data_descarga !== today) return false;
      const [h, m] = e.hora_chegada.split(':').map(Number);
      const diff = (currentH * 60 + currentM) - (h * 60 + m);
      return diff > 120;
    }).length;

    const queue_internal_exceeded = filteredEntriesForDashboard.filter(e => {
      if (!e || !e.hora_entrada || e.hora_saida || e.data_descarga !== today) return false;
      const [h, m] = e.hora_entrada.split(':').map(Number);
      const diff = (currentH * 60 + currentM) - (h * 60 + m);
      return diff > 60;
    }).length;

    return {
      arrival_count: arrivals.length,
      arrival_tons: arrivals.reduce((acc, e) => acc + (e.tonelada || 0), 0),
      in_stock: arrivals.filter(e => e && ['Estoque', 'Estoque (Cheio Terminal)', 'Rejeitado'].includes(e.status)).length,
      exited: exits.length,
      suppliers: [...new Set(arrivals.filter(e => e && e.fornecedor).map(e => e.fornecedor))].length,
      exited_tons: exits.reduce((acc, e) => acc + (e.tonelada || 0), 0),
      queue_external,
      queue_internal,
      queue_exit,
      queue_external_exceeded,
      queue_internal_exceeded
    };
  }, [filteredEntriesForDashboard, selectedDates, isExitEntry, getExitDate]);

  const monthlyExitTotal = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return 0;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    return filteredEntriesForDashboard
      .filter(e => {
        if (!e || !isExitEntry(e)) return false;
        
        // Prioritize appropriate exit dates dynamically
        const exitDate = getExitDate(e, true);
        if (!exitDate) return false;
        
        let y, m;
        if (exitDate.includes('-')) {
          const parts = exitDate.split('-');
          if (parts.length >= 2) {
            y = Number(parts[0]);
            m = Number(parts[1]);
          }
        } else if (exitDate.includes('/')) {
          const parts = exitDate.split('/');
          if (parts.length === 3) {
            y = Number(parts[2]);
            m = Number(parts[1]);
          }
        }
        
        return y === currentYear && m === currentMonth;
      }).length;
  }, [filteredEntriesForDashboard, isExitEntry, getExitDate]);

  const exitChartData = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    const dailyMap: Record<string, any> = {};
    
    const exitedEntries = filteredEntriesForDashboard.filter(entry => {
      if (!entry) return false;
      const isExited = isExitEntry(entry);
      if (!isExited) return false;
      
      const arrivedOnSelected = selectedDates.includes(entry.data_descarga);
      const exitDate = getExitDate(entry);
      const exitedOnSelected = exitDate && selectedDates.includes(exitDate);
      
      return arrivedOnSelected || exitedOnSelected;
    });

    const chartDates = new Set<string>(selectedDates);
    exitedEntries.forEach(entry => {
      // Prioritize appropriate exit dates dynamically
      const exitDate = getExitDate(entry, true);
      if (exitDate) chartDates.add(exitDate);
    });

    const sortedDates = Array.from(chartDates).sort();
    
    sortedDates.forEach(date => {
      dailyMap[date] = { date };
    });

    exitedEntries.forEach(entry => {
      // Prioritize appropriate exit dates dynamically
      const exitDate = getExitDate(entry, true);
      const key = `${entry.descricao_produto} - ${entry.destino}`;
      if (exitDate && dailyMap[exitDate]) {
        if (!dailyMap[exitDate][key]) {
          dailyMap[exitDate][key] = 0;
          dailyMap[exitDate][`${key}_tons`] = 0;
        }
        dailyMap[exitDate][key] += 1;
        dailyMap[exitDate][`${key}_tons`] += (entry.tonelada || 0);
      }
    });

    return Object.values(dailyMap);
  }, [filteredEntriesForDashboard, selectedDates, isExitEntry, getExitDate]);

  const exitChartKeys = React.useMemo(() => {
    const keys = new Set<string>();
    filteredEntriesForDashboard.forEach(entry => {
      if (isExitEntry(entry)) {
        keys.add(`${entry.descricao_produto} - ${entry.destino}`);
      }
    });
    return Array.from(keys);
  }, [filteredEntriesForDashboard, isExitEntry]);

  const selectedPeriodExitsSummary = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    
    const summaryMap: Record<string, { 
      destination: string, 
      products: Record<string, { count: number, tons: number }> 
    }> = {};

    filteredEntriesForDashboard.forEach(e => {
      if (!e || !isExitEntry(e)) return;
      const exitDate = getExitDate(e);
      if (!exitDate || !selectedDates.includes(exitDate)) return;
      
      const dest = e.destino || 'Não especificado';
      if (!summaryMap[dest]) {
        summaryMap[dest] = { destination: dest, products: {} };
      }
      
      const prod = e.descricao_produto || 'Não especificado';
      if (!summaryMap[dest].products[prod]) {
        summaryMap[dest].products[prod] = { count: 0, tons: 0 };
      }
      
      summaryMap[dest].products[prod].count += 1;
      summaryMap[dest].products[prod].tons += (e.tonelada || 0);
    });

    return Object.values(summaryMap).sort((a, b) => a.destination.localeCompare(b.destination));
  }, [filteredEntriesForDashboard, selectedDates, isExitEntry, getExitDate]);

  const monthlyAccumulatedExits = React.useMemo(() => {
    if (!Array.isArray(entries)) return [];
    
    const monthlyMap: Record<string, { 
      month: string, 
      destinations: Record<string, { 
        products: Record<string, { count: number, tons: number }> 
      }> 
    }> = {};

    entries.forEach(e => {
      if (!e || !isExitEntry(e)) return;
      
      const exitDate = getExitDate(e, true);
      
      if (!exitDate) return;
      
      // Handle both YYYY-MM-DD and DD/MM/YYYY formats
      let year, month;
      if (exitDate.includes('-')) {
        [year, month] = exitDate.split('-');
      } else if (exitDate.includes('/')) {
        const parts = exitDate.split('/');
        if (parts.length === 3) {
          // Assume DD/MM/YYYY
          year = parts[2];
          month = parts[1];
        }
      }
      
      if (!year || !month) return;
      const monthKey = `${year}-${month.padStart(2, '0')}`;
      
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { month: monthKey, destinations: {} };
      }
      
      const dest = e.destino || 'Não especificado';
      if (!monthlyMap[monthKey].destinations[dest]) {
        monthlyMap[monthKey].destinations[dest] = { products: {} };
      }
      
      const prod = e.descricao_produto || 'Não especificado';
      if (!monthlyMap[monthKey].destinations[dest].products[prod]) {
        monthlyMap[monthKey].destinations[dest].products[prod] = { count: 0, tons: 0 };
      }
      
      monthlyMap[monthKey].destinations[dest].products[prod].count += 1;
      monthlyMap[monthKey].destinations[dest].products[prod].tons += (e.tonelada || 0);
    });

    return Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month));
  }, [entries, isTitam, isExitEntry, getExitDate]);

  const getMonthName = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      let date;
      if (dateStr.includes('-')) {
        date = new Date(dateStr + 'T12:00:00');
      } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
        }
      }
      
      if (!date || isNaN(date.getTime())) return '';
      
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        .replace(/^\w/, (c) => c.toUpperCase());
    } catch (e) {
      return '';
    }
  };

  const isValidContainerNumberForDuplicateCheck = (num?: string) => {
    if (!num) return false;
    const clean = num.trim().toUpperCase();
    if (
      clean === '' || 
      clean === '-' || 
      clean === 'S/N' || 
      clean === 'S/C' || 
      clean === 'N/A' || 
      clean === 'SEM CONTAINER' || 
      clean === 'SEM CONTEINER' || 
      clean === 'N/D' || 
      clean === 'N/O' ||
      clean.length < 4
    ) {
      return false;
    }
    return true;
  };

  const handleCreateEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    if (!selectedBranchId || selectedBranchId === 'all') {
      addNotification("Selecione uma filial ativa antes de cadastrar registros.", "warning");
      return;
    }

    setIsSaving(true);
    const formDataObj = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formDataObj.entries());
    
    // Check for duplicate NF per supplier
    const nf = rawData.nf_numero?.toString().trim();
    const fornecedor = rawData.fornecedor?.toString().trim();
    if (nf && fornecedor) {
      const isDuplicate = entries.some(entry => 
        entry.nf_numero && 
        entry.nf_numero.toString().trim() === nf && 
        entry.fornecedor?.toString().trim().toLowerCase() === fornecedor.toLowerCase()
      );
      
      if (isDuplicate) {
        addNotification(`A Nota Fiscal ${nf} já está cadastrada para o fornecedor ${fornecedor}!`, "error");
        setIsSaving(false);
        return;
      }
    }

    let finalStatus = rawData.status?.toString() || '';
    if (isVoltaRedonda && finalStatus) {
      if (finalStatus === 'Em descarga') finalStatus = 'Em descarga na Arcelor';
      if (finalStatus === 'Estoque') finalStatus = 'Estoque (Cheio Terminal)';
      if (finalStatus === 'Transito vazio' || finalStatus === 'Trânsito Vazio') finalStatus = 'Trânsito Vazio (Arcos)';
    }

    // Business rule: Titam branch cannot have duplicate containers in "Estoque" status for different NFs
    const entryBranch = branches.find(b => b.id === selectedBranchId);
    const isFromTitam = entryBranch?.name?.toLowerCase().includes('titam');
    const targetStatus = finalStatus || 'Estoque';
    const containerNum = rawData.container?.toString().trim().toUpperCase();

    if (isFromTitam && targetStatus === 'Estoque' && isValidContainerNumberForDuplicateCheck(containerNum)) {
      const hasDuplicateContainer = entries.some(entry => {
        const eb = branches.find(b => b.id === entry.branchId);
        const entryIsTitam = eb?.name?.toLowerCase().includes('titam');
        return (
          entryIsTitam &&
          entry.status === 'Estoque' &&
          entry.container?.toString().trim().toUpperCase() === containerNum &&
          entry.nf_numero?.toString().trim().toUpperCase() !== nf?.toUpperCase()
        );
      });
      
      if (hasDuplicateContainer) {
        addNotification("O container já foi usado.", "error");
        setIsSaving(false);
        return;
      }
    }

    const sanitizeNumeric = (val: any) => {
      if (val === undefined || val === null) return 0;
      if (typeof val !== 'string') return val;
      const sanitized = val.replace(/\./g, '').replace(',', '.');
      return parseFloat(sanitized) || 0;
    };

    const data: any = {
      ...rawData,
      status: finalStatus || (isVoltaRedonda ? 'Trânsito Cheio' : 'Estoque'),
      valor: sanitizeNumeric(rawData.valor),
      tonelada: sanitizeNumeric(rawData.tonelada),
      branchId: selectedBranchId,
      uid: user.uid,
      created_by_email: user.email || 'Usuário',
      created_at: serverTimestamp()
    };
    
    try {
      const docRef = await addDoc(collection(db, 'entries'), data);
      
      // Tentar disparar integração se já for criado como Embarcado
      if (data.status === 'Embarcado') {
        await triggerIntegration(docRef.id, data);
      }

      addNotification("Registro salvo com sucesso!", "info");
      setShowForm(false);
      setFormData({});
    } catch (error) {
      console.error("Error saving entry:", error);
      addNotification("Erro ao salvar registro: " + (error instanceof Error ? error.message : "Erro desconhecido"), "error");
      try {
        handleFirestoreError(error, OperationType.CREATE, 'entries', user);
      } catch (e) {
        // Ignorar o throw do handleFirestoreError para não quebrar o fluxo da UI mais do que o necessário
      }
    } finally {
      setIsSaving(false);
    }
  };

  const triggerIntegration = async (id: string | number, updates: Partial<Entry>) => {
    if (updates.status !== 'Embarcado') return;

    const currentEntry = entries.find(e => String(e.id) === String(id));
    // Se for um novo registro (handleCreateEntry), currentEntry não existirá no estado ainda
    // mas os dados estão em 'updates'
    
    const branchId = updates.branchId || currentEntry?.branchId;
    if (!branchId) return;

    const entryBranch = branches.find(b => b.id === branchId);
    const isFromTitam = entryBranch?.name?.toLowerCase().includes('titam');

    if (!isFromTitam) return;

    const finalDestino = (updates.destino || currentEntry?.destino || "").toString().trim();
    const nf = updates.nf_numero || currentEntry?.nf_numero;
    
    // Log para depuração
    console.log(`[Integração] Verificando NF: ${nf}, Destino: ${finalDestino}`);

    if (finalDestino.toLowerCase().includes('resende')) {
      const voltaRedondaBranch = branches.find(b => 
        b.name?.toLowerCase().includes('volta redonda') || 
        b.name?.toLowerCase().includes('v. redonda')
      );

      if (voltaRedondaBranch) {
        // Verificar duplicidade no servidor (já que o estado 'entries' pode estar filtrado por filial)
        const qAlready = query(
          collection(db, 'entries'), 
          where('nf_numero', '==', nf), 
          where('branchId', '==', voltaRedondaBranch.id)
        );
        const snapshotAlready = await getDocs(qAlready);
        const alreadyIntegrated = !snapshotAlready.empty;

        if (alreadyIntegrated) {
          console.log(`[Integração] NF ${nf} já existe em Volta Redonda. Atualizando registro existente...`);
          const existingDoc = snapshotAlready.docs[0];
          // Opcional: Atualizar o existente? Por enquanto vamos apenas evitar a duplicata como solicitado
          // await updateDoc(doc(db, 'entries', existingDoc.id), updatesToSync); 
          return;
        }

        const baseData = currentEntry ? { ...currentEntry } : { ...updates };
        
        // Mapear apenas os campos solicitados (dados da foto)
        const newEntry = {
          mes: baseData.mes || updates.mes || "",
          chave_acesso: baseData.chave_acesso || updates.chave_acesso || "",
          nf_numero: baseData.nf_numero || updates.nf_numero || "",
          tonelada: baseData.tonelada || updates.tonelada || 0,
          valor: baseData.valor || updates.valor || 0,
          descricao_produto: baseData.descricao_produto || updates.descricao_produto || "",
          id_lote: baseData.id_lote || updates.id_lote || "",
          data_nf: baseData.data_nf || updates.data_nf || "",
          data_descarga: baseData.data_descarga || updates.data_descarga || "",
          data_posicionamento: baseData.data_posicionamento || updates.data_posicionamento || "",
          fornecedor: baseData.fornecedor || updates.fornecedor || "",
          placa_veiculo: baseData.placa_veiculo || updates.placa_veiculo || "",
          container: baseData.container || updates.container || "",
          destino: baseData.destino || updates.destino || "",
          transportador: baseData.transportador || updates.transportador || "",
          cliente: baseData.cliente || updates.cliente || "",
          data_carregamento_rodoviario: baseData.data_carregamento_rodoviario || updates.data_carregamento_rodoviario || "",
          placa_saida: baseData.placa_saida || updates.placa_saida || "",
          data_faturamento_vli: baseData.data_faturamento_vli || updates.data_faturamento_vli || "",
          numero_vagao: baseData.numero_vagao || updates.numero_vagao || "",
          status: 'Trânsito Cheio' as const,
          branchId: voltaRedondaBranch.id,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          uid: user?.uid || (baseData as any).uid,
          created_by_email: user?.email || (baseData as any).created_by_email
        };
        
        delete (newEntry as any).id;

        try {
          await addDoc(collection(db, 'entries'), newEntry);
          addNotification("Integração: Registro enviado para Volta Redonda (Trânsito Cheio)", "info");
        } catch (error) {
          console.error("[Integração] Erro ao criar registro em Volta Redonda:", error);
        }
      } else {
        console.warn("[Integração] Filial Volta Redonda não encontrada.");
      }
    }
  };

  const handleUpdateEntry = async (id: string | number, updates: Partial<Entry>) => {
    console.log(`[Update] handleUpdateEntry iniciada para ID: ${id}`, updates);
    
    if (!user) {
      console.error("[Update] Erro: Usuário não autenticado");
      addNotification("Sessão expirada. Faça login novamente.", "error");
      return false;
    }

    // Garantir que temos um ID válido e extrair se for objeto
    const docId = typeof id === 'object' && id !== null ? (id as any).id : id;
    
    if (!docId || String(docId).trim() === '') {
      console.error("[Update] Erro: ID inválido", id);
      addNotification("Erro interno: ID do registro inválido.", "error");
      return false;
    }

    const sanitizeNumeric = (val: any) => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return val;
      if (typeof val !== 'string') return 0;
      const sanitized = val.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(sanitized);
      return isNaN(parsed) ? 0 : parsed;
    };

    try {
      setIsUpdating(true);
      setLastUpdateError(null);
      
      // Criar payload limpo
      const sanitizedUpdates: any = {};
      const ignoreFields = ['id', 'isPending', 'created_at', 'uid', 'import_batch'];
      
      const currentEntry = entries.find(e => String(e.id) === String(docId));
      const branchId = updates.branchId || currentEntry?.branchId;
      const isVR = branches.find(b => b.id === branchId)?.name?.toLowerCase().includes('volta redonda') || false;

      // Business rule: Titam branch cannot have duplicate containers in "Estoque" status for different NFs
      const entryBranch = branches.find(b => b.id === branchId);
      const isFromTitam = entryBranch?.name?.toLowerCase().includes('titam');
      const targetStatus = updates.status !== undefined ? updates.status : currentEntry?.status;
      const targetContainer = (updates.container !== undefined ? updates.container : currentEntry?.container)?.toString().trim().toUpperCase();
      const targetNf = (updates.nf_numero !== undefined ? updates.nf_numero : currentEntry?.nf_numero)?.toString().trim().toUpperCase();

      if (isFromTitam && targetStatus === 'Estoque' && isValidContainerNumberForDuplicateCheck(targetContainer)) {
        const hasDuplicateContainer = entries.some(entry => {
          if (String(entry.id) === String(docId)) return false; // skip self
          const eb = branches.find(b => b.id === entry.branchId);
          const entryIsTitam = eb?.name?.toLowerCase().includes('titam');
          return (
            entryIsTitam &&
            entry.status === 'Estoque' &&
            entry.container?.toString().trim().toUpperCase() === targetContainer &&
            entry.nf_numero?.toString().trim().toUpperCase() !== targetNf
          );
        });
        
        if (hasDuplicateContainer) {
          addNotification("O container já foi usado.", "error");
          setIsUpdating(false);
          return false;
        }
      }

      Object.entries(updates).forEach(([key, value]) => {
        if (!ignoreFields.includes(key) && value !== undefined && value !== null) {
          if (key === 'valor' || key === 'tonelada') {
            sanitizedUpdates[key] = sanitizeNumeric(value);
          } else if (key === 'status' && isVR && value) {
            let finalVal = value.toString();
            if (finalVal === 'Em descarga') finalVal = 'Em descarga na Arcelor';
            if (finalVal === 'Estoque') finalVal = 'Estoque (Cheio Terminal)';
            if (finalVal === 'Transito vazio' || finalVal === 'Trânsito Vazio') finalVal = 'Trânsito Vazio (Arcos)';
            sanitizedUpdates[key] = finalVal;
          } else {
            sanitizedUpdates[key] = value;
          }
        }
      });

      // Metadados de atualização
      sanitizedUpdates.updated_at = serverTimestamp();
      sanitizedUpdates.updated_by_email = user.email || 'Usuário';

      console.log(`[Update] Enviando para Firestore: entries/${docId}`, sanitizedUpdates);
      
      const entryRef = doc(db, 'entries', String(docId));
      await setDoc(entryRef, sanitizedUpdates, { merge: true });
      
      console.log(`[Update] Sucesso no merge do Firestore para ${docId}`);

      // Tentar disparar integração (não bloqueante)
      try {
        await triggerIntegration(docId, sanitizedUpdates);
      } catch (intError) {
        console.error("[Update] Erro na integração (não fatal):", intError);
      }

      addNotification(`Registro NF ${updates.nf_numero || 'selecionada'} atualizado com sucesso!`, "info");
      return true;
    } catch (error: any) {
      console.error("[Update] Erro FATAL ao salvar no Firestore:", error);
      
      let errorMessage = error.message || 'Erro desconhecido';
      if (errorMessage.toLowerCase().includes('permission-denied') || errorMessage.toLowerCase().includes('permissão negada')) {
        errorMessage = 'Erro de Permissão (Security Rules). Verifique se você é administrador.';
      } else if (errorMessage.toLowerCase().includes('offline') || errorMessage.toLowerCase().includes('network')) {
        errorMessage = 'Erro de Conexão. Verifique sua internet.';
      }
      
      setLastUpdateError(errorMessage);
      addNotification(`Erro ao salvar: ${errorMessage}`, "error");
      
      // Registrar erro detalhado para diagnóstico
      try {
        handleFirestoreError(error, OperationType.UPDATE, `entries/${docId}`, user);
      } catch (e) {
        // Ignora o throw do handleFirestoreError para não travar a UI
      }
      
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickStatusUpdate = async (id: string | number, type: 'chegada' | 'entrada' | 'saida') => {
    if (!user) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const updates: Partial<Entry> = {
      updated_at: serverTimestamp(),
      updated_by_email: user.email || 'Usuário'
    };
    if (type === 'chegada') updates.hora_chegada = timeStr;
    if (type === 'entrada') updates.hora_entrada = timeStr;
    if (type === 'saida') {
      updates.hora_saida = timeStr;
    }

    try {
      await updateDoc(doc(db, 'entries', String(id)), updates);
      
      // Tentar disparar integração
      await triggerIntegration(id, updates);

      addNotification(`Horário de ${type} registrado: ${timeStr}`, "info");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `entries/${id}`, user);
      addNotification(`Erro ao registrar ${type}.`, "error");
    }
  };

  const handleCreateContainer = async (numero: string, status: Container['status'], observacao?: string, branchId?: string) => {
    if (!user || !numero) return;
    const targetBranchId = branchId || selectedBranchId;
    if (!targetBranchId || targetBranchId === 'all') {
      addNotification("Selecione uma filial ativa antes de cadastrar containers.", "warning");
      return;
    }
    
    // Check for duplicates (case-insensitive, global across all branches)
    const upperNumero = numero.trim().toUpperCase();
    const existing = containers.find(c => c.numero.trim().toUpperCase() === upperNumero);
    if (existing) {
      const branchName = branches.find(b => b.id === existing.branchId)?.name || 'outra filial';
      addNotification(`Erro: O container ${upperNumero} já está cadastrado na filial ${branchName}.`, "error");
      return;
    }

    try {
      await addDoc(collection(db, 'containers'), {
        numero: upperNumero,
        status,
        observacao: observacao || '',
        branchId: targetBranchId,
        uid: user.uid,
        updated_at: serverTimestamp(),
        updated_by_email: user.email
      });
      addNotification(`Container ${upperNumero} adicionado!`, "info");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'containers', user);
      addNotification("Erro ao adicionar container.", "error");
    }
  };

  const handleBulkCreateContainers = async (text: string, status: Container['status'], branchId: string) => {
    if (!user || !text || !branchId) return;
    setIsProcessing(true);
    try {
      const codes = text
        .split(/[\n,;]+/)
        .map(code => code.trim().toUpperCase())
        .filter(code => code.length > 0);

      if (codes.length === 0) {
        addNotification("Nenhum número de container válido encontrado.", "warning");
        setIsProcessing(false);
        return;
      }

      // Filter out duplicates within the user input list itself
      const uniqueInputCodes = Array.from(new Set(codes));

      // Filter out codes that already exist in our loaded containers state (globally)
      const existingNumbers = new Set(containers.map(c => c.numero.trim().toUpperCase()));
      const codesToAdd = uniqueInputCodes.filter(code => !existingNumbers.has(code));
      const duplicatesCount = uniqueInputCodes.length - codesToAdd.length;

      if (codesToAdd.length === 0) {
        addNotification("Todos os containers informados já estão cadastrados.", "warning");
        setIsProcessing(false);
        return;
      }

      let successCount = 0;
      await Promise.all(
        codesToAdd.map(async (numero) => {
          await addDoc(collection(db, 'containers'), {
            numero,
            status,
            observacao: '',
            branchId,
            uid: user.uid,
            updated_at: serverTimestamp(),
            updated_by_email: user.email
          });
          successCount++;
        })
      );

      if (duplicatesCount > 0) {
        addNotification(`${successCount} containers cadastrados. ${duplicatesCount} já existentes foram ignorados.`, "info");
      } else {
        addNotification(`${successCount} containers cadastrados com sucesso!`, "info");
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'containers_bulk', user);
      addNotification(`Erro ao cadastrar containers em lote: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCleanDuplicateContainers = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      // Group containers by uppercase number
      const groups: Record<string, Container[]> = {};
      containers.forEach(c => {
        const key = c.numero.trim().toUpperCase();
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(c);
      });

      const toDelete: Container[] = [];
      const duplicateDetails: string[] = [];

      Object.entries(groups).forEach(([numero, list]) => {
        if (list.length > 1) {
          // Keep the first registered container, delete the duplicate copies
          for (let i = 1; i < list.length; i++) {
            toDelete.push(list[i]);
          }
          duplicateDetails.push(numero);
        }
      });

      if (toDelete.length === 0) {
        addNotification("Nenhum container duplicado encontrado no cadastro.", "info");
        setIsProcessing(false);
        return;
      }

      let deletedCount = 0;
      await Promise.all(
        toDelete.map(async (c) => {
          await deleteDoc(doc(db, 'containers', c.id));
          deletedCount++;
        })
      );

      addNotification(`${deletedCount} duplicados eliminados (${duplicateDetails.slice(0, 5).join(', ')}${duplicateDetails.length > 5 ? '...' : ''}).`, "info");
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'containers_cleanup', user);
      addNotification("Erro ao eliminar containers duplicados.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBranch = async (name: string, code: string, location: string) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await addDoc(collection(db, 'branches'), {
        name,
        code,
        location,
        uid: user.uid,
        created_at: serverTimestamp()
      });
      addNotification(`Filial ${name} cadastrada com sucesso!`, "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'branches', user);
      addNotification(`Erro ao cadastrar filial: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await deleteDoc(doc(db, 'branches', id));
      addNotification("Filial excluída com sucesso!", "info");
      if (selectedBranchId === id) {
        setSelectedBranchId('all');
        localStorage.removeItem('selected_branch_id');
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'branches', user);
      addNotification(`Erro ao excluir filial: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateSupplier = async (name: string, branchId: string, cnpj?: string, contact?: string) => {
    if (!user || !branchId) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'suppliers'), {
        name,
        branchId,
        cnpj: cnpj || '',
        contact: contact || '',
        uid: user.uid,
        created_at: serverTimestamp()
      });
      addNotification(`Fornecedor ${name} cadastrado com sucesso!`, "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'suppliers', user);
      addNotification(`Erro ao cadastrar fornecedor: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateSupplier = async (id: string, name: string, branchId: string, cnpj?: string, contact?: string) => {
    if (!user || !branchId) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'suppliers', id), {
        name,
        branchId,
        cnpj: cnpj || '',
        contact: contact || '',
        updated_at: serverTimestamp()
      });
      addNotification(`Fornecedor ${name} atualizado com sucesso!`, "info");
      setEditingRegistration(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'suppliers', user);
      addNotification(`Erro ao atualizar fornecedor: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await deleteDoc(doc(db, 'suppliers', id));
      addNotification("Fornecedor excluído com sucesso!", "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'suppliers', user);
      addNotification(`Erro ao excluir fornecedor: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateTransporter = async (name: string, branchId: string, cnpj?: string, contact?: string) => {
    if (!user || !branchId) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'transporters'), {
        name,
        branchId,
        cnpj: cnpj || '',
        contact: contact || '',
        uid: user.uid,
        created_at: serverTimestamp()
      });
      addNotification(`Transportador ${name} cadastrado com sucesso!`, "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'transporters', user);
      addNotification(`Erro ao cadastrar transportador: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateTransporter = async (id: string, name: string, branchId: string, cnpj?: string, contact?: string) => {
    if (!user || !branchId) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'transporters', id), {
        name,
        branchId,
        cnpj: cnpj || '',
        contact: contact || '',
        updated_at: serverTimestamp()
      });
      addNotification(`Transportador ${name} atualizado com sucesso!`, "info");
      setEditingRegistration(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'transporters', user);
      addNotification(`Erro ao atualizar transportador: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTransporter = async (id: string) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await deleteDoc(doc(db, 'transporters', id));
      addNotification("Transportador excluído com sucesso!", "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'transporters', user);
      addNotification(`Erro ao excluir transportador: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateCustomer = async (name: string, branchId: string, cnpj?: string, contact?: string) => {
    if (!user || !branchId) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'customers'), {
        name,
        branchId,
        cnpj: cnpj || '',
        contact: contact || '',
        uid: user.uid,
        created_at: serverTimestamp()
      });
      addNotification(`Cliente ${name} cadastrado com sucesso!`, "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'customers', user);
      addNotification(`Erro ao cadastrar cliente: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateCustomer = async (id: string, name: string, branchId: string, cnpj?: string, contact?: string) => {
    if (!user || !branchId) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'customers', id), {
        name,
        branchId,
        cnpj: cnpj || '',
        contact: contact || '',
        updated_at: serverTimestamp()
      });
      addNotification(`Cliente ${name} atualizado com sucesso!`, "info");
      setEditingRegistration(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'customers', user);
      addNotification(`Erro ao atualizar cliente: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await deleteDoc(doc(db, 'customers', id));
      addNotification("Cliente excluído com sucesso!", "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'customers', user);
      addNotification(`Erro ao excluir cliente: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateProduct = async (name: string, branchId: string) => {
    if (!user || !branchId) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'products'), {
        name,
        branchId,
        uid: user.uid,
        created_at: serverTimestamp()
      });
      addNotification(`Produto ${name} cadastrado com sucesso!`, "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'products', user);
      addNotification(`Erro ao cadastrar produto: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProduct = async (id: string, name: string, branchId: string) => {
    if (!user || !branchId) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'products', id), {
        name,
        branchId,
        updated_at: serverTimestamp()
      });
      addNotification(`Produto ${name} atualizado com sucesso!`, "info");
      setEditingRegistration(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'products', user);
      addNotification(`Erro ao atualizar produto: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await deleteDoc(doc(db, 'products', id));
      addNotification("Produto excluído com sucesso!", "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'products', user);
      addNotification(`Erro ao excluir produto: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateDestination = async (name: string, branchId: string) => {
    if (!user || !branchId) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'destinations'), {
        name,
        branchId,
        uid: user.uid,
        created_at: serverTimestamp()
      });
      addNotification(`Destino ${name} cadastrado com sucesso!`, "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'destinations', user);
      addNotification(`Erro ao cadastrar destino: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateDestination = async (id: string, name: string, branchId: string) => {
    if (!user || !branchId) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'destinations', id), {
        name,
        branchId,
        updated_at: serverTimestamp()
      });
      addNotification(`Destino ${name} atualizado com sucesso!`, "info");
      setEditingRegistration(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'destinations', user);
      addNotification(`Erro ao atualizar destino: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDestination = async (id: string) => {
    if (!user) return;
    try {
      setIsProcessing(true);
      await deleteDoc(doc(db, 'destinations', id));
      addNotification("Destino excluído com sucesso!", "info");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'destinations', user);
      addNotification(`Erro ao excluir destino: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMigrateOrphanData = async (targetBranchId: string) => {
    if (!targetBranchId || targetBranchId === 'all' || !user) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      let count = 0;

      // Filtrar entradas sem branchId
      entries.forEach(entry => {
        if (!entry.branchId) {
          const docRef = doc(db, 'entries', String(entry.id));
          batch.update(docRef, { branchId: targetBranchId });
          count++;
        }
      });

      // Filtrar containers sem branchId
      containers.forEach(container => {
        if (!container.branchId) {
          const docRef = doc(db, 'containers', String(container.id));
          batch.update(docRef, { branchId: targetBranchId });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        addNotification(`${count} registros foram vinculados com sucesso à filial selecionada.`, "info");
      } else {
        addNotification('Não foram encontrados registros sem filial para migrar.', "info");
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'migration', user);
      addNotification(`Erro na migração: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateContainer = async (id: string, updates: Partial<Container>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'containers', id), {
        ...updates,
        updated_at: serverTimestamp(),
        updated_by_email: user.email
      });
      addNotification("Container atualizado!", "info");
      setEditingRegistration(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `containers/${id}`, user);
      addNotification("Erro ao atualizar container.", "error");
    }
  };

  const handleDeleteContainer = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'containers', id));
      addNotification("Container removido!", "warning");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `containers/${id}`, user);
      addNotification("Erro ao remover container.", "error");
    }
  };

  const yardEntries = React.useMemo(() => {
    if (!Array.isArray(entries)) return [];
    return entries.filter(e => {
      const today = new Date().toISOString().split('T')[0];
      const isToday = e.data_descarga === today || e.data_posicionamento === today;
      const isInYard = e.hora_chegada && !e.hora_saida;
      return isToday || isInYard;
    }).sort((a, b) => {
      const timeA = a.hora_chegada || '99:99';
      const timeB = b.hora_chegada || '99:99';
      return timeA.localeCompare(timeB);
    });
  }, [entries]);

  const handleDeleteEntry = (id: string | number) => {
    setDeleteConfirmation(id);
  };

  const handleBulkDeleteEntries = (ids: (string | number)[]) => {
    setBulkDeleteConfirmation(ids);
  };

  const executeBulkDelete = async () => {
    if (!user || !bulkDeleteConfirmation) return;
    
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      bulkDeleteConfirmation.forEach((id) => {
        batch.delete(doc(db, 'entries', String(id)));
      });
      await batch.commit();
      addNotification(`${bulkDeleteConfirmation.length} registros excluídos com sucesso!`, "info");
      setBulkDeleteConfirmation(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `entries/bulk`, user);
      addNotification("Erro ao excluir registros. Verifique suas permissões.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const executeDelete = async () => {
    if (!user || !deleteConfirmation) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'entries', String(deleteConfirmation)));
      addNotification("Registro excluído com sucesso!", "info");
      setDeleteConfirmation(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `entries/${deleteConfirmation}`, user);
      addNotification("Erro ao excluir registro. Verifique suas permissões.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-titam-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-titam-lime/30 border-t-titam-lime rounded-full animate-spin" />
          <p className="text-titam-lime font-bold tracking-widest animate-pulse">CARREGANDO...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-titam-deep p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center"
        >
          <div className="w-24 h-24 bg-titam-lime/10 rounded-full flex items-center justify-center mx-auto mb-8">
             <Truck className="text-titam-deep w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-titam-deep mb-2">Titam Intermodais</h1>
          <p className="text-gray-500 mb-8">Acesse o sistema para gerenciar seu estoque e logística.</p>
          
          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-left">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-600 font-medium leading-relaxed">{authError}</p>
            </div>
          )}

          <button 
            onClick={login}
            disabled={loginLoading}
            className={`w-full bg-titam-deep text-white py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 ${loginLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loginLoading ? (
              <>
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" referrerPolicy="no-referrer" />
                <span>Entrar com Google</span>
              </>
            )}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="flex h-screen transition-all duration-700"
      style={{
        backgroundColor: 'var(--bg)'
      }}
    >
      {/* Sidebar */}
      <aside className="w-64 bg-titam-deep text-white flex flex-col shadow-xl transition-all duration-700">
        <div className="p-8 border-b border-white/5">
          {!isTitam ? (
            <div className="w-full px-2">
              {/* Multitex Logo - Original appearance restored */}
              <div className="w-full flex flex-col items-center">
                <div className="bg-black border-2 border-[#FFB800] rounded-lg p-3 w-full flex flex-col items-center shadow-lg transform -skew-x-3 transition-all duration-700">
                  <h1 className="text-[#FFB800] font-black italic text-3xl tracking-tighter leading-none glow-text">MULTITEX</h1>
                  <p className="text-white text-[10px] font-bold uppercase tracking-[0.3em] mt-1">LOGÍSTICA Ltda.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full px-2">
              <svg viewBox="0 0 300 195" className="w-full h-auto text-titam-lime fill-current">
                {/* Icon: Road and Rail crossing (The X shape) */}
                <g transform="translate(75, 10) scale(1.0)">
                  {/* Road side (Left) */}
                  <path d="M0 20 L50 20 M0 50 L50 50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
                  <path d="M10 35 L40 35" stroke="currentColor" strokeWidth="3" strokeDasharray="8 6" fill="none" />
                  
                  {/* Crossing/Twist (The X) */}
                  <path d="M50 20 C80 20, 80 50, 110 50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
                  <path d="M50 50 C80 50, 80 20, 110 20" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />

                  {/* Rail side (Right) */}
                  <path d="M110 20 L160 20 M110 50 L160 50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
                  <path d="M120 15 L120 55 M135 15 L135 55 M150 15 L150 55" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </g>

                {/* Text: titam */}
                <g transform="translate(150, 145)" textAnchor="middle">
                  <text style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '84px', letterSpacing: '-0.04em' }}>titam</text>
                </g>

                {/* Slogan */}
                <g transform="translate(150, 175)" textAnchor="middle">
                  <text style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '11px', letterSpacing: '0.28em' }}>
                    INTERMODAIS INTELIGENTES
                  </text>
                </g>
              </svg>
            </div>
          )}
        </div>
        
        <div className="px-4 py-2 border-b border-white/10">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider ml-2">Filial Ativa</label>
            <select 
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                localStorage.setItem('selected_branch_id', e.target.value);
              }}
              className="w-full bg-white/5 text-white border border-white/10 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            >
              <option value="all" className="bg-titam-deep">Todas as Filiais</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id} className="bg-titam-deep">
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavItem 
            icon={<LayoutDashboard size={18} />} 
            label="Painel" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<ArrowDownLeft size={18} />} 
            label="Entrada" 
            active={activeTab === 'entrada'} 
            onClick={() => setActiveTab('entrada')} 
          />
          <NavItem 
            icon={<ArrowUpRight size={18} />} 
            label="Saída" 
            active={activeTab === 'saida'} 
            onClick={() => setActiveTab('saida')} 
          />
          <NavItem 
            icon={<Activity size={18} />} 
            label="Fluxo de Veículos" 
            active={activeTab === 'fluxo'} 
            onClick={() => setActiveTab('fluxo')} 
          />
          <NavItem 
            icon={<FileText size={18} />} 
            label="Faturamento" 
            active={activeTab === 'faturamento'} 
            onClick={() => setActiveTab('faturamento')} 
          />
          <NavItem 
            icon={<Truck size={18} />} 
            label="Todos os Registros" 
            active={activeTab === 'lista'} 
            onClick={() => setActiveTab('lista')} 
          />
          <NavItem 
            icon={<FileJson size={18} />} 
            label="Relatórios" 
            active={activeTab === 'relatorios'} 
            onClick={() => setActiveTab('relatorios')} 
          />
          <NavItem 
            icon={<Package size={18} />} 
            label="Contêineres" 
            active={activeTab === 'containers'} 
            onClick={() => setActiveTab('containers')} 
          />

          {isAdmin && (
            <>
              <NavItem 
                icon={<Building2 size={18} />} 
                label="Gestão de Filiais" 
                active={activeTab === 'filiais'} 
                onClick={() => setActiveTab('filiais')} 
              />
              <NavItem 
                icon={<Users size={18} />} 
                label="Base de Cadastros" 
                active={activeTab === 'cadastros'} 
                onClick={() => setActiveTab('cadastros')} 
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl mb-4">
            <div className="w-8 h-8 rounded-full bg-titam-lime text-titam-deep flex items-center justify-center font-bold text-xs">
              <span>{user.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{user.displayName || 'Usuário'}</p>
              <p className="text-[10px] text-white/40 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-2 px-4 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs font-bold"
          >
            <X size={14} />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8 transition-all duration-700">
        <AnimatePresence>
          {notifications
            .filter(n => n.type === 'critical')
            .filter(n => {
              if (isVoltaRedonda) {
                const text = (n.message || '').toLowerCase();
                return !text.includes('titam') && !text.includes('serra-es') && !text.includes('cal dolomítico') && !n.id.startsWith('impact-');
              }
              return true;
            })
            .map(n => (
            <motion.div
              key={n.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-600 text-white px-6 py-3 flex items-center justify-between shadow-lg relative z-[100]"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="animate-pulse" />
                <span className="font-bold tracking-wide uppercase text-sm">Alerta Crítico:</span>
                <span className="font-medium">{n.message}</span>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                className="hover:bg-white/20 p-1 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl font-light text-gray-900 tracking-tight capitalize mb-1">
                {activeTab === 'dashboard' ? 'Painel Informativo' : activeTab}
              </h1>
              <div className="flex items-center gap-3">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Titam Intermodais</p>
                <div className="w-1 h-1 rounded-full bg-gray-300" />
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  serverStatus === 'online' ? 'bg-emerald-50 text-emerald-600' : 
                  serverStatus === 'offline' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
                }`}>
                  <div className={`w-1 h-1 rounded-full ${
                    serverStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 
                    serverStatus === 'offline' ? 'bg-red-500' : 'bg-gray-400'
                  }`} />
                  <span>{serverStatus === 'online' ? 'Online' : serverStatus === 'offline' ? 'Offline' : '...'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSyncingState && (
              <div className="flex items-center gap-2 text-[9px] text-titam-deep bg-titam-lime font-black px-3 py-1.5 rounded-full shadow-sm">
                <SyncIcon size={10} className="animate-spin" />
                <span className="uppercase tracking-widest">Sincronizando</span>
              </div>
            )}

            {uniqueProducts.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm transition-all duration-700">
                <Package size={16} className="text-titam-lime" />
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="bg-transparent outline-none text-[10px] font-bold text-gray-700 uppercase cursor-pointer"
                >
                  <option value="all">Todos Produtos</option>
                  {uniqueProducts.map(product => (
                    <option key={product} value={product}>{product}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="flex items-center bg-white p-1 rounded-xl border border-gray-100 shadow-sm transition-all duration-700">
              <button 
                onClick={() => addNotification("Sincronização automática ativa.", "info")}
                className="p-2.5 text-gray-400 hover:text-titam-deep hover:bg-gray-50 rounded-lg transition-all"
              >
                <SyncIcon size={18} className={loading ? 'animate-spin' : ''} />
              </button>

              <button 
                onClick={triggerTestAlert}
                className="p-2.5 text-gray-400 hover:text-titam-deep hover:bg-gray-50 rounded-lg transition-all relative"
              >
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-2 ring-white" />
                )}
              </button>
            </div>

            {activeTab !== 'dashboard' && (
              <button 
                onClick={() => {
                  if (selectedBranchId === 'all') {
                    addNotification("Selecione uma filial específica para cadastrar novos registros.", "warning");
                    return;
                  }
                  setFormData({});
                  setShowForm(true);
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-bold text-sm ${
                  selectedBranchId === 'all' 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-titam-deep text-white hover:bg-titam-deep/90 shadow-lg shadow-titam-deep/20'
                }`}
              >
                <Plus size={18} className={selectedBranchId === 'all' ? 'text-gray-400' : 'text-titam-lime'} />
                Novo Registro
              </button>
            )}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
              id="dashboard-content"
            >
              {/* Date & NF Filter */}
                <div className="bg-white border-gray-100 shadow-sm p-6 rounded-2xl border space-y-6 transition-all duration-700">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center">
                      <Filter size={20} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Filtros Inteligentes</h3>
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Refine sua visualização de dados</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-titam-lime transition-colors" size={16} />
                      <input 
                        type="text" 
                        placeholder="PESQUISAR NF..."
                        value={nfSearch}
                        onChange={(e) => setNfSearch(e.target.value)}
                        className="pl-12 pr-6 py-3 border bg-gray-50 border-gray-100 focus:ring-titam-lime/20 focus:bg-white rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none transition-all w-full sm:w-64"
                      />
                    </div>

                    <div className="flex items-center gap-2 border bg-gray-50 border-gray-100 rounded-xl px-4 py-3">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Produto:</span>
                      <select 
                        value={productFilter}
                        onChange={(e) => setProductFilter(e.target.value)}
                        className="bg-transparent outline-none text-[10px] font-bold text-gray-700 uppercase cursor-pointer"
                      >
                        <option value="all">Todos os Produtos</option>
                        {uniqueProducts.map(product => (
                          <option key={product} value={product}>{product}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 border bg-gray-50 border-gray-100 rounded-xl px-4 py-3">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Período:</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="date" 
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-transparent outline-none text-[10px] font-bold text-gray-700 uppercase"
                        />
                        <span className="text-gray-300">/</span>
                        <input 
                          type="date" 
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="bg-transparent outline-none text-[10px] font-bold text-gray-700 uppercase"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        if (startDate && endDate) {
                          const start = new Date(startDate);
                          const end = new Date(endDate);
                          const dates = [];
                          let current = new Date(start);
                          while (current <= end) {
                            dates.push(current.toISOString().split('T')[0]);
                            current.setDate(current.getDate() + 1);
                          }
                          setSelectedDates(dates);
                        } else if (startDate) {
                          setSelectedDates([startDate]);
                        }
                      }}
                      className="bg-titam-deep text-white px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-titam-deep/90 transition-all shadow-lg shadow-titam-deep/10"
                    >
                      Aplicar
                    </button>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          setSelectedDates([today]);
                          setStartDate(today);
                          setEndDate(today);
                          setNfSearch('');
                        }}
                        className="text-[10px] font-bold text-titam-deep bg-titam-lime/20 hover:bg-titam-lime/40 px-4 py-3 rounded-xl transition-all uppercase tracking-widest"
                      >
                        Hoje
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedDates([]);
                          setStartDate('');
                          setEndDate('');
                          setNfSearch('');
                        }}
                        className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-3 rounded-xl transition-all uppercase tracking-widest"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] w-full mb-2">
                    {selectedDates.length > 5 ? `Período: ${selectedDates[0].split('-').reverse().join('/')} até ${selectedDates[selectedDates.length-1].split('-').reverse().join('/')} (${selectedDates.length} dias)` : 'Datas Selecionadas:'}
                  </span>
                  {selectedDates.length <= 5 && selectedDates.map(date => (
                    <div key={date} className="flex items-center gap-2 bg-gray-50 text-gray-600 px-3 py-1.5 rounded-full text-[10px] font-bold border border-gray-100">
                      {date.split('-').reverse().join('/')}
                      <button 
                        onClick={() => {
                          if (selectedDates.length > 1) {
                            setSelectedDates(prev => prev.filter(d => d !== date));
                          }
                        }}
                        className="hover:text-red-600 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>



              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                  title="Estoque Selecionado" 
                  value={dailyStats.in_stock} 
                  subtitle="Unidades (Datas filtradas)"
                  icon={<Package className="text-titam-deep" />}
                />
                <StatCard 
                  title="Saídas Selecionadas" 
                  value={dailyStats.exited} 
                  subtitle="Unidades (Datas filtradas)"
                  icon={<ArrowUpRight className="text-titam-deep" />}
                />
                <StatCard 
                  title="Fornecedores" 
                  value={dailyStats.suppliers} 
                  subtitle="Nas datas filtradas"
                  icon={<Truck className="text-titam-deep" />}
                />
              </div>

              {/* Impactos em Tempo Real Section */}
              {(dailyStats.queue_external_exceeded > 0 || dailyStats.queue_internal_exceeded > 0) && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 p-6 bg-red-50/50 border border-red-100 rounded-2xl relative overflow-hidden transition-all duration-700"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <AlertTriangle size={80} className="text-red-500" />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                      Impactos em Tempo Real (Hoje)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dailyStats.queue_external_exceeded > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm flex items-center gap-4 transition-all duration-700">
                          <div className="p-3 bg-red-50 rounded-lg text-red-500">
                            <Clock size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fila Externa</p>
                            <p className="text-lg font-black text-gray-900">{dailyStats.queue_external_exceeded} <span className="text-xs font-bold text-red-500 uppercase">Veículos Excedidos</span></p>
                          </div>
                        </div>
                      )}
                      {dailyStats.queue_internal_exceeded > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm flex items-center gap-4 transition-all duration-700">
                          <div className="p-3 bg-red-50 rounded-lg text-red-500">
                            <Activity size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fila Interna</p>
                            <p className="text-lg font-black text-gray-900">{dailyStats.queue_internal_exceeded} <span className="text-xs font-bold text-red-500 uppercase">Veículos Excedidos</span></p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Fluxo de Veículos Section */}
              <div className="mt-8">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <Activity size={14} className="text-titam-lime" />
                  Fluxo de Veículos (Quantidade)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md border transition-all duration-700 flex items-center justify-between group relative overflow-hidden">
                    {dailyStats.queue_external_exceeded > 0 && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse"></div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Fila Externa</p>
                        {dailyStats.queue_external_exceeded > 0 && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[8px] font-black uppercase animate-bounce">
                            {dailyStats.queue_external_exceeded} Impacto
                          </span>
                        )}
                      </div>
                      <h4 className="text-4xl font-light text-gray-900 tracking-tighter">{dailyStats.queue_external}</h4>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase">Aguardando Entrada</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${dailyStats.queue_external_exceeded > 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white'}`}>
                      <Clock size={20} />
                    </div>
                  </div>
                  
                  <div className="bg-white border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md border transition-all duration-700 flex items-center justify-between group relative overflow-hidden">
                    {dailyStats.queue_internal_exceeded > 0 && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse"></div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Fila Interna</p>
                        {dailyStats.queue_internal_exceeded > 0 && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[8px] font-black uppercase animate-bounce">
                            {dailyStats.queue_internal_exceeded} Impacto
                          </span>
                        )}
                      </div>
                      <h4 className="text-4xl font-light text-gray-900 tracking-tighter">{dailyStats.queue_internal}</h4>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase">Em Operação</p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${dailyStats.queue_internal_exceeded > 0 ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white'}`}>
                      <Truck size={20} />
                    </div>
                  </div>

                  <div className="bg-white border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md border transition-all duration-700 flex items-center justify-between group">
                    <div>
                      <p className="text-[10px] font-bold text-titam-lime uppercase tracking-widest mb-2">Saídas</p>
                      <h4 className="text-4xl font-light text-gray-900 tracking-tighter">{dailyStats.queue_exit}</h4>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase">Concluído</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-titam-lime/10 flex items-center justify-center group-hover:bg-titam-lime group-hover:text-titam-deep transition-all">
                      <ArrowUpRight size={20} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart: Saídas por Dia */}
                <div className="bg-white border-gray-100 p-8 rounded-2xl border shadow-sm transition-all duration-700">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 size={16} className="text-titam-lime" />
                      Saídas por Dia
                    </h3>
                  </div>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={exitChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={brandPrimaryColor} stopOpacity={1}/>
                            <stop offset="100%" stopColor={brandPrimaryColor} stopOpacity={0.7}/>
                          </linearGradient>
                          <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={brandDeepColor} stopOpacity={1}/>
                            <stop offset="100%" stopColor={brandDeepColor} stopOpacity={0.7}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f1f1" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                          tickFormatter={(val) => val.split('-').slice(2).join('/')}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white border-gray-50 p-4 rounded-xl shadow-2xl border min-w-[200px] transition-all duration-700">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{label?.toString().split('-').reverse().join('/')}</p>
                                  <div className="space-y-3">
                                    {payload.map((entry: any, index: number) => {
                                      const tons = entry.payload[`${entry.name}_tons`] || 0;
                                      return (
                                        <div key={index} className="flex flex-col gap-1">
                                          <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                            <p className="text-[10px] font-bold text-gray-700 uppercase tracking-tight">{entry.name}</p>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm font-black text-gray-900">{entry.value} Un</span>
                                            <span className="text-xs font-bold text-titam-lime">{tons.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}t</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          align="right" 
                          iconType="circle" 
                          wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} 
                        />
                        {exitChartKeys.map((key, idx) => (
                          <Bar 
                            key={key} 
                            dataKey={key} 
                            stackId="a" 
                            fill={idx % 2 === 0 ? "url(#barGradient1)" : "url(#barGradient2)"} 
                            radius={[6, 6, 0, 0]}
                            barSize={32}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Line Chart: Performance */}
                <div className="bg-white border-gray-100 p-8 rounded-2xl border shadow-sm transition-all duration-700">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                      <Activity size={16} className="text-amber-500" />
                      Performance
                    </h3>
                    <div className="flex gap-6">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Média Total</span>
                        <span className="text-sm font-black text-gray-900">{performanceAverages.avgTotal}m</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Média Descarga</span>
                        <span className="text-sm font-black text-gray-900">{performanceAverages.avgDescarga}m</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={brandPrimaryColor} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={brandPrimaryColor} stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorDescarga" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={brandDeepColor} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={brandDeepColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f1f1" />
                        <XAxis 
                          dataKey="label" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white border-gray-50 p-5 rounded-2xl shadow-2xl border min-w-[220px] transition-all duration-700">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">{label}</p>
                                  <div className="space-y-4">
                                    {payload.map((entry: any, index: number) => (
                                      <div key={index} className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                          <p className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">{entry.name}</p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-xl font-black text-gray-900">{entry.value} min</span>
                                          {entry.name === 'Total' && entry.value > 60 && (
                                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Acima da Meta</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <ReferenceLine y={60} stroke="#E2E8F0" strokeDasharray="8 8" label={{ position: 'right', value: 'Meta: 60min', fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} />
                        <Legend 
                          verticalAlign="top" 
                          align="right" 
                          iconType="circle" 
                          wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="total" 
                          name="Total" 
                          stroke={brandPrimaryColor} 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorTotal)" 
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: brandPrimaryColor }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="descarga" 
                          name="Descarga" 
                          stroke={brandDeepColor} 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorDescarga)" 
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: brandDeepColor }} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart: Queue Analysis */}
                <div className="bg-white border-gray-200 p-6 rounded-xl border shadow-sm transition-all duration-700">
                  <div className="flex flex-col items-center text-center mb-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 justify-center">
                      <Activity size={18} className="text-blue-600" />
                      Fluxo de Veículos (Quantidade)
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Distribuição de carga e fluxo de saída por período</p>
                    
                    <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest mt-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-blue-500"></span>
                        <span className="text-gray-500">Fila Ext.</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
                        <span className="text-gray-500">Fila Int.</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-titam-lime"></span>
                        <span className="text-gray-500">Saídas</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={queueVolumeData} 
                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                        barGap={8}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis 
                          dataKey="label" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#64748B', fontWeight: 500 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fill: '#94A3B8' }}
                          dx={-10}
                        />
                        <Tooltip 
                          cursor={{ fill: '#F8FAFC', radius: 4 }}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                              return (
                                <div className="bg-white border-gray-100 p-4 rounded-xl shadow-xl min-w-[180px] transition-all duration-700">
                                  <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">{label}</p>
                                  <div className="space-y-2">
                                    {payload.map((entry: any, index: number) => (
                                      <div key={index} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                          <span className="text-xs font-medium text-gray-600">{entry.name}</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">{entry.value}</span>
                                      </div>
                                    ))}
                                    <div className="pt-2 mt-2 border-t border-gray-50 flex items-center justify-between">
                                      <span className="text-xs font-bold text-gray-900">Total Geral</span>
                                      <span className="text-sm font-black text-blue-600">{total}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar 
                          dataKey="externa" 
                          name="Fila Externa" 
                          fill="#3B82F6" 
                          radius={[4, 4, 0, 0]}
                          animationDuration={1500}
                        >
                          {queueVolumeData.length <= 16 && (
                            <LabelList dataKey="externa" position="top" style={{ fontSize: '10px', fill: '#3B82F6', fontWeight: 'bold' }} offset={8} />
                          )}
                        </Bar>
                        <Bar 
                          dataKey="interna" 
                          name="Fila Interna" 
                          fill="#F59E0B" 
                          radius={[4, 4, 0, 0]}
                          animationDuration={1500}
                        >
                          {queueVolumeData.length <= 16 && (
                            <LabelList dataKey="interna" position="top" style={{ fontSize: '10px', fill: '#F59E0B', fontWeight: 'bold' }} offset={8} />
                          )}
                        </Bar>
                        <Bar 
                          dataKey="concluidos" 
                          name="Saídas" 
                          fill={brandPrimaryColor} 
                          radius={[4, 4, 0, 0]}
                          animationDuration={1500}
                        >
                          {queueVolumeData.length <= 16 && (
                            <LabelList dataKey="concluidos" position="top" style={{ fontSize: '10px', fill: '#84CC16', fontWeight: 'bold' }} offset={8} />
                          )}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all duration-700">
                  <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="font-semibold text-gray-900">Estoque por Fornecedor</h2>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Filtrar fornecedor..."
                        value={supplierFilter}
                        onChange={(e) => setSupplierFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-titam-lime outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-3 data-grid-header text-[10px]">Fornecedor</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Estoque</th>
                          {isVoltaRedonda && (
                            <>
                              <th className="px-6 py-3 data-grid-header text-[10px]">Vazio Term.</th>
                              <th className="px-6 py-3 data-grid-header text-[10px]">Trans. Vazio</th>
                            </>
                          )}
                          <th className="px-6 py-3 data-grid-header text-[10px]">Descarga</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Rejeitado</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">T. Cheio</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Embarcado</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Devolvido</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900 text-xs">{s.fornecedor}</td>
                            <td className="px-6 py-4 mono-value text-xs text-blue-600 font-bold">{s.estoque}</td>
                            {isVoltaRedonda && (
                              <>
                                <td className="px-6 py-4 mono-value text-xs text-purple-600 font-bold">{(s as any).vazio_terminal || 0}</td>
                                <td className="px-6 py-4 mono-value text-xs text-pink-600 font-bold">{(s as any).transito_vazio || 0}</td>
                              </>
                            )}
                            <td className="px-6 py-4 mono-value text-xs text-orange-600 font-bold">{s.em_descarga || 0}</td>
                            <td className="px-6 py-4 mono-value text-xs text-red-600 font-bold">{s.rejeitado}</td>
                            <td className="px-6 py-4 mono-value text-xs text-indigo-600 font-bold">{s.transito_cheio || 0}</td>
                            <td className="px-6 py-4 mono-value text-xs text-emerald-600 font-bold">{s.embarcado}</td>
                            <td className="px-6 py-4 mono-value text-xs text-amber-600 font-bold">{s.devolvido}</td>
                            <td className="px-6 py-4 mono-value text-xs font-black text-titam-deep">{s.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all duration-700">
                  <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="font-semibold text-gray-900">Estoque por Produto e Destino</h2>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Filtrar por fornecedor..."
                        value={productDestSupplierFilter}
                        onChange={(e) => setProductDestSupplierFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-titam-lime outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-3 data-grid-header text-[10px]">Produto</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Destino</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Estoque</th>
                          {isVoltaRedonda && (
                            <>
                              <th className="px-6 py-3 data-grid-header text-[10px]">Vazio Term.</th>
                              <th className="px-6 py-3 data-grid-header text-[10px]">Trans. Vazio</th>
                            </>
                          )}
                          <th className="px-6 py-3 data-grid-header text-[10px]">Descarga</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Rejeitado</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">T. Cheio</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Embarcado</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Devolvido</th>
                          <th className="px-6 py-3 data-grid-header text-[10px]">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {productDestSummary.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900 text-xs">{s.descricao_produto}</td>
                            <td className="px-6 py-4 text-[10px] text-gray-600">{s.destino}</td>
                            <td className="px-6 py-4 mono-value text-xs text-blue-600 font-bold">{s.estoque}</td>
                            {isVoltaRedonda && (
                              <>
                                <td className="px-6 py-4 mono-value text-xs text-purple-600 font-bold">{(s as any).vazio_terminal || 0}</td>
                                <td className="px-6 py-4 mono-value text-xs text-pink-600 font-bold">{(s as any).transito_vazio || 0}</td>
                              </>
                            )}
                            <td className="px-6 py-4 mono-value text-xs text-orange-600 font-bold">{s.em_descarga || 0}</td>
                            <td className="px-6 py-4 mono-value text-xs text-red-600 font-bold">{s.rejeitado}</td>
                            <td className="px-6 py-4 mono-value text-xs text-indigo-600 font-bold">{s.transito_cheio || 0}</td>
                            <td className="px-6 py-4 mono-value text-xs text-emerald-600 font-bold">{s.embarcado}</td>
                            <td className="px-6 py-4 mono-value text-xs text-amber-600 font-bold">{s.devolvido}</td>
                            <td className="px-6 py-4 mono-value text-xs font-black text-titam-deep">{s.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Supplier Stock by Unloading Date */}
                <div className="bg-white border-gray-200 p-6 rounded-xl shadow-sm transition-all duration-700">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Truck size={18} className="text-titam-deep" />
                      Estoque por Fornecedor por Dia (NFs Recebidas)
                    </h3>
                    <div className="flex gap-2">
                      {selectedDates.slice(0, 3).map(d => (
                        <span key={d} className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full transition-all duration-700">
                          {d.split('-').reverse().join('/')}
                        </span>
                      ))}
                      {selectedDates.length > 3 && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full transition-all duration-700">+{selectedDates.length - 3}</span>}
                    </div>
                  </div>
                  
                  {supplierStockByDate.length > 0 ? (
                    <div className="space-y-6">
                      {/* Totals by Product Type */}
                      <div className="bg-titam-deep/5 p-4 rounded-xl border border-titam-deep/10 transition-all duration-700">
                        <p className="text-[10px] font-bold text-titam-deep uppercase tracking-widest mb-3">Total por Tipo de Produto (Período Selecionado)</p>
                        <div className="flex flex-wrap gap-4">
                          {productStockByDate.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white border border-gray-100 px-3 py-1.5 rounded-lg shadow-sm transition-all duration-700">
                              <span className="text-xs font-medium text-gray-600">{p.name}:</span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-bold text-titam-deep">{p.count}</span>
                                <span className="text-[10px] text-gray-400 font-medium">NFs</span>
                                <span className="text-gray-300 mx-1">|</span>
                                <span className="text-sm font-bold text-titam-lime">{p.tons.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                <span className="text-[10px] text-gray-400 font-medium">Ton</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
  
                      {/* Breakdown by Supplier and Product */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {supplierStockByDate.map((item, idx) => (
                          <div key={idx} className="p-4 rounded-lg border border-gray-100 bg-gray-50/50 flex flex-col transition-all duration-700">
                            <div className="text-center mb-3">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{item.name}</p>
                              <div className="flex items-center justify-center gap-4">
                                <div>
                                  <p className="text-2xl font-black text-titam-deep">{item.count}</p>
                                  <p className="text-[9px] text-gray-400 font-bold uppercase">NFs</p>
                                </div>
                                <div className="w-px h-8 bg-gray-200"></div>
                                <div>
                                  <p className="text-2xl font-black text-titam-lime">{item.tons.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</p>
                                  <p className="text-[9px] text-gray-400 font-bold uppercase">Ton</p>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1.5 pt-3 border-t border-gray-200/50">
                              {item.products.map((p, pi) => (
                                <div key={pi} className="flex flex-col space-y-0.5">
                                  <span className="text-[10px] text-gray-500 truncate font-medium" title={p.name}>{p.name}</span>
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-400">{p.count} NFs</span>
                                    <span className="font-bold text-titam-deep bg-white border border-gray-100 px-1.5 py-0.5 rounded transition-all duration-700">
                                      {p.tons.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Ton
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-gray-400">
                      <Package size={48} className="mb-4 opacity-20" />
                      <p className="text-sm font-medium">Nenhuma nota fiscal recebida nesta data.</p>
                    </div>
                  )}
                </div>
  
                <div className="bg-white border-gray-200 p-6 rounded-xl shadow-sm transition-all duration-700">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <ArrowUpRight size={18} className="text-titam-deep" />
                      Resumo de Saídas por Destino e Produto (Período Selecionado)
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedPeriodExitsSummary.length === 0 ? (
                      <div className="col-span-full text-center py-12 bg-gray-50 border border-gray-200 rounded-xl border border-dashed transition-all duration-700">
                        <p className="text-gray-400 text-sm">Nenhuma saída no período selecionado.</p>
                      </div>
                    ) : (
                      selectedPeriodExitsSummary.map((destData) => (
                        <div key={destData.destination} className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 transition-all duration-700">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-1.5 h-4 bg-titam-lime rounded-full"></div>
                            <h4 className="text-xs font-black text-gray-700 uppercase tracking-tight">{destData.destination}</h4>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(destData.products).map(([prod, data]) => (
                              <div key={prod} className="bg-white border border-gray-100 p-3 rounded-lg flex justify-between items-center shadow-sm transition-all duration-700">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">{prod}</span>
                                  <span className="text-xs font-black text-titam-deep">{data.count} Unidades</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] font-bold text-titam-lime uppercase leading-none block mb-1">Peso Total</span>
                                  <span className="text-xs font-black text-titam-deep">{data.tons.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Ton</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
  
                {/* Monthly Accumulated Exits Section */}
                <div className="bg-white border-gray-200 p-6 rounded-xl border shadow-sm transition-all duration-700">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Calendar size={18} className="text-titam-deep" />
                      Acumulado de Saídas por Mês (Destino e Material)
                    </h3>
                    <div className="flex gap-2">
                      <button 
                        onClick={exportDashboardPDF}
                        className="px-3 py-1.5 bg-titam-deep text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-all flex items-center gap-2"
                      >
                        <FileDown size={14} />
                        Exportar PDF
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-8">
                    {monthlyAccumulatedExits.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-xl border border-dashed transition-all duration-700">
                        <p className="text-gray-400 text-sm">Nenhuma saída registrada até o momento.</p>
                      </div>
                    ) : (
                      monthlyAccumulatedExits.map((monthData) => (
                        <div key={monthData.month} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm transition-all duration-700">
                          <div className="bg-titam-deep px-4 py-3 flex justify-between items-center">
                            <h4 className="text-white font-bold uppercase tracking-wider text-sm">
                              {(() => {
                                const [y, m] = monthData.month.split('-');
                                return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                              })()}
                            </h4>
                            <div className="flex gap-4 text-white/80 text-[10px] font-bold uppercase">
                              <span>Total Mês: {Object.values(monthData.destinations).reduce((acc, d) => acc + Object.values(d.products).reduce((pAcc, p) => pAcc + p.count, 0), 0)} Un</span>
                              <span>|</span>
                              <span>{Object.values(monthData.destinations).reduce((acc, d) => acc + Object.values(d.products).reduce((pAcc, p) => pAcc + p.tons, 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Ton</span>
                            </div>
                          </div>
                          
                          <div className="divide-y divide-gray-100">
                            {Object.entries(monthData.destinations).map(([dest, destData]) => (
                              <div key={dest} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-2 h-2 rounded-full bg-titam-lime"></div>
                                  <span className="text-xs font-black text-gray-700 uppercase tracking-tight">{dest}</span>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {Object.entries(destData.products).map(([prod, prodData]) => (
                                    <div key={prod} className="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center shadow-sm transition-all duration-700">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">{prod}</span>
                                        <span className="text-xs font-black text-titam-deep">{prodData.count} Unidades</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-[10px] font-bold text-titam-lime uppercase leading-none block mb-1">Peso Total</span>
                                        <span className="text-xs font-black text-titam-deep">{prodData.tons.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} Ton</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
            </motion.div>
          )}

          {activeTab === 'entrada' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-700">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Total Entradas (Período)</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-titam-deep">{dailyStats.arrival_count}</span>
                    <span className="text-xs text-gray-400 font-bold">UNIDADES</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-700">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Peso Total (Período)</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-titam-lime">{dailyStats.arrival_tons.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
                    <span className="text-xs text-gray-400 font-bold">TONELADAS</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-700">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Média por NF</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-titam-deep">
                      {dailyStats.arrival_count > 0 ? (dailyStats.arrival_tons / dailyStats.arrival_count).toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '0,0'}
                    </span>
                    <span className="text-xs text-gray-400 font-bold">TON/NF</span>
                  </div>
                </div>
              </div>

              <DataView 
                title="Gestão de Entradas"
                entries={filteredEntriesByProduct}
                readOnly={selectedBranchId === 'all'}
                columns={[
                  { key: 'mes', label: 'Mês' },
                  { key: 'data_nf', label: 'Data NF' },
                  { key: 'nf_numero', label: 'N.F' },
                  { key: 'id_lote', label: 'ID Lote' },
                  { key: 'data_descarga', label: 'Data Descarga' },
                  { key: 'tonelada', label: 'Tonelada' },
                  { key: 'valor', label: 'Valor' },
                  { key: 'fornecedor', label: 'Fornecedor' },
                  { key: 'container', label: 'Container' },
                  { key: 'hora_chegada', label: 'Chegada' },
                  { key: 'hora_entrada', label: 'Entrada' },
                  { key: 'hora_saida', label: 'Saída' },
                  { key: 'total_time' as any, label: 'Tempo Total' },
                  { key: 'descarga_time' as any, label: 'Tempo Descarga' },
                  { key: 'status', label: 'Status' }
                ]}
                onEdit={setSelectedEntry}
                onDelete={handleDeleteEntry}
                onBulkDelete={handleBulkDeleteEntries}
              />
          </div>
        )}

          {activeTab === 'saida' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-700">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Total Saídas (Período)</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-titam-deep">{dailyStats.exited}</span>
                    <span className="text-xs text-gray-400 font-bold">UNIDADES</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-700">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Peso Total (Período)</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-titam-lime">{dailyStats.exited_tons.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
                    <span className="text-xs text-gray-400 font-bold">TONELADAS</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-700">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Média por NF</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-titam-deep">
                      {dailyStats.exited > 0 ? (dailyStats.exited_tons / dailyStats.exited).toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '0,0'}
                    </span>
                    <span className="text-xs text-gray-400 font-bold">TON/NF</span>
                  </div>
                </div>
              </div>

              <DataView 
                title="Gestão de Saídas"
                entries={filteredEntriesByProduct}
                readOnly={selectedBranchId === 'all'}
                columns={[
                  { key: 'data_posicionamento', label: 'Data Posicionamento' },
                  { key: 'nf_numero', label: 'N.F' },
                  { key: 'id_lote', label: 'ID Lote' },
                  { key: 'descricao_produto', label: 'Produto' },
                  { key: 'tonelada', label: 'Tonelada' },
                  { key: 'container', label: 'Container' },
                  { key: 'transportador', label: 'Transportador' },
                  { key: 'cliente', label: 'Cliente' },
                  { key: 'data_carregamento_rodoviario', label: 'Carregamento Rod.' },
                  { key: 'placa_saida', label: 'Placa Saída' },
                  { key: 'data_faturamento_vli', label: 'Data Fat. VLI' },
                  { key: 'horario_posicionamento', label: 'Horário de Posicionamento' },
                  { key: 'horario_faturamento', label: 'Horário de Faturamento' },
                  { key: 'numero_vagao', label: 'Nº Vagão' },
                  { key: 'destino', label: 'Destino' },
                  { key: 'fornecedor', label: 'Fornecedor' },
                  { key: 'status', label: 'Status' }
                ]}
                onEdit={setSelectedEntry}
                onDelete={handleDeleteEntry}
                onBulkDelete={handleBulkDeleteEntries}
              />
            </div>
          )}

          {activeTab === 'faturamento' && (
            <DataView 
              title="Faturamento e CTEs"
              entries={filteredEntriesByProduct}
              readOnly={selectedBranchId === 'all'}
              columns={[
                { key: 'data_emissao_nf', label: 'Emissão NF' },
                { key: 'nf_numero', label: 'N.F' },
                { key: 'data_emissao_cte', label: 'Emissão CTE Intertex' },
                { key: 'cte_intertex', label: 'CTE Intertex' },
                { key: 'data_emissao_cte_transp', label: 'Emissão CTE Transp.' },
                { key: 'cte_transportador', label: 'CTE Transp.' },
                { key: 'data_titam', label: 'Data TITAM' },
                { key: 'faturamento_titam', label: 'Faturamento Titam' }
              ]}
              onEdit={setSelectedEntry}
              onDelete={handleDeleteEntry}
              onBulkDelete={handleBulkDeleteEntries}
            />
          )}

          {activeTab === 'lista' && (
            <DataView 
              title="Todos os Registros"
              entries={filteredEntriesByProduct}
              readOnly={selectedBranchId === 'all'}
              columns={[
                { key: 'nf_numero', label: 'N.F' },
                { key: 'descricao_produto', label: 'Produto' },
                { key: 'fornecedor', label: 'Fornecedor' },
                { key: 'container', label: 'Container' },
                { key: 'data_posicionamento', label: 'Data Posicionamento' },
                { key: 'status', label: 'Status' },
                { key: 'created_by_email' as any, label: 'Usuário' },
                { key: 'data_nf', label: 'Data NF' }
              ]}
              onEdit={setSelectedEntry}
              onDelete={handleDeleteEntry}
              onBulkDelete={handleBulkDeleteEntries}
            />
          )}

          {activeTab === 'relatorios' && (
            <ReportsView 
              entries={filteredEntriesByProduct} 
              onExportBackup={exportBackup} 
              onImportBackup={importBackup} 
              onUndoLastImport={undoLastImport}
              isProcessing={isProcessing}
              isTitam={isTitam}
              isExitEntry={isExitEntry}
              getExitDate={getExitDate}
              branches={branches}
            />
          )}

          {activeTab === 'fluxo' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-titam-deep uppercase tracking-tight">Fluxo de Veículos</h2>
                  <p className="text-gray-500 text-sm">Controle operacional de entrada e saída do pátio</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Externa */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-700">
                  <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
                    <h3 className="font-bold text-sm uppercase tracking-wider">Fila Externa</h3>
                    <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-black">
                      {yardEntries.filter(e => e.hora_chegada && !e.hora_entrada).length}
                    </span>
                  </div>
                  <div className="p-4 space-y-3 max-h-[600px] overflow-auto">
                    {yardEntries.filter(e => e.hora_chegada && !e.hora_entrada).length === 0 ? (
                      <p className="text-center py-8 text-gray-400 text-xs italic">Nenhum veículo na fila externa</p>
                    ) : (
                      yardEntries.filter(e => e.hora_chegada && !e.hora_entrada).map(e => (
                        <div key={e.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-black text-gray-900">{e.placa_veiculo}</span>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">Chegada: {e.hora_chegada}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate">{e.fornecedor}</p>
                          <button 
                            onClick={() => handleQuickStatusUpdate(e.id, 'entrada')}
                            className="w-full py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition-colors uppercase"
                          >
                            Registrar Entrada
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Interna */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-700">
                  <div className="p-4 bg-amber-500 text-white flex justify-between items-center">
                    <h3 className="font-bold text-sm uppercase tracking-wider">Fila Interna</h3>
                    <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-black">
                      {yardEntries.filter(e => e.hora_entrada && !e.hora_saida).length}
                    </span>
                  </div>
                  <div className="p-4 space-y-3 max-h-[600px] overflow-auto">
                    {yardEntries.filter(e => e.hora_entrada && !e.hora_saida).length === 0 ? (
                      <p className="text-center py-8 text-gray-400 text-xs italic">Nenhum veículo na fila interna</p>
                    ) : (
                      yardEntries.filter(e => e.hora_entrada && !e.hora_saida).map(e => (
                        <div key={e.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-black text-gray-900">{e.placa_veiculo}</span>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">Entrada: {e.hora_entrada}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate">{e.fornecedor}</p>
                          <button 
                            onClick={() => handleQuickStatusUpdate(e.id, 'saida')}
                            className="w-full py-1.5 bg-amber-500 text-white text-[10px] font-bold rounded hover:bg-amber-600 transition-colors uppercase"
                          >
                            Registrar Saída
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Saída */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-700">
                  <div className="p-4 bg-titam-lime text-titam-deep flex justify-between items-center">
                    <h3 className="font-bold text-sm uppercase tracking-wider">Saídas de Hoje</h3>
                    <span className="bg-titam-deep/10 px-2 py-0.5 rounded text-xs font-black">
                      {yardEntries.filter(e => e.hora_saida).length}
                    </span>
                  </div>
                  <div className="p-4 space-y-3 max-h-[600px] overflow-auto">
                    {yardEntries.filter(e => e.hora_saida).length === 0 ? (
                      <p className="text-center py-8 text-gray-400 text-xs italic">Nenhuma saída registrada hoje</p>
                    ) : (
                      yardEntries.filter(e => e.hora_saida).map(e => (
                        <div key={e.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-black text-gray-900">{e.placa_veiculo}</span>
                            <span className="text-[10px] font-bold text-titam-deep bg-titam-lime/20 px-1.5 py-0.5 rounded uppercase">Saída: {e.hora_saida}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate">{e.fornecedor}</p>
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-gray-400 uppercase">T. Total:</span>
                            <span className="text-titam-deep">{calculateTimeDiff(e.hora_chegada, e.hora_saida)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'containers' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-titam-deep uppercase tracking-tight">Gestão de Containers</h2>
                  <p className="text-gray-500 text-sm">Controle de disponibilidade e manutenção de frota</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-700">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Disponíveis para Carga</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-600">
                      {containers.filter(c => c.status === 'Disponível').length}
                    </span>
                    <span className="text-xs text-gray-400 font-bold uppercase">Unidades</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-700">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Em Manutenção</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-amber-500">
                      {containers.filter(c => c.status === 'Em Manutenção').length}
                    </span>
                    <span className="text-xs text-gray-400 font-bold uppercase">Unidades</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all duration-700">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Em Uso / Operação</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-blue-600">
                      {containers.filter(c => c.status === 'Em Uso').length}
                    </span>
                    <span className="text-xs text-gray-400 font-bold uppercase">Unidades</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white lg:col-span-2 rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-700">
                  <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex justify-between items-center transition-all duration-700">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Lista de Containers</h3>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Total: {containers.length}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 transition-all duration-700">
                          <th className="px-6 py-4">Número</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Observação</th>
                          {selectedBranchId !== 'all' && (
                            <th className="px-6 py-4 text-right">Ações</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {containers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-xs italic">
                              Nenhum container cadastrado
                            </td>
                          </tr>
                        ) : (
                          containers.map(container => (
                            <tr key={container.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-6 py-4">
                                <span className="text-xs font-black text-titam-deep uppercase tracking-wider">{container.numero}</span>
                              </td>
                              <td className="px-6 py-4">
                                <select 
                                  value={container.status}
                                  disabled={selectedBranchId === 'all'}
                                  onChange={(e) => handleUpdateContainer(container.id, { status: e.target.value as any })}
                                  className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest outline-none border-none ${
                                    selectedBranchId === 'all' ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                                  } ${
                                    container.status === 'Disponível' ? 'bg-emerald-50 text-emerald-600' :
                                    container.status === 'Em Manutenção' ? 'bg-amber-50 text-amber-600' :
                                    'bg-blue-50 text-blue-600'
                                  }`}
                                >
                                  <option value="Disponível">Disponível</option>
                                  <option value="Em Manutenção">Em Manutenção</option>
                                  <option value="Em Uso">Em Uso</option>
                                </select>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] text-gray-500 font-medium">{container.observacao || '-'}</span>
                              </td>
                              {selectedBranchId !== 'all' && (
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => handleDeleteContainer(container.id)}
                                    className="p-2 text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-fit sticky top-6 transition-all duration-700">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep mb-6">Novo Container</h3>
                  {selectedBranchId === 'all' ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col items-center text-center gap-3">
                      <AlertCircle size={24} className="text-amber-500" />
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest leading-relaxed">
                        Selecione uma filial específica no menu lateral para cadastrar novos containers.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const numero = (form.elements.namedItem('numero') as HTMLInputElement).value;
                      const status = (form.elements.namedItem('status') as HTMLSelectElement).value as any;
                      const obs = (form.elements.namedItem('observacao') as HTMLTextAreaElement).value;
                      handleCreateContainer(numero, status, obs);
                      form.reset();
                    }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Número do Container</label>
                        <input 
                          name="numero"
                          required
                          placeholder="EX: TITU1234567"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-titam-lime/20 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Inicial</label>
                        <select 
                          name="status"
                          required
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-titam-lime/20 focus:bg-white outline-none transition-all"
                        >
                          <option value="Disponível">Disponível</option>
                          <option value="Em Manutenção">Em Manutenção</option>
                          <option value="Em Uso">Em Uso</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Observação</label>
                        <textarea 
                          name="observacao"
                          rows={3}
                          placeholder="DETALHES DA MANUTENÇÃO OU USO..."
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-titam-lime/20 focus:bg-white outline-none transition-all resize-none"
                        />
                      </div>
                      <button 
                        type="submit"
                        className="w-full py-4 bg-titam-deep text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-titam-deep/90 transition-all shadow-lg shadow-titam-deep/20"
                      >
                        Cadastrar Container
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'apresentacao' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-titam-deep uppercase tracking-tight">Apresentação Institucional</h2>
                  <p className="text-gray-500 text-sm">Visão estratégica e de engenharia de processos da filial Titam</p>
                </div>
              </div>

              <TitamPresentationView 
                entries={entries} 
                containers={containers} 
                branches={branches} 
              />
            </motion.div>
          )}

          {activeTab === 'filiais' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-titam-deep uppercase tracking-tight">Gestão de Filiais</h2>
                  <p className="text-gray-500 text-sm">Cadastre e gerencie as unidades da empresa</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white lg:col-span-2 rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-700">
                  <div className="bg-gray-50/50 p-4 border-b border-gray-100 flex justify-between items-center transition-all duration-700">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Lista de Filiais</h3>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Total: {branches.length}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 transition-all duration-700">
                          <th className="px-6 py-4">Nome</th>
                          <th className="px-6 py-4">Código</th>
                          <th className="px-6 py-4">Localização</th>
                          <th className="px-6 py-4">Usuários Ativos (Registros)</th>
                          {selectedBranchId === 'all' && (
                            <th className="px-6 py-4 text-right">Ações</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {branches.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-xs italic">
                              Nenhuma filial cadastrada
                            </td>
                          </tr>
                        ) : (
                          branches.map(branch => (
                            <tr key={branch.id} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="px-6 py-4">
                                <span className="text-xs font-black text-titam-deep uppercase tracking-wider">{branch.name}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] font-black bg-gray-100 px-2 py-1 rounded uppercase tracking-widest">{branch.code}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-[10px] text-gray-500 font-medium">{branch.location || '-'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto">
                                  {branchUsersSummary[branch.id]?.length > 0 ? (
                                    branchUsersSummary[branch.id].map((u, ui) => (
                                      <div key={ui} className="flex items-center gap-2 text-[10px]">
                                        <span className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 truncate max-w-[200px]" title={u.email}>
                                          {u.email}
                                        </span>
                                        <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/50">
                                          {u.count} {u.count === 1 ? 'registro' : 'registros'}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic">Sem registros ativos</span>
                                  )}
                                </div>
                              </td>
                              {selectedBranchId === 'all' && (
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => handleDeleteBranch(branch.id)}
                                    className="p-2 text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-fit sticky top-6 transition-all duration-700">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep mb-6">Nova Filial</h3>
                  {selectedBranchId !== 'all' ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col items-center text-center gap-3">
                      <AlertCircle size={24} className="text-amber-500" />
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest leading-relaxed">
                        Selecione "Todas as Filiais" no menu lateral para gerenciar e cadastrar novas unidades.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                      const code = (form.elements.namedItem('code') as HTMLInputElement).value;
                      const location = (form.elements.namedItem('location') as HTMLInputElement).value;
                      handleCreateBranch(name, code, location);
                      form.reset();
                    }} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nome da Filial</label>
                        <input 
                          name="name"
                          required
                          placeholder="EX: UNIDADE VITÓRIA"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-titam-lime/20 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Código / Sigla</label>
                        <input 
                          name="code"
                          required
                          placeholder="EX: VIX-01"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-titam-lime/20 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Localização</label>
                        <input 
                          name="location"
                          placeholder="EX: SERRA, ES"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-titam-lime/20 focus:bg-white outline-none transition-all"
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={isProcessing}
                        className="w-full py-4 bg-titam-deep text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-titam-deep/90 transition-all shadow-lg shadow-titam-deep/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                        Cadastrar Filial
                      </button>
                    </form>
                  )}

                  {/* Migration Tool */}
                  {(entries.some(e => !e.branchId) || containers.some(c => !c.branchId)) && (
                    <div className="mt-8 pt-8 border-t border-dashed border-gray-200">
                      <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle size={16} className="text-amber-500" />
                        <h4 className="font-bold text-[10px] uppercase tracking-widest text-titam-deep">Manutenção de Dados</h4>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-4 leading-relaxed">
                        Foram encontrados registros sem filial vinculada. Deseja mover todos para uma filial específica?
                      </p>
                      <div className="space-y-3">
                        <select 
                          id="migration-target"
                          className="w-full px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-amber-200 outline-none transition-all"
                        >
                          <option value="">Selecionar Destino...</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => {
                            const select = document.getElementById('migration-target') as HTMLSelectElement;
                            handleMigrateOrphanData(select.value);
                          }}
                          disabled={isProcessing}
                          className="w-full py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <SyncIcon size={14} />}
                          Vincular Registros
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Painel de Auditoria de Status de NF */}
              <div className="bg-white border-gray-200 shadow-sm p-6 rounded-xl border space-y-4 transition-all duration-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-titam-lime/15 text-titam-deep rounded-xl flex items-center justify-center border border-titam-lime/20">
                      <AlertCircle size={18} className="text-titam-deep" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Auditoria de Status de NF-e</h3>
                      <p className="text-gray-500 text-xs mt-1">Verifique se as NFs sofreram alterações de status hoje</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">NFs para Consultar:</span>
                    <input
                      type="text"
                      placeholder="Ex: 17745, 17743..."
                      value={nfAuditSearch}
                      onChange={(e) => setNfAuditSearch(e.target.value)}
                      className="border border-gray-200 bg-gray-50/50 rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-titam-lime outline-none transition-all w-full sm:w-64"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {nfAuditResults.map((result, idx) => {
                    const statusColors: Record<string, string> = {
                      'Estoque': 'bg-emerald-50 text-emerald-700 border-emerald-100',
                      'Estoque (Cheio Terminal)': 'bg-emerald-50 text-emerald-700 border-emerald-100',
                      'Embarcado': 'bg-blue-50 text-blue-700 border-blue-100',
                      'Devolvido': 'bg-amber-50 text-amber-700 border-amber-100',
                      'Rejeitado': 'bg-red-50 text-red-700 border-red-100',
                      'Em descarga': 'bg-purple-50 text-purple-700 border-purple-100',
                      'Em descarga na Arcelor': 'bg-purple-50 text-purple-700 border-purple-100',
                    };

                    const badgeClass = statusColors[result.currentStatus] || 'bg-gray-50 text-gray-600 border-gray-100';

                    return (
                      <div 
                        key={idx} 
                        className={`rounded-xl border p-4 space-y-3 transition-all ${
                          result.changedToday 
                            ? 'bg-emerald-50/15 border-emerald-500/20 shadow-sm shadow-emerald-500/5' 
                            : 'bg-white border-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-titam-deep tracking-wider">NF: {result.nf}</span>
                          
                          {result.changedToday ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              Alterada Hoje
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-gray-100 text-gray-400">
                              Sem alteração hoje
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-400 font-medium uppercase tracking-wider">Status Atual:</span>
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
                              {result.currentStatus}
                            </span>
                          </div>

                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-400 font-medium uppercase tracking-wider">Filial:</span>
                            <span className="text-gray-700 font-bold uppercase tracking-wider">{result.branchName}</span>
                          </div>

                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-400 font-medium uppercase tracking-wider">Último Usuário:</span>
                            <span className="text-gray-600 font-bold font-mono truncate max-w-[120px]">{result.updatedBy}</span>
                          </div>

                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-400 font-medium uppercase tracking-wider">Última Atualização:</span>
                            <span className="text-gray-500 font-bold font-mono text-[10px]">{result.updatedAt}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Auditoria de Atividade por Horário */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-700">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Auditoria de Lançamentos e Atividade por Horário</h3>
                    <p className="text-gray-500 text-xs mt-1">Selecione a filial, data e horário para identificar quais usuários lançaram registros ou realizaram ações no sistema.</p>
                  </div>
                </div>
                
                {/* Filters */}
                <div className="p-6 bg-gray-50/50 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filial</label>
                    <select
                      value={auditBranchId}
                      onChange={(e) => setAuditBranchId(e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-titam-lime outline-none bg-white transition-all"
                    >
                      <option value="all">Todas as Filiais</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</label>
                    <input
                      type="date"
                      value={auditDate}
                      onChange={(e) => setAuditDate(e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-titam-lime outline-none bg-white transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Horário Inicial</label>
                    <input
                      type="time"
                      value={auditStartTime}
                      onChange={(e) => setAuditStartTime(e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-titam-lime outline-none bg-white transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Horário Final</label>
                    <input
                      type="time"
                      value={auditEndTime}
                      onChange={(e) => setAuditEndTime(e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-titam-lime outline-none bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Audit Results */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Usuário</th>
                        <th className="px-6 py-4">Filial</th>
                        <th className="px-6 py-4">Data/Hora (UTC)</th>
                        <th className="px-6 py-4">Data/Hora (Local)</th>
                        <th className="px-6 py-4">Tipo de Ação / Registro</th>
                        <th className="px-6 py-4">Identificador (NF/Container)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {auditResults.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-xs italic">
                            Nenhuma atividade encontrada para os filtros selecionados
                          </td>
                        </tr>
                      ) : (
                        auditResults.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{item.email}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-bold text-titam-deep uppercase">{item.branchName}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-[10px] text-gray-400">{item.createdAtUTC}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs font-bold text-gray-600">{item.createdAtLocal}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-medium text-gray-500">{item.action}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs font-bold text-titam-deep bg-titam-lime/15 px-2 py-0.5 rounded border border-titam-lime/20">{item.identifier}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'cadastros' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-titam-deep uppercase tracking-tight">Base de Cadastros</h2>
                  <p className="text-gray-500 text-sm">Gerencie fornecedores, transportadores e clientes por filial</p>
                </div>
              </div>
              
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Fornecedores', count: suppliers.filter(s => selectedBranchId === 'all' || !selectedBranchId ? true : s.branchId === selectedBranchId).length, icon: <Building2 className="text-blue-600" />, color: 'blue' },
                  { label: 'Transportadores', count: transporters.filter(t => selectedBranchId === 'all' || !selectedBranchId ? true : t.branchId === selectedBranchId).length, icon: <Truck className="text-emerald-600" />, color: 'emerald' },
                  { label: 'Clientes', count: customers.filter(c => selectedBranchId === 'all' || !selectedBranchId ? true : c.branchId === selectedBranchId).length, icon: <Users className="text-indigo-600" />, color: 'indigo' },
                  { label: 'Produtos', count: products.filter(p => selectedBranchId === 'all' || !selectedBranchId ? true : p.branchId === selectedBranchId).length, icon: <Boxes className="text-titam-deep" />, color: 'lime' },
                  { label: 'Destinos', count: destinations.filter(d => selectedBranchId === 'all' || !selectedBranchId ? true : d.branchId === selectedBranchId).length, icon: <MapPin className="text-amber-600" />, color: 'amber' },
                  { label: 'Containers', count: containers.filter(c => selectedBranchId === 'all' || !selectedBranchId ? true : c.branchId === selectedBranchId).length, icon: <Truck className="text-rose-600" />, color: 'rose' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all duration-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-1.5 ${stat.color === 'lime' ? 'bg-titam-lime/20' : `bg-${stat.color}-50`} rounded-lg`}>
                        {stat.icon}
                      </div>
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Cadastrados</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-2xl font-black ${stat.color === 'lime' ? 'text-titam-deep' : `text-${stat.color}-600`} tracking-tighter`}>{stat.count}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{stat.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid Registration Sections */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Fornecedores */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px] transition-all duration-700">
                    <div className="bg-gray-50/50 p-5 border-b border-gray-200 flex items-center gap-3 transition-all duration-700">
                      <Package size={18} className="text-titam-lime" />
                      <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Fornecedores</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {suppliers.filter(s => selectedBranchId === 'all' || !selectedBranchId ? true : s.branchId === selectedBranchId).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                          <Package size={32} className="mb-2" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum fornecedor</p>
                        </div>
                      ) : (
                        suppliers.filter(s => selectedBranchId === 'all' || !selectedBranchId ? true : s.branchId === selectedBranchId).map(sup => (
                          <div key={sup.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-titam-deep uppercase truncate">{sup.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {sup.cnpj && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{sup.cnpj}</p>}
                                {selectedBranchId === 'all' && (
                                  <span className="text-[8px] bg-titam-deep/10 text-titam-deep px-1.5 py-0.5 rounded-full font-black uppercase">
                                    {branches.find(b => b.id === sup.branchId)?.name || 'N/A'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => {
                                  setEditingRegistration({ id: sup.id, type: 'suppliers', data: sup });
                                  const form = document.getElementById('form-suppliers');
                                  form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className="p-1.5 text-gray-300 hover:text-titam-deep hover:bg-white rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteSupplier(sup.id)}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div id="form-suppliers" className="p-5 border-t border-gray-100 bg-gray-50/30">
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                        const cnpj = (form.elements.namedItem('cnpj') as HTMLInputElement).value;
                        const branchId = (form.elements.namedItem('branchId') as HTMLSelectElement).value;
                        
                        if (editingRegistration?.type === 'suppliers' && editingRegistration?.id) {
                          handleUpdateSupplier(editingRegistration.id, name, branchId, cnpj);
                        } else {
                          handleCreateSupplier(name, branchId, cnpj);
                        }
                        form.reset();
                      }} className="space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-titam-deep uppercase tracking-widest">
                            {editingRegistration?.type === 'suppliers' ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                          </span>
                          {editingRegistration?.type === 'suppliers' && (
                            <button 
                              type="button"
                              onClick={() => setEditingRegistration(null)}
                              className="text-[10px] font-bold text-red-500 uppercase hover:underline"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        <select 
                          name="branchId" 
                          required 
                          defaultValue={editingRegistration?.type === 'suppliers' ? editingRegistration.data.branchId : (selectedBranchId !== 'all' ? selectedBranchId : "")}
                          key={`sup-branch-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-[10px] font-black border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase bg-white"
                        >
                          <option value="" disabled>Selecionar Filial</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <input 
                          name="name" 
                          required 
                          placeholder="Nome do Fornecedor" 
                          defaultValue={editingRegistration?.type === 'suppliers' ? editingRegistration.data.name : ""}
                          key={`sup-name-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase" 
                        />
                        <input 
                          name="cnpj" 
                          placeholder="CNPJ (Opcional)" 
                          defaultValue={editingRegistration?.type === 'suppliers' ? editingRegistration.data.cnpj : ""}
                          key={`sup-cnpj-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase" 
                        />
                        <button type="submit" disabled={isProcessing} className="w-full py-2.5 bg-titam-deep text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-titam-deep/90 transition-all flex items-center justify-center gap-2">
                          {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : (editingRegistration?.type === 'suppliers' ? <Check size={14} /> : <Plus size={14} />)} 
                          {editingRegistration?.type === 'suppliers' ? 'Salvar Alterações' : 'Adicionar Fornecedor'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Transportadores */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px] transition-all duration-700">
                    <div className="bg-gray-50/50 p-5 border-b border-gray-200 flex items-center gap-3 transition-all duration-700">
                      <Truck size={18} className="text-titam-lime" />
                      <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Transportadores</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {transporters.filter(t => selectedBranchId === 'all' || !selectedBranchId ? true : t.branchId === selectedBranchId).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                          <Truck size={32} className="mb-2" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum transportador</p>
                        </div>
                      ) : (
                        transporters.filter(t => selectedBranchId === 'all' || !selectedBranchId ? true : t.branchId === selectedBranchId).map(tr => (
                          <div key={tr.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-titam-deep uppercase truncate">{tr.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {tr.cnpj && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{tr.cnpj}</p>}
                                {selectedBranchId === 'all' && (
                                  <span className="text-[8px] bg-titam-deep/10 text-titam-deep px-1.5 py-0.5 rounded-full font-black uppercase">
                                    {branches.find(b => b.id === tr.branchId)?.name || 'N/A'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => {
                                  setEditingRegistration({ id: tr.id, type: 'transporters', data: tr });
                                  const form = document.getElementById('form-transporters');
                                  form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className="p-1.5 text-gray-300 hover:text-titam-deep hover:bg-white rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteTransporter(tr.id)}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div id="form-transporters" className="p-5 border-t border-gray-100 bg-gray-50/30">
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                        const cnpj = (form.elements.namedItem('cnpj') as HTMLInputElement).value;
                        const branchId = (form.elements.namedItem('branchId') as HTMLSelectElement).value;
                        
                        if (editingRegistration?.type === 'transporters' && editingRegistration?.id) {
                          handleUpdateTransporter(editingRegistration.id, name, branchId, cnpj);
                        } else {
                          handleCreateTransporter(name, branchId, cnpj);
                        }
                        form.reset();
                      }} className="space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-titam-deep uppercase tracking-widest">
                            {editingRegistration?.type === 'transporters' ? 'Editar Transportador' : 'Novo Transportador'}
                          </span>
                          {editingRegistration?.type === 'transporters' && (
                            <button 
                              type="button"
                              onClick={() => setEditingRegistration(null)}
                              className="text-[10px] font-bold text-red-500 uppercase hover:underline"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        <select 
                          name="branchId" 
                          required 
                          defaultValue={editingRegistration?.type === 'transporters' ? editingRegistration.data.branchId : (selectedBranchId !== 'all' ? selectedBranchId : "")}
                          key={`tr-branch-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-[10px] font-black border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase bg-white"
                        >
                          <option value="" disabled>Selecionar Filial</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <input 
                          name="name" 
                          required 
                          placeholder="Nome do Transportador" 
                          defaultValue={editingRegistration?.type === 'transporters' ? editingRegistration.data.name : ""}
                          key={`tr-name-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase" 
                        />
                        <input 
                          name="cnpj" 
                          placeholder="CNPJ (Opcional)" 
                          defaultValue={editingRegistration?.type === 'transporters' ? editingRegistration.data.cnpj : ""}
                          key={`tr-cnpj-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase" 
                        />
                        <button type="submit" disabled={isProcessing} className="w-full py-2.5 bg-titam-deep text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-titam-deep/90 transition-all flex items-center justify-center gap-2">
                          {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : (editingRegistration?.type === 'transporters' ? <Check size={14} /> : <Plus size={14} />)} 
                          {editingRegistration?.type === 'transporters' ? 'Salvar Alterações' : 'Adicionar Transportador'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Clientes */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px] transition-all duration-700">
                    <div className="bg-gray-50/50 p-5 border-b border-gray-200 flex items-center gap-3 transition-all duration-700">
                      <Building2 size={18} className="text-titam-lime" />
                      <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Clientes</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {customers.filter(c => selectedBranchId === 'all' || !selectedBranchId ? true : c.branchId === selectedBranchId).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                          <Building2 size={32} className="mb-2" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum cliente</p>
                        </div>
                      ) : (
                        customers.filter(c => selectedBranchId === 'all' || !selectedBranchId ? true : c.branchId === selectedBranchId).map(cl => (
                          <div key={cl.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-titam-deep uppercase truncate">{cl.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {cl.cnpj && <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{cl.cnpj}</p>}
                                {selectedBranchId === 'all' && (
                                  <span className="text-[8px] bg-titam-deep/10 text-titam-deep px-1.5 py-0.5 rounded-full font-black uppercase">
                                    {branches.find(b => b.id === cl.branchId)?.name || 'N/A'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => {
                                  setEditingRegistration({ id: cl.id, type: 'customers', data: cl });
                                  const form = document.getElementById('form-customers');
                                  form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className="p-1.5 text-gray-300 hover:text-titam-deep hover:bg-white rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteCustomer(cl.id)}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div id="form-customers" className="p-5 border-t border-gray-100 bg-gray-50/30">
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                        const cnpj = (form.elements.namedItem('cnpj') as HTMLInputElement).value;
                        const branchId = (form.elements.namedItem('branchId') as HTMLSelectElement).value;
                        
                        if (editingRegistration?.type === 'customers' && editingRegistration?.id) {
                          handleUpdateCustomer(editingRegistration.id, name, branchId, cnpj);
                        } else {
                          handleCreateCustomer(name, branchId, cnpj);
                        }
                        form.reset();
                      }} className="space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-titam-deep uppercase tracking-widest">
                            {editingRegistration?.type === 'customers' ? 'Editar Cliente' : 'Novo Cliente'}
                          </span>
                          {editingRegistration?.type === 'customers' && (
                            <button 
                              type="button"
                              onClick={() => setEditingRegistration(null)}
                              className="text-[10px] font-bold text-red-500 uppercase hover:underline"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        <select 
                          name="branchId" 
                          required 
                          defaultValue={editingRegistration?.type === 'customers' ? editingRegistration.data.branchId : (selectedBranchId !== 'all' ? selectedBranchId : "")}
                          key={`cl-branch-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-[10px] font-black border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase bg-white"
                        >
                          <option value="" disabled>Selecionar Filial</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <input 
                          name="name" 
                          required 
                          placeholder="Nome do Cliente" 
                          defaultValue={editingRegistration?.type === 'customers' ? editingRegistration.data.name : ""}
                          key={`cl-name-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase" 
                        />
                        <input 
                          name="cnpj" 
                          placeholder="CNPJ (Opcional)" 
                          defaultValue={editingRegistration?.type === 'customers' ? editingRegistration.data.cnpj : ""}
                          key={`cl-cnpj-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase" 
                        />
                        <button type="submit" disabled={isProcessing} className="w-full py-2.5 bg-titam-deep text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-titam-deep/90 transition-all flex items-center justify-center gap-2">
                          {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : (editingRegistration?.type === 'customers' ? <Check size={14} /> : <Plus size={14} />)} 
                          {editingRegistration?.type === 'customers' ? 'Salvar Alterações' : 'Adicionar Cliente'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Produtos */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px] transition-all duration-700">
                    <div className="bg-gray-50/50 p-5 border-b border-gray-200 flex items-center gap-3 transition-all duration-700">
                      <Boxes size={18} className="text-titam-lime" />
                      <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Produtos</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {products.filter(p => selectedBranchId === 'all' || !selectedBranchId ? true : p.branchId === selectedBranchId).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                          <Boxes size={32} className="mb-2" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum produto</p>
                        </div>
                      ) : (
                        products.filter(p => selectedBranchId === 'all' || !selectedBranchId ? true : p.branchId === selectedBranchId).map(prod => (
                          <div key={prod.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-titam-deep uppercase truncate">{prod.name}</p>
                              {selectedBranchId === 'all' && (
                                <span className="text-[8px] bg-titam-deep/10 text-titam-deep px-1.5 py-0.5 rounded-full font-black uppercase">
                                  {branches.find(b => b.id === prod.branchId)?.name || 'N/A'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => {
                                  setEditingRegistration({ id: prod.id, type: 'products', data: prod });
                                  const form = document.getElementById('form-products');
                                  form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className="p-1.5 text-gray-300 hover:text-titam-deep hover:bg-white rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                         ))
                       )}
                     </div>

                    <div id="form-products" className="p-5 border-t border-gray-100 bg-gray-50/30">
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                        const branchId = (form.elements.namedItem('branchId') as HTMLSelectElement).value;
                        
                        if (editingRegistration?.type === 'products' && editingRegistration?.id) {
                          handleUpdateProduct(editingRegistration.id, name, branchId);
                        } else {
                          handleCreateProduct(name, branchId);
                        }
                        form.reset();
                      }} className="space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-titam-deep uppercase tracking-widest">
                            {editingRegistration?.type === 'products' ? 'Editar Produto' : 'Novo Produto'}
                          </span>
                          {editingRegistration?.type === 'products' && (
                            <button 
                              type="button"
                              onClick={() => setEditingRegistration(null)}
                              className="text-[10px] font-bold text-red-500 uppercase hover:underline"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        <select 
                          name="branchId" 
                          required 
                          defaultValue={editingRegistration?.type === 'products' ? editingRegistration.data.branchId : (selectedBranchId !== 'all' ? selectedBranchId : "")}
                          key={`prod-branch-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-[10px] font-black border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase bg-white"
                        >
                          <option value="" disabled>Selecionar Filial</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <input 
                          name="name" 
                          required 
                          placeholder="Nome do Produto" 
                          defaultValue={editingRegistration?.type === 'products' ? editingRegistration.data.name : ""}
                          key={`prod-name-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase" 
                        />
                        <button type="submit" disabled={isProcessing} className="w-full py-2.5 bg-titam-deep text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-titam-deep/90 transition-all flex items-center justify-center gap-2">
                          {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : (editingRegistration?.type === 'products' ? <Check size={14} /> : <Plus size={14} />)} 
                          {editingRegistration?.type === 'products' ? 'Salvar Alterações' : 'Adicionar Produto'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>

                {/* Destinos */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px] transition-all duration-700">
                    <div className="bg-gray-50/50 p-5 border-b border-gray-200 flex items-center gap-3 transition-all duration-700">
                      <MapPin size={18} className="text-titam-lime" />
                      <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Destinos</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {destinations.filter(d => selectedBranchId === 'all' || !selectedBranchId ? true : d.branchId === selectedBranchId).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                          <MapPin size={32} className="mb-2" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum destino</p>
                        </div>
                      ) : (
                        destinations.filter(d => selectedBranchId === 'all' || !selectedBranchId ? true : d.branchId === selectedBranchId).map(dest => (
                          <div key={dest.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-titam-deep uppercase truncate">{dest.name}</p>
                              {selectedBranchId === 'all' && (
                                <span className="text-[8px] bg-titam-deep/10 text-titam-deep px-1.5 py-0.5 rounded-full font-black uppercase">
                                  {branches.find(b => b.id === dest.branchId)?.name || 'N/A'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => {
                                  setEditingRegistration({ id: dest.id, type: 'destinations', data: dest });
                                  const form = document.getElementById('form-destinations');
                                  form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className="p-1.5 text-gray-300 hover:text-titam-deep hover:bg-white rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteDestination(dest.id)}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div id="form-destinations" className="p-5 border-t border-gray-100 bg-gray-50/30">
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                        const branchId = (form.elements.namedItem('branchId') as HTMLSelectElement).value;
                        
                        if (editingRegistration?.type === 'destinations' && editingRegistration?.id) {
                          handleUpdateDestination(editingRegistration.id, name, branchId);
                        } else {
                          handleCreateDestination(name, branchId);
                        }
                        form.reset();
                      }} className="space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black text-titam-deep uppercase tracking-widest">
                            {editingRegistration?.type === 'destinations' ? 'Editar Destino' : 'Novo Destino'}
                          </span>
                          {editingRegistration?.type === 'destinations' && (
                            <button 
                              type="button"
                              onClick={() => setEditingRegistration(null)}
                              className="text-[10px] font-bold text-red-500 uppercase hover:underline"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        <select 
                          name="branchId" 
                          required 
                          defaultValue={editingRegistration?.type === 'destinations' ? editingRegistration.data.branchId : (selectedBranchId !== 'all' ? selectedBranchId : "")}
                          key={`dest-branch-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-[10px] font-black border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase bg-white"
                        >
                          <option value="" disabled>Selecionar Filial</option>
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <input 
                          name="name" 
                          required 
                          placeholder="Nome do Destino" 
                          defaultValue={editingRegistration?.type === 'destinations' ? editingRegistration.data.name : ""}
                          key={`dest-name-${editingRegistration?.id || 'new'}`}
                          className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase" 
                        />
                      </form>
                    </div>
                  </div>
                </div>

                {/* Containers */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px] transition-all duration-700">
                    <div className="bg-gray-50/50 p-5 border-b border-gray-200 flex items-center justify-between transition-all duration-700">
                      <div className="flex items-center gap-3">
                        <Truck size={18} className="text-titam-lime" />
                        <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Containers</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCleanDuplicateContainers}
                          disabled={isProcessing}
                          title="Eliminar containers com números duplicados"
                          className="text-[9px] bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider transition-all flex items-center gap-1 border border-red-100 hover:border-red-200"
                        >
                          <Trash2 size={10} />
                          Eliminar Duplicados
                        </button>
                        <span className="text-[10px] bg-titam-deep/10 text-titam-deep px-1.5 py-0.5 rounded-full font-black uppercase">
                          {containers.filter(c => selectedBranchId === 'all' || !selectedBranchId ? true : c.branchId === selectedBranchId).length}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {containers.filter(c => selectedBranchId === 'all' || !selectedBranchId ? true : c.branchId === selectedBranchId).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                          <Truck size={32} className="mb-2" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum container</p>
                        </div>
                      ) : (
                        containers.filter(c => selectedBranchId === 'all' || !selectedBranchId ? true : c.branchId === selectedBranchId).map(container => (
                          <div key={container.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-titam-deep uppercase truncate">{container.numero}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${
                                  container.status === 'Disponível' ? 'bg-emerald-50 text-emerald-600' :
                                  container.status === 'Em Manutenção' ? 'bg-amber-50 text-amber-600' :
                                  'bg-blue-50 text-blue-600'
                                }`}>
                                  {container.status}
                                </span>
                                {selectedBranchId === 'all' && (
                                  <span className="text-[8px] bg-titam-deep/10 text-titam-deep px-1.5 py-0.5 rounded-full font-black uppercase">
                                    {branches.find(b => b.id === container.branchId)?.name || 'N/A'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => {
                                  setEditingRegistration({ id: container.id, type: 'containers', data: container });
                                  const form = document.getElementById('form-containers');
                                  form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className="p-1.5 text-gray-300 hover:text-titam-deep hover:bg-white rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteContainer(container.id)}
                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div id="form-containers" className="p-5 border-t border-gray-100 bg-gray-50/30">
                      {/* Tabs for registration type: only show if not editing */}
                      {!editingRegistration || editingRegistration.type !== 'containers' ? (
                        <div className="flex bg-gray-100 p-1 rounded-lg mb-3">
                          <button 
                            type="button" 
                            onClick={() => setContainerRegMode('individual')}
                            className={`flex-1 text-[9px] font-black uppercase py-1.5 rounded-md transition-all ${
                              containerRegMode === 'individual' ? 'bg-white text-titam-deep shadow-sm' : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            Individual
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setContainerRegMode('lote')}
                            className={`flex-1 text-[9px] font-black uppercase py-1.5 rounded-md transition-all ${
                              containerRegMode === 'lote' ? 'bg-white text-titam-deep shadow-sm' : 'text-gray-500 hover:text-gray-900'
                            }`}
                          >
                            Em Lote (Lista)
                          </button>
                        </div>
                      ) : null}

                      {editingRegistration?.type === 'containers' || containerRegMode === 'individual' ? (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.target as HTMLFormElement;
                          const numero = (form.elements.namedItem('numero') as HTMLInputElement).value;
                          const status = (form.elements.namedItem('status') as HTMLSelectElement).value as any;
                          const branchId = (form.elements.namedItem('branchId') as HTMLSelectElement).value;
                          const obs = (form.elements.namedItem('observacao') as HTMLInputElement).value;
                          
                          if (editingRegistration?.type === 'containers' && editingRegistration?.id) {
                            handleUpdateContainer(editingRegistration.id, { numero, status, branchId, observacao: obs });
                          } else {
                            handleCreateContainer(numero, status, obs, branchId);
                          }
                          form.reset();
                        }} className="space-y-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black text-titam-deep uppercase tracking-widest">
                              {editingRegistration?.type === 'containers' ? 'Editar Container' : 'Novo Container'}
                            </span>
                            {editingRegistration?.type === 'containers' && (
                              <button 
                                type="button"
                                onClick={() => setEditingRegistration(null)}
                                className="text-[10px] font-bold text-red-500 uppercase hover:underline"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                          <select 
                            name="branchId" 
                            required 
                            defaultValue={editingRegistration?.type === 'containers' ? editingRegistration.data.branchId : (selectedBranchId !== 'all' ? selectedBranchId : "")}
                            key={`cont-branch-${editingRegistration?.id || 'new'}`}
                            className="w-full px-4 py-2 text-[10px] font-black border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase bg-white"
                          >
                            <option value="" disabled>Selecionar Filial</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                          <input 
                            name="numero" 
                            required 
                            placeholder="Número do Container" 
                            defaultValue={editingRegistration?.type === 'containers' ? editingRegistration.data.numero : ""}
                            key={`cont-numero-${editingRegistration?.id || 'new'}`}
                            className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase" 
                          />
                          <select 
                            name="status"
                            required
                            defaultValue={editingRegistration?.type === 'containers' ? editingRegistration.data.status : "Disponível"}
                            key={`cont-status-${editingRegistration?.id || 'new'}`}
                            className="w-full px-4 py-2 text-[10px] font-black border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase bg-white"
                          >
                            <option value="Disponível">Disponível</option>
                            <option value="Em Manutenção">Em Manutenção</option>
                            <option value="Em Uso">Em Uso</option>
                          </select>
                          <input 
                            name="observacao" 
                            placeholder="Observação (Opcional)" 
                            defaultValue={editingRegistration?.type === 'containers' ? editingRegistration.data.observacao : ""}
                            key={`cont-obs-${editingRegistration?.id || 'new'}`}
                            className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase" 
                          />
                          <button type="submit" disabled={isProcessing} className="w-full py-2.5 bg-titam-deep text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-titam-deep/90 transition-all flex items-center justify-center gap-2">
                            {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : (editingRegistration?.type === 'containers' ? <Check size={14} /> : <Plus size={14} />)} 
                            {editingRegistration?.type === 'containers' ? 'Salvar Alterações' : 'Adicionar Container'}
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.target as HTMLFormElement;
                          const lista = (form.elements.namedItem('lista') as HTMLTextAreaElement).value;
                          const status = (form.elements.namedItem('status') as HTMLSelectElement).value as any;
                          const branchId = (form.elements.namedItem('branchId') as HTMLSelectElement).value;
                          
                          handleBulkCreateContainers(lista, status, branchId);
                          form.reset();
                        }} className="space-y-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-black text-titam-deep uppercase tracking-widest">
                              Cadastrar em Lote
                            </span>
                          </div>
                          <select 
                            name="branchId" 
                            required 
                            defaultValue={selectedBranchId !== 'all' ? selectedBranchId : ""}
                            className="w-full px-4 py-2 text-[10px] font-black border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase bg-white"
                          >
                            <option value="" disabled>Selecionar Filial</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                          <select 
                            name="status"
                            required
                            defaultValue="Disponível"
                            className="w-full px-4 py-2 text-[10px] font-black border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase bg-white"
                          >
                            <option value="Disponível">Disponível</option>
                            <option value="Em Manutenção">Em Manutenção</option>
                            <option value="Em Uso">Em Uso</option>
                          </select>
                          <textarea 
                            name="lista" 
                            required 
                            rows={3}
                            placeholder="INSIRA OS NÚMEROS DE CONTAINER SEPARADOS POR LINHA, VÍRGULA OU PONTO-E-VÍRGULA..." 
                            className="w-full px-4 py-2 text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-titam-lime/20 outline-none uppercase resize-none" 
                          />
                          <button type="submit" disabled={isProcessing} className="w-full py-2.5 bg-titam-deep text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-titam-deep/90 transition-all flex items-center justify-center gap-2">
                            {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />} 
                            Adicionar Lista
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Confirmation Modal */}
        <AnimatePresence>
          {showEditConfirm && selectedEntry && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-700"
              >
                <div className="p-6 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle size={32} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Confirmar Edição</h2>
                  <p className="text-gray-500 mb-6">
                    Você tem certeza que deseja salvar as alterações feitas neste registro?
                    <span className="block mt-2 font-semibold text-titam-deep">
                      NF: {selectedEntry.nf_numero}
                    </span>
                    {lastUpdateError && (
                      <span className="block mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 font-medium animate-pulse">
                        ⚠️ {lastUpdateError}
                      </span>
                    )}
                  </p>
                  
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => {
                        setShowEditConfirm(false);
                        setLastUpdateError(null);
                      }}
                      disabled={isUpdating}
                      className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={async () => {
                        const success = await handleUpdateEntry(selectedEntry.id, editFormData);
                        if (success) {
                          setShowEditConfirm(false);
                          setSelectedEntry(null);
                          setLastUpdateError(null);
                        }
                      }}
                      disabled={isUpdating}
                      className={`flex-1 px-4 py-2 bg-titam-lime text-titam-deep rounded-lg hover:opacity-90 transition-colors font-bold shadow-md flex items-center justify-center gap-2 ${isUpdating ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {isUpdating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-titam-deep/30 border-t-titam-deep rounded-full animate-spin" />
                          Salvando...
                        </>
                      ) : 'Confirmar'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirmation && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-700"
              >
                <div className="p-6 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle size={32} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Confirmar Exclusão</h2>
                  <p className="text-gray-500 mb-6">
                    Você tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
                    {entries.find(e => e.id === deleteConfirmation) && (
                      <span className="block mt-2 font-semibold text-titam-deep">
                        NF: {entries.find(e => e.id === deleteConfirmation)?.nf_numero}
                      </span>
                    )}
                  </p>
                  
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => setDeleteConfirmation(null)}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={executeDelete}
                      disabled={isDeleting}
                      className={`flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {isDeleting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Excluindo...
                        </>
                      ) : (
                        <>
                          <Trash2 size={18} />
                          Excluir
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {bulkDeleteConfirmation && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-700"
              >
                <div className="p-6 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                    <Trash2 size={32} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Exclusão em Massa</h2>
                  <p className="text-gray-500 mb-6">
                    Você tem certeza que deseja excluir <span className="font-black text-red-600">{bulkDeleteConfirmation.length}</span> registros selecionados? Esta ação é irreversível.
                  </p>
                  
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => setBulkDeleteConfirmation(null)}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={executeBulkDelete}
                      disabled={isDeleting}
                      className={`flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {isDeleting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Excluindo...
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          Confirmar ({bulkDeleteConfirmation.length})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Entry Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto transition-all duration-700"
            >
              <div className="p-6 border-b border-gray-100 bg-white flex justify-between items-center sticky top-0 backdrop-blur-md z-10 transition-all duration-700">
                <h2 className="text-xl font-semibold text-gray-900">Nova Entrada de Produto</h2>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setImportingNfe(true)}
                    className="flex items-center gap-2 text-titam-deep border border-titam-lime hover:bg-titam-lime/10 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                  >
                    <FileJson size={16} />
                    Importar NF-e
                  </button>
                  <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={24} />
                  </button>
                </div>
              </div>
              <form 
                key={JSON.stringify(formData)}
                onSubmit={handleCreateEntry} 
                className="p-8 space-y-8"
              >
                {!isVoltaRedonda ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mês de Referência</label>
                      <input 
                        name="mes" 
                        required 
                        defaultValue={formData.mes || getMonthName(formData.data_nf || formData.data_posicionamento || new Date().toISOString().split('T')[0])} 
                        className="border border-gray-200 bg-gray-50 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700"
                      />
                    </div>
                    <Input label="Chave de Acesso NF" name="chave_acesso" required defaultValue={formData.chave_acesso} />
                    <Input label="N.F" name="nf_numero" required defaultValue={formData.nf_numero} />
                    <Input 
                      label="Tonelada" 
                      name="tonelada" 
                      type="text" 
                      required 
                      defaultValue={formData.tonelada !== undefined ? Number(formData.tonelada).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} 
                      placeholder="0,00" 
                    />
                    <Input 
                      label="Valor" 
                      name="valor" 
                      type="text" 
                      maxLength={12} 
                      required 
                      defaultValue={formData.valor !== undefined ? Number(formData.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} 
                      placeholder="0,00" 
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição Produto</label>
                      <select name="descricao_produto" defaultValue={formData.descricao_produto || ""} className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700 font-bold uppercase" required>
                        <option value="" disabled>Selecione o produto</option>
                        <option value="Cal Dolomítico">Cal Dolomítico</option>
                        <option value="Cal Calcítico">Cal Calcítico</option>
                        <option value="Bobina de Aço">Bobina de Aço</option>
                        {isTitam && <option value="Minério de Ferro">Minério de Ferro</option>}
                        {products.filter(p => p.branchId === selectedBranchId).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>
                    <Input label="ID do Lote" name="id_lote" defaultValue={formData.id_lote} />
                    <Input label="Data N.F" name="data_nf" type="date" required defaultValue={formData.data_nf} />
                    <Input label="Data Descarga" name="data_descarga" type="date" required defaultValue={formData.data_descarga} />
                    <Input label="Data de Posicionamento" name="data_posicionamento" type="date" defaultValue={formData.data_posicionamento} />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                      <select name="status" defaultValue={formData.status || (isTitam ? "Em descarga" : "Estoque")} className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700" required>
                        <option value="Estoque">Estoque</option>
                        <option value="Em descarga">Em descarga</option>
                        <option value="Trânsito Cheio">Trânsito Cheio</option>
                        <option value="Rejeitado">Rejeitado</option>
                        <option value="Embarcado">Embarcado</option>
                        <option value="Devolvido">Devolvido</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fornecedor</label>
                      <select name="fornecedor" defaultValue={formData.fornecedor || ""} className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700" required>
                        <option value="" disabled>Selecione o fornecedor</option>
                        {suppliers.filter(s => s.branchId === selectedBranchId).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <Input label="Placa do Veículo" name="placa_veiculo" defaultValue={formData.placa_veiculo} />
                    <ContainerSearchField 
                      label="Container" 
                      name="container" 
                      defaultValue={formData.container} 
                      branchId={selectedBranchId || ''}
                      containers={containers}
                      branches={branches}
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Destino</label>
                      <select name="destino" defaultValue={formData.destino || ""} className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700 font-bold uppercase" required>
                        <option value="" disabled>Selecione o destino</option>
                        <option value="Serra - ES">Serra - ES</option>
                        <option value="Resende - RJ">Resende - RJ</option>
                        <option value="Cosmorama - SP">Cosmorama - SP</option>
                        {isTitam && <option value="Timoteo - MG">Timoteo - MG</option>}
                        {destinations.filter(d => d.branchId === selectedBranchId).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        {customers.filter(c => c.branchId === selectedBranchId).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mês de Referência</label>
                      <input 
                        name="mes" 
                        defaultValue={formData.mes || getMonthName(formData.data_nf || new Date().toISOString().split('T')[0])} 
                        className="border border-gray-200 bg-gray-50 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700"
                      />
                    </div>
                    <Input label="Chave de Acesso NF" name="chave_acesso" defaultValue={formData.chave_acesso} />
                    <Input label="N.F" name="nf_numero" defaultValue={formData.nf_numero} />
                    <Input 
                      label="Tonelada" 
                      name="tonelada" 
                      type="text" 
                      defaultValue={formData.tonelada !== undefined ? Number(formData.tonelada).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} 
                      placeholder="0,00" 
                    />
                    <Input 
                      label="Valor" 
                      name="valor" 
                      type="text" 
                      maxLength={12} 
                      defaultValue={formData.valor !== undefined ? Number(formData.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} 
                      placeholder="0,00" 
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição Produto</label>
                      <select name="descricao_produto" defaultValue={formData.descricao_produto || ""} className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700 font-bold uppercase" required>
                        <option value="" disabled>Selecione o produto</option>
                        <option value="Cal Dolomítico">Cal Dolomítico</option>
                        <option value="Cal Calcítico">Cal Calcítico</option>
                        <option value="Bobina de Aço">Bobina de Aço</option>
                        <option value="Vazio">Vazio</option>
                        {products.filter(p => p.branchId === selectedBranchId).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>
                    <Input label="ID do Lote" name="id_lote" defaultValue={formData.id_lote} />
                    <Input label="Data N.F" name="data_nf" type="date" defaultValue={formData.data_nf} />
                    <Input label="Data Descarga" name="data_descarga" type="date" defaultValue={formData.data_descarga} />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                      <select name="status" defaultValue={(formData.status as any) === 'Em descarga' ? 'Em descarga na Arcelor' : ((formData.status as any) === 'Estoque' ? 'Estoque (Cheio Terminal)' : ((formData.status as any) === 'Transito vazio' || (formData.status as any) === 'Trânsito Vazio' ? 'Trânsito Vazio (Arcos)' : (formData.status || "Trânsito Cheio")))} className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700" required>
                        <option value="Trânsito Cheio">Trânsito Cheio</option>
                        <option value="Estoque (Cheio Terminal)">Estoque (Cheio Terminal)</option>
                        <option value="Em descarga na Arcelor">Em descarga na Arcelor</option>
                        <option value="Vazio Terminal">Vazio Terminal</option>
                        <option value="Trânsito Vazio (Arcos)">Trânsito Vazio (Arcos)</option>
                        <option value="Rejeitado">Rejeitado</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fornecedor</label>
                      <select name="fornecedor" defaultValue={formData.fornecedor || ""} className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700" required>
                        <option value="" disabled>Selecione o fornecedor</option>
                        {suppliers.filter(s => s.branchId === selectedBranchId).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Destino</label>
                      <select name="destino" defaultValue={formData.destino || ""} className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700" required>
                        <option value="" disabled>Selecione o destino</option>
                        <option value="Arcos - MG">Arcos - MG</option>
                        {destinations.filter(d => d.branchId === selectedBranchId).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                    <ContainerSearchField 
                      label="Container" 
                      name="container" 
                      defaultValue={formData.container} 
                      branchId={selectedBranchId || ''}
                      containers={containers}
                      branches={branches}
                    />
                  </div>
                )}

                {!isVoltaRedonda && (
                  <>
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-gray-100">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transportador</label>
                        <select name="transportador" defaultValue={formData.transportador || ""} className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700">
                          <option value="">Selecione o transportador</option>
                          {transporters.filter(t => t.branchId === selectedBranchId).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</label>
                        <select name="cliente" defaultValue={formData.cliente || ""} className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700">
                          <option value="">Selecione o cliente</option>
                          {customers.filter(c => c.branchId === selectedBranchId).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <Input label="Data Carregamento Rodoviário" name="data_carregamento_rodoviario" type="date" defaultValue={formData.data_carregamento_rodoviario} />
                      <Input label="Placa do Veículo (Saída)" name="placa_saida" defaultValue={formData.placa_saida} />
                    </div>

                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
                      <Input label="Hora Chegada" name="hora_chegada" type="time" defaultValue={formData.hora_chegada} />
                      <Input label="Hora Entrada" name="hora_entrada" type="time" defaultValue={formData.hora_entrada} />
                      <Input label="Hora Saída" name="hora_saida" type="time" defaultValue={formData.hora_saida} />
                    </div>

                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-gray-100">
                      <Input label="Data Emissão NF" name="data_emissao_nf" type="date" defaultValue={formData.data_emissao_nf} />
                      <Input label="Emissão CTE Intertex" name="data_emissao_cte" type="date" defaultValue={formData.data_emissao_cte} />
                      <Input label="CTE Intertex" name="cte_intertex" defaultValue={formData.cte_intertex} />
                      <Input label="Emissão CTE Transp." name="data_emissao_cte_transp" type="date" defaultValue={formData.data_emissao_cte_transp} />
                      <Input label="CTE Transportador" name="cte_transportador" defaultValue={formData.cte_transportador} />
                      <Input label="Data TITAM" name="data_titam" type="date" defaultValue={formData.data_titam} />
                      <Input label="Faturamento Titam" name="faturamento_titam" defaultValue={formData.faturamento_titam} />
                      <Input label="Data Faturamento VLI" name="data_faturamento_vli" type="date" defaultValue={formData.data_faturamento_vli} />
                      <Input label="Nº Vagão" name="numero_vagao" defaultValue={formData.numero_vagao} />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 mt-4 border-t border-gray-100 pt-6">
                  <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors" disabled={isSaving}>Cancelar</button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-6 py-2 bg-titam-lime text-titam-deep shadow-titam-lime/20 rounded-lg hover:opacity-90 transition-all font-bold shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : 'Salvar Registro'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* NF-e Import Modal */}
        {importingNfe && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-8 transition-all duration-700"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Importar Dados da NF-e</h2>
                <button onClick={() => setImportingNfe(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <p className="text-gray-500 text-sm mb-4">Cole o conteúdo XML da Nota Fiscal ou o texto extraído para preenchimento automático.</p>
              <textarea 
                className="w-full h-48 border border-gray-200 bg-white text-gray-900 rounded-xl p-4 focus:ring-2 focus:ring-titam-lime outline-none font-mono text-sm mb-6 transition-all duration-700"
                placeholder="Cole o XML aqui..."
                value={nfeContent}
                onChange={(e) => setNfeContent(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setImportingNfe(false)} 
                  className="px-6 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={async () => {
                    try {
                      setIsProcessing(true);
                      const res = await fetch('/api/parse-nfe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: nfeContent }),
                      });
                      const data = await res.json();
                      if (data.error) throw new Error(data.error);
                      setFormData(data);
                      setImportingNfe(false);
                      setNfeContent('');
                    } catch (err) {
                      alert("Erro ao processar NF-e. Verifique o conteúdo.");
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  disabled={isProcessing || !nfeContent}
                  className="px-6 py-2 bg-titam-lime text-titam-deep shadow-titam-lime/20 rounded-lg hover:opacity-90 transition-all flex items-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-titam-deep/30 border-t-titam-deep rounded-full animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Search size={18} />
                      Processar com IA
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit Modal (Generic for Exit, Performance, Billing) */}
        {selectedEntry && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto transition-all duration-700"
            >
              <div className="p-6 border-b border-gray-100 bg-white flex justify-between items-center sticky top-0 backdrop-blur-md z-10 transition-all duration-700">
                <h2 className="text-xl font-semibold text-gray-900">Atualizar Registro: NF {selectedEntry.nf_numero}</h2>
                <button onClick={() => { setSelectedEntry(null); setShowEditConfirm(false); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-8">
                {(() => {
                  const editBranch = branches.find(b => b.id === editFormData.branchId);
                  const isVREdit = editBranch?.name?.toLowerCase().includes('volta redonda') || false;
                  const isTitamEdit = editBranch?.name?.toLowerCase().includes('titam') || false;
                  return (
                    <>
                {/* Section: Entrada */}
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-titam-lime uppercase tracking-widest">Informações de Entrada</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Input 
                      label="Número NF" 
                      value={editFormData.nf_numero || ''} 
                      onChange={(e) => setEditFormData(prev => ({ ...prev, nf_numero: e.target.value }))}
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Fornecedor</label>
                      <select 
                        value={editFormData.fornecedor || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, fornecedor: e.target.value }))}
                        className="border border-gray-100 bg-gray-50/50 text-gray-900 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-titam-lime/30 focus:border-titam-lime focus:bg-white outline-none transition-all font-bold uppercase"
                      >
                        <option value="">Selecione o fornecedor</option>
                        {suppliers.filter(s => s.branchId === editFormData.branchId).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        {!suppliers.filter(s => s.branchId === editFormData.branchId).find(s => s.name === editFormData.fornecedor) && editFormData.fornecedor && (
                          <option value={editFormData.fornecedor}>{editFormData.fornecedor}</option>
                        )}
                      </select>
                    </div>
                    {!isVREdit && (
                      <Input 
                        label="Placa Veículo" 
                        value={editFormData.placa_veiculo || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, placa_veiculo: e.target.value }))}
                      />
                    )}
                    <Input 
                      label="Data NF" 
                      type="date"
                      value={editFormData.data_nf || ''} 
                      onChange={(e) => setEditFormData(prev => ({ ...prev, data_nf: e.target.value }))}
                    />
                    <Input 
                      label="Data Descarga" 
                      type="date"
                      value={editFormData.data_descarga || ''} 
                      onChange={(e) => setEditFormData(prev => ({ ...prev, data_descarga: e.target.value }))}
                    />
                    <div className="col-span-2 md:col-span-3">
                      <Input 
                        label="Chave de Acesso" 
                        value={editFormData.chave_acesso || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, chave_acesso: e.target.value }))}
                      />
                    </div>
                  </div>
                </section>

                {/* Section: Informações Gerais */}
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-600 uppercase tracking-widest">Informações Gerais</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mês de Referência</label>
                      <input 
                        value={editFormData.mes || getMonthName(editFormData.data_nf || editFormData.data_posicionamento)}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, mes: e.target.value }))}
                        className="border border-gray-200 bg-gray-50 text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição Produto</label>
                      <select 
                        value={editFormData.descricao_produto || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, descricao_produto: e.target.value }))}
                        className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700 font-bold uppercase"
                      >
                        <option value="">Selecione o produto</option>
                        <option value="Cal Dolomítico">Cal Dolomítico</option>
                        <option value="Cal Calcítico">Cal Calcítico</option>
                        <option value="Bobina de Aço">Bobina de Aço</option>
                        {isVREdit && <option value="Vazio">Vazio</option>}
                        {isTitamEdit && <option value="Minério de Ferro">Minério de Ferro</option>}
                        {products.filter(p => p.branchId === editFormData.branchId).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        {/* Fallback for existing value not in list */}
                        {editFormData.descricao_produto && 
                         !["Cal Dolomítico", "Cal Calcítico", "Bobina de Aço", "Vazio", "Minério de Ferro"].includes(editFormData.descricao_produto) &&
                         !products.some(p => p.name === editFormData.descricao_produto && p.branchId === editFormData.branchId) && (
                           <option key="current" value={editFormData.descricao_produto}>{editFormData.descricao_produto}</option>
                        )}
                      </select>
                    </div>
                    <Input 
                      label="ID do Lote" 
                      value={editFormData.id_lote || ''} 
                      onChange={(e) => setEditFormData(prev => ({ ...prev, id_lote: e.target.value }))}
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Destino</label>
                      <select 
                        value={editFormData.destino || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, destino: e.target.value }))}
                        className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700 font-bold uppercase"
                      >
                        <option value="">Selecione o destino</option>
                        <option value="Serra - ES">Serra - ES</option>
                        <option value="Resende - RJ">Resende - RJ</option>
                        <option value="Cosmorama - SP">Cosmorama - SP</option>
                        {(branches.find(b => b.id === editFormData.branchId)?.name?.toLowerCase().includes('titam') || isTitam) && <option value="Timoteo - MG">Timoteo - MG</option>}
                        {isVREdit && <option value="Arcos - MG">Arcos - MG</option>}
                        {destinations.filter(d => d.branchId === editFormData.branchId).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        {customers
                          .filter(c => c.branchId === editFormData.branchId)
                          .filter(c => isVREdit ? c.name !== "ARCELORMITTAL SUL FLUMINENSE S.A" : true)
                          .map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        {!customers.filter(c => c.branchId === editFormData.branchId).find(c => c.name === editFormData.destino) && 
                         !destinations.filter(d => d.branchId === editFormData.branchId).find(d => d.name === editFormData.destino) && 
                         editFormData.destino && !["Serra - ES", "Resende - RJ", "Cosmorama - SP", "Timoteo - MG", "Arcos - MG"].includes(editFormData.destino) && (
                          <option value={editFormData.destino}>{editFormData.destino}</option>
                        )}
                      </select>
                    </div>
                    <ContainerSearchField 
                      label="Container" 
                      name="container" 
                      value={editFormData.container || ''} 
                      onChange={(val) => setEditFormData(prev => ({ ...prev, container: val }))}
                      branchId={editFormData.branchId || ''}
                      containers={containers}
                      branches={branches}
                    />
                    <Input 
                      label="Tonelada" 
                      type="text"
                      value={editFormData.tonelada !== undefined ? (typeof editFormData.tonelada === 'number' ? editFormData.tonelada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : editFormData.tonelada) : ''} 
                      onChange={(e) => setEditFormData(prev => ({ ...prev, tonelada: e.target.value as any }))}
                    />
                    <Input 
                      label="Valor" 
                      type="text"
                      value={editFormData.valor !== undefined ? (typeof editFormData.valor === 'number' ? editFormData.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : editFormData.valor) : ''} 
                      onChange={(e) => setEditFormData(prev => ({ ...prev, valor: e.target.value as any }))}
                    />
                    {!isVREdit && (
                      <>
                        <Input 
                          label="Hora Chegada" 
                          type="time" 
                          value={editFormData.hora_chegada || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, hora_chegada: e.target.value }))}
                        />
                        <Input 
                          label="Hora Entrada" 
                          type="time" 
                          value={editFormData.hora_entrada || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, hora_entrada: e.target.value }))}
                        />
                        <Input 
                          label="Hora Saída" 
                          type="time" 
                          value={editFormData.hora_saida || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, hora_saida: e.target.value }))}
                        />
                      </>
                    )}
                  </div>
                </section>

                {/* Section: Saída */}
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-titam-deep uppercase tracking-widest">Informações de Saída</h3>
                  
                  {isVREdit && (
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 mb-4">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Modal de Transporte</label>
                      <div className="flex gap-4 mt-2">
                        <button 
                          type="button"
                          onClick={() => setEditFormData(prev => ({ ...prev, modal: 'Rodoviário' }))}
                          className={`flex-1 py-2 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-xs font-bold ${editFormData.modal === 'Rodoviário' ? 'border-titam-lime bg-titam-lime/5 text-titam-deep' : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'}`}
                        >
                          Rodoviário
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEditFormData(prev => ({ ...prev, modal: 'Ferroviário' }))}
                          className={`flex-1 py-2 px-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 text-xs font-bold ${editFormData.modal === 'Ferroviário' ? 'border-titam-lime bg-titam-lime/5 text-titam-deep' : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'}`}
                        >
                          Ferroviário
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {(!isVREdit || editFormData.modal === 'Rodoviário') && (
                      <>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Transportador</label>
                          <select 
                            value={editFormData.transportador || ''} 
                            onChange={(e) => setEditFormData(prev => ({ ...prev, transportador: e.target.value }))}
                            className="border border-gray-100 bg-gray-50/50 text-gray-900 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-titam-lime/30 focus:border-titam-lime focus:bg-white outline-none transition-all font-bold uppercase"
                          >
                            <option value="">Selecione o transportador</option>
                            {transporters.filter(t => t.branchId === editFormData.branchId).map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                            {!transporters.filter(t => t.branchId === editFormData.branchId).find(t => t.name === editFormData.transportador) && editFormData.transportador && (
                              <option value={editFormData.transportador}>{editFormData.transportador}</option>
                            )}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Cliente</label>
                          <select 
                            value={editFormData.cliente || ''} 
                            onChange={(e) => setEditFormData(prev => ({ ...prev, cliente: e.target.value }))}
                            className="border border-gray-100 bg-gray-50/50 text-gray-900 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-titam-lime/30 focus:border-titam-lime focus:bg-white outline-none transition-all font-bold uppercase"
                          >
                            <option value="">Selecione o cliente</option>
                            {customers.filter(c => c.branchId === editFormData.branchId).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            {!customers.filter(c => c.branchId === editFormData.branchId).find(c => c.name === editFormData.cliente) && editFormData.cliente && (
                              <option value={editFormData.cliente}>{editFormData.cliente}</option>
                            )}
                          </select>
                        </div>
                        <Input 
                          label="Data Carregamento Rodoviário" 
                          type="date"
                          value={editFormData.data_carregamento_rodoviario || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, data_carregamento_rodoviario: e.target.value }))}
                        />
                        <Input 
                          label="Placa Veículo (Saída)" 
                          value={editFormData.placa_saida || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, placa_saida: e.target.value }))}
                        />
                      </>
                    )}

                    {(!isVREdit || editFormData.modal === 'Ferroviário') && (
                      <>
                        <Input 
                          label="Data de Posicionamento" 
                          type="date" 
                          value={editFormData.data_posicionamento || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, data_posicionamento: e.target.value }))}
                        />
                        <Input 
                          label="Horário de Posicionamento" 
                          type="time"
                          value={editFormData.horario_posicionamento || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, horario_posicionamento: e.target.value }))}
                        />
                        <Input 
                          label="Data Final Carregamento" 
                          type="date"
                          value={editFormData.data_final_carregamento || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, data_final_carregamento: e.target.value }))}
                        />
                        <Input 
                          label="Horário Final Carregamento" 
                          type="time"
                          value={editFormData.horario_final_carregamento || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, horario_final_carregamento: e.target.value }))}
                        />
                        <Input 
                          label="Nº Vagão" 
                          value={editFormData.numero_vagao || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, numero_vagao: e.target.value }))}
                        />
                        <Input 
                          label="Número do Container" 
                          value={editFormData.container || ''} 
                          onChange={(e) => setEditFormData(prev => ({ ...prev, container: e.target.value }))}
                        />
                      </>
                    )}

                    {!isVREdit && (
                      <Input 
                        label="Data Faturamento VLI" 
                        type="date" 
                        value={editFormData.data_faturamento_vli || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, data_faturamento_vli: e.target.value }))}
                      />
                    )}
                    {!isVREdit && (
                      <Input 
                        label="Horário de Faturamento" 
                        type="time"
                        value={editFormData.horario_faturamento || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, horario_faturamento: e.target.value }))}
                      />
                    )}

                     <div className="flex flex-col gap-1">
                       <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Atual</label>
                       <select 
                         value={editFormData.status || ''}
                         onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value as any }))}
                         className="border border-gray-200 bg-white text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700"
                       >
                         {isVREdit ? (
                           <>
                             <option value="Trânsito Cheio">Trânsito Cheio</option>
                             <option value="Estoque (Cheio Terminal)">Estoque (Cheio Terminal)</option>
                             <option value="Em descarga na Arcelor">Em descarga na Arcelor</option>
                             <option value="Vazio Terminal">Vazio Terminal</option>
                             <option value="Trânsito Vazio (Arcos)">Trânsito Vazio (Arcos)</option>
                             <option value="Rejeitado">Rejeitado</option>
                           </>
                         ) : (
                           <>
                             <option value="Estoque">Estoque</option>
                             <option value="Em descarga">Em descarga</option>
                             <option value="Trânsito Cheio">Trânsito Cheio</option>
                             <option value="Rejeitado">Rejeitado</option>
                             <option value="Embarcado">Embarcado</option>
                             <option value="Devolvido">Devolvido</option>
                           </>
                         )}
                       </select>
                     </div>
                  </div>
                </section>

                {/* Section: Faturamento */}
                {!isVREdit && (
                  <section className="space-y-4">
                    <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Faturamento</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Input 
                        label="Data Emissão NF" 
                        type="date" 
                        value={editFormData.data_emissao_nf || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, data_emissao_nf: e.target.value }))}
                      />
                      <Input 
                        label="Emissão CTE Intertex" 
                        type="date" 
                        value={editFormData.data_emissao_cte || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, data_emissao_cte: e.target.value }))}
                      />
                      <Input 
                        label="CTE Intertex" 
                        value={editFormData.cte_intertex || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, cte_intertex: e.target.value }))}
                      />
                      <Input 
                        label="Emissão CTE Transp." 
                        type="date" 
                        value={editFormData.data_emissao_cte_transp || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, data_emissao_cte_transp: e.target.value }))}
                      />
                      <Input 
                        label="CTE Transportador" 
                        value={editFormData.cte_transportador || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, cte_transportador: e.target.value }))}
                      />
                      <Input 
                        label="Data TITAM" 
                        type="date"
                        value={editFormData.data_titam || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, data_titam: e.target.value }))}
                      />
                      <Input 
                        label="Faturamento Titam" 
                        value={editFormData.faturamento_titam || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, faturamento_titam: e.target.value }))}
                      />
                    </div>
                  </section>
                )}
                    </>
                  );
                })()}

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    onClick={() => { setSelectedEntry(null); setShowEditConfirm(false); }} 
                    className="px-6 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => setShowEditConfirm(true)} 
                    disabled={isUpdating}
                    className={`px-8 py-2 bg-titam-lime text-titam-deep rounded-lg hover:opacity-90 transition-colors font-bold shadow-md flex items-center gap-2 ${isUpdating ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Toast Notifications Panel */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {notifications
            .filter(n => n.type !== 'critical')
            .map(n => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                className="pointer-events-auto bg-white rounded-xl shadow-xl border border-gray-100 p-4 flex gap-3 items-start overflow-hidden transition-all duration-300"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {n.type === 'error' && <AlertCircle className="text-red-500" size={18} />}
                  {n.type === 'warning' && <AlertTriangle className="text-amber-500" size={18} />}
                  {n.type === 'info' && <CheckSquare className="text-emerald-500" size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-normal">{n.message}</p>
                </div>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const calculateTimeDiff = (start?: string, end?: string) => {
  if (!start || !end) return '-';
  try {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const d1 = new Date(2000, 0, 1, h1, m1);
    const d2 = new Date(2000, 0, 1, h2, m2);
    let diff = (d2.getTime() - d1.getTime()) / 1000 / 60;
    if (diff < 0) diff += 24 * 60;
    const hours = Math.floor(diff / 60);
    const minutes = Math.round(diff % 60);
    return `${hours}h ${minutes}m`;
  } catch (e) {
    return '-';
  }
};

function ReportsView({ 
  entries, 
  onExportBackup, 
  onImportBackup,
  onUndoLastImport,
  isProcessing,
  isTitam,
  isExitEntry,
  getExitDate,
  branches
}: { 
  entries: Entry[], 
  onExportBackup: () => void, 
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onUndoLastImport: () => void,
  isProcessing: boolean,
  isTitam?: boolean,
  isExitEntry?: (e: Entry | Partial<Entry> | null | undefined) => boolean,
  getExitDate?: (e: Entry | Partial<Entry> | null | undefined, includeDescargaFallback?: boolean) => string,
  branches?: any[]
}) {
  const [reportType, setReportType] = useState<'estoque' | 'faturamento' | 'performance' | 'logistica_vli' | 'faturamento_detalhado' | 'saida_detalhada' | 'transporte_municipal' | 'estoque_minerio' | 'faturamento_bobinas' | 'acumulado_saidas' | 'acumulado_estoque' | 'frota_veiculos'>('estoque');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterFornecedor, setFilterFornecedor] = useState('');
  const [fleetSearch, setFleetSearch] = useState('');

  const filteredEntries = entries.filter(entry => {
    if (reportType === 'acumulado_saidas') {
      if (!isExitEntry || !isExitEntry(entry)) return false;
      const exitDate = getExitDate ? getExitDate(entry, true) : '';
      if (!exitDate) return false;
      const matchesDate = (!startDate || exitDate >= startDate) && (!endDate || exitDate <= endDate);
      const matchesFornecedor = !filterFornecedor || (entry.fornecedor && entry.fornecedor.toLowerCase().includes(filterFornecedor.toLowerCase()));
      return matchesDate && matchesFornecedor;
    }
    if (reportType === 'acumulado_estoque') {
      const isCurrentlyInStock = entry.status === 'Estoque' || entry.status === 'Estoque (Cheio Terminal)';
      if (!isCurrentlyInStock) return false;
      const date = entry.data_nf;
      const matchesDate = (!startDate || date >= startDate) && (!endDate || date <= endDate);
      const matchesFornecedor = !filterFornecedor || (entry.fornecedor && entry.fornecedor.toLowerCase().includes(filterFornecedor.toLowerCase()));
      return matchesDate && matchesFornecedor;
    }
    const date = reportType === 'saida_detalhada' ? (entry.data_faturamento_vli || entry.data_nf) : entry.data_nf;
    const matchesDate = (!startDate || date >= startDate) && (!endDate || date <= endDate);
    const matchesFornecedor = !filterFornecedor || (entry.fornecedor && entry.fornecedor.toLowerCase().includes(filterFornecedor.toLowerCase()));
    const matchesStatus = (reportType === 'estoque' || reportType === 'estoque_minerio') ? (entry.status === 'Estoque' || entry.status === 'Estoque (Cheio Terminal)') : true;
    const matchesProduct = reportType === 'estoque_minerio' 
      ? entry.descricao_produto === 'Minério de Ferro' 
      : reportType === 'faturamento_bobinas'
      ? entry.descricao_produto === 'Bobina de Aço'
      : true;
    return matchesDate && matchesFornecedor && matchesStatus && matchesProduct;
  });

  const getMonthName = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      let date;
      if (dateStr.includes('-')) {
        date = new Date(dateStr + 'T12:00:00');
      } else if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0);
        }
      }
      
      if (!date || isNaN(date.getTime())) return '';
      
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        .replace(/^\w/, (c) => c.toUpperCase());
    } catch (e) {
      return '';
    }
  };

  const acumuladoSaidasData = React.useMemo(() => {
    if (reportType !== 'acumulado_saidas') return [];

    const groups: Record<string, {
      monthKey: string;
      destination: string;
      material: string;
      totalWeight: number;
      supplierMap: Record<string, number>;
    }> = {};

    filteredEntries.forEach(e => {
      const exitDate = getExitDate ? getExitDate(e, true) : '';
      if (!exitDate) return;

      let year = '';
      let month = '';
      if (exitDate.includes('-')) {
        const parts = exitDate.split('-');
        year = parts[0];
        month = parts[1];
      } else if (exitDate.includes('/')) {
        const parts = exitDate.split('/');
        if (parts.length === 3) {
          year = parts[2];
          month = parts[1];
        }
      }

      if (!year || !month) return;
      const monthKey = `${year}-${month.padStart(2, '0')}`;
      const destination = e.destino || 'Não especificado';
      const material = e.descricao_produto || 'Não especificado';
      const supplier = e.fornecedor || 'Não especificado';
      const weight = e.tonelada || 0;

      const groupKey = `${monthKey}|${destination}|${material}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          monthKey,
          destination,
          material,
          totalWeight: 0,
          supplierMap: {}
        };
      }

      groups[groupKey].totalWeight += weight;
      if (!groups[groupKey].supplierMap[supplier]) {
        groups[groupKey].supplierMap[supplier] = 0;
      }
      groups[groupKey].supplierMap[supplier] += weight;
    });

    return Object.values(groups).map(g => {
      const suppliers = Object.entries(g.supplierMap).map(([name, weight]) => {
        const percentage = g.totalWeight > 0 ? (weight / g.totalWeight) * 100 : 0;
        return { name, weight, percentage };
      }).sort((a, b) => b.weight - a.weight);

      return {
        ...g,
        suppliers
      };
    }).sort((a, b) => {
      if (b.monthKey !== a.monthKey) return b.monthKey.localeCompare(a.monthKey);
      if (a.destination !== b.destination) return a.destination.localeCompare(b.destination);
      return a.material.localeCompare(b.material);
    });
  }, [filteredEntries, reportType, getExitDate]);

  const acumuladoEstoqueData = React.useMemo(() => {
    if (reportType !== 'acumulado_estoque') return [];

    const groups: Record<string, {
      branchName: string;
      material: string;
      destino?: string;
      totalWeight: number;
      supplierMap: Record<string, number>;
    }> = {};

    filteredEntries.forEach(e => {
      const eb = branches?.find(b => b.id === e.branchId);
      const branchName = eb?.name || 'Não especificado';
      const material = e.descricao_produto || 'Não especificado';
      const supplier = e.fornecedor || 'Não especificado';
      const weight = e.tonelada || 0;
      const destino = e.destino || 'Não especificado';

      const isTitamBranch = branchName.toLowerCase().includes('titam');
      const groupKey = isTitamBranch ? `${branchName}|${material}|${destino}` : `${branchName}|${material}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          branchName,
          material,
          destino: isTitamBranch ? destino : undefined,
          totalWeight: 0,
          supplierMap: {}
        };
      }

      groups[groupKey].totalWeight += weight;
      if (!groups[groupKey].supplierMap[supplier]) {
        groups[groupKey].supplierMap[supplier] = 0;
      }
      groups[groupKey].supplierMap[supplier] += weight;
    });

    return Object.values(groups).map(g => {
      const suppliers = Object.entries(g.supplierMap).map(([name, weight]) => {
        const percentage = g.totalWeight > 0 ? (weight / g.totalWeight) * 100 : 0;
        return { name, weight, percentage };
      }).sort((a, b) => b.weight - a.weight);

      return {
        ...g,
        suppliers
      };
    }).sort((a, b) => {
      if (a.branchName !== b.branchName) return a.branchName.localeCompare(b.branchName);
      if (a.material !== b.material) return a.material.localeCompare(b.material);
      if (a.destino && b.destino) return a.destino.localeCompare(b.destino);
      return 0;
    });
  }, [filteredEntries, reportType, branches]);

  const fleetData = React.useMemo(() => {
    if (!Array.isArray(filteredEntries)) return [];
    
    const platesMap = new Map<string, {
      plate: string;
      trips: number;
      firstSeen: string;
      lastSeen: string;
      products: Set<string>;
      suppliers: Set<string>;
      destinations: Set<string>;
      lastStatus: string;
    }>();

    filteredEntries.forEach(e => {
      if (!e) return;
      const pIn = e.placa_veiculo?.trim().toUpperCase();
      const pOut = e.placa_saida?.trim().toUpperCase();
      const date = e.data_descarga || e.data_nf || '';
      
      const processPlate = (plate: string) => {
        if (!plate) return;
        if (!platesMap.has(plate)) {
          platesMap.set(plate, {
            plate,
            trips: 0,
            firstSeen: date,
            lastSeen: date,
            products: new Set(),
            suppliers: new Set(),
            destinations: new Set(),
            lastStatus: e.status || ''
          });
        }
        
        const data = platesMap.get(plate)!;
        data.trips += 1;
        if (date) {
          if (!data.firstSeen || date < data.firstSeen) data.firstSeen = date;
          if (!data.lastSeen || date > data.lastSeen) data.lastSeen = date;
        }
        if (e.descricao_produto) data.products.add(e.descricao_produto);
        if (e.fornecedor) data.suppliers.add(e.fornecedor);
        if (e.destino) data.destinations.add(e.destino);
        if (e.status) data.lastStatus = e.status;
      };

      processPlate(pIn);
      if (pOut && pOut !== pIn) {
        processPlate(pOut);
      }
    });

    return Array.from(platesMap.values()).map(p => ({
      ...p,
      products: Array.from(p.products),
      suppliers: Array.from(p.suppliers),
      destinations: Array.from(p.destinations)
    })).sort((a, b) => b.trips - a.trips);
  }, [filteredEntries]);

  const filteredFleet = React.useMemo(() => {
    if (!fleetSearch) return fleetData;
    const search = fleetSearch.toUpperCase();
    return fleetData.filter(item => item.plate.includes(search));
  }, [fleetData, fleetSearch]);

  const exportToCSV = () => {
    if (reportType === 'frota_veiculos') {
      const headers = ['Placa', 'Viagens', 'Produtos Transportados', 'Fornecedores / Destinos', 'Primeira Entrada', 'Última Operação', 'Status Atual'];
      const rows = filteredFleet.map(item => [
        item.plate,
        item.trips.toString(),
        item.products.join(', '),
        [...item.suppliers, ...item.destinations].join(' / '),
        item.firstSeen ? item.firstSeen.split('-').reverse().join('/') : '-',
        item.lastSeen ? item.lastSeen.split('-').reverse().join('/') : '-',
        item.lastStatus || 'Concluído'
      ]);
      const csvContent = [headers, ...rows].map(r => r.map(val => `"${val || ''}"`).join(';')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_frota_veiculos_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    if (reportType === 'acumulado_saidas') {
      const headers = ['Mês', 'Destino', 'Material', 'Peso Total (Ton)', 'Fornecedor', 'Peso Fornecedor (Ton)', 'Percentual (%)'];
      const rows: any[] = [];
      acumuladoSaidasData.forEach(row => {
        row.suppliers.forEach(s => {
          rows.push([
            getMonthName(row.monthKey + "-01"),
            row.destination,
            row.material,
            row.totalWeight.toString().replace('.', ','),
            s.name,
            s.weight.toString().replace('.', ','),
            s.percentage.toFixed(2).replace('.', ',')
          ]);
        });
      });
      const csvContent = [headers, ...rows].map(r => r.map(val => `"${val || ''}"`).join(';')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_acumulado_saidas_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    if (reportType === 'acumulado_estoque') {
      const hasDestino = acumuladoEstoqueData.some(r => r.destino);
      const headers = hasDestino
        ? ['Filial', 'Destino', 'Material', 'Peso Total em Estoque (Ton)', 'Fornecedor', 'Peso Fornecedor (Ton)', 'Percentual (%)']
        : ['Filial', 'Material', 'Peso Total em Estoque (Ton)', 'Fornecedor', 'Peso Fornecedor (Ton)', 'Percentual (%)'];
      const rows: any[] = [];
      acumuladoEstoqueData.forEach(row => {
        row.suppliers.forEach(s => {
          const rowData = hasDestino
            ? [
                row.branchName,
                row.destino || '-',
                row.material,
                row.totalWeight.toString().replace('.', ','),
                s.name,
                s.weight.toString().replace('.', ','),
                s.percentage.toFixed(2).replace('.', ',')
              ]
            : [
                row.branchName,
                row.material,
                row.totalWeight.toString().replace('.', ','),
                s.name,
                s.weight.toString().replace('.', ','),
                s.percentage.toFixed(2).replace('.', ',')
              ];
          rows.push(rowData);
        });
      });
      const csvContent = [headers, ...rows].map(r => r.map(val => `"${val || ''}"`).join(';')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_acumulado_estoque_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const headers = reportType === 'estoque' 
      ? (isTitam 
         ? ['Data NF', 'Data de Descarga', 'NF', 'Container', 'Fornecedor', 'Produto', 'Tonelada', 'Status', 'Número do Vagão']
         : ['Data NF', 'NF', 'Container', 'Fornecedor', 'Produto', 'Tonelada', 'Status', 'Número do Vagão'])
      : reportType === 'faturamento'
      ? ['NF', 'Valor', 'Data Emissão', 'CTE Intertex', 'CTE Transportador']
      : reportType === 'performance'
      ? ['NF', 'Data Descarga', 'Fornecedor', 'Produto', 'Placa', 'Chegada', 'Entrada', 'Saída', 'Tempo Descarga', 'Tempo Total']
      : reportType === 'logistica_vli'
      ? ['NF', 'Produto', 'Container', 'Vagão', 'Fat. VLI', 'Destino', 'Fornecedor']
      : reportType === 'transporte_municipal'
      ? ['Mês', 'Data NF', 'NF', 'Fornecedor', 'Tonelada', 'Produto', 'Destino', 'Placa']
      : reportType === 'saida_detalhada'
      ? ['Data Posicionamento', 'Horário Posicionamento', 'Data NF', 'Fornecedor', 'Data Descarga', 'NF', 'ID Lote', 'Produto', 'Volume (Ton)', 'Placa', 'Transportador', 'Cliente', 'Data Carregamento Rod.', 'Placa Saída', 'Container', 'Vagão', 'Fat. VLI', 'Horário Faturamento', 'Destino', 'Fornecedor', 'Status']
      : reportType === 'estoque_minerio'
      ? ['Data NF', 'NF', 'Fornecedor', 'Produto', 'Tonelada', 'Status', 'Data do Recebimento', 'Placa do Veículo', 'Destino']
      : reportType === 'faturamento_bobinas'
      ? ['Data de Descarga', 'Nota Fiscal', 'Tonelada', 'ID do Lote', 'Data Carregamento Rodoviário']
      : ['Emissão NF', 'NF', 'Fornecedor', 'Tipo de Material', 'Peso', 'Destino', 'Emissão CTE Intertex', 'CTE Intertex', 'Emissão CTE Transp.', 'CTE Transportador', 'Data TITAM', 'Faturamento Titam'];

    const rows = filteredEntries.map(e => {
      if (reportType === 'estoque') {
        return isTitam 
          ? [e.data_nf, e.data_descarga || '-', e.nf_numero, e.container, e.fornecedor, e.descricao_produto, e.tonelada, e.status, '']
          : [e.data_nf, e.nf_numero, e.container, e.fornecedor, e.descricao_produto, e.tonelada, e.status, ''];
      }
      if (reportType === 'faturamento') return [e.nf_numero, e.valor, e.data_emissao_nf, e.cte_intertex, e.cte_transportador];
      if (reportType === 'performance') return [e.nf_numero, e.data_descarga || '-', e.fornecedor, e.descricao_produto, e.placa_veiculo, e.hora_chegada, e.hora_entrada, e.hora_saida, calculateTimeDiff(e.hora_entrada, e.hora_saida), calculateTimeDiff(e.hora_chegada, e.hora_saida)];
      if (reportType === 'logistica_vli') return [e.nf_numero, e.descricao_produto, e.container, e.numero_vagao, e.data_faturamento_vli, e.destino, e.fornecedor];
      if (reportType === 'transporte_municipal') return [e.mes, e.data_nf, e.nf_numero, e.fornecedor, e.tonelada, e.descricao_produto, e.destino, e.placa_veiculo];
      if (reportType === 'saida_detalhada') return [e.data_posicionamento, e.horario_posicionamento, e.data_nf, e.fornecedor, e.data_descarga, e.nf_numero, e.id_lote, e.descricao_produto, e.tonelada, e.placa_veiculo, e.transportador, e.cliente, e.data_carregamento_rodoviario, e.placa_saida, e.container, e.numero_vagao, e.data_faturamento_vli, e.horario_faturamento, e.destino, e.fornecedor, e.status];
      if (reportType === 'estoque_minerio') return [e.data_nf, e.nf_numero, e.fornecedor, e.descricao_produto, e.tonelada, e.status, e.data_descarga, e.placa_veiculo, e.destino];
      if (reportType === 'faturamento_bobinas') return [e.data_descarga, e.nf_numero, e.tonelada, e.id_lote, e.data_carregamento_rodoviario];
      return [e.data_emissao_nf, e.nf_numero, e.fornecedor, e.descricao_produto, e.tonelada, e.destino, e.data_emissao_cte, e.cte_intertex, e.data_emissao_cte_transp, e.cte_transportador, e.data_titam, e.faturamento_titam];
    });

    const csvContent = [headers, ...rows].map(r => r.map(val => `"${val || ''}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 items-end transition-all duration-700">
        <div className="md:col-span-5 flex justify-between items-center mb-2 border-b border-gray-100 pb-4">
          <h3 className="text-sm font-bold text-titam-deep uppercase tracking-widest">Ferramentas de Dados</h3>
          <div className="flex gap-3">
            <button 
              onClick={onUndoLastImport}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-bold border border-red-100 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? (
                <div className="w-3 h-3 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Desfazer Última Importação
            </button>
            <button 
              onClick={onExportBackup}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-bold"
            >
              <Download size={14} />
              Exportar Backup (JSON)
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-titam-lime/20 text-titam-deep rounded-lg hover:bg-titam-lime/30 transition-colors text-xs font-bold cursor-pointer">
              <Upload size={14} />
              Importar Backup (JSON/Excel)
              <input type="file" accept=".json,.xlsx,.xls" onChange={onImportBackup} className="hidden" />
            </label>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo de Relatório</label>
          <select 
            value={reportType}
            onChange={(e) => setReportType(e.target.value as any)}
            className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none bg-white transition-all duration-700"
          >
            <option value="estoque">Estoque por Fornecedor</option>
            <option value="faturamento">Faturamento Mensal</option>
            <option value="performance">Performance de Descarga</option>
            <option value="logistica_vli">Logística VLI</option>
            <option value="transporte_municipal">Transporte Municipal</option>
            <option value="saida_detalhada">Relatório de Saída Detalhado</option>
            <option value="faturamento_detalhado">Faturamento Detalhado</option>
            <option value="estoque_minerio">Estoque Minério</option>
            <option value="faturamento_bobinas">Faturamento Bobinas</option>
            <option value="acumulado_saidas">Acumulado de Saídas por Mês (Destino/Material)</option>
            <option value="acumulado_estoque">Acumulado de Estoque por Fornecedor (Filial/Material)</option>
            <option value="frota_veiculos">Controle de Frota & Veículos</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filtrar Fornecedor</label>
          <input 
            type="text" 
            placeholder="Nome do fornecedor..."
            value={filterFornecedor}
            onChange={(e) => setFilterFornecedor(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {reportType === 'saida_detalhada' ? 'Início Fat. VLI' : 'Data Início'}
          </label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {reportType === 'saida_detalhada' ? 'Fim Fat. VLI' : 'Data Fim'}
          </label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-all duration-700"
          />
        </div>
        <button 
          onClick={exportToCSV}
          className="px-4 py-2 bg-titam-lime text-titam-deep shadow-titam-lime/20 rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 font-bold shadow-sm"
        >
          <Download size={18} />
          Exportar CSV
        </button>
      </div>

      {reportType === 'frota_veiculos' ? (
        <div className="bg-white border-gray-100 p-8 rounded-2xl border shadow-sm transition-all duration-700 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-titam-deep/5 text-titam-deep rounded-xl flex items-center justify-center">
                <Truck size={24} />
              </div>
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Controle de Frota & Veículos</h3>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Histórico de placas identificadas neste terminal</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Search Plate */}
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-titam-lime transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder="BUSCAR PLACA..."
                  value={fleetSearch}
                  onChange={(e) => setFleetSearch(e.target.value)}
                  className="pl-12 pr-6 py-2.5 border bg-gray-50 border-gray-100 focus:ring-titam-lime/20 focus:bg-white rounded-xl text-[10px] font-bold uppercase tracking-widest outline-none transition-all w-full sm:w-48"
                />
              </div>

              {/* Total vehicles Badge */}
              <div className="bg-titam-deep text-white px-4 py-2.5 rounded-xl flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest">Veículos Únicos:</span>
                <span className="text-sm font-black text-titam-lime">{fleetData.length}</span>
              </div>
            </div>
          </div>

          {filteredFleet.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <Truck className="mx-auto text-gray-300 mb-2" size={32} />
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Nenhum veículo encontrado para os filtros selecionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Placa</th>
                    <th className="pb-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">Viagens</th>
                    <th className="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Produtos Transportados</th>
                    <th className="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Fornecedores / Destinos</th>
                    <th className="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Primeira Entrada</th>
                    <th className="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">Última Operação</th>
                    <th className="pb-3 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Status Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredFleet.map((item) => (
                    <tr key={item.plate} className="group hover:bg-gray-50/50 transition-all">
                      <td className="py-4 pr-3">
                        {/* Brazilian-style License Plate design */}
                        <div className="inline-flex flex-col border border-gray-400 rounded-md overflow-hidden bg-white shadow-sm w-24">
                          <div className="bg-blue-600 text-white text-[7px] font-bold text-center py-0.5 tracking-wider uppercase">
                            BRASIL
                          </div>
                          <div className="text-center py-1 text-xs font-black tracking-widest text-gray-900 font-mono">
                            {item.plate}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <span className="inline-flex items-center justify-center bg-gray-100 text-gray-800 text-[10px] font-black px-2 py-1 rounded-md">
                          {item.trips}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {item.products.length > 0 ? (
                            item.products.map(p => (
                              <span key={p} className="bg-gray-50 text-gray-600 border border-gray-100 text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] text-gray-300 italic">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="text-[10px] font-bold text-gray-600 uppercase max-w-[200px] truncate">
                          {[...item.suppliers, ...item.destinations].join(' / ') || <span className="text-gray-300 italic">-</span>}
                        </div>
                      </td>
                      <td className="py-4 text-[10px] font-medium text-gray-500">
                        {item.firstSeen ? item.firstSeen.split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="py-4 text-[10px] font-semibold text-gray-700">
                        {item.lastSeen ? item.lastSeen.split('-').reverse().join('/') : '-'}
                      </td>
                      <td className="py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          item.lastStatus.toLowerCase().includes('estoque') || item.lastStatus.toLowerCase().includes('entrada')
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-gray-50 text-gray-500 border border-gray-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            item.lastStatus.toLowerCase().includes('estoque') || item.lastStatus.toLowerCase().includes('entrada')
                              ? 'bg-emerald-500 animate-pulse'
                              : 'bg-gray-400'
                          }`}></span>
                          {item.lastStatus || 'Concluído'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-700">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 capitalize">
              Prévia: {reportType === 'acumulado_saidas' ? 'Acumulado de Saídas por Mês' : reportType === 'acumulado_estoque' ? 'Acumulado de Estoque por Fornecedor' : reportType}
            </h2>
          </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 transition-all duration-700">
                {reportType === 'acumulado_saidas' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">Mês</th>
                    <th className="px-6 py-3 data-grid-header">Destino</th>
                    <th className="px-6 py-3 data-grid-header">Material</th>
                    <th className="px-6 py-3 data-grid-header">Peso Total</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedores (Peso / Part. %)</th>
                  </>
                )}
                {reportType === 'acumulado_estoque' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">Filial</th>
                    {acumuladoEstoqueData.some(r => r.destino) && (
                      <th className="px-6 py-3 data-grid-header">Destino</th>
                    )}
                    <th className="px-6 py-3 data-grid-header">Material</th>
                    <th className="px-6 py-3 data-grid-header">Peso Total em Estoque</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedores em Estoque (Peso / Part. %)</th>
                  </>
                )}
                {reportType === 'estoque' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">Data NF</th>
                    {isTitam && <th className="px-6 py-3 data-grid-header">Data de Descarga</th>}
                    <th className="px-6 py-3 data-grid-header">NF</th>
                    <th className="px-6 py-3 data-grid-header">Container</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                    <th className="px-6 py-3 data-grid-header">Produto</th>
                    <th className="px-6 py-3 data-grid-header">Tonelada</th>
                    <th className="px-6 py-3 data-grid-header">Status</th>
                    <th className="px-6 py-3 data-grid-header">Número do Vagão</th>
                  </>
                )}
                {reportType === 'faturamento' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">NF</th>
                    <th className="px-6 py-3 data-grid-header">Valor</th>
                    <th className="px-6 py-3 data-grid-header">Emissão NF</th>
                    <th className="px-6 py-3 data-grid-header">CTE Intertex</th>
                    <th className="px-6 py-3 data-grid-header">CTE Transp.</th>
                  </>
                )}
                {reportType === 'performance' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">NF</th>
                    <th className="px-6 py-3 data-grid-header">Data Descarga</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                    <th className="px-6 py-3 data-grid-header">Produto</th>
                    <th className="px-6 py-3 data-grid-header">Placa</th>
                    <th className="px-6 py-3 data-grid-header">Chegada</th>
                    <th className="px-6 py-3 data-grid-header">Entrada</th>
                    <th className="px-6 py-3 data-grid-header">Saída</th>
                    <th className="px-6 py-3 data-grid-header">T. Descarga</th>
                    <th className="px-6 py-3 data-grid-header">T. Total</th>
                  </>
                )}
                {reportType === 'logistica_vli' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">NF</th>
                    <th className="px-6 py-3 data-grid-header">Produto</th>
                    <th className="px-6 py-3 data-grid-header">Container</th>
                    <th className="px-6 py-3 data-grid-header">Vagão</th>
                    <th className="px-6 py-3 data-grid-header">Fat. VLI</th>
                    <th className="px-6 py-3 data-grid-header">Destino</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                  </>
                )}
                {reportType === 'transporte_municipal' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">Mês</th>
                    <th className="px-6 py-3 data-grid-header">Data NF</th>
                    <th className="px-6 py-3 data-grid-header">NF</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                    <th className="px-6 py-3 data-grid-header">Tonelada</th>
                    <th className="px-6 py-3 data-grid-header">Produto</th>
                    <th className="px-6 py-3 data-grid-header">Destino</th>
                    <th className="px-6 py-3 data-grid-header">Placa</th>
                  </>
                )}
                {reportType === 'saida_detalhada' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">Data Posicionamento</th>
                    <th className="px-6 py-3 data-grid-header">Horário Posicionamento</th>
                    <th className="px-6 py-3 data-grid-header">Data NF</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                    <th className="px-6 py-3 data-grid-header">Data Descarga</th>
                    <th className="px-6 py-3 data-grid-header">NF</th>
                    <th className="px-6 py-3 data-grid-header">ID Lote</th>
                    <th className="px-6 py-3 data-grid-header">Produto</th>
                    <th className="px-6 py-3 data-grid-header">Volume (Ton)</th>
                    <th className="px-6 py-3 data-grid-header">Placa</th>
                    <th className="px-6 py-3 data-grid-header">Transportador</th>
                    <th className="px-6 py-3 data-grid-header">Cliente</th>
                    <th className="px-6 py-3 data-grid-header">Data Carreg. Rod.</th>
                    <th className="px-6 py-3 data-grid-header">Placa Saída</th>
                    <th className="px-6 py-3 data-grid-header">Container</th>
                    <th className="px-6 py-3 data-grid-header">Vagão</th>
                    <th className="px-6 py-3 data-grid-header">Fat. VLI</th>
                    <th className="px-6 py-3 data-grid-header">Horário Faturamento</th>
                    <th className="px-6 py-3 data-grid-header">Destino</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                    <th className="px-6 py-3 data-grid-header">Status</th>
                  </>
                )}
                {reportType === 'faturamento_detalhado' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">Emissão NF</th>
                    <th className="px-6 py-3 data-grid-header">NF</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                    <th className="px-6 py-3 data-grid-header">Tipo de Material</th>
                    <th className="px-6 py-3 data-grid-header">Peso</th>
                    <th className="px-6 py-3 data-grid-header">Destino</th>
                    <th className="px-6 py-3 data-grid-header">Emissão CTE Intertex</th>
                    <th className="px-6 py-3 data-grid-header">CTE Intertex</th>
                    <th className="px-6 py-3 data-grid-header">Emissão CTE Transp.</th>
                    <th className="px-6 py-3 data-grid-header">CTE Transp.</th>
                    <th className="px-6 py-3 data-grid-header">Data TITAM</th>
                    <th className="px-6 py-3 data-grid-header">Faturamento Titam</th>
                  </>
                )}
                {reportType === 'estoque_minerio' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">Data NF</th>
                    <th className="px-6 py-3 data-grid-header">NF</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                    <th className="px-6 py-3 data-grid-header">Produto</th>
                    <th className="px-6 py-3 data-grid-header">Tonelada</th>
                    <th className="px-6 py-3 data-grid-header">Status</th>
                    <th className="px-6 py-3 data-grid-header">Data Recebimento</th>
                    <th className="px-6 py-3 data-grid-header">Placa Veículo</th>
                    <th className="px-6 py-3 data-grid-header">Destino</th>
                  </>
                )}
                {reportType === 'faturamento_bobinas' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">Data de Descarga</th>
                    <th className="px-6 py-3 data-grid-header">Nota Fiscal</th>
                    <th className="px-6 py-3 data-grid-header">Tonelada</th>
                    <th className="px-6 py-3 data-grid-header">ID do Lote</th>
                    <th className="px-6 py-3 data-grid-header">Data Carregamento Rodoviário</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportType === 'acumulado_saidas' ? (
                acumuladoSaidasData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    <td className="px-6 py-4 text-sm font-bold text-gray-700">{getMonthName(row.monthKey + "-01")}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-semibold">{row.destination}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-semibold">{row.material}</td>
                    <td className="px-6 py-4 text-sm font-black text-titam-deep mono-value">
                      {row.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="space-y-1.5 py-1">
                        {row.suppliers.map((s, sIdx) => (
                          <div key={sIdx} className="flex items-center justify-between gap-4 text-xs">
                            <span className="font-bold text-gray-500 uppercase">{s.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-gray-700 font-bold bg-gray-100 px-2 py-0.5 rounded">
                                {s.weight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                              </span>
                              <span className="font-mono text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                {s.percentage.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              ) : reportType === 'acumulado_estoque' ? (
                acumuladoEstoqueData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    <td className="px-6 py-4 text-sm font-bold text-gray-700">{row.branchName}</td>
                    {acumuladoEstoqueData.some(r => r.destino) && (
                      <td className="px-6 py-4 text-sm text-gray-600 font-semibold">{row.destino || '-'}</td>
                    )}
                    <td className="px-6 py-4 text-sm text-gray-600 font-semibold">{row.material}</td>
                    <td className="px-6 py-4 text-sm font-black text-titam-deep mono-value">
                      {row.totalWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="space-y-1.5 py-1">
                        {row.suppliers.map((s, sIdx) => (
                          <div key={sIdx} className="flex items-center justify-between gap-4 text-xs">
                            <span className="font-bold text-gray-500 uppercase">{s.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-gray-700 font-bold bg-gray-100 px-2 py-0.5 rounded">
                                {s.weight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t
                              </span>
                              <span className="font-mono text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                {s.percentage.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                filteredEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    {reportType === 'estoque' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_nf}</td>
                      {isTitam && <td className="px-6 py-4 text-sm text-gray-600">{e.data_descarga || '-'}</td>}
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.container}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.fornecedor}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.descricao_produto}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.tonelada}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.status}</td>
                      <td className="px-6 py-4 text-sm text-gray-600"></td>
                    </>
                  )}
                  {reportType === 'faturamento' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.valor}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_emissao_nf || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.cte_intertex || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.cte_transportador || '-'}</td>
                    </>
                  )}
                  {reportType === 'performance' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_descarga || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.fornecedor}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.descricao_produto}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.placa_veiculo}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.hora_chegada || '-'}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.hora_entrada || '-'}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.hora_saida || '-'}</td>
                      <td className="px-6 py-4 text-sm mono-value">{calculateTimeDiff(e.hora_entrada, e.hora_saida)}</td>
                      <td className="px-6 py-4 text-sm mono-value">{calculateTimeDiff(e.hora_chegada, e.hora_saida)}</td>
                    </>
                  )}
                  {reportType === 'logistica_vli' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.descricao_produto}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.container}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.numero_vagao || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_faturamento_vli || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.destino}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.fornecedor}</td>
                    </>
                  )}
                  {reportType === 'transporte_municipal' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.mes}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_nf}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.fornecedor}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.tonelada}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.descricao_produto}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.destino}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.placa_veiculo}</td>
                    </>
                  )}
                  {reportType === 'saida_detalhada' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_posicionamento || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.horario_posicionamento || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_nf}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.fornecedor}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_descarga}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.id_lote || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.descricao_produto}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.tonelada}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.placa_veiculo}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.transportador || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.cliente || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_carregamento_rodoviario || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.placa_saida || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.container}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.numero_vagao || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_faturamento_vli || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.horario_faturamento || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.destino}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.fornecedor}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.status}</td>
                    </>
                  )}
                  {reportType === 'faturamento_detalhado' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_emissao_nf || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.fornecedor}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.descricao_produto || '-'}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.tonelada || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.destino || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_emissao_cte || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.cte_intertex || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_emissao_cte_transp || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.cte_transportador || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_titam || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.faturamento_titam || '-'}</td>
                    </>
                  )}
                  {reportType === 'estoque_minerio' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_nf}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.fornecedor}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.descricao_produto}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.tonelada}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.status}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_descarga || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.placa_veiculo || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.destino || '-'}</td>
                    </>
                  )}
                  {reportType === 'faturamento_bobinas' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_descarga || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.tonelada || '0'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.id_lote || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_carregamento_rodoviario || '-'}</td>
                    </>
                  )}
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </motion.div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  const activeBg = 'bg-titam-lime';
  const activeText = 'text-titam-deep';

  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? `${activeBg} ${activeText} font-bold shadow-[0_8px_20px_-10px_rgba(0,0,0,0.1)]` : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : ''}`}>
        {icon}
      </div>
      <span className="text-[11px] uppercase tracking-widest leading-none">{label}</span>
      {active && <ChevronRight size={14} className="ml-auto" />}
    </button>
  );
}

function StatCard({ title, value, subtitle, icon }: { title: string, value: number | string, subtitle: string, icon: React.ReactNode }) {
  const brandDeep = '#1E3932';
  
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      className={`bg-white border-gray-100 p-8 rounded-2xl border shadow-sm hover:shadow-2xl transition-all duration-300 group relative overflow-hidden`}
    >
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(${brandDeep} 1px, transparent 1px)`, backgroundSize: '24px 24px' }}></div>
      
      <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 bg-titam-lime opacity-[0.03] rounded-full transition-transform duration-500 group-hover:scale-150"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="p-4 bg-gray-50 text-gray-400 group-hover:text-titam-lime group-hover:bg-titam-lime/10 rounded-2xl transition-all duration-300">
            {icon}
          </div>
          <div className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-300 group-hover:text-titam-lime/30 transition-colors">
            {title.split(' ')[0]}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-gray-400">{title}</h3>
            <div className="flex items-baseline gap-2">
              <div className="text-5xl font-light text-gray-900 tracking-tighter tabular-nums transition-colors duration-500">{value}</div>
              {typeof value === 'number' && <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">un</div>}
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
            <span className="w-1.5 h-1.5 rounded-full bg-titam-lime animate-pulse"></span>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{label}</label>
      <input 
        className="border border-gray-100 bg-gray-50/50 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-titam-lime/30 focus:border-titam-lime focus:bg-white outline-none transition-all"
        {...props}
      />
    </div>
  );
}

function ContainerSearchField({
  label,
  name,
  defaultValue,
  value,
  onChange,
  branchId,
  containers,
  branches
}: {
  label: string;
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (val: string) => void;
  branchId: string;
  containers: any[];
  branches: any[];
}) {
  const [inputValue, setInputValue] = useState(defaultValue || value || '');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (defaultValue !== undefined && value === undefined) {
      setInputValue(defaultValue);
    }
  }, [defaultValue, value]);

  // Filter containers of this branch
  const filteredContainers = React.useMemo(() => {
    const activeBranchContainers = containers.filter(c => !branchId || branchId === 'all' ? true : c.branchId === branchId);
    if (!inputValue) return activeBranchContainers;
    return activeBranchContainers.filter(c => 
      c.numero.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [containers, branchId, inputValue]);

  return (
    <div className="flex flex-col gap-1.5 relative">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative flex items-center">
        <input 
          name={name}
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            setInputValue(val);
            if (onChange) {
              onChange(val);
            }
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Digite ou pesquise o container..."
          className="w-full border border-gray-100 bg-gray-50/50 text-gray-900 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-titam-lime/30 focus:border-titam-lime focus:bg-white outline-none transition-all font-semibold uppercase animate-none"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 text-gray-400 hover:text-titam-deep p-1 rounded-full hover:bg-gray-100 transition-all cursor-pointer"
          title="Ver todos os containers cadastrados"
        >
          <Search size={16} />
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 flex flex-col overflow-hidden">
            <div className="overflow-y-auto flex-1">
              {filteredContainers.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-400 font-bold uppercase tracking-wider">
                  Nenhum container encontrado
                </div>
              ) : (
                filteredContainers.map((container) => (
                  <button
                    key={container.id}
                    type="button"
                    onClick={() => {
                      setInputValue(container.numero);
                      if (onChange) onChange(container.numero);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center justify-between border-b border-gray-100/50 cursor-pointer"
                  >
                    <div>
                      <span className="font-black text-titam-deep">{container.numero}</span>
                      <span className="ml-2 text-[9px] text-gray-400 font-bold uppercase">
                        ({branches.find(b => b.id === container.branchId)?.name || 'N/A'})
                      </span>
                    </div>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase ${
                      container.status === 'Disponível' ? 'bg-emerald-50 text-emerald-600' :
                      container.status === 'Em Manutenção' ? 'bg-amber-50 text-amber-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {container.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}



function DataView({ title, entries, columns, onEdit, onDelete, onBulkDelete, readOnly = false }: { 
  title: string, 
  entries: Entry[], 
  columns: { key: keyof Entry, label: string }[], 
  onEdit: (e: Entry) => void,
  onDelete: (id: string | number) => void,
  onBulkDelete: (ids: (string | number)[]) => void,
  readOnly?: boolean
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const filteredEntries = entries.filter(entry => {
    const searchStr = searchTerm.toLowerCase();
    const searchableFields = [
      entry.nf_numero,
      entry.container,
      entry.fornecedor,
      entry.descricao_produto,
      entry.placa_veiculo,
      entry.placa_saida,
      entry.transportador,
      entry.id_lote,
      entry.numero_vagao,
      entry.destino
    ];

    return searchableFields.some(val => 
      val && val.toString().toLowerCase().includes(searchStr)
    ) || Object.values(entry).some(val => 
      val && typeof val !== 'object' && val.toString().toLowerCase().includes(searchStr)
    );
  });

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEntries.map(e => e.id));
    }
  };

  const handleToggleSelect = (id: string | number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    onBulkDelete(selectedIds);
    setSelectedIds([]);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white border-gray-100 rounded-2xl border overflow-hidden transition-all duration-700`}
    >
      <div className={`p-6 border-b border-gray-50 bg-white/50 flex justify-between items-center backdrop-blur-sm sticky top-0 z-20 transition-all duration-700`}>
        <div className="flex items-center gap-4 flex-1">
          <h2 className={`text-[11px] font-black text-gray-900 uppercase tracking-[0.2em] whitespace-nowrap`}>{title}</h2>
          {showSearch && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '100%', opacity: 1 }}
              className="max-w-md"
            >
              <input 
                type="text"
                placeholder="PROCURAR..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border-gray-100 border rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-titam-lime/30 outline-none transition-all"
                autoFocus
              />
            </motion.div>
          )}
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && !readOnly && (
            <motion.button 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={handleBulkDelete}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
            >
              <Trash2 size={14} />
              Excluir ({selectedIds.length})
            </motion.button>
          )}
          <button 
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2.5 rounded-xl transition-all ${showSearch ? 'bg-titam-lime text-titam-deep' : 'text-gray-400 hover:bg-gray-50 border border-gray-100'}`}
          >
            <Search size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`bg-gray-50/50 transition-all duration-700`}>
              {!readOnly && (
                <th className="px-6 py-4 border-b border-gray-50">
                  <button 
                    onClick={handleToggleSelectAll}
                    className="text-gray-400 hover:text-titam-deep transition-colors"
                  >
                    {selectedIds.length === filteredEntries.length && filteredEntries.length > 0 ? (
                      <CheckSquare size={16} className="text-titam-lime" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
              )}
              {columns.map(col => (
                <th key={col.key as string} className={`px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] border-b border-gray-50 text-gray-400 italic font-serif`}>{col.label}</th>
              ))}
              {!readOnly && (
                <th className={`px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] border-b border-gray-50 text-gray-400 bg-gray-50/50 sticky right-0 z-10 italic font-serif transition-all duration-700`}>Ações</th>
              )}
            </tr>
          </thead>
          <tbody className={`divide-y divide-gray-50`}>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (readOnly ? 0 : 2)} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 opacity-20">
                    <Package size={48} />
                    <p className="text-xs font-bold uppercase tracking-widest">Nenhum registro</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className={`group ${selectedIds.includes(entry.id) ? 'bg-titam-lime/10' : 'hover:bg-titam-deep hover:text-white'} transition-all duration-200 cursor-default`}>
                  {!readOnly && (
                    <td className="px-6 py-5 border-b border-gray-50">
                      <button 
                        onClick={() => handleToggleSelect(entry.id)}
                        className={`transition-colors ${selectedIds.includes(entry.id) ? 'text-titam-lime' : 'text-gray-300 group-hover:text-white/50'}`}
                      >
                        {selectedIds.includes(entry.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key as string} className="px-6 py-5 text-[11px] font-medium transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`
                          ${col.key === 'status' ? `px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${getStatusBadgeStyle(entry.status)}` : ''}
                          ${(col.key === 'valor' || col.key === 'tonelada' || col.key === 'nf_numero' || (col.key as unknown as string) === 'total_time' || (col.key as unknown as string) === 'descarga_time') ? 'font-mono tracking-tighter' : ''}
                        `}>
                          {(col.key as unknown as string) === 'total_time' ? calculateTimeDiff(entry.hora_chegada, entry.hora_saida) :
                           (col.key as unknown as string) === 'descarga_time' ? calculateTimeDiff(entry.hora_entrada, entry.hora_saida) :
                           (col.key === 'valor' || col.key === 'tonelada') ? 
                             (entry[col.key] !== undefined ? Number(entry[col.key]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-') :
                           (entry[col.key] || '-')}
                        </span>
                        {col.key === 'nf_numero' && entry.isPending && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Pendente" />
                        )}
                      </div>
                    </td>
                  ))}
                  {!readOnly && (
                    <td className={`px-6 py-5 sticky right-0 bg-white border-l border-gray-50 group-hover:bg-titam-deep z-10 transition-all duration-200`}>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => onEdit(entry)}
                          className="text-[10px] font-black uppercase tracking-[0.15em] text-titam-deep group-hover:text-white transition-colors"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(entry.id);
                          }}
                          className={`text-gray-300 group-hover:text-red-400 transition-colors`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

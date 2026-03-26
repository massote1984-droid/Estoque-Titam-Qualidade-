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
  Scale
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
import { Entry, StockSummary, Container } from './types';
import { useAuth } from './components/FirebaseProvider';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  where,
  getDocs
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

type Tab = 'dashboard' | 'entrada' | 'saida' | 'performance' | 'faturamento' | 'lista' | 'relatorios' | 'fluxo' | 'containers';

export default function App() {
  const { user, loading: authLoading, login, logout, loginLoading, error: authError } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [importingNfe, setImportingNfe] = useState(false);
  const [nfeContent, setNfeContent] = useState('');
  const [formData, setFormData] = useState<Partial<Entry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [notifications, setNotifications] = useState<{id: string, message: string, type: 'info' | 'warning' | 'error' | 'critical', persistent?: boolean}[]>([]);
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
  const [lastBatchId, setLastBatchId] = useState<string | null>(localStorage.getItem('last_import_batch'));
  const isSyncing = React.useRef(false);
  const [isSyncingState, setIsSyncingState] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [productDestSupplierFilter, setProductDestSupplierFilter] = useState<string>('');
  const [nfSearch, setNfSearch] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (selectedEntry) {
      setEditFormData(selectedEntry);
    } else {
      setEditFormData({});
    }
  }, [selectedEntry]);

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
    if (activeTab !== 'dashboard' || entries.length === 0) return;

    const checkQueueImpacts = () => {
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
  }, [entries, activeTab]);

  const triggerTestAlert = () => {
    const alerts = [
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
            Promise.all(entriesToImport.map(ent => {
              const { id, isPending, ...data } = ent;
              return addDoc(collection(db, 'entries'), {
                ...data,
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
    const q = query(collection(db, 'entries'), orderBy('created_at', 'desc'));
    const qContainers = query(collection(db, 'containers'), orderBy('numero', 'asc'));
    
    const unsubscribeEntries = onSnapshot(q, (snapshot) => {
      const entriesData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        // Convert Firestore Timestamp to string for compatibility with existing code
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

    return () => {
      unsubscribeEntries();
      unsubscribeContainers();
    };
  }, [user]);

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
  }, [entries, nfSearch]);

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
      return {
        fornecedor: s,
        estoque: supplierEntries.filter(e => e && e.status === 'Estoque').length,
        rejeitado: supplierEntries.filter(e => e && e.status === 'Rejeitado').length,
        embarcado: supplierEntries.filter(e => e && e.status === 'Embarcado').length,
        devolvido: supplierEntries.filter(e => e && e.status === 'Devolvido').length,
        total: supplierEntries.length
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
      return {
        descricao_produto: prod,
        destino: dest,
        estoque: filtered.filter(e => e && e.status === 'Estoque').length,
        rejeitado: filtered.filter(e => e && e.status === 'Rejeitado').length,
        embarcado: filtered.filter(e => e && e.status === 'Embarcado').length,
        devolvido: filtered.filter(e => e && e.status === 'Devolvido').length,
        total: filtered.length
      };
    });
  }, [filteredEntriesForDashboard, productDestSupplierFilter]);

  const supplierStockByDate = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    const filtered = filteredEntriesForDashboard.filter(e => e && e.data_descarga && selectedDates.includes(e.data_descarga));
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
    const filtered = filteredEntriesForDashboard.filter(e => e && e.data_descarga && selectedDates.includes(e.data_descarga));
    const productMap: Record<string, { count: number, tons: number }> = {};
    filtered.forEach(e => {
      const product = e.descricao_produto || 'Não especificado';
      if (!productMap[product]) {
        productMap[product] = { count: 0, tons: 0 };
      }
      productMap[product].count += 1;
      productMap[product].tons += (e.tonelada || 0);
    });
    return Object.entries(productMap).map(([name, data]) => ({ name, count: data.count, tons: data.tons }));
  }, [filteredEntriesForDashboard, selectedDates]);

  const dailyStats = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return { in_stock: 0, exited: 0, suppliers: 0 };
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    
    const arrivals = filteredEntriesForDashboard.filter(e => e && e.data_descarga && selectedDates.includes(e.data_descarga));
    const exits = filteredEntriesForDashboard.filter(e => {
      if (!e || !['Embarcado', 'Devolvido'].includes(e.status)) return false;
      const exitDate = e.data_posicionamento || e.data_faturamento_vli;
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
      in_stock: arrivals.filter(e => e && ['Estoque', 'Rejeitado'].includes(e.status)).length,
      exited: exits.length,
      suppliers: [...new Set(arrivals.filter(e => e && e.fornecedor).map(e => e.fornecedor))].length,
      exited_tons: exits.reduce((acc, e) => acc + (e.tonelada || 0), 0),
      queue_external,
      queue_internal,
      queue_exit,
      queue_external_exceeded,
      queue_internal_exceeded
    };
  }, [filteredEntriesForDashboard, selectedDates]);

  const monthlyExitTotal = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return 0;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    return filteredEntriesForDashboard
      .filter(e => {
        if (!e || !['Embarcado', 'Devolvido'].includes(e.status)) return false;
        
        // Prioritize data_posicionamento for exits
        const exitDate = e.data_posicionamento || e.data_faturamento_vli || e.data_descarga;
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
  }, [filteredEntriesForDashboard]);

  const exitChartData = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    const dailyMap: Record<string, any> = {};
    
    const exitedEntries = filteredEntriesForDashboard.filter(entry => {
      if (!entry) return false;
      const isExited = ['Embarcado', 'Devolvido'].includes(entry.status);
      if (!isExited) return false;
      
      const arrivedOnSelected = selectedDates.includes(entry.data_descarga);
      const exitDate = entry.data_posicionamento || entry.data_faturamento_vli;
      const exitedOnSelected = exitDate && selectedDates.includes(exitDate);
      
      return arrivedOnSelected || exitedOnSelected;
    });

    const chartDates = new Set<string>(selectedDates);
    exitedEntries.forEach(entry => {
      // Prioritize data_posicionamento for exits
      const exitDate = entry.data_posicionamento || entry.data_faturamento_vli || entry.data_descarga;
      if (exitDate) chartDates.add(exitDate);
    });

    const sortedDates = Array.from(chartDates).sort();
    
    sortedDates.forEach(date => {
      dailyMap[date] = { date };
    });

    exitedEntries.forEach(entry => {
      // Prioritize data_posicionamento for exits
      const exitDate = entry.data_posicionamento || entry.data_faturamento_vli || entry.data_descarga;
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
  }, [filteredEntriesForDashboard, selectedDates]);

  const exitChartKeys = React.useMemo(() => {
    const keys = new Set<string>();
    filteredEntriesForDashboard.forEach(entry => {
      if (['Embarcado', 'Devolvido'].includes(entry.status)) {
        keys.add(`${entry.descricao_produto} - ${entry.destino}`);
      }
    });
    return Array.from(keys);
  }, [filteredEntriesForDashboard]);

  const selectedPeriodExitsSummary = React.useMemo(() => {
    if (!Array.isArray(filteredEntriesForDashboard)) return [];
    
    const summaryMap: Record<string, { 
      destination: string, 
      products: Record<string, { count: number, tons: number }> 
    }> = {};

    filteredEntriesForDashboard.forEach(e => {
      if (!e || !['Embarcado', 'Devolvido'].includes(e.status)) return;
      const exitDate = e.data_posicionamento || e.data_faturamento_vli;
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
  }, [filteredEntriesForDashboard, selectedDates]);

  const monthlyAccumulatedExits = React.useMemo(() => {
    if (!Array.isArray(entries)) return [];
    
    const monthlyMap: Record<string, { 
      month: string, 
      destinations: Record<string, { 
        products: Record<string, { count: number, tons: number }> 
      }> 
    }> = {};

    entries.forEach(e => {
      if (!e || !['Embarcado', 'Devolvido'].includes(e.status)) return;
      
      // Prioritize data_posicionamento as requested for exits
      const exitDate = e.data_posicionamento || e.data_faturamento_vli || e.data_descarga;
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
  }, [entries]);

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

  const handleCreateEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
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

    const sanitizeNumeric = (val: any) => {
      if (typeof val !== 'string') return val;
      return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
    };
    
    const data = {
      ...rawData,
      valor: sanitizeNumeric(rawData.valor),
      tonelada: sanitizeNumeric(rawData.tonelada),
      uid: user.uid,
      created_by_email: user.email || 'Usuário',
      created_at: serverTimestamp()
    };
    
    try {
      await addDoc(collection(db, 'entries'), data);
      addNotification("Registro salvo com sucesso!", "info");
      setShowForm(false);
      setFormData({});
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'entries', user);
      addNotification("Erro ao salvar registro.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateEntry = async (id: string | number, updates: Partial<Entry>) => {
    if (!user) return;
    const sanitizedUpdates = { ...updates };
    const sanitizeNumeric = (val: any) => {
      if (typeof val !== 'string') return val;
      return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
    };

    if (sanitizedUpdates.valor !== undefined) {
      sanitizedUpdates.valor = sanitizeNumeric(sanitizedUpdates.valor);
    }
    if (sanitizedUpdates.tonelada !== undefined) {
      sanitizedUpdates.tonelada = sanitizeNumeric(sanitizedUpdates.tonelada);
    }

    // Remove fields that shouldn't be updated or are incompatible
    delete sanitizedUpdates.id;
    delete sanitizedUpdates.isPending;

    // Add tracking info
    sanitizedUpdates.updated_at = serverTimestamp();
    sanitizedUpdates.updated_by_email = user.email || 'Usuário';

    try {
      setIsUpdating(true);
      await updateDoc(doc(db, 'entries', String(id)), sanitizedUpdates);
      addNotification("Registro atualizado!", "info");
      setSelectedEntry(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `entries/${id}`, user);
      addNotification("Erro ao atualizar registro.", "error");
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
      addNotification(`Horário de ${type} registrado: ${timeStr}`, "info");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `entries/${id}`, user);
      addNotification(`Erro ao registrar ${type}.`, "error");
    }
  };

  const handleCreateContainer = async (numero: string, status: Container['status'], observacao?: string) => {
    if (!user || !numero) return;
    try {
      await addDoc(collection(db, 'containers'), {
        numero,
        status,
        observacao: observacao || '',
        uid: user.uid,
        updated_at: serverTimestamp(),
        updated_by_email: user.email
      });
      addNotification(`Container ${numero} adicionado!`, "info");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'containers', user);
      addNotification("Erro ao adicionar container.", "error");
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
    <div className="flex h-screen bg-[#F8F9FA]">
      {/* Sidebar */}
      <aside className="w-64 bg-titam-deep flex flex-col text-white shadow-xl">
        <div className="p-8 border-b border-white/10">
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
                <text style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '11px', letterSpacing: '0.28em' }} opacity="0.85">
                  INTERMODAIS INTELIGENTES
                </text>
              </g>
            </svg>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavItem 
            icon={<LayoutDashboard size={18} />} 
            label="Dashboard" 
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
            label="Containers" 
            active={activeTab === 'containers'} 
            onClick={() => setActiveTab('containers')} 
          />
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl mb-4">
            <div className="w-8 h-8 rounded-full bg-titam-lime flex items-center justify-center text-titam-deep font-bold text-xs">
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
      <main className="flex-1 overflow-auto p-8">
        <AnimatePresence>
          {notifications.filter(n => n.type === 'critical').map(n => (
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
              <div className="flex items-center gap-2 text-[9px] text-titam-deep font-black bg-titam-lime px-3 py-1.5 rounded-full shadow-sm">
                <SyncIcon size={10} className="animate-spin" />
                <span className="uppercase tracking-widest">Sincronizando</span>
              </div>
            )}
            
            <div className="flex items-center bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
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
                  setFormData({});
                  setShowForm(true);
                }}
                className="flex items-center gap-2 bg-titam-deep text-white px-5 py-2.5 rounded-xl hover:bg-titam-deep/90 transition-all shadow-lg shadow-titam-deep/20 font-bold text-sm"
              >
                <Plus size={18} className="text-titam-lime" />
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
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                      <Filter size={20} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">Filtros Inteligentes</h3>
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
                        className="pl-12 pr-6 py-3 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-titam-lime/20 focus:bg-white outline-none transition-all w-full sm:w-64"
                      />
                    </div>

                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
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
                  className="mt-8 p-6 bg-red-50/50 border border-red-100 rounded-2xl relative overflow-hidden"
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
                        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm flex items-center gap-4">
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
                        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm flex items-center gap-4">
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
                  <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group relative overflow-hidden">
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
                  
                  <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group relative overflow-hidden">
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

                  <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
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
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
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
                            <stop offset="0%" stopColor="#B6D932" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#B6D932" stopOpacity={0.7}/>
                          </linearGradient>
                          <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1E3932" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#1E3932" stopOpacity={0.7}/>
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
                                <div className="bg-white p-4 rounded-xl shadow-2xl border border-gray-50 min-w-[200px]">
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
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
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
                            <stop offset="5%" stopColor="#B6D932" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#B6D932" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorDescarga" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1E3932" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#1E3932" stopOpacity={0}/>
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
                                <div className="bg-white p-5 rounded-2xl shadow-2xl border border-gray-50 min-w-[220px]">
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
                          stroke="#B6D932" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorTotal)" 
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: '#B6D932' }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="descarga" 
                          name="Descarga" 
                          stroke="#1E3932" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorDescarga)" 
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff', fill: '#1E3932' }} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart: Queue Analysis */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
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
                                <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 min-w-[180px]">
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
                          fill="#B6D932" 
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
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                          <th className="px-6 py-3 data-grid-header text-[10px]">Rejeitado</th>
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
                            <td className="px-6 py-4 mono-value text-xs text-red-600 font-bold">{s.rejeitado}</td>
                            <td className="px-6 py-4 mono-value text-xs text-emerald-600 font-bold">{s.embarcado}</td>
                            <td className="px-6 py-4 mono-value text-xs text-amber-600 font-bold">{s.devolvido}</td>
                            <td className="px-6 py-4 mono-value text-xs font-black text-titam-deep">{s.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                          <th className="px-6 py-3 data-grid-header text-[10px]">Rejeitado</th>
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
                            <td className="px-6 py-4 mono-value text-xs text-red-600 font-bold">{s.rejeitado}</td>
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
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Truck size={18} className="text-titam-deep" />
                    Estoque por Fornecedor por Dia (NFs Recebidas)
                  </h3>
                  <div className="flex gap-2">
                    {selectedDates.slice(0, 3).map(d => (
                      <span key={d} className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {d.split('-').reverse().join('/')}
                      </span>
                    ))}
                    {selectedDates.length > 3 && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">+{selectedDates.length - 3}</span>}
                  </div>
                </div>
                
                {supplierStockByDate.length > 0 ? (
                  <div className="space-y-6">
                    {/* Totals by Product Type */}
                    <div className="bg-titam-deep/5 p-4 rounded-xl border border-titam-deep/10">
                      <p className="text-[10px] font-bold text-titam-deep uppercase tracking-widest mb-3">Total por Tipo de Produto (Período Selecionado)</p>
                      <div className="flex flex-wrap gap-4">
                        {productStockByDate.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
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
                        <div key={idx} className="p-4 rounded-lg border border-gray-100 bg-gray-50/50 flex flex-col">
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
                                  <span className="font-bold text-titam-deep bg-white px-1.5 py-0.5 rounded border border-gray-100">
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

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <ArrowUpRight size={18} className="text-titam-deep" />
                    Resumo de Saídas por Destino e Produto (Período Selecionado)
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {selectedPeriodExitsSummary.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-gray-400 text-sm">Nenhuma saída no período selecionado.</p>
                    </div>
                  ) : (
                    selectedPeriodExitsSummary.map((destData) => (
                      <div key={destData.destination} className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1.5 h-4 bg-titam-lime rounded-full"></div>
                          <h4 className="text-xs font-black text-gray-700 uppercase tracking-tight">{destData.destination}</h4>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(destData.products).map(([prod, data]) => (
                            <div key={prod} className="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center shadow-sm">
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
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
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
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-gray-400 text-sm">Nenhuma saída registrada até o momento.</p>
                    </div>
                  ) : (
                    monthlyAccumulatedExits.map((monthData) => (
                      <div key={monthData.month} className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
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
                                  <div key={prod} className="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center shadow-sm">
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
            <DataView 
              title="Gestão de Entradas"
              entries={entries}
              columns={[
                { key: 'mes', label: 'Mês' },
                { key: 'data_nf', label: 'Data NF' },
                { key: 'nf_numero', label: 'N.F' },
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
            />
          )}

          {activeTab === 'saida' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Total Saídas (Período)</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-titam-deep">{dailyStats.exited}</span>
                    <span className="text-xs text-gray-400 font-bold">UNIDADES</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Peso Total (Período)</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-titam-lime">{dailyStats.exited_tons.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
                    <span className="text-xs text-gray-400 font-bold">TONELADAS</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
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
                entries={entries}
                columns={[
                  { key: 'data_posicionamento', label: 'Data Posicionamento' },
                  { key: 'nf_numero', label: 'N.F' },
                  { key: 'descricao_produto', label: 'Produto' },
                  { key: 'tonelada', label: 'Tonelada' },
                  { key: 'container', label: 'Container' },
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
              />
            </div>
          )}

          {activeTab === 'faturamento' && (
            <DataView 
              title="Faturamento e CTEs"
              entries={entries}
              columns={[
                { key: 'data_emissao_nf', label: 'Emissão NF' },
                { key: 'nf_numero', label: 'N.F' },
                { key: 'data_emissao_cte', label: 'Emissão CTE Intertex' },
                { key: 'cte_intertex', label: 'CTE Intertex' },
                { key: 'data_emissao_cte_transp', label: 'Emissão CTE Transp.' },
                { key: 'cte_transportador', label: 'CTE Transp.' }
              ]}
              onEdit={setSelectedEntry}
              onDelete={handleDeleteEntry}
            />
          )}

          {activeTab === 'lista' && (
            <DataView 
              title="Todos os Registros"
              entries={entries}
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
            />
          )}

          {activeTab === 'relatorios' && (
            <ReportsView 
              entries={entries} 
              onExportBackup={exportBackup} 
              onImportBackup={importBackup} 
              onUndoLastImport={undoLastImport}
              isProcessing={isProcessing}
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
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Disponíveis para Carga</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-600">
                      {containers.filter(c => c.status === 'Disponível').length}
                    </span>
                    <span className="text-xs text-gray-400 font-bold uppercase">Unidades</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Em Manutenção</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-amber-500">
                      {containers.filter(c => c.status === 'Em Manutenção').length}
                    </span>
                    <span className="text-xs text-gray-400 font-bold uppercase">Unidades</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
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
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep">Lista de Containers</h3>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Total: {containers.length}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                          <th className="px-6 py-4">Número</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Observação</th>
                          <th className="px-6 py-4 text-right">Ações</th>
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
                                  onChange={(e) => handleUpdateContainer(container.id, { status: e.target.value as any })}
                                  className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest outline-none border-none cursor-pointer ${
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
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => handleDeleteContainer(container.id)}
                                  className="p-2 text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-fit sticky top-6">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-titam-deep mb-6">Novo Container</h3>
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
                </div>
              </div>
            </motion.div>
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
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
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
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={executeDelete}
                      disabled={isDeleting}
                      className={`flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-bold shadow-md flex items-center justify-center gap-2 ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
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
        </AnimatePresence>

        {/* Entry Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h2 className="text-xl font-semibold">Nova Entrada de Produto</h2>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setImportingNfe(true)}
                    className="flex items-center gap-2 text-titam-deep border border-titam-lime px-3 py-1 rounded-lg hover:bg-titam-lime/10 text-sm font-medium"
                  >
                    <FileJson size={16} />
                    Importar NF-e
                  </button>
                  <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={24} />
                  </button>
                </div>
              </div>
              <form 
                key={JSON.stringify(formData)}
                onSubmit={handleCreateEntry} 
                className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mês de Referência</label>
                  <input 
                    name="mes" 
                    required 
                    defaultValue={formData.mes || getMonthName(formData.data_nf || formData.data_posicionamento || new Date().toISOString().split('T')[0])} 
                    className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none bg-gray-50"
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
                  <select name="descricao_produto" defaultValue={formData.descricao_produto || ""} className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none bg-white" required>
                    <option value="" disabled>Selecione o produto</option>
                    <option value="Cal Dolomítico">Cal Dolomítico</option>
                    <option value="Cal Calcítico">Cal Calcítico</option>
                  </select>
                </div>
                <Input label="Data N.F" name="data_nf" type="date" required defaultValue={formData.data_nf} />
                <Input label="Data Descarga" name="data_descarga" type="date" required defaultValue={formData.data_descarga} />
                <Input label="Data de Posicionamento" name="data_posicionamento" type="date" defaultValue={formData.data_posicionamento} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                  <select name="status" defaultValue={formData.status || "Estoque"} className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none bg-white" required>
                    <option value="Estoque">Estoque</option>
                    <option value="Rejeitado">Rejeitado</option>
                    <option value="Embarcado">Embarcado</option>
                    <option value="Devolvido">Devolvido</option>
                  </select>
                </div>
                <Input label="Fornecedor" name="fornecedor" required defaultValue={formData.fornecedor} />
                <Input label="Placa do Veículo" name="placa_veiculo" required defaultValue={formData.placa_veiculo} />
                <Input label="Container" name="container" defaultValue={formData.container} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Destino</label>
                  <select name="destino" defaultValue={formData.destino || ""} className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none bg-white" required>
                    <option value="" disabled>Selecione o destino</option>
                    <option value="Serra - ES">Serra - ES</option>
                    <option value="Resende - RJ">Resende - RJ</option>
                  </select>
                </div>

                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
                  <Input label="Hora Chegada" name="hora_chegada" type="time" defaultValue={formData.hora_chegada} />
                  <Input label="Hora Entrada" name="hora_entrada" type="time" defaultValue={formData.hora_entrada} />
                  <Input label="Hora Saída" name="hora_saida" type="time" defaultValue={formData.hora_saida} />
                </div>
                
                <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                  <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" disabled={isSaving}>Cancelar</button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className={`px-6 py-2 bg-titam-lime text-titam-deep rounded-lg hover:opacity-90 transition-colors font-bold shadow-md active:scale-95 flex items-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Importar Dados da NF-e</h2>
                <button onClick={() => setImportingNfe(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <p className="text-gray-500 text-sm mb-4">Cole o conteúdo XML da Nota Fiscal ou o texto extraído para preenchimento automático.</p>
              <textarea 
                className="w-full h-48 border border-gray-200 rounded-xl p-4 focus:ring-2 focus:ring-titam-lime outline-none font-mono text-sm mb-6"
                placeholder="Cole o XML aqui..."
                value={nfeContent}
                onChange={(e) => setNfeContent(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setImportingNfe(false)} 
                  className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
                  className={`px-6 py-2 bg-titam-lime text-titam-deep rounded-lg hover:opacity-90 transition-colors flex items-center gap-2 font-bold ${(isProcessing || !nfeContent) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h2 className="text-xl font-semibold">Atualizar Registro: NF {selectedEntry.nf_numero}</h2>
                <button onClick={() => setSelectedEntry(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 space-y-8">
                {/* Section: Informações Gerais */}
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-600 uppercase tracking-widest">Informações Gerais</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mês de Referência</label>
                      <input 
                        value={editFormData.mes || getMonthName(editFormData.data_nf || editFormData.data_posicionamento)}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, mes: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none bg-gray-50"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição Produto</label>
                      <select 
                        value={editFormData.descricao_produto || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, descricao_produto: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none bg-white"
                      >
                        <option value="Cal Dolomítico">Cal Dolomítico</option>
                        <option value="Cal Calcítico">Cal Calcítico</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Destino</label>
                      <select 
                        value={editFormData.destino || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, destino: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none bg-white"
                      >
                        <option value="Serra - ES">Serra - ES</option>
                        <option value="Resende - RJ">Resende - RJ</option>
                      </select>
                    </div>
                    <Input 
                      label="Container" 
                      value={editFormData.container || ''} 
                      onChange={(e) => setEditFormData(prev => ({ ...prev, container: e.target.value }))}
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
                  </div>
                </section>

                {/* Section: Saída */}
                {(activeTab === 'saida' || activeTab === 'lista') && (
                  <section className="space-y-4">
                    <h3 className="text-sm font-bold text-titam-deep uppercase tracking-widest">Informações de Saída</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Input 
                        label="Data de Posicionamento" 
                        type="date" 
                        value={editFormData.data_posicionamento || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, data_posicionamento: e.target.value }))}
                      />
                      <Input 
                        label="Data Faturamento VLI" 
                        type="date" 
                        value={editFormData.data_faturamento_vli || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, data_faturamento_vli: e.target.value }))}
                      />
                      <Input 
                        label="Horário de Posicionamento" 
                        type="time"
                        value={editFormData.horario_posicionamento || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, horario_posicionamento: e.target.value }))}
                      />
                      <Input 
                        label="Horário de Faturamento" 
                        type="time"
                        value={editFormData.horario_faturamento || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, horario_faturamento: e.target.value }))}
                      />
                      <Input 
                        label="Nº Vagão" 
                        value={editFormData.numero_vagao || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, numero_vagao: e.target.value }))}
                      />
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Atual</label>
                        <select 
                          value={editFormData.status || ''}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value as any }))}
                          className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none bg-white"
                        >
                          <option value="Estoque">Estoque</option>
                          <option value="Rejeitado">Rejeitado</option>
                          <option value="Embarcado">Embarcado</option>
                          <option value="Devolvido">Devolvido</option>
                        </select>
                      </div>
                    </div>
                  </section>
                )}

                {/* Section: Performance */}
                {(activeTab === 'performance' || activeTab === 'lista') && (
                  <section className="space-y-4">
                    <h3 className="text-sm font-bold text-amber-600 uppercase tracking-widest">Performance Logística (Visualização)</h3>
                    <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Chegada</span>
                        <span className="font-mono">{editFormData.hora_chegada || '--:--'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Entrada</span>
                        <span className="font-mono">{editFormData.hora_entrada || '--:--'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Saída</span>
                        <span className="font-mono">{editFormData.hora_saida || '--:--'}</span>
                      </div>
                    </div>
                  </section>
                )}

                {/* Section: Faturamento */}
                {(activeTab === 'faturamento' || activeTab === 'lista') && (
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
                    </div>
                  </section>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    onClick={() => setSelectedEntry(null)} 
                    className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => handleUpdateEntry(selectedEntry.id, editFormData)} 
                    disabled={isUpdating}
                    className={`px-8 py-2 bg-titam-lime text-titam-deep rounded-lg hover:opacity-90 transition-colors font-bold shadow-md flex items-center gap-2 ${isUpdating ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isUpdating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </main>
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
  isProcessing
}: { 
  entries: Entry[], 
  onExportBackup: () => void, 
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onUndoLastImport: () => void,
  isProcessing: boolean
}) {
  const [reportType, setReportType] = useState<'estoque' | 'faturamento' | 'performance' | 'logistica_vli' | 'faturamento_detalhado' | 'saida_detalhada'>('estoque');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterFornecedor, setFilterFornecedor] = useState('');

  const filteredEntries = entries.filter(entry => {
    const date = reportType === 'saida_detalhada' ? (entry.data_faturamento_vli || entry.data_nf) : entry.data_nf;
    const matchesDate = (!startDate || date >= startDate) && (!endDate || date <= endDate);
    const matchesFornecedor = !filterFornecedor || entry.fornecedor.toLowerCase().includes(filterFornecedor.toLowerCase());
    return matchesDate && matchesFornecedor;
  });

  const exportToCSV = () => {
    const headers = reportType === 'estoque' 
      ? ['Data NF', 'NF', 'Fornecedor', 'Produto', 'Tonelada', 'Status']
      : reportType === 'faturamento'
      ? ['NF', 'Valor', 'Data Emissão', 'CTE Intertex', 'CTE Transportador']
      : reportType === 'performance'
      ? ['NF', 'Data Descarga', 'Fornecedor', 'Produto', 'Placa', 'Chegada', 'Entrada', 'Saída', 'Tempo Descarga', 'Tempo Total']
      : reportType === 'logistica_vli'
      ? ['NF', 'Produto', 'Container', 'Vagão', 'Fat. VLI', 'Destino', 'Fornecedor']
      : reportType === 'saida_detalhada'
      ? ['Data Posicionamento', 'Horário Posicionamento', 'Data NF', 'Data Descarga', 'NF', 'Produto', 'Volume (Ton)', 'Placa', 'Container', 'Vagão', 'Fat. VLI', 'Horário Faturamento', 'Destino', 'Fornecedor', 'Status']
      : ['Emissão NF', 'NF', 'Emissão CTE Intertex', 'CTE Intertex', 'Emissão CTE Transp.', 'CTE Transportador'];

    const rows = filteredEntries.map(e => {
      if (reportType === 'estoque') return [e.data_nf, e.nf_numero, e.fornecedor, e.descricao_produto, e.tonelada, e.status];
      if (reportType === 'faturamento') return [e.nf_numero, e.valor, e.data_emissao_nf, e.cte_intertex, e.cte_transportador];
      if (reportType === 'performance') return [e.nf_numero, e.data_descarga || '-', e.fornecedor, e.descricao_produto, e.placa_veiculo, e.hora_chegada, e.hora_entrada, e.hora_saida, calculateTimeDiff(e.hora_entrada, e.hora_saida), calculateTimeDiff(e.hora_chegada, e.hora_saida)];
      if (reportType === 'logistica_vli') return [e.nf_numero, e.descricao_produto, e.container, e.numero_vagao, e.data_faturamento_vli, e.destino, e.fornecedor];
      if (reportType === 'saida_detalhada') return [e.data_posicionamento, e.horario_posicionamento, e.data_nf, e.data_descarga, e.nf_numero, e.descricao_produto, e.tonelada, e.placa_veiculo, e.container, e.numero_vagao, e.data_faturamento_vli, e.horario_faturamento, e.destino, e.fornecedor, e.status];
      return [e.data_emissao_nf, e.nf_numero, e.data_emissao_cte, e.cte_intertex, e.data_emissao_cte_transp, e.cte_transportador];
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
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
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
            className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none bg-white"
          >
            <option value="estoque">Estoque por Fornecedor</option>
            <option value="faturamento">Faturamento Mensal</option>
            <option value="performance">Performance de Descarga</option>
            <option value="logistica_vli">Logística VLI</option>
            <option value="saida_detalhada">Relatório de Saída Detalhado</option>
            <option value="faturamento_detalhado">Faturamento Detalhado</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filtrar Fornecedor</label>
          <input 
            type="text" 
            placeholder="Nome do fornecedor..."
            value={filterFornecedor}
            onChange={(e) => setFilterFornecedor(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none"
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
            className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none"
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
            className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none"
          />
        </div>
        <button 
          onClick={exportToCSV}
          className="bg-titam-lime text-titam-deep px-4 py-2 rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2 font-bold shadow-sm"
        >
          <Download size={18} />
          Exportar CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 capitalize">Prévia: {reportType}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {reportType === 'estoque' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">Data NF</th>
                    <th className="px-6 py-3 data-grid-header">NF</th>
                    <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                    <th className="px-6 py-3 data-grid-header">Produto</th>
                    <th className="px-6 py-3 data-grid-header">Tonelada</th>
                    <th className="px-6 py-3 data-grid-header">Status</th>
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
                {reportType === 'saida_detalhada' && (
                  <>
                    <th className="px-6 py-3 data-grid-header">Data Posicionamento</th>
                    <th className="px-6 py-3 data-grid-header">Horário Posicionamento</th>
                    <th className="px-6 py-3 data-grid-header">Data NF</th>
                    <th className="px-6 py-3 data-grid-header">Data Descarga</th>
                    <th className="px-6 py-3 data-grid-header">NF</th>
                    <th className="px-6 py-3 data-grid-header">Produto</th>
                    <th className="px-6 py-3 data-grid-header">Volume (Ton)</th>
                    <th className="px-6 py-3 data-grid-header">Placa</th>
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
                    <th className="px-6 py-3 data-grid-header">Emissão CTE Intertex</th>
                    <th className="px-6 py-3 data-grid-header">CTE Intertex</th>
                    <th className="px-6 py-3 data-grid-header">Emissão CTE Transp.</th>
                    <th className="px-6 py-3 data-grid-header">CTE Transp.</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEntries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  {reportType === 'estoque' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_nf}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.fornecedor}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.descricao_produto}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.tonelada}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.status}</td>
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
                  {reportType === 'saida_detalhada' && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_posicionamento || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.horario_posicionamento || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_nf}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_descarga}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.nf_numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.descricao_produto}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.tonelada}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.placa_veiculo}</td>
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
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_emissao_cte || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.cte_intertex || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_emissao_cte_transp || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.cte_transportador || '-'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-titam-lime text-titam-deep font-bold shadow-lg' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
    >
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={14} className="ml-auto" />}
    </button>
  );
}

function StatCard({ title, value, subtitle, icon }: { title: string, value: number | string, subtitle: string, icon: React.ReactNode }) {
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.01 }}
      className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group relative overflow-hidden"
    >
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1E3932 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      
      <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 bg-titam-lime opacity-[0.05] rounded-full transition-transform duration-500 group-hover:scale-150"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="p-3 bg-gray-50 rounded-2xl text-gray-400 group-hover:text-titam-lime group-hover:bg-titam-lime/10 transition-all duration-300 shadow-inner">
            {icon}
          </div>
          <div className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] group-hover:text-titam-lime/30 transition-colors">
            {title.split(' ')[0]}
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">{title}</h3>
          <div className="flex items-baseline gap-2">
            <div className="text-5xl font-black text-gray-900 tracking-tighter tabular-nums drop-shadow-sm">{value}</div>
            {typeof value === 'number' && <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">un</div>}
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 pt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-titam-lime animate-pulse shadow-[0_0_8px_rgba(182,217,50,0.8)]"></span>
            {subtitle}
          </p>
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
        className="border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-titam-lime/30 focus:border-titam-lime focus:bg-white outline-none transition-all"
        {...props}
      />
    </div>
  );
}

function DataView({ title, entries, columns, onEdit, onDelete }: { 
  title: string, 
  entries: Entry[], 
  columns: { key: keyof Entry, label: string }[], 
  onEdit: (e: Entry) => void,
  onDelete: (id: string | number) => void
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const filteredEntries = entries.filter(entry => {
    const searchStr = searchTerm.toLowerCase();
    // Explicitly search in key fields to ensure container and others are always included
    const searchableFields = [
      entry.nf_numero,
      entry.container,
      entry.fornecedor,
      entry.descricao_produto,
      entry.placa_veiculo,
      entry.numero_vagao,
      entry.destino
    ];

    return searchableFields.some(val => 
      val && val.toString().toLowerCase().includes(searchStr)
    ) || Object.values(entry).some(val => 
      val && typeof val !== 'object' && val.toString().toLowerCase().includes(searchStr)
    );
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
    >
      <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-4 flex-1">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest whitespace-nowrap">{title}</h2>
          {showSearch && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '100%', opacity: 1 }}
              className="max-w-md"
            >
              <input 
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-titam-lime/30 outline-none"
                autoFocus
              />
            </motion.div>
          )}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2.5 rounded-xl transition-all ${showSearch ? 'bg-titam-lime text-titam-deep shadow-lg shadow-titam-lime/20' : 'text-gray-400 hover:bg-gray-50 border border-gray-100'}`}
          >
            <Search size={16} />
          </button>
          <button className="p-2.5 text-gray-400 hover:bg-gray-50 border border-gray-100 rounded-xl transition-all">
            <Filter size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50">
              {columns.map(col => (
                <th key={col.key as string} className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 italic font-serif opacity-70">{col.label}</th>
              ))}
              <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50 sticky right-0 bg-gray-50/50 z-10 italic font-serif opacity-70">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 opacity-20">
                    <Package size={48} />
                    <p className="text-xs font-bold uppercase tracking-widest">Nenhum registro</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="group hover:bg-titam-deep hover:text-white transition-all duration-200 cursor-default">
                  {columns.map(col => (
                    <td key={col.key as string} className="px-6 py-5 text-[11px] font-medium transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`
                          ${col.key === 'status' ? 'px-2 py-1 rounded-md bg-gray-100 text-gray-600 group-hover:bg-white/10 group-hover:text-white text-[9px] font-black uppercase tracking-wider' : ''}
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
                  <td className="px-6 py-5 sticky right-0 bg-white group-hover:bg-titam-deep z-10 border-l border-gray-50 group-hover:border-white/10 transition-all duration-200">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => onEdit(entry)}
                        className="text-[10px] font-black uppercase tracking-[0.15em] text-titam-deep group-hover:text-titam-lime transition-colors"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(entry.id);
                        }}
                        className="text-gray-300 group-hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

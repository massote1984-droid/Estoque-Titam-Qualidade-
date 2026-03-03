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
  Upload,
  RefreshCw as SyncIcon
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
  Cell
} from 'recharts';
import { Entry, StockSummary } from './types';

type Tab = 'dashboard' | 'entrada' | 'saida' | 'performance' | 'faturamento' | 'lista' | 'relatorios';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<StockSummary[]>([]);
  const [productDestSummary, setProductDestSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [importingNfe, setImportingNfe] = useState(false);
  const [nfeContent, setNfeContent] = useState('');
  const [formData, setFormData] = useState<Partial<Entry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [notifications, setNotifications] = useState<{id: string, message: string, type: 'info' | 'warning' | 'error'}[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([new Date().toISOString().split('T')[0]]);
  const [editFormData, setEditFormData] = useState<Partial<Entry>>({});
  const [lastBatchId, setLastBatchId] = useState<string | null>(localStorage.getItem('last_import_batch'));
  const isSyncing = React.useRef(false);
  const [isSyncingState, setIsSyncingState] = useState(false);

  useEffect(() => {
    if (selectedEntry) {
      setEditFormData(selectedEntry);
    } else {
      setEditFormData({});
    }
  }, [selectedEntry]);

  const addNotification = (message: string, type: 'info' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [{id, message, type}, ...prev]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const triggerTestAlert = () => {
    const alerts = [
      { msg: "ALERTA: Estoque de Cal Dolomítico (Serra-ES) está abaixo do limite mínimo (150t)!", type: 'warning' },
      { msg: "NOTIFICAÇÃO: 3 novos caminhões aguardando na portaria.", type: 'info' },
      { msg: "ERRO: Falha na sincronização com o sistema VLI. Tentando novamente...", type: 'error' }
    ];
    const alert = alerts[Math.floor(Math.random() * alerts.length)];
    addNotification(alert.msg, alert.type as any);
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

  const undoLastImport = async () => {
    if (!confirm("Tem certeza que deseja excluir os registros da última importação?")) return;
    
    try {
      // Try to delete by batchId if we have it
      const url = lastBatchId 
        ? `/api/delete-batch?batchId=${lastBatchId}` 
        : `/api/delete-batch?minutes=15`; // Fallback to last 15 mins for immediate fix
      
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        addNotification(`${data.changes} registros excluídos com sucesso.`, "info");
        // Clear local storage entries that might be pending
        const localData = localStorage.getItem('stock_entries');
        if (localData) {
          const entries = JSON.parse(localData);
          const filtered = entries.filter((e: any) => e.import_batch !== lastBatchId);
          localStorage.setItem('stock_entries', JSON.stringify(filtered));
        }
        setLastBatchId(null);
        localStorage.removeItem('last_import_batch');
        fetchData();
      } else {
        throw new Error(data.error || "Erro ao excluir registros");
      }
    } catch (err: any) {
      addNotification(`Erro: ${err.message}`, "error");
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
            data_faturamento_vli: row['Data Fat. VLI'] || row.data_faturamento_vli || row['DATA FATURAMENTO'] || '',
            status: row.Status || row.status || row.STATUS || 'Estoque',
            fornecedor: row.Fornecedor || row.fornecedor || row.FORNECEDOR || '',
            placa_veiculo: row.Placa || row.placa_veiculo || row.PLACA || '',
            container: row.Container || row.container || row.CONTAINER || '',
            destino: row.Destino || row.destino || row.DESTINO || '',
            created_at: new Date().toISOString()
          }));
        }

        if (entriesToImport.length > 0) {
          const localData = localStorage.getItem('stock_entries');
          const existingEntries = localData ? JSON.parse(localData) : [];
          
          const batchId = `batch_${Date.now()}`;
          setLastBatchId(batchId);
          localStorage.setItem('last_import_batch', batchId);

          const importedEntries = entriesToImport.map((ent: any) => ({ 
            ...ent, 
            id: ent.id || Date.now() + Math.random(),
            import_batch: batchId,
            isPending: true // Always mark as pending so they get synced to server
          }));
          
          const mergedEntries = [...importedEntries, ...existingEntries];
          setEntries(mergedEntries);
          localStorage.setItem('stock_entries', JSON.stringify(mergedEntries));
          addNotification(`${entriesToImport.length} registros importados. Sincronizando com o servidor...`, "info");
          
          if (serverStatus === 'online') {
            syncOfflineData();
          } else {
            fetchData(); // This will handle offline summary calculation
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

  const syncOfflineData = async () => {
    if (isSyncing.current) return;
    
    const localData = localStorage.getItem('stock_entries');
    if (!localData) return;

    let currentEntries = JSON.parse(localData);
    const pendingEntries = currentEntries.filter((e: any) => e.isPending);

    if (pendingEntries.length === 0) return;

    isSyncing.current = true;
    setIsSyncingState(true);
    console.log(`Sincronizando ${pendingEntries.length} registros pendentes...`);
    
    let syncSuccessCount = 0;
    const updatedLocalEntries = [...currentEntries];

    for (let i = 0; i < updatedLocalEntries.length; i++) {
      const entry = updatedLocalEntries[i];
      if (!entry.isPending) continue;

      try {
        const { id, isPending, ...dataToSync } = entry;
        
        // If ID is large, it's a temporary local ID, use POST to create
        // If ID is small, it's an existing server ID, use PUT to update
        const isNewEntry = id > 1000000000000;
        
        const res = await fetch(isNewEntry ? '/api/entries' : `/api/entries/${id}`, {
          method: isNewEntry ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSync),
        });

        if (res.ok) {
          if (isNewEntry) {
            const result = await res.json();
            updatedLocalEntries[i] = { ...entry, id: result.id, isPending: false };
          } else {
            updatedLocalEntries[i] = { ...entry, isPending: false };
          }
          syncSuccessCount++;
        }
      } catch (error) {
        console.error("Erro ao sincronizar registro:", error);
        break;
      }
    }

    if (syncSuccessCount > 0) {
      localStorage.setItem('stock_entries', JSON.stringify(updatedLocalEntries));
      setEntries(updatedLocalEntries);
      fetchData(); // Refresh all data from server after sync to ensure consistency
    }
    
    isSyncing.current = false;
    setIsSyncingState(false);
  };

  const fetchData = async () => {
    try {
      // Use a timeout for the health check to avoid long hangs
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const healthRes = await fetch(`/api/health?t=${Date.now()}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (healthRes.ok) {
        if (serverStatus !== 'online') {
          setServerStatus('online');
          syncOfflineData();
        }
      } else {
        throw new Error('Server offline');
      }

      const [entriesRes, summaryRes, productDestRes] = await Promise.all([
        fetch('/api/entries'),
        fetch('/api/stock-summary'),
        fetch('/api/stock-by-product-destination')
      ]);
      
      if (!entriesRes.ok || !summaryRes.ok || !productDestRes.ok) {
        throw new Error('Failed to fetch entries or summary');
      }

      const entriesData = await entriesRes.json();
      const summaryData = await summaryRes.json();
      const productDestData = await productDestRes.json();
      
      // Merge local pending entries with server data
      const localData = localStorage.getItem('stock_entries');
      const localEntries = localData ? JSON.parse(localData) : [];
      const pendingEntries = localEntries.filter((e: any) => e.isPending);
      
      // Use a Map to ensure unique entries by ID, preferring server data for non-pending
      const entryMap = new Map();
      
      // Add server entries first
      entriesData.forEach((e: any) => entryMap.set(e.id, e));
      
      // Add pending entries (might overwrite if ID matches, but pending should have temp IDs)
      pendingEntries.forEach((e: any) => entryMap.set(e.id, e));
      
      const mergedEntries = Array.from(entryMap.values());
      
      // Sort by created_at or ID to maintain order
      mergedEntries.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setEntries(mergedEntries);
      setSummary(summaryData);
      setProductDestSummary(productDestData);
      
      localStorage.setItem('stock_entries', JSON.stringify(mergedEntries));
    } catch (error) {
      console.error("Error fetching data, falling back to local storage:", error);
      setServerStatus('offline');
      
      const localData = localStorage.getItem('stock_entries');
      if (localData) {
        const parsedData = JSON.parse(localData);
        if (parsedData.length > 0) {
          setEntries(parsedData);
          
          // Calculate summary locally to keep UI functional
          const suppliers = [...new Set(parsedData.map((e: any) => e.fornecedor))];
          const localSummary = suppliers.map(s => ({
            fornecedor: s,
            in_stock: parsedData.filter((e: any) => e.fornecedor === s && ['Estoque', 'Rejeitado'].includes(e.status)).length,
            exited: parsedData.filter((e: any) => e.fornecedor === s && ['Embarcado', 'Devolvido'].includes(e.status)).length
          }));
          setSummary(localSummary);

          const productDests = [...new Set(parsedData.map((e: any) => `${e.descricao_produto}|${e.destino}`))];
          const localProductDestSummary = productDests.map(pd => {
            const [prod, dest] = (pd as string).split('|');
            const filtered = parsedData.filter((e: any) => e.descricao_produto === prod && e.destino === dest);
            return {
              descricao_produto: prod,
              destino: dest,
              in_stock: filtered.filter((e: any) => ['Estoque', 'Rejeitado'].includes(e.status)).length,
              exited: filtered.filter((e: any) => ['Embarcado', 'Devolvido'].includes(e.status)).length
            };
          });
          setProductDestSummary(localProductDestSummary);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Warn user if they try to leave with pending changes
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const localData = localStorage.getItem('stock_entries');
      if (localData) {
        const entries = JSON.parse(localData);
        if (entries.some((e: any) => e.isPending)) {
          e.preventDefault();
          e.returnValue = '';
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    setTimeout(() => {
      addNotification("Bem-vindo ao Sistema Titam! O monitoramento de estoque está ativo.", "info");
    }, 1500);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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

  const chartDataDaily = React.useMemo(() => {
    const dailyMap: Record<string, any> = {};
    entries.forEach(entry => {
      const date = entry.data_nf;
      if (!dailyMap[date]) {
        dailyMap[date] = { date, 'Cal Dolomítico': 0, 'Cal Calcítico': 0, total: 0 };
      }
      if (entry.descricao_produto === 'Cal Dolomítico') dailyMap[date]['Cal Dolomítico'] += entry.tonelada;
      if (entry.descricao_produto === 'Cal Calcítico') dailyMap[date]['Cal Calcítico'] += entry.tonelada;
      dailyMap[date].total += entry.tonelada;
    });
    return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  }, [entries]);

  const performanceChartData = React.useMemo(() => {
    return entries
      .filter(e => e.hora_chegada && e.hora_saida)
      .slice(-10)
      .map(e => ({
        nf: `NF ${e.nf_numero}`,
        total: calculateTimeInMinutes(e.hora_chegada, e.hora_saida),
        descarga: calculateTimeInMinutes(e.hora_entrada, e.hora_saida)
      }));
  }, [entries]);

  const supplierStockByDate = React.useMemo(() => {
    const filtered = entries.filter(e => selectedDates.includes(e.data_descarga));
    const supplierMap: Record<string, number> = {};
    filtered.forEach(e => {
      supplierMap[e.fornecedor] = (supplierMap[e.fornecedor] || 0) + 1;
    });
    return Object.entries(supplierMap).map(([name, count]) => ({ name, count }));
  }, [entries, selectedDates]);

  const dailyStats = React.useMemo(() => {
    const filtered = entries.filter(e => selectedDates.includes(e.data_descarga));
    return {
      in_stock: filtered.filter(e => ['Estoque', 'Rejeitado'].includes(e.status)).length,
      exited: filtered.filter(e => ['Embarcado', 'Devolvido'].includes(e.status)).length,
      suppliers: [...new Set(filtered.map(e => e.fornecedor))].length
    };
  }, [entries, selectedDates]);

  const monthlyExitTotal = React.useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    return entries
      .filter(e => {
        if (!['Embarcado', 'Devolvido'].includes(e.status)) return false;
        const exitDate = e.data_faturamento_vli || e.data_descarga;
        if (!exitDate) return false;
        const [y, m] = exitDate.split('-').map(Number);
        return y === currentYear && m === currentMonth;
      })
      .reduce((acc, e) => acc + e.tonelada, 0);
  }, [entries]);

  const exitChartData = React.useMemo(() => {
    const dailyMap: Record<string, any> = {};
    
    // Filter entries that:
    // 1. Arrived on the selected dates AND are exited (to show later exits)
    // 2. OR exited on the selected dates (to show exits of older stock)
    const exitedEntries = entries.filter(entry => {
      const isExited = ['Embarcado', 'Devolvido'].includes(entry.status);
      if (!isExited) return false;
      
      const arrivedOnSelected = selectedDates.includes(entry.data_descarga);
      const exitedOnSelected = entry.data_faturamento_vli && selectedDates.includes(entry.data_faturamento_vli);
      
      return arrivedOnSelected || exitedOnSelected;
    });

    // Get all unique dates to build the X-axis
    // This includes:
    // - All selected dates (context)
    // - All actual exit dates for the filtered entries
    const chartDates = new Set<string>(selectedDates);
    exitedEntries.forEach(entry => {
      const exitDate = entry.data_faturamento_vli || entry.data_descarga;
      if (exitDate) chartDates.add(exitDate);
    });

    const sortedDates = Array.from(chartDates).sort();
    
    sortedDates.forEach(date => {
      dailyMap[date] = { date };
    });

    exitedEntries.forEach(entry => {
      const exitDate = entry.data_faturamento_vli || entry.data_descarga;
      const key = `${entry.descricao_produto} - ${entry.destino}`;
      if (exitDate && dailyMap[exitDate]) {
        if (!dailyMap[exitDate][key]) {
          dailyMap[exitDate][key] = 0;
        }
        dailyMap[exitDate][key] += entry.tonelada;
      }
    });

    return Object.values(dailyMap);
  }, [entries, selectedDates]);

  const exitChartKeys = React.useMemo(() => {
    const keys = new Set<string>();
    entries.forEach(entry => {
      if (['Embarcado', 'Devolvido'].includes(entry.status)) {
        keys.add(`${entry.descricao_produto} - ${entry.destino}`);
      }
    });
    return Array.from(keys);
  }, [entries]);

  const handleCreateEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formDataObj = new FormData(e.currentTarget);
    const data = Object.fromEntries(formDataObj.entries());
    
    // Optimistic Update: Save locally first
    const newId = Date.now() + Math.random();
    const newItem = { ...data, id: newId, created_at: new Date().toISOString(), isPending: true };
    const newEntries = [newItem, ...entries];
    
    setEntries(newEntries as Entry[]);
    localStorage.setItem('stock_entries', JSON.stringify(newEntries));
    setShowForm(false);
    setFormData({});
    setIsSaving(false);

    // Try to sync in background
    syncOfflineData();
  };

  const handleUpdateEntry = async (id: number, updates: Partial<Entry>) => {
    // Optimistic Update: Save locally first
    const updatedEntries = entries.map(e => e.id === id ? { ...e, ...updates, isPending: true } : e);
    setEntries(updatedEntries);
    localStorage.setItem('stock_entries', JSON.stringify(updatedEntries));
    setSelectedEntry(null);

    // Try to sync in background
    syncOfflineData();
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    
    const previousEntries = [...entries];
    const newEntries = entries.filter(e => e.id !== id);
    setEntries(newEntries);
    localStorage.setItem('stock_entries', JSON.stringify(newEntries));
    
    try {
      if (serverStatus === 'online') {
        const res = await fetch(`/api/entries/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          // If server delete fails, we might want to revert or just log
          console.error("Failed to delete on server");
        }
      }
    } catch (error: any) {
      console.error("Error deleting entry:", error);
    }
  };

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
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 capitalize">
                {activeTab === 'dashboard' ? 'Painel Informativo - Titam' : activeTab}
              </h1>
              <p className="text-gray-500 text-sm">Gerencie seu estoque com precisão técnica.</p>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              serverStatus === 'online' ? 'bg-emerald-50 text-emerald-600' : 
              serverStatus === 'offline' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                serverStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 
                serverStatus === 'offline' ? 'bg-red-500' : 'bg-gray-400'
              }`} />
              {serverStatus === 'online' ? 'Sistema Online' : serverStatus === 'offline' ? 'Modo Offline (Local)' : 'Verificando...'}
              {serverStatus === 'offline' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fetchData()} 
                    className="ml-2 underline hover:text-red-800 transition-colors"
                  >
                    Tentar Reconectar
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isSyncingState && (
              <div className="flex items-center gap-2 text-[10px] text-titam-deep font-bold bg-titam-lime/20 px-3 py-1 rounded-full animate-pulse">
                <SyncIcon size={10} className="animate-spin" />
                Sincronizando...
              </div>
            )}
            <button 
              onClick={() => {
                addNotification("Iniciando sincronização manual...", "info");
                fetchData();
              }}
              className="p-2 text-gray-400 hover:text-titam-deep hover:bg-titam-lime/10 rounded-lg transition-colors"
              title="Sincronizar Dados"
            >
              <SyncIcon size={20} className={loading ? 'animate-spin' : ''} />
            </button>

            <div className="relative">
              <button 
                onClick={triggerTestAlert}
                className="p-2 text-gray-400 hover:text-titam-deep hover:bg-titam-lime/10 rounded-lg transition-colors relative"
                title="Simular Alerta de Estoque"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>
              
              <AnimatePresence>
                {notifications.length > 0 && (
                  <div className="absolute right-0 mt-2 w-80 z-50 pointer-events-none">
                    {notifications.map((n, i) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 20, y: -10 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`mb-2 p-4 rounded-xl shadow-lg border flex items-start gap-3 pointer-events-auto ${
                          n.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                          n.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                          'bg-blue-50 border-blue-200 text-blue-800'
                        }`}
                      >
                        {n.type === 'warning' && <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
                        <p className="text-sm font-medium">{n.message}</p>
                        <button 
                          onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                          className="ml-auto text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>

            {activeTab !== 'dashboard' && (
            <button 
              onClick={() => {
                setFormData({});
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-titam-lime text-titam-deep px-4 py-2 rounded-lg hover:opacity-90 transition-colors shadow-sm font-bold"
            >
              <Plus size={18} />
              Nova Entrada
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
            >
              {/* Date Filter */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-titam-lime/10 rounded-lg text-titam-deep">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Filtro por Data de Descarga</h3>
                      <p className="text-xs text-gray-500">Selecione uma ou mais datas para filtrar os dados.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      onChange={(e) => {
                        const date = e.target.value;
                        if (date && !selectedDates.includes(date)) {
                          setSelectedDates(prev => [...prev, date].sort());
                        }
                      }}
                      className="border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-titam-lime outline-none font-medium text-gray-700"
                    />
                    <button 
                      onClick={() => setSelectedDates([new Date().toISOString().split('T')[0]])}
                      className="text-xs font-bold text-titam-deep hover:underline px-2"
                    >
                      Resetar
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {selectedDates.map(date => (
                    <div key={date} className="flex items-center gap-2 bg-titam-lime/20 text-titam-deep px-3 py-1 rounded-full text-xs font-bold border border-titam-lime/30">
                      {date.split('-').reverse().join('/')}
                      <button 
                        onClick={() => {
                          if (selectedDates.length > 1) {
                            setSelectedDates(prev => prev.filter(d => d !== date));
                          }
                        }}
                        className="hover:text-red-600"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <StatCard 
                  title="Estoque Selecionado" 
                  value={dailyStats.in_stock} 
                  subtitle="Nas datas filtradas"
                  icon={<Package className="text-titam-deep" />}
                />
                <StatCard 
                  title="Saídas Selecionadas" 
                  value={dailyStats.exited} 
                  subtitle="Nas datas filtradas"
                  icon={<ArrowUpRight className="text-titam-deep" />}
                />
                <StatCard 
                  title="Fornecedores" 
                  value={dailyStats.suppliers} 
                  subtitle="Nas datas filtradas"
                  icon={<Truck className="text-titam-deep" />}
                />
                <StatCard 
                  title="Total Saídas Mês" 
                  value={monthlyExitTotal.toFixed(1)} 
                  subtitle="Toneladas (Mês Atual)"
                  icon={<TrendingUp className="text-emerald-600" />}
                />
                <div className="bg-titam-deep rounded-xl p-5 shadow-sm border border-white/10 flex flex-col justify-between">
                  <div>
                    <h3 className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-1">Centro de Alertas</h3>
                    <p className="text-white text-lg font-bold">Teste o Sistema</p>
                  </div>
                  <button 
                    onClick={triggerTestAlert}
                    className="mt-3 w-full py-1.5 bg-titam-lime text-titam-deep rounded-lg text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <Bell size={14} />
                    Disparar Alerta
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart: Saídas por Dia */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <BarChart3 size={18} className="text-titam-deep" />
                      Saídas por Dia (Toneladas por Destino/Produto)
                    </h3>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={exitChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 12, fill: '#64748B' }}
                          tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        {exitChartKeys.map((key, idx) => (
                          <Bar 
                            key={key} 
                            dataKey={key} 
                            stackId="a" 
                            fill={idx % 2 === 0 ? "#B6D932" : "#1E3932"} 
                            radius={idx === exitChartKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Line Chart: Performance */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Activity size={18} className="text-amber-600" />
                      Performance Logística (Minutos)
                    </h3>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis 
                          dataKey="nf" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#64748B' }}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Line type="monotone" dataKey="total" name="Tempo Total" stroke="#B6D932" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="descarga" name="Tempo Descarga" stroke="#1E3932" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="font-semibold text-gray-900">Estoque por Fornecedor</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                          <th className="px-6 py-3 data-grid-header">Em Estoque</th>
                          <th className="px-6 py-3 data-grid-header">Saídas</th>
                          <th className="px-6 py-3 data-grid-header">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900">{s.fornecedor}</td>
                            <td className="px-6 py-4 mono-value">{s.in_stock}</td>
                            <td className="px-6 py-4 mono-value">{s.exited}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.in_stock > 0 ? 'bg-titam-lime/20 text-titam-deep' : 'bg-gray-100 text-gray-600'}`}>
                                {s.in_stock > 0 ? 'Ativo' : 'Vazio'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="font-semibold text-gray-900">Estoque por Produto e Destino</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-3 data-grid-header">Produto</th>
                          <th className="px-6 py-3 data-grid-header">Destino</th>
                          <th className="px-6 py-3 data-grid-header">Estoque</th>
                          <th className="px-6 py-3 data-grid-header">Saídas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {productDestSummary.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900">{s.descricao_produto}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{s.destino}</td>
                            <td className="px-6 py-4 mono-value text-titam-deep font-bold">{s.in_stock}</td>
                            <td className="px-6 py-4 mono-value text-gray-400">{s.exited}</td>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {supplierStockByDate.map((item, idx) => (
                      <div key={idx} className="p-4 rounded-lg border border-gray-100 bg-gray-50/50 flex flex-col items-center justify-center text-center">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{item.name}</p>
                        <p className="text-3xl font-black text-titam-deep">{item.count}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-1">Notas Fiscais</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-gray-400">
                    <Package size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">Nenhuma nota fiscal recebida nesta data.</p>
                  </div>
                )}
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
            <DataView 
              title="Gestão de Saídas"
              entries={entries}
              columns={[
                { key: 'nf_numero', label: 'N.F' },
                { key: 'container', label: 'Container' },
                { key: 'data_faturamento_vli', label: 'Data Fat. VLI' },
                { key: 'cte_vli', label: 'CTE VLI' },
                { key: 'numero_vagao', label: 'Nº Vagão' },
                { key: 'status', label: 'Status' }
              ]}
              onEdit={setSelectedEntry}
              onDelete={handleDeleteEntry}
            />
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
                { key: 'status', label: 'Status' },
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
            />
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
                <Input label="Mês" name="mes" required defaultValue={formData.mes} />
                <Input label="Chave de Acesso NF" name="chave_acesso" required defaultValue={formData.chave_acesso} />
                <Input label="N.F" name="nf_numero" required defaultValue={formData.nf_numero} />
                <Input label="Tonelada" name="tonelada" type="number" step="0.01" required defaultValue={formData.tonelada} />
                <Input label="Valor" name="valor" type="number" step="0.01" required defaultValue={formData.valor} />
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
                    }
                  }}
                  className="px-6 py-2 bg-titam-lime text-titam-deep rounded-lg hover:opacity-90 transition-colors flex items-center gap-2 font-bold"
                >
                  <Search size={18} />
                  Processar com IA
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
                        label="Data Faturamento VLI" 
                        type="date" 
                        value={editFormData.data_faturamento_vli || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, data_faturamento_vli: e.target.value }))}
                      />
                      <Input 
                        label="CTE VLI" 
                        value={editFormData.cte_vli || ''} 
                        onChange={(e) => setEditFormData(prev => ({ ...prev, cte_vli: e.target.value }))}
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
                    className="px-8 py-2 bg-titam-lime text-titam-deep rounded-lg hover:opacity-90 transition-colors font-bold shadow-md"
                  >
                    Salvar Alterações
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
  onUndoLastImport
}: { 
  entries: Entry[], 
  onExportBackup: () => void, 
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onUndoLastImport: () => void
}) {
  const [reportType, setReportType] = useState<'estoque' | 'faturamento' | 'performance' | 'logistica_vli' | 'faturamento_detalhado'>('estoque');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterFornecedor, setFilterFornecedor] = useState('');

  const filteredEntries = entries.filter(entry => {
    const date = entry.data_nf;
    const matchesDate = (!startDate || date >= startDate) && (!endDate || date <= endDate);
    const matchesFornecedor = !filterFornecedor || entry.fornecedor.toLowerCase().includes(filterFornecedor.toLowerCase());
    return matchesDate && matchesFornecedor;
  });

  const exportToCSV = () => {
    const headers = reportType === 'estoque' 
      ? ['Fornecedor', 'Produto', 'Tonelada', 'Status', 'Data NF']
      : reportType === 'faturamento'
      ? ['NF', 'Valor', 'Data Emissão', 'CTE Intertex', 'CTE Transportador']
      : reportType === 'performance'
      ? ['NF', 'Data Descarga', 'Fornecedor', 'Produto', 'Placa', 'Chegada', 'Entrada', 'Saída', 'Tempo Descarga', 'Tempo Total']
      : reportType === 'logistica_vli'
      ? ['NF', 'Container', 'Vagão', 'Fat. VLI', 'Destino']
      : ['Emissão NF', 'NF', 'Emissão CTE Intertex', 'CTE Intertex', 'Emissão CTE Transp.', 'CTE Transportador'];

    const rows = filteredEntries.map(e => {
      if (reportType === 'estoque') return [e.fornecedor, e.descricao_produto, e.tonelada, e.status, e.data_nf];
      if (reportType === 'faturamento') return [e.nf_numero, e.valor, e.data_emissao_nf, e.cte_intertex, e.cte_transportador];
      if (reportType === 'performance') return [e.nf_numero, e.data_descarga || '-', e.fornecedor, e.descricao_produto, e.placa_veiculo, e.hora_chegada, e.hora_entrada, e.hora_saida, calculateTimeDiff(e.hora_entrada, e.hora_saida), calculateTimeDiff(e.hora_chegada, e.hora_saida)];
      if (reportType === 'logistica_vli') return [e.nf_numero, e.container, e.numero_vagao, e.data_faturamento_vli, e.destino];
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
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-bold border border-red-100"
            >
              <Trash2 size={14} />
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
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Início</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Fim</label>
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
                    <th className="px-6 py-3 data-grid-header">Fornecedor</th>
                    <th className="px-6 py-3 data-grid-header">Produto</th>
                    <th className="px-6 py-3 data-grid-header">Tonelada</th>
                    <th className="px-6 py-3 data-grid-header">Status</th>
                    <th className="px-6 py-3 data-grid-header">Data NF</th>
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
                    <th className="px-6 py-3 data-grid-header">Container</th>
                    <th className="px-6 py-3 data-grid-header">Vagão</th>
                    <th className="px-6 py-3 data-grid-header">Fat. VLI</th>
                    <th className="px-6 py-3 data-grid-header">Destino</th>
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
                      <td className="px-6 py-4 text-sm text-gray-600">{e.fornecedor}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.descricao_produto}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.tonelada}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.status}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_nf}</td>
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
                      <td className="px-6 py-4 text-sm text-gray-600">{e.container}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.numero_vagao || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.data_faturamento_vli || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{e.destino}</td>
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
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-titam-lime/30 transition-colors group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-titam-lime/10 rounded-lg group-hover:bg-titam-lime/20 transition-colors">
          {icon}
        </div>
      </div>
      <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
      <div className="text-3xl font-bold text-gray-900 mb-1 mono-value">{value}</div>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <input 
        className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-titam-lime outline-none transition-shadow"
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
  onDelete: (id: number) => void
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const filteredEntries = entries.filter(entry => {
    const searchStr = searchTerm.toLowerCase();
    return Object.values(entry).some(val => 
      val && val.toString().toLowerCase().includes(searchStr)
    );
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
    >
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-4 flex-1">
          <h2 className="font-semibold text-gray-900 whitespace-nowrap">{title}</h2>
          {showSearch && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '100%', opacity: 1 }}
              className="max-w-md"
            >
              <input 
                type="text"
                placeholder="Pesquisar em todos os campos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-titam-lime outline-none"
                autoFocus
              />
            </motion.div>
          )}
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 border rounded-lg transition-colors ${showSearch ? 'bg-titam-lime/10 text-titam-deep border-titam-lime/30' : 'text-gray-400 hover:text-gray-600 border-gray-200'}`}
          >
            <Search size={18} />
          </button>
          <button className="p-2 text-gray-400 hover:text-titam-deep hover:bg-titam-lime/10 border border-gray-200 rounded-lg transition-colors">
            <Filter size={18} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columns.map(col => (
                <th key={col.key as string} className="px-6 py-3 data-grid-header">{col.label}</th>
              ))}
              <th className="px-6 py-3 data-grid-header sticky right-0 bg-gray-50 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-gray-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="group hover:bg-gray-50 transition-colors">
                  {columns.map(col => (
                    <td key={col.key as string} className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        {(col.key as any) === 'total_time' ? calculateTimeDiff(entry.hora_chegada, entry.hora_saida) :
                         (col.key as any) === 'descarga_time' ? calculateTimeDiff(entry.hora_entrada, entry.hora_saida) :
                         (entry[col.key] || '-')}
                        {col.key === 'nf_numero' && entry.isPending && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-bold uppercase flex items-center gap-1">
                            <RefreshCw size={10} className="animate-spin" />
                            Pendente
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="px-6 py-4 sticky right-0 bg-white group-hover:bg-gray-50 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] transition-colors">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => onEdit(entry)}
                        className="text-titam-deep hover:opacity-70 text-sm font-medium"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(entry.id);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors group"
                        title="Excluir Registro"
                      >
                        <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
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

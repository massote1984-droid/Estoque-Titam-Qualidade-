import React, { useState, useEffect } from 'react';
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
  Calendar
} from 'lucide-react';
import { Entry, StockSummary } from './types';

type Tab = 'dashboard' | 'entrada' | 'saida' | 'performance' | 'faturamento' | 'lista' | 'relatorios';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [importingNfe, setImportingNfe] = useState(false);
  const [nfeContent, setNfeContent] = useState('');
  const [formData, setFormData] = useState<Partial<Entry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  const fetchData = async () => {
    try {
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) setServerStatus('online');
      else setServerStatus('offline');

      const [entriesRes, summaryRes] = await Promise.all([
        fetch('/api/entries'),
        fetch('/api/stock-summary')
      ]);
      const entriesData = await entriesRes.json();
      const summaryData = await summaryRes.json();
      setEntries(entriesData);
      setSummary(summaryData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formDataObj = new FormData(e.currentTarget);
    const data = Object.fromEntries(formDataObj.entries());
    
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({});
        fetchData();
      } else {
        const errorData = await res.json();
        alert(`Erro ao salvar: ${errorData.error || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error("Error creating entry:", error);
      alert(`Erro de conexão ao salvar registro: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateEntry = async (id: number, updates: Partial<Entry>) => {
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setSelectedEntry(null);
        fetchData();
      }
    } catch (error) {
      console.error("Error updating entry:", error);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
            <Package size={24} />
            <span>StockPro</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
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
            icon={<Clock size={18} />} 
            label="Performance" 
            active={activeTab === 'performance'} 
            onClick={() => setActiveTab('performance')} 
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
              <h1 className="text-2xl font-semibold text-gray-900 capitalize">{activeTab}</h1>
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
              {serverStatus === 'online' ? 'Sistema Online' : serverStatus === 'offline' ? 'Sistema Offline' : 'Verificando...'}
            </div>
          </div>
          {activeTab !== 'dashboard' && (
            <button 
              onClick={() => {
                setFormData({});
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus size={18} />
              Nova Entrada
            </button>
          )}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  title="Total em Estoque" 
                  value={summary.reduce((acc, s) => acc + s.in_stock, 0)} 
                  subtitle="Unidades ativas"
                  icon={<Package className="text-indigo-600" />}
                />
                <StatCard 
                  title="Total Saídas" 
                  value={summary.reduce((acc, s) => acc + s.exited, 0)} 
                  subtitle="Unidades embarcadas"
                  icon={<ArrowUpRight className="text-emerald-600" />}
                />
                <StatCard 
                  title="Fornecedores" 
                  value={summary.length} 
                  subtitle="Parceiros ativos"
                  icon={<Truck className="text-amber-600" />}
                />
              </div>

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
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.in_stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                              {s.in_stock > 0 ? 'Ativo' : 'Vazio'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                { key: 'nf_numero', label: 'N.F' },
                { key: 'tonelada', label: 'Tonelada' },
                { key: 'valor', label: 'Valor' },
                { key: 'fornecedor', label: 'Fornecedor' },
                { key: 'status', label: 'Status' }
              ]}
              onEdit={setSelectedEntry}
            />
          )}

          {activeTab === 'saida' && (
            <DataView 
              title="Gestão de Saídas"
              entries={entries}
              columns={[
                { key: 'nf_numero', label: 'N.F' },
                { key: 'data_faturamento_vli', label: 'Data Fat. VLI' },
                { key: 'cte_vli', label: 'CTE VLI' },
                { key: 'status', label: 'Status' }
              ]}
              onEdit={setSelectedEntry}
            />
          )}

          {activeTab === 'performance' && (
            <DataView 
              title="Performance Logística"
              entries={entries}
              columns={[
                { key: 'nf_numero', label: 'N.F' },
                { key: 'hora_chegada', label: 'Chegada' },
                { key: 'hora_entrada', label: 'Entrada' },
                { key: 'hora_saida', label: 'Saída' },
                { key: 'placa_veiculo', label: 'Placa' }
              ]}
              onEdit={setSelectedEntry}
            />
          )}

          {activeTab === 'faturamento' && (
            <DataView 
              title="Faturamento e CTEs"
              entries={entries}
              columns={[
                { key: 'nf_numero', label: 'N.F' },
                { key: 'data_emissao_nf', label: 'Emissão NF' },
                { key: 'cte_intertex', label: 'CTE Intertex' },
                { key: 'data_emissao_cte', label: 'Emissão CTE' },
                { key: 'cte_transportador', label: 'CTE Transp.' }
              ]}
              onEdit={setSelectedEntry}
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
                { key: 'status', label: 'Status' },
                { key: 'data_nf', label: 'Data NF' }
              ]}
              onEdit={setSelectedEntry}
            />
          )}

          {activeTab === 'relatorios' && (
            <ReportsView entries={entries} />
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
                    className="flex items-center gap-2 text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 text-sm font-medium"
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
                <Input label="Descrição Produto" name="descricao_produto" required defaultValue={formData.descricao_produto} />
                <Input label="Data N.F" name="data_nf" type="date" required defaultValue={formData.data_nf} />
                <Input label="Data Descarga" name="data_descarga" type="date" required defaultValue={formData.data_descarga} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                  <select name="status" defaultValue={formData.status || "Estoque"} className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" required>
                    <option value="Estoque">Estoque</option>
                    <option value="Rejeitado">Rejeitado</option>
                    <option value="Embarcado">Embarcado</option>
                    <option value="Devolvido">Devolvido</option>
                  </select>
                </div>
                <Input label="Fornecedor" name="fornecedor" required defaultValue={formData.fornecedor} />
                <Input label="Placa do Veículo" name="placa_veiculo" required defaultValue={formData.placa_veiculo} />
                <Input label="Container" name="container" required defaultValue={formData.container} />
                <Input label="Destino" name="destino" required defaultValue={formData.destino} />
                
                <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                  <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" disabled={isSaving}>Cancelar</button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className={`px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-md active:scale-95 flex items-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
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
                className="w-full h-48 border border-gray-200 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm mb-6"
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
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
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
                {/* Section: Saída */}
                {(activeTab === 'saida' || activeTab === 'lista') && (
                  <section className="space-y-4">
                    <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Informações de Saída</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Input 
                        label="Data Faturamento VLI" 
                        type="date" 
                        defaultValue={selectedEntry.data_faturamento_vli} 
                        onBlur={(e) => handleUpdateEntry(selectedEntry.id, { data_faturamento_vli: e.target.value })}
                      />
                      <Input 
                        label="CTE VLI" 
                        defaultValue={selectedEntry.cte_vli} 
                        onBlur={(e) => handleUpdateEntry(selectedEntry.id, { cte_vli: e.target.value })}
                      />
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status Atual</label>
                        <select 
                          defaultValue={selectedEntry.status}
                          onChange={(e) => handleUpdateEntry(selectedEntry.id, { status: e.target.value as any })}
                          className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
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
                    <h3 className="text-sm font-bold text-amber-600 uppercase tracking-widest">Performance Logística</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <Input 
                        label="Hora Chegada" 
                        type="time" 
                        defaultValue={selectedEntry.hora_chegada} 
                        onBlur={(e) => handleUpdateEntry(selectedEntry.id, { hora_chegada: e.target.value })}
                      />
                      <Input 
                        label="Hora Entrada" 
                        type="time" 
                        defaultValue={selectedEntry.hora_entrada} 
                        onBlur={(e) => handleUpdateEntry(selectedEntry.id, { hora_entrada: e.target.value })}
                      />
                      <Input 
                        label="Hora Saída" 
                        type="time" 
                        defaultValue={selectedEntry.hora_saida} 
                        onBlur={(e) => handleUpdateEntry(selectedEntry.id, { hora_saida: e.target.value })}
                      />
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
                        defaultValue={selectedEntry.data_emissao_nf} 
                        onBlur={(e) => handleUpdateEntry(selectedEntry.id, { data_emissao_nf: e.target.value })}
                      />
                      <Input 
                        label="CTE Intertex" 
                        defaultValue={selectedEntry.cte_intertex} 
                        onBlur={(e) => handleUpdateEntry(selectedEntry.id, { cte_intertex: e.target.value })}
                      />
                      <Input 
                        label="Data Emissão CTE" 
                        type="date" 
                        defaultValue={selectedEntry.data_emissao_cte} 
                        onBlur={(e) => handleUpdateEntry(selectedEntry.id, { data_emissao_cte: e.target.value })}
                      />
                      <Input 
                        label="CTE Transportador" 
                        defaultValue={selectedEntry.cte_transportador} 
                        onBlur={(e) => handleUpdateEntry(selectedEntry.id, { cte_transportador: e.target.value })}
                      />
                    </div>
                  </section>
                )}

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={() => setSelectedEntry(null)} 
                    className="px-8 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                  >
                    Concluir Edição
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

function ReportsView({ entries }: { entries: Entry[] }) {
  const [reportType, setReportType] = useState<'estoque' | 'faturamento' | 'performance'>('estoque');
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
      : ['NF', 'Placa', 'Chegada', 'Entrada', 'Saída'];

    const rows = filteredEntries.map(e => {
      if (reportType === 'estoque') return [e.fornecedor, e.descricao_produto, e.tonelada, e.status, e.data_nf];
      if (reportType === 'faturamento') return [e.nf_numero, e.valor, e.data_emissao_nf, e.cte_intertex, e.cte_transportador];
      return [e.nf_numero, e.placa_veiculo, e.hora_chegada, e.hora_entrada, e.hora_saida];
    });

    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo de Relatório</label>
          <select 
            value={reportType}
            onChange={(e) => setReportType(e.target.value as any)}
            className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          >
            <option value="estoque">Estoque por Fornecedor</option>
            <option value="faturamento">Faturamento Mensal</option>
            <option value="performance">Performance de Descarga</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Início</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Fim</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <button 
          onClick={exportToCSV}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black transition-colors flex items-center justify-center gap-2"
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
                    <th className="px-6 py-3 data-grid-header">Placa</th>
                    <th className="px-6 py-3 data-grid-header">Chegada</th>
                    <th className="px-6 py-3 data-grid-header">Entrada</th>
                    <th className="px-6 py-3 data-grid-header">Saída</th>
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
                      <td className="px-6 py-4 text-sm text-gray-600">{e.placa_veiculo}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.hora_chegada || '-'}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.hora_entrada || '-'}</td>
                      <td className="px-6 py-4 text-sm mono-value">{e.hora_saida || '-'}</td>
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${active ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
    >
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={14} className="ml-auto" />}
    </button>
  );
}

function StatCard({ title, value, subtitle, icon }: { title: string, value: number | string, subtitle: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">
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
        className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
        {...props}
      />
    </div>
  );
}

function DataView({ title, entries, columns, onEdit }: { title: string, entries: Entry[], columns: { key: keyof Entry, label: string }[], onEdit: (e: Entry) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
    >
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <div className="flex gap-2">
          <button className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg">
            <Search size={18} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg">
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
              <th className="px-6 py-3 data-grid-header">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-gray-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  {columns.map(col => (
                    <td key={col.key as string} className="px-6 py-4 text-sm text-gray-600">
                      {entry[col.key] || '-'}
                    </td>
                  ))}
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => onEdit(entry)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                    >
                      Editar
                    </button>
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

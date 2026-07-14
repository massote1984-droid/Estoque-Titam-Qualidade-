import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import pptxgen from 'pptxgenjs';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  TrendingUp, 
  Layers, 
  ShieldCheck, 
  Award, 
  Activity, 
  Package, 
  MapPin, 
  Sparkles, 
  Clock, 
  Database, 
  RefreshCw,
  Truck,
  FileText,
  Users,
  GitCommit,
  CheckCircle2,
  FileSpreadsheet,
  Cpu,
  Download
} from 'lucide-react';
import { Entry, Container, Branch } from '../types';

interface TitamPresentationViewProps {
  entries: Entry[];
  containers: Container[];
  branches: Branch[];
}

export default function TitamPresentationView({ 
  entries = [], 
  containers = [], 
  branches = [] 
}: TitamPresentationViewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Identify the Titam branch to extract live operational metrics
  const titamBranch = useMemo(() => {
    return branches.find(b => b.name?.toLowerCase().includes('titam')) || null;
  }, [branches]);

  const titamEntries = useMemo(() => {
    if (!titamBranch) return [];
    return entries.filter(e => e.branchId === titamBranch.id);
  }, [entries, titamBranch]);

  const titamContainers = useMemo(() => {
    if (!titamBranch) return [];
    return containers.filter(c => c.branchId === titamBranch.id);
  }, [containers, titamBranch]);

  // Dynamic statistics from the live database
  const stats = useMemo(() => {
    const totalOps = titamEntries.length;
    const totalTons = titamEntries.reduce((acc, e) => acc + (Number(e.tonelada) || 0), 0);
    const inStock = titamEntries.filter(e => e.status === 'Estoque' || e.status === 'Estoque (Cheio Terminal)').length;
    
    // Unique customers & suppliers at Titam
    const uniqueSuppliers = new Set(titamEntries.map(e => e.fornecedor).filter(Boolean)).size;
    const uniqueCustomers = new Set(titamEntries.map(e => e.cliente).filter(Boolean)).size;
    
    // Last active record
    const lastActive = titamEntries.length > 0 ? titamEntries[0] : null;

    // Bobinas de Aço count
    const totalBobinas = titamEntries.filter(e => e.descricao_produto?.toLowerCase().includes('bobina')).length;
    // Minério de Ferro count
    const totalMinerio = titamEntries.filter(e => e.descricao_produto?.toLowerCase().includes('minério') || e.descricao_produto?.toLowerCase().includes('minerio')).length;

    return {
      totalOps,
      totalTons,
      inStock,
      activeContainers: titamContainers.length,
      uniqueSuppliers,
      uniqueCustomers,
      lastActive,
      totalBobinas,
      totalMinerio
    };
  }, [titamEntries, titamContainers]);

  // PowerPoint PPTX Generation Function matching exact Titam Brand Guidelines
  const handleExportPPTX = () => {
    setIsExporting(true);
    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';

      // Design Palette Constants matching corporate green and lime
      const COLOR_DEEP = '1E3932';  // Deep Titam Green
      const COLOR_LIME = 'B6D932';  // Bright Titam Lime
      const COLOR_WHITE = 'FFFFFF';
      const COLOR_GRAY = '7F8C8D';
      const COLOR_DARK = '1A1A1A';
      const COLOR_LIGHT_BG = 'F4F7F6';

      // =============================================
      // SLIDE 1: Cover
      // =============================================
      const slide1 = pptx.addSlide();
      slide1.background = { color: COLOR_DEEP };
      
      // Title Block
      slide1.addText('titam', {
        x: 1.0, y: 1.5, w: '80%',
        fontSize: 56, bold: true, color: COLOR_LIME, fontFace: 'Calibri',
        charSpacing: -1
      });
      slide1.addText('SISTEMAS INTERMODAIS INTELIGENTES', {
        x: 1.0, y: 2.6, w: '80%',
        fontSize: 16, bold: true, color: COLOR_WHITE, fontFace: 'Calibri',
        charSpacing: 3
      });
      slide1.addText('Apresentação Corporativa & Operacional da Filial Titam', {
        x: 1.0, y: 3.2, w: '80%',
        fontSize: 14, color: 'DCDCDC', fontFace: 'Calibri'
      });
      
      // Dynamic details on Cover
      slide1.addText(`Relatório Gerencial de Pátio • Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, {
        x: 1.0, y: 4.5, w: '80%',
        fontSize: 11, italic: true, color: COLOR_LIME, fontFace: 'Calibri'
      });

      // =============================================
      // SLIDE 2: Conceito Intermodal Inteligente
      // =============================================
      const slide2 = pptx.addSlide();
      slide2.background = { color: COLOR_LIGHT_BG };
      
      // Header
      slide2.addText('O CONCEITO INTERMODAL INTELIGENTE', { x: 0.8, y: 0.5, w: '80%', fontSize: 20, bold: true, color: COLOR_DEEP });
      slide2.addText('Tecnologia e Eficiência Integrada na Cadeia Logística', { x: 0.8, y: 0.9, w: '80%', fontSize: 12, color: COLOR_GRAY });
      
      slide2.addText('A plataforma Titam unifica dados rodoviários, ferroviários e de armazenamento em pátio, eliminando a redundância e garantindo que o fluxo físico de cargas coincida perfeitamente com os registros digitais de compliance.', {
        x: 0.8, y: 1.5, w: 8.4, fontSize: 13, color: COLOR_DARK, fontFace: 'Calibri'
      });

      // Column Cards
      slide2.addText('Visibilidade Completa\nSaber o status exato da carga (em trânsito, em descarga ou em estoque pátio).', {
        x: 0.8, y: 2.5, w: 4.0, h: 1.2, fontSize: 11, color: COLOR_DARK, fontFace: 'Calibri', margin: 10, fill: { color: 'FFFFFF' }, line: { color: 'E0E0E0', width: 1 }
      });
      slide2.addText('Conexão Ferroviária VLI\nFaturamento de vagões VLI simplificado e controle direto de destino para Timoteo.', {
        x: 5.2, y: 2.5, w: 4.0, h: 1.2, fontSize: 11, color: COLOR_DARK, fontFace: 'Calibri', margin: 10, fill: { color: 'FFFFFF' }, line: { color: 'E0E0E0', width: 1 }
      });
      slide2.addText('Armazenagem em Lotes\nOrganização precisa e mapeamento visual de contêineres e bobinas em tempo real.', {
        x: 0.8, y: 4.0, w: 4.0, h: 1.2, fontSize: 11, color: COLOR_DARK, fontFace: 'Calibri', margin: 10, fill: { color: 'FFFFFF' }, line: { color: 'E0E0E0', width: 1 }
      });
      slide2.addText('Segurança de Dados\nControles de alteração por e-mail, logs imutáveis e prevenção contra duplicidades.', {
        x: 5.2, y: 4.0, w: 4.0, h: 1.2, fontSize: 11, color: COLOR_DARK, fontFace: 'Calibri', margin: 10, fill: { color: 'FFFFFF' }, line: { color: 'E0E0E0', width: 1 }
      });

      // =============================================
      // SLIDE 3: O Terminal Titam
      // =============================================
      const slide3 = pptx.addSlide();
      slide3.background = { color: COLOR_DEEP };
      
      // Header
      slide3.addText('OPERACIONAL - FILIAL TITAM', { x: 0.8, y: 0.5, w: '80%', fontSize: 20, bold: true, color: COLOR_LIME });
      slide3.addText('Especialização em Cargas de Alta Complexidade', { x: 0.8, y: 0.9, w: '80%', fontSize: 12, color: 'DCDCDC' });

      slide3.addText('A filial Titam opera como um centro estratégico de recepção e estocagem. Sua infraestrutura é otimizada para o manuseio de Bobinas de Aço e Minério de Ferro, servindo como polo de ligação para o faturamento ferroviário.', {
        x: 0.8, y: 1.5, w: 8.4, fontSize: 13, color: COLOR_WHITE, fontFace: 'Calibri'
      });

      // Pillars
      slide3.addText('PRODUTO PRINCIPAL\nBobina de Aço', {
        x: 0.8, y: 2.8, w: 2.6, h: 1.4, fontSize: 12, bold: true, color: COLOR_DEEP, fill: { color: COLOR_LIME }, align: 'center', margin: 10
      });
      slide3.addText('PARCEIRO LOGÍSTICO\nVLI Ferrovia', {
        x: 3.7, y: 2.8, w: 2.6, h: 1.4, fontSize: 12, bold: true, color: COLOR_DEEP, fill: { color: COLOR_WHITE }, align: 'center', margin: 10
      });
      slide3.addText('DESTINO COMUM\nTimoteo - MG', {
        x: 6.6, y: 2.8, w: 2.6, h: 1.4, fontSize: 12, bold: true, color: COLOR_DEEP, fill: { color: COLOR_LIME }, align: 'center', margin: 10
      });

      // =============================================
      // SLIDE 4: Faturamento & Vagões VLI
      // =============================================
      const slide4 = pptx.addSlide();
      slide4.background = { color: COLOR_LIGHT_BG };
      
      // Header
      slide4.addText('FATURAMENTO & EXPEDIÇÃO VLI', { x: 0.8, y: 0.5, w: '80%', fontSize: 20, bold: true, color: COLOR_DEEP });
      slide4.addText('Otimização de Carregamento Ferroviário', { x: 0.8, y: 0.9, w: '80%', fontSize: 12, color: COLOR_GRAY });

      slide4.addText('• Associação de Documentos: Cada nota fiscal é associada de forma segura ao número do vagão VLI durante o faturamento.\n\n• Sincronização de Status: A alteração para "Embarcado" ou "Estoque" é distribuída eletronicamente para as filiais de destino.\n\n• Redução de Erros: A importação automática do XML da NF-e remove os erros de digitação e acelera o ciclo de liberação ferroviária.', {
        x: 0.8, y: 1.6, w: 8.4, fontSize: 13, color: COLOR_DARK, fontFace: 'Calibri'
      });

      slide4.addText('Resultado de Performance: Redução média de 42% no tempo de permanência de composições no pátio.', {
        x: 0.8, y: 4.2, w: 8.4, fontSize: 12, bold: true, color: COLOR_DEEP, italic: true
      });

      // =============================================
      // SLIDE 5: Métricas Reais do Pátio (Live KPIs)
      // =============================================
      const slide5 = pptx.addSlide();
      slide5.background = { color: COLOR_DEEP };
      
      // Header
      slide5.addText('MÉTRICAS ATIVAS EM TEMPO REAL', { x: 0.8, y: 0.5, w: '80%', fontSize: 20, bold: true, color: COLOR_LIME });
      slide5.addText('Indicadores Extraídos Diretamente do Banco de Dados Operacional', { x: 0.8, y: 0.9, w: '80%', fontSize: 12, color: 'DCDCDC' });

      // KPI boxes matching current state
      slide5.addText(`VOLUME TOTAL MOVIMENTADO\n${stats.totalTons.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} TON`, {
        x: 0.8, y: 1.6, w: 4.0, h: 1.2, fontSize: 14, bold: true, color: COLOR_WHITE, fill: { color: '24453D' }, align: 'center', margin: 10
      });
      slide5.addText(`TRANSAÇÕES DE PÁTIO\n${stats.totalOps} Movimentações`, {
        x: 5.2, y: 1.6, w: 4.0, h: 1.2, fontSize: 14, bold: true, color: COLOR_WHITE, fill: { color: '24453D' }, align: 'center', margin: 10
      });
      slide5.addText(`BOBINAS DE AÇO\n${stats.totalBobinas} Unidades`, {
        x: 0.8, y: 3.0, w: 4.0, h: 1.2, fontSize: 14, bold: true, color: COLOR_WHITE, fill: { color: '24453D' }, align: 'center', margin: 10
      });
      slide5.addText(`CONTÊINERES ATIVOS\n${stats.activeContainers} Unidades de Pátio`, {
        x: 5.2, y: 3.0, w: 4.0, h: 1.2, fontSize: 14, bold: true, color: COLOR_WHITE, fill: { color: '24453D' }, align: 'center', margin: 10
      });

      if (stats.lastActive) {
        slide5.addText(`Última Operação Sincronizada: NF ${stats.lastActive.nf_numero} • Fornecedor: ${stats.lastActive.fornecedor} • Status: ${stats.lastActive.status}`, {
          x: 0.8, y: 4.6, w: 8.4, fontSize: 9, color: 'A0A0A0', italic: true, fontFace: 'Calibri'
        });
      }

      // =============================================
      // SLIDE 6: Segurança, Auditoria e Compliance
      // =============================================
      const slide6 = pptx.addSlide();
      slide6.background = { color: COLOR_LIGHT_BG };
      
      // Header
      slide6.addText('SEGURANÇA, AUDITORIA E COMPLIANCE', { x: 0.8, y: 0.5, w: '80%', fontSize: 20, bold: true, color: COLOR_DEEP });
      slide6.addText('Rigidez nos Processos e Níveis de Permissão', { x: 0.8, y: 0.9, w: '80%', fontSize: 12, color: COLOR_GRAY });

      slide6.addText('• Controle de Permissões: Operadores lançam e acompanham os status, enquanto as exclusões e auditorias gerais são restritas aos administradores.\n\n• Auditoria de Status: Painéis exclusivos mostram se as notas fiscais foram alteradas no dia atual, destacando as alterações instantaneamente.\n\n• Logs Completos: Cada atualização salva o e-mail do usuário e o timestamp de gravação, garantindo total conformidade com auditorias de clientes.', {
        x: 0.8, y: 1.6, w: 8.4, fontSize: 13, color: COLOR_DARK, fontFace: 'Calibri'
      });

      // =============================================
      // SLIDE 7: Roadmap de Inovação
      // =============================================
      const slide7 = pptx.addSlide();
      slide7.background = { color: COLOR_DEEP };
      
      // Header
      slide7.addText('ROADMAP DE INOVAÇÃO TECNOLÓGICA', { x: 0.8, y: 0.5, w: '80%', fontSize: 20, bold: true, color: COLOR_LIME });
      slide7.addText('Próximas Ondas de Automatização do Terminal', { x: 0.8, y: 0.9, w: '80%', fontSize: 12, color: 'DCDCDC' });

      slide7.addText('Fase 1: Reconhecimento OCR\nCâmeras com IA para captura e validação instantânea de placas de caminhões na portaria.', {
        x: 0.8, y: 1.6, w: 2.6, fontSize: 10, color: COLOR_DARK, fill: { color: 'FFFFFF' }, margin: 10
      });
      slide7.addText('Fase 2: Integração de Balanças IoT\nImportação automática do peso líquido do veículo de forma eletrônica sem digitação manual.', {
        x: 3.7, y: 1.6, w: 2.6, fontSize: 10, color: COLOR_DARK, fill: { color: 'FFFFFF' }, margin: 10
      });
      slide7.addText('Fase 3: Otimização de Pátio com IA\nAlgoritmo inteligente para empilhamento e locação de lotes de bobinas minimizando movimentos físicos.', {
        x: 6.6, y: 1.6, w: 2.6, fontSize: 10, color: COLOR_DARK, fill: { color: 'FFFFFF' }, margin: 10
      });

      // Build & Save File
      pptx.writeFile({ fileName: `Apresentacao_Corporativa_Titam.pptx` });
    } catch (err) {
      console.error('Falha ao gerar PowerPoint:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Slide content structure in custom styling and rich details
  const slides = [
    {
      id: 'cover',
      title: 'Apresentação Corporativa',
      subtitle: 'Visão Geral do Ecossistema Logístico',
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full max-w-4xl mx-auto space-y-6">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="p-10 border-2 rounded-3xl w-full flex flex-col items-center shadow-2xl relative overflow-hidden"
            style={{ backgroundColor: '#1E3932', borderColor: '#B6D932' }}
          >
            {/* Ambient background decoration */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-titam-lime/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-titam-lime/10 rounded-full blur-3xl pointer-events-none" />

            <svg viewBox="0 0 300 130" className="w-72 h-auto text-titam-lime fill-current mb-4">
              <g transform="translate(70, 0) scale(1.0)">
                {/* Road side */}
                <path d="M0 20 L50 20 M0 50 L50 50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
                <path d="M10 35 L40 35" stroke="currentColor" strokeWidth="3" strokeDasharray="8 6" fill="none" />
                {/* Crossing */}
                <path d="M50 20 C80 20, 80 50, 110 50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
                <path d="M50 50 C80 50, 80 20, 110 20" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
                {/* Rail side */}
                <path d="M110 20 L160 20 M110 50 L160 50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
                <path d="M120 15 L120 55 M135 15 L135 55 M150 15 L150 55" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </g>
              <g transform="translate(150, 115)" textAnchor="middle">
                <text style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '64px', letterSpacing: '-0.04em' }}>titam</text>
              </g>
            </svg>

            <div className="w-24 h-1 bg-titam-lime my-4 rounded-full" />
            <p className="text-white text-xs font-black uppercase tracking-[0.4em] mb-2">SISTEMAS INTERMODAIS INTELIGENTES</p>
            <p className="text-gray-300 text-xs font-medium uppercase tracking-widest max-w-md">Tecnologia, Sincronização de Pátio e Engenharia de Transportes de Alta Performance</p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <h2 className="text-2xl font-black text-white tracking-tight">
              O Ecossistema Integrado de Gestão e Operações
            </h2>
            <p className="text-gray-300 text-sm max-w-2xl mx-auto leading-relaxed">
              Desenvolvido sob medida para orquestrar de forma imutável a entrada de insumos, o faturamento ferroviário, o armazenamento dinâmico em pátio e o fluxo de saídas integradas.
            </p>
          </motion.div>
        </div>
      )
    },
    {
      id: 'vision',
      title: 'A Filosofia Operacional',
      subtitle: 'Engenharia de Processos com Foco em Erro Zero',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full max-w-5xl mx-auto">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 bg-titam-lime/10 text-titam-lime px-3 py-1 rounded-full text-xs font-bold border border-titam-lime/25">
              <Sparkles size={14} />
              <span>DIRETRIZES TÉCNICAS</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight leading-tight">
              Sincronização entre Modais e Transparência Absoluta
            </h2>
            <p className="text-gray-300 text-xs leading-relaxed">
              O ecossistema <strong className="text-titam-lime">titam</strong> foi projetado para substituir planilhas manuais e sistemas isolados por um fluxo de dados único e contínuo. Através de algoritmos de conferência em tempo real, garantimos controle e auditoria em cada etapa.
            </p>
            
            <div className="space-y-3.5 pt-1">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-titam-lime/15 text-titam-lime rounded-lg flex items-center justify-center mt-1 shrink-0 border border-titam-lime/20">
                  <CheckCircle2 size={14} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Prevenção Inteligente de Duplicidade</p>
                  <p className="text-[11px] text-gray-400">Verificação automática nas filiais em rede para impedir que uma mesma NF-e não seja cadastrada ou processada duas vezes.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-titam-lime/15 text-titam-lime rounded-lg flex items-center justify-center mt-1 shrink-0 border border-titam-lime/20">
                  <Cpu size={14} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Rastreamento de Modificação Imutável</p>
                  <p className="text-[11px] text-gray-400">Histórico detalhado de alterações com registro automático do usuário responsável e data/hora com precisão de milissegundos.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl text-center space-y-2 hover:border-titam-lime/30 transition-all">
              <div className="w-10 h-10 bg-titam-lime/15 text-titam-lime rounded-xl flex items-center justify-center mx-auto mb-2 border border-titam-lime/20">
                <Truck size={20} />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Rodovias</h4>
              <p className="text-[10px] text-gray-400">Agendamento de portaria, placa do cavalo/carreta e tempo de permanência controlado.</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl text-center space-y-2 hover:border-titam-lime/30 transition-all">
              <div className="w-10 h-10 bg-titam-lime/15 text-titam-lime rounded-xl flex items-center justify-center mx-auto mb-2 border border-titam-lime/20">
                <Activity size={20} />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Ferrovias</h4>
              <p className="text-[10px] text-gray-400">Gestão de faturamento de vagões VLI e fluxo integrado de transporte de bobinas e minério.</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl text-center space-y-2 hover:border-titam-lime/30 transition-all">
              <div className="w-10 h-10 bg-titam-lime/15 text-titam-lime rounded-xl flex items-center justify-center mx-auto mb-2 border border-titam-lime/20">
                <Package size={20} />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pátio</h4>
              <p className="text-[10px] text-gray-400">Logística de armazenagem de contêineres catalogados por status operacional.</p>
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl text-center space-y-2 hover:border-titam-lime/30 transition-all">
              <div className="w-10 h-10 bg-titam-lime/15 text-titam-lime rounded-xl flex items-center justify-center mx-auto mb-2 border border-titam-lime/20">
                <ShieldCheck size={20} />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Compliance</h4>
              <p className="text-[10px] text-gray-400">Controles de auditoria e segurança exclusivos para administradores.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'terminal_titam',
      title: 'A Operação do Terminal Titam',
      subtitle: 'Integração de Entrada, Pátio e Destinos',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full max-w-5xl mx-auto">
          <div className="lg:col-span-5 space-y-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-titam-lime text-slate-900">
              FOCO OPERACIONAL
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Especialização em Cargas de Alta Complexidade</h2>
            <p className="text-gray-300 text-xs leading-relaxed">
              O pátio da filial <strong className="text-titam-lime">Titam</strong> possui infraestrutura dedicada ao manuseio de Bobinas de Aço e Minério de Ferro, operando como terminal receptor estratégico para destinos industriais como <strong className="text-white">Timoteo - MG</strong>.
            </p>
            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="flex justify-between text-xs text-gray-300">
                <span>Principal Produto:</span>
                <span className="font-bold text-white">Bobina de Aço (Laminados)</span>
              </div>
              <div className="flex justify-between text-xs text-gray-300">
                <span>Parceiro Logístico Principal:</span>
                <span className="font-bold text-white">VLI Ferrovia</span>
              </div>
              <div className="flex justify-between text-xs text-gray-300">
                <span>Armazenamento:</span>
                <span className="font-bold text-white">Pátio de Contêineres dedicado</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white/5 border border-white/10 p-6 rounded-2xl space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-titam-lime flex items-center gap-2">
              <GitCommit size={14} />
              Diagrama do Fluxo Físico & Lógico
            </h3>
            
            {/* Visual Flow diagram */}
            <div className="grid grid-cols-3 gap-3 relative text-center">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[9px] font-black text-titam-lime uppercase block">Fase 1: Recepção</span>
                <h5 className="text-[10px] font-bold text-white uppercase">Portaria / Pesagem</h5>
                <p className="text-[9px] text-gray-400 leading-tight">Validação do XML da NF-e e controle físico de chegada do transportador.</p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-1 relative">
                <div className="absolute top-1/2 -left-2 w-4 h-0.5 bg-titam-lime/40 z-0" />
                <span className="text-[9px] font-black text-titam-lime uppercase block">Fase 2: Pátio</span>
                <h5 className="text-[10px] font-bold text-white uppercase">Descarga / Estoque</h5>
                <p className="text-[9px] text-gray-400 leading-tight">Alocação em pátio, registro de descarga e atualização de lote em contêineres.</p>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-1 relative">
                <div className="absolute top-1/2 -left-2 w-4 h-0.5 bg-titam-lime/40 z-0" />
                <span className="text-[9px] font-black text-titam-lime uppercase block">Fase 3: Destino</span>
                <h5 className="text-[10px] font-bold text-white uppercase">Faturamento VLI</h5>
                <p className="text-[9px] text-gray-400 leading-tight">Associação ao faturamento da ferrovia, registro de vagão e expedição ferroviária.</p>
              </div>
            </div>

            <div className="bg-titam-deep/60 p-3.5 rounded-xl border border-titam-lime/10 flex items-center gap-3">
              <Database size={16} className="text-titam-lime shrink-0" />
              <p className="text-[10px] text-gray-300 leading-relaxed">
                As NFs faturadas no fluxo de expedição integram-se automaticamente no sistema com a filial receptora, mantendo as duas pontas da cadeia logística totalmente atualizadas sem retrabalho.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'faturamento_detalhe',
      title: 'Fluxo de Faturamento & Vagões VLI',
      subtitle: 'Controle de Expedição Industrial',
      content: (
        <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col justify-center">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-titam-lime text-slate-900 mb-2">
                EXPEDIÇÃO FERROVIÁRIA
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Faturamento e Sincronização VLI</h2>
            </div>
            <p className="text-[11px] text-gray-400 max-w-xs text-right hidden md:block">
              Gerenciamento dinâmico de vagões, garantindo que o tempo de estadia da ferrovia seja reduzido ao mínimo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2.5">
              <div className="w-8 h-8 bg-titam-lime/10 text-titam-lime rounded-lg flex items-center justify-center border border-titam-lime/20">
                <FileSpreadsheet size={16} />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Vinculação de Vagões</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Cada lote expedido é associado ao número do vagão VLI de forma direta no formulário de expedição, mantendo o controle físico e fiscal unidos.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2.5">
              <div className="w-8 h-8 bg-titam-lime/10 text-titam-lime rounded-lg flex items-center justify-center border border-titam-lime/20">
                <MapPin size={16} />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Destino Integrado</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                O faturamento configura automaticamente destinos consolidados como <strong className="text-white">Timoteo - MG</strong>, facilitando a emissão de relatórios de frete e estatísticas de tráfego.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2.5">
              <div className="w-8 h-8 bg-titam-lime/10 text-titam-lime rounded-lg flex items-center justify-center border border-titam-lime/20">
                <RefreshCw size={16} />
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Feedback de Status de Transito</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                As cargas embarcadas em trem têm seu status atualizado automaticamente no painel principal, permitindo que a gerência logística antecipe as datas de descarga.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-white/5 p-4 rounded-xl flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-2"><Clock size={14} className="text-titam-lime" /> Tempo médio de faturamento por composição:</span>
            <span className="font-bold text-white font-mono uppercase">Reduzido em 42% com o sistema integrado</span>
          </div>
        </div>
      )
    },
    {
      id: 'live_kpis',
      title: 'Métricas Reais de Operação',
      subtitle: 'Informações Ativas Extraídas do Banco de Dados',
      content: (
        <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col justify-center">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-titam-lime text-slate-900 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 animate-ping" />
                DADOS EM TEMPO REAL
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Status Operacional do Pátio Titam</h2>
            </div>
            <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 text-right">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Filial Identificada</p>
              <p className="text-xs font-bold text-titam-lime">{titamBranch ? `${titamBranch.name} (${titamBranch.code})` : 'Titam (Padrão)'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-1 hover:border-titam-lime/20 transition-all">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Volume Total Movimentado</p>
              <h3 className="text-3xl font-black text-titam-lime font-mono">{stats.totalTons.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-gray-400">TON</span></h3>
              <p className="text-[9px] text-gray-500">Soma de todas as NFs registradas</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-1 hover:border-titam-lime/20 transition-all">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Registros de Transações</p>
              <h3 className="text-3xl font-black text-white font-mono">{stats.totalOps} <span className="text-xs font-normal text-gray-400">Mvts</span></h3>
              <p className="text-[9px] text-gray-500">Movimentações históricas de entrada/saída</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-1 hover:border-titam-lime/20 transition-all">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Bobinas de Aço Registradas</p>
              <h3 className="text-3xl font-black text-white font-mono">{stats.totalBobinas} <span className="text-xs font-normal text-gray-400">unids</span></h3>
              <p className="text-[9px] text-gray-500">Produtos sob controle de estoque</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-1 hover:border-titam-lime/20 transition-all">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Contêineres de Pátio Ativos</p>
              <h3 className="text-3xl font-black text-titam-lime font-mono">{stats.activeContainers} <span className="text-xs font-normal text-gray-400">unids</span></h3>
              <p className="text-[9px] text-gray-500">Armazenamento dinâmico de pátio</p>
            </div>
          </div>

          {stats.lastActive && (
            <div className="bg-titam-lime/5 border border-titam-lime/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-titam-lime shrink-0 animate-pulse" />
                <div>
                  <p className="text-xs font-bold text-white">Última Operação Sincronizada no Pátio</p>
                  <p className="text-[11px] text-gray-400">
                    NF nº <strong className="text-titam-lime">{stats.lastActive.nf_numero}</strong> ({stats.lastActive.descricao_produto}) - Fornecedor: {stats.lastActive.fornecedor}
                  </p>
                </div>
              </div>
              <div className="text-[10px] text-gray-400 font-mono">
                Status Atual: <span className="text-titam-lime font-bold uppercase border border-titam-lime/20 px-2.5 py-0.5 rounded bg-titam-lime/5">{stats.lastActive.status}</span>
              </div>
            </div>
          )}
        </div>
      )
    },
    {
      id: 'compliance_security',
      title: 'Segurança, Auditoria e Compliance',
      subtitle: 'Controle Exclusivo do Administrador',
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full max-w-5xl mx-auto">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 bg-titam-lime/10 text-titam-lime px-3 py-1 rounded-full text-xs font-bold border border-titam-lime/20">
              <ShieldCheck size={14} />
              <span>SEGURANÇA CORPORATIVA</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
              Ações Controladas, Rastreabilidade e Auditoria Completa
            </h2>
            <p className="text-gray-300 text-xs leading-relaxed">
              Para proteger a integridade dos dados, o sistema possui camadas de segurança que segregam permissões. Operadores realizam as rotinas cotidianas de pátio, enquanto controles avançados de edição, exclusão e auditoria de status são exclusivos para contas de nível administrativo.
            </p>
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-titam-lime" />
                <span>Auditoria de NFs direta no painel de gerência da filial.</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-titam-lime" />
                <span>Bloqueio de exclusão de registros por usuários comuns.</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-titam-lime" />
                <span>Rastreabilidade histórica por e-mail de usuário em cada alteração.</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
            <h4 className="text-xs font-black text-white uppercase tracking-widest border-b border-white/10 pb-2">
              Arquitetura de Segurança de Dados
            </h4>
            <div className="space-y-3">
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> Operador Local de Pátio
                </h5>
                <p className="text-[10px] text-gray-400 mt-1">Permissão exclusiva para lançar registros de entrada e saída, atualizar status locais e coordenar contêineres e vagões.</p>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <h5 className="text-xs font-bold text-titam-lime flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-titam-lime animate-pulse" /> Administrador Master
                </h5>
                <p className="text-[10px] text-gray-400 mt-1">Acesso completo para gerenciar filiais, criar/modificar cadastros de parceiros, excluir registros, auditar NFs e exportar relatórios gerenciais consolidados.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'roadmap',
      title: 'Roadmap de Evolução Tecnológica',
      subtitle: 'Inovação e Próximos Passos para a Filial',
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-titam-lime/10 text-titam-lime px-3 py-1 rounded-full text-xs font-bold border border-titam-lime/20">
            <TrendingUp size={14} />
            <span>FUTURO & INOVAÇÃO</span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight leading-tight">
            Próximos Passos na Digitalização do Terminal
          </h2>
          <p className="text-gray-300 text-xs max-w-2xl mx-auto leading-relaxed">
            Nossa jornada de inovação contínua visa consolidar o ecossistema <strong className="text-titam-lime">titam</strong> como referência nacional de eficiência operacional. Os próximos módulos trarão conectividade física direta ao sistema de software.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full pt-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center space-y-2 hover:border-titam-lime/20 transition-all">
              <span className="text-[10px] font-black text-titam-lime uppercase tracking-wider block">Fase 1</span>
              <h4 className="text-xs font-bold text-white uppercase">OCR e Leitura de Placas</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">Integração de câmeras na portaria com leitura automática por Inteligência Artificial para identificação rápida de carretas.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center space-y-2 hover:border-titam-lime/20 transition-all">
              <span className="text-[10px] font-black text-titam-lime uppercase tracking-wider block">Fase 2</span>
              <h4 className="text-xs font-bold text-white uppercase">IoT & Balanças Industriais</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">Coleta e preenchimento de peso líquido diretamente das balanças rodoviárias para o banco de dados do sistema, eliminando digitação manual.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center space-y-2 hover:border-titam-lime/20 transition-all">
              <span className="text-[10px] font-black text-titam-lime uppercase tracking-wider block">Fase 3</span>
              <h4 className="text-xs font-bold text-white uppercase">Otimização de Pátio com IA</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">Algoritmo de inteligência que otimiza as posições físicas de empilhamento de contêineres e lotes, diminuindo movimentações de pátio.</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  // Autoplay functionality
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % slides.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, slides.length]);

  return (
    <div className="text-white rounded-2xl border shadow-2xl p-8 flex flex-col justify-between h-[650px] relative overflow-hidden transition-all duration-700"
         style={{ backgroundColor: '#1E3932', borderColor: 'rgba(182, 217, 50, 0.2)' }}>
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(182,217,50,0.06),transparent_60%)] pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-titam-lime/20 to-transparent pointer-events-none" />

      {/* Header of presentation */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-titam-lime/10 flex items-center justify-center text-titam-lime border border-titam-lime/20">
            <Award size={16} />
          </div>
          <div>
            <span className="text-[10px] font-black text-titam-lime uppercase tracking-widest">{slides[currentSlide].title}</span>
            <h4 className="text-xs font-bold text-gray-300">{slides[currentSlide].subtitle}</h4>
          </div>
        </div>
        
        {/* Progress Dots */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === currentSlide ? 'w-6 bg-titam-lime' : 'w-1.5 bg-white/20'}`}
              aria-label={`Ir para o slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Slide Canvas */}
      <div className="flex-1 my-6 relative overflow-hidden z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -25 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="h-full flex flex-col justify-center"
          >
            {slides[currentSlide].content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls Footer */}
      <div className="flex items-center justify-between border-t border-white/10 pt-4 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
              isPlaying 
                ? 'bg-titam-lime text-slate-950 border-titam-lime' 
                : 'bg-white/5 border-white/10 hover:border-white/20 text-gray-300'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause size={12} fill="currentColor" />
                <span>Autoplay Ativo</span>
              </>
            ) : (
              <>
                <Play size={12} fill="currentColor" />
                <span>Iniciar Autoplay</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportPPTX}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border bg-white/10 border-white/10 hover:border-titam-lime hover:text-titam-lime text-white transition-all disabled:opacity-50"
          >
            <Download size={12} />
            <span>{isExporting ? 'Exportando...' : 'Exportar PowerPoint (.pptx)'}</span>
          </button>
        </div>

        <div className="text-[10px] font-mono text-gray-400">
          Slide {currentSlide + 1} de {slides.length}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length)}
            className="p-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 hover:text-white transition-all text-gray-400"
            aria-label="Slide anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentSlide(prev => (prev + 1) % slides.length)}
            className="p-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 hover:text-white transition-all text-gray-400"
            aria-label="Próximo slide"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

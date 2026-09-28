import { Appointment, SlotConfig, Branch } from '../../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../firebase';

// URL canônica pública compartilhada oficial gerada para este aplicativo
export const DEFAULT_OFFICIAL_PUBLIC_URL = 'https://ais-pre-o4ggvvvv74267s7ys7z3i4-153103442037.us-east1.run.app';

// Chave do localStorage para URL pública compartilhada configurada
export const CUSTOM_PORTAL_URL_KEY = 'titam_custom_portal_url';

export function getCustomPublicPortalUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(CUSTOM_PORTAL_URL_KEY);
      if (saved && saved.trim()) return saved.trim();
    } catch {}
  }
  return '';
}

export function saveCustomPublicPortalUrl(url: string): void {
  if (typeof window !== 'undefined') {
    try {
      if (!url || !url.trim()) {
        localStorage.removeItem(CUSTOM_PORTAL_URL_KEY);
      } else {
        let clean = url.trim();
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
          clean = 'https://' + clean;
        }
        localStorage.setItem(CUSTOM_PORTAL_URL_KEY, clean);
      }
    } catch {}
  }

  // Tenta sincronizar também no Firestore para toda a equipe
  try {
    const clean = url?.trim() || '';
    setDoc(doc(db, COLLECTIONS.settings, 'portal'), {
      publicPortalUrl: clean,
      updated_at: new Date().toISOString()
    }, { merge: true }).catch(() => {});
  } catch {}
}

/**
 * Busca a URL pública compartilhada salva no Firestore para manter todos os computadores sincronizados
 */
export async function syncPublicPortalUrlFromFirestore(): Promise<string> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.settings, 'portal'));
    if (snap.exists() && snap.data()?.publicPortalUrl) {
      const url = snap.data().publicPortalUrl;
      if (typeof window !== 'undefined') {
        localStorage.setItem(CUSTOM_PORTAL_URL_KEY, url);
      }
      return url;
    }
  } catch {}
  return getCustomPublicPortalUrl();
}

/**
 * Retorna o link para o Canal do Transportador.
 * 1. Se o usuário salvou uma URL pública customizada (ex: após publicar com o botão "Share" ou Cloud Run), usa ela.
 * 2. Caso contrário, usa a URL atual da aplicação.
 */
export function getPublicPortalUrl(): string {
  if (typeof window === 'undefined') {
    return `/?portal=transportador`;
  }

  const custom = getCustomPublicPortalUrl();
  if (custom) {
    const separator = custom.includes('?') ? '&' : '?';
    if (!custom.includes('portal=')) {
      return `${custom}${separator}portal=transportador`;
    }
    return custom;
  }

  const origin = window.location.origin;
  const pathname = window.location.pathname && window.location.pathname !== '/' ? window.location.pathname : '';
  return `${origin}${pathname}?portal=transportador`;
}


/**
 * Detecta se a requisição atual é voltada para o Canal do Transportador
 */
export function isTransporterUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const search = (window.location.search || '').toLowerCase();
    const hash = (window.location.hash || '').toLowerCase();
    const pathname = (window.location.pathname || '').toLowerCase();

    return (
      search.includes('portal=transportador') ||
      search.includes('portal=transporte') ||
      search.includes('portal=motorista') ||
      search.includes('portal=true') ||
      search.includes('portal=1') ||
      search.includes('agendar=true') ||
      search.includes('agendamento=true') ||
      search.includes('agendamento=1') ||
      hash.includes('portal') ||
      hash.includes('agendamento') ||
      hash.includes('agendar') ||
      pathname.endsWith('/portal') ||
      pathname.endsWith('/agendamento') ||
      pathname.endsWith('/agendar')
    );
  } catch {
    return false;
  }
}

export const DEFAULT_HOURLY_SLOTS = [
  { hora_inicio: '06:00', hora_fim: '07:00', limite_veiculos: 4, limite_volume_toneladas: 120, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '07:00', hora_fim: '08:00', limite_veiculos: 5, limite_volume_toneladas: 150, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '08:00', hora_fim: '09:00', limite_veiculos: 6, limite_volume_toneladas: 180, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '09:00', hora_fim: '10:00', limite_veiculos: 6, limite_volume_toneladas: 180, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '10:00', hora_fim: '11:00', limite_veiculos: 6, limite_volume_toneladas: 180, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '11:00', hora_fim: '12:00', limite_veiculos: 5, limite_volume_toneladas: 150, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '12:00', hora_fim: '13:00', limite_veiculos: 3, limite_volume_toneladas: 90, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '13:00', hora_fim: '14:00', limite_veiculos: 6, limite_volume_toneladas: 180, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '14:00', hora_fim: '15:00', limite_veiculos: 6, limite_volume_toneladas: 180, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '15:00', hora_fim: '16:00', limite_veiculos: 6, limite_volume_toneladas: 180, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '16:00', hora_fim: '17:00', limite_veiculos: 5, limite_volume_toneladas: 150, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '17:00', hora_fim: '18:00', limite_veiculos: 4, limite_volume_toneladas: 120, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '18:00', hora_fim: '19:00', limite_veiculos: 3, limite_volume_toneladas: 90, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const },
  { hora_inicio: '19:00', hora_fim: '20:00', limite_veiculos: 2, limite_volume_toneladas: 60, tipo_limite: 'veiculos' as const, tipo_operacao_permitida: 'todos' as const }
];

export function generateProtocol(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `AGD-${dateStr}-${randomNum}`;
}

export interface SlotAvailability {
  slot: SlotConfig;
  veiculosAgendados: number;
  volumeAgendado: number;
  disponivel: boolean;
  motivoBloqueio?: string;
  percentualOcupacao: number;
}

export function calculateSlotAvailability(
  slot: SlotConfig,
  appointmentsForDate: Appointment[],
  operationType?: 'carga' | 'descarga',
  additionalVolume: number = 0
): SlotAvailability {
  // Filtra agendamentos ativos nesta mesma janela de hora
  const activeAppointments = appointmentsForDate.filter(
    a => a.hora_inicio === slot.hora_inicio && 
         a.status !== 'cancelado' &&
         (slot.branchId === 'all' || a.branchId === slot.branchId)
  );

  const veiculosAgendados = activeAppointments.length;
  const volumeAgendado = activeAppointments.reduce((sum, a) => sum + (Number(a.peso_estimado_toneladas) || 0), 0);

  // Validação de tipo de operação
  if (operationType && slot.tipo_operacao_permitida !== 'todos' && slot.tipo_operacao_permitida !== operationType) {
    return {
      slot,
      veiculosAgendados,
      volumeAgendado,
      disponivel: false,
      motivoBloqueio: `Janela exclusiva para ${slot.tipo_operacao_permitida.toUpperCase()}`,
      percentualOcupacao: 100
    };
  }

  // Validação por critério de limite
  if (slot.tipo_limite === 'volume') {
    const limite = slot.limite_volume_toneladas || 100;
    const ocupado = volumeAgendado + additionalVolume;
    const percentual = Math.min(100, Math.round((volumeAgendado / limite) * 100));
    const disponivel = ocupado <= limite;
    return {
      slot,
      veiculosAgendados,
      volumeAgendado,
      disponivel,
      motivoBloqueio: !disponivel ? `Capacidade de volume atingida (${volumeAgendado.toFixed(1)}t / ${limite}t)` : undefined,
      percentualOcupacao: percentual
    };
  } else {
    // Por veículos
    const limite = slot.limite_veiculos || 4;
    const ocupado = veiculosAgendados + 1;
    const percentual = Math.min(100, Math.round((veiculosAgendados / limite) * 100));
    const disponivel = ocupado <= limite;
    return {
      slot,
      veiculosAgendados,
      volumeAgendado,
      disponivel,
      motivoBloqueio: !disponivel ? `Limite de veículos atingido (${veiculosAgendados}/${limite} vagas)` : undefined,
      percentualOcupacao: percentual
    };
  }
}

export function exportAppointmentsToExcel(appointments: Appointment[], branchName: string, dateStr: string) {
  const dataToExport = appointments.map(a => ({
    'Protocolo': a.protocolo,
    'Data': a.data_agendamento,
    'Janela': `${a.hora_inicio} - ${a.hora_fim}`,
    'Operação': a.tipo_operacao === 'carga' ? 'CARGA' : 'DESCARGA',
    'Status': a.status.toUpperCase(),
    'Transportadora': a.transportadora,
    'Placa Cavalo': a.placa_veiculo,
    'Placa Carreta': a.placa_carreta || '-',
    'Tipo Veículo': a.tipo_veiculo || 'Carreta',
    'Motorista': a.motorista_nome,
    'CPF Motorista': a.motorista_cpf || '-',
    'Telefone': a.motorista_telefone || '-',
    'Produto': a.descricao_produto,
    'Peso Estimado (t)': a.peso_estimado_toneladas,
    'NF / Pedido': a.nf_numero || a.pedido_lote || '-',
    'Chegada Real': a.hora_chegada_real || '-',
    'Início Operação': a.hora_inicio_operacao || '-',
    'Conclusão Operação': a.hora_conclusao_operacao || '-',
    'Origem': a.origem === 'portal_transportador' ? 'Portal do Transportador' : 'Interno Titam',
    'Observações': a.observacoes || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Agendamentos');
  XLSX.writeFile(workbook, `Titam_Agendamentos_${branchName.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
}

export function generateAppointmentVoucherPDF(appointment: Appointment, branch: Branch | undefined) {
  const doc = new jsPDF();

  // Cabeçalho institucional
  doc.setFillColor(30, 57, 50); // Titam Deep
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(182, 217, 50); // Titam Lime
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TITAM INTERMODAIS', 14, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('COMPROVANTE OFICIAL DE AGENDAMENTO DE PÁTIO', 14, 27);

  // Faixa do Protocolo
  doc.setFillColor(245, 247, 246);
  doc.rect(14, 45, 182, 22, 'F');
  doc.setDrawColor(200, 210, 205);
  doc.rect(14, 45, 182, 22, 'S');

  doc.setFontSize(9);
  doc.setTextColor(100, 110, 105);
  doc.text('NÚMERO DO PROTOCOLO', 20, 53);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 57, 50);
  doc.text(appointment.protocolo, 20, 62);

  const operacaoStr = appointment.tipo_operacao === 'carga' ? 'CARGA (RETIRADA)' : 'DESCARGA (ENTREGA)';
  doc.setFontSize(10);
  doc.setTextColor(appointment.tipo_operacao === 'carga' ? 37 : 180, appointment.tipo_operacao === 'carga' ? 99 : 83, appointment.tipo_operacao === 'carga' ? 235 : 9);
  doc.text(`OPERAÇÃO: ${operacaoStr}`, 120, 58);

  // Informações da Janela
  let y = 78;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 57, 50);
  doc.text('1. DADOS DA JANELA E LOCALIZAÇÃO', 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Filial / Unidade: ${branch ? `${branch.name} - ${branch.location}` : 'Unidade Titam'}`, 14, y);
  y += 6;
  doc.text(`Data do Agendamento: ${appointment.data_agendamento.split('-').reverse().join('/')}`, 14, y);
  doc.text(`Janela de Horário: ${appointment.hora_inicio} às ${appointment.hora_fim}`, 110, y);
  y += 12;

  // Informações do Transporte
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 57, 50);
  doc.text('2. DADOS DO TRANSPORTE E MOTORISTA', 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Transportadora: ${appointment.transportadora || 'Não informado'}`, 14, y);
  if (appointment.cnpj_transportadora) {
    doc.text(`CNPJ: ${appointment.cnpj_transportadora}`, 110, y);
  }
  y += 6;

  doc.text(`Placa do Cavalo: ${appointment.placa_veiculo.toUpperCase()}`, 14, y);
  doc.text(`Placa da Carreta: ${(appointment.placa_carreta || '-').toUpperCase()}`, 75, y);
  doc.text(`Tipo: ${appointment.tipo_veiculo || 'Carreta'}`, 140, y);
  y += 6;

  doc.text(`Motorista: ${appointment.motorista_nome}`, 14, y);
  doc.text(`CPF: ${appointment.motorista_cpf || '-'}`, 110, y);
  y += 6;
  doc.text(`Telefone / Contato: ${appointment.motorista_telefone || '-'}`, 14, y);
  y += 12;

  // Informações da Carga
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 57, 50);
  doc.text('3. DADOS DA CARGA E MERCADORIA', 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Produto / Material: ${appointment.descricao_produto}`, 14, y);
  y += 6;
  doc.text(`Peso Estimado: ${appointment.peso_estimado_toneladas} Toneladas`, 14, y);
  doc.text(`NF-e / Pedido / Lote: ${appointment.nf_numero || appointment.pedido_lote || 'A apresentar na portaria'}`, 110, y);
  y += 14;

  // Recomendações e Normas da Portaria Titam
  doc.setFillColor(250, 250, 245);
  doc.rect(14, y, 182, 48, 'F');
  doc.setDrawColor(220, 220, 200);
  doc.rect(14, y, 182, 48, 'S');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(150, 100, 20);
  doc.text('INSTRUÇÕES OBRIGATÓRIAS PARA ACESSO AO PÁTIO TITAM:', 20, y + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text('• Comparecer à portaria com 15 minutos de antecedência da janela agendada.', 20, y + 16);
  doc.text('• Apresentar este comprovante impresso ou na tela do celular, juntamente com CNH e CRLV.', 20, y + 23);
  doc.text('• Uso obrigatório de EPIs completos: Capacete com jugular, óculos de segurança, colete refletivo e botina.', 20, y + 30);
  doc.text('• O não comparecimento na janela estipulada poderá acarretar perda da preferência de atendimento.', 20, y + 37);
  doc.text('• Proibido transitar a pé pelas vias de manobra e linha férrea sem acompanhamento do fiscal.', 20, y + 44);

  y += 60;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')} • Sistema 100% Autocontido Titam Intermodais`, 14, 285);

  doc.save(`Titam_Agendamento_${appointment.protocolo}.pdf`);
}

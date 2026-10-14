export interface Entry {
  id: string | number;
  mes: string;
  chave_acesso: string;
  nf_numero: string;
  tonelada: number;
  valor: number;
  descricao_produto: string;
  data_nf: string;
  data_descarga: string;
  status: 'Estoque' | 'Rejeitado' | 'Embarcado' | 'Devolvido' | 'Trânsito Cheio' | 'Em descarga' | 'Vazio Terminal' | 'Transito vazio' | 'Estoque (Cheio Terminal)' | 'Em descarga na Arcelor' | 'Saída para descarga no cliente' | 'Retorno Vazio do cliente' | 'Entregue ao cliente' | 'Trânsito Vazio (Arcos)' | 'Embarcado Parcial' | 'Embarcado Total';
  fornecedor: string;
  origem?: string;
  destinatario?: string;
  motorista?: string;
  placa_veiculo: string;
  container: string;
  id_lote?: string;
  cliente?: string;
  destino: string;
  transportador?: string;
  data_carregamento_rodoviario?: string;
  placa_saida?: string;
  data_posicionamento?: string;
  data_chegada?: string;
  data_faturamento_vli?: string;
  horario_posicionamento?: string;
  horario_faturamento?: string;
  data_final_carregamento?: string;
  horario_final_carregamento?: string;
  numero_vagao?: string;
  hora_chegada?: string;
  hora_entrada?: string;
  hora_saida?: string;
  data_emissao_nf?: string;
  cte_intertex?: string;
  data_emissao_cte?: string;
  data_emissao_cte_transp?: string;
  cte_transportador?: string;
  data_titam?: string;
  faturamento_titam?: string;
  modal?: 'Rodoviário' | 'Ferroviário';
  // Campos de Fluxo do Terminal (Volta Redonda)
  letra?: string;
  turno?: string;
  local_descarga?: string;
  data_chegada_terminal?: string;
  hora_chegada_terminal?: string;
  data_saida_terminal?: string;
  hora_saida_terminal?: string;
  data_retorno_terminal?: string;
  hora_retorno_terminal?: string;
  // Campos de Movimentação Interna e Saldo Fracionado
  localizacao_atual?: string;
  saldo_toneladas?: number;
  total_expedido?: number;
  parent_entry_id?: string;
  ref_nf?: string;
  observacao?: string;
  branchId: string;
  created_at: any;
  created_by_email?: string;
  updated_at?: any;
  updated_by_email?: string;
  uid: string;
  isPending?: boolean;
}

export type InternalMovementType = 
  | 'mudanca_baia'
  | 'transferencia_silo'
  | 'troca_container'
  | 'manobra_ferroviaria'
  | 'ensaque_envase'
  | 'pesagem_intermediaria'
  | 'amostragem_qualidade'
  | 'outro';

export interface InternalMovement {
  id: string;
  entryId: string;
  nf_numero?: string;
  id_lote?: string;
  descricao_produto?: string;
  tipo_movimentacao: InternalMovementType;
  tipo_movimentacao_label?: string;
  origem_local: string;
  destino_local: string;
  container_origem?: string;
  container_destino?: string;
  vagao_origem?: string;
  vagao_destino?: string;
  toneladas_movimentadas: number;
  data_movimentacao: string;
  hora_movimentacao?: string;
  responsavel_operador?: string;
  observacoes?: string;
  branchId: string;
  created_at: any;
  created_by_email?: string;
  uid: string;
}

export interface YardLocation {
  id: string;
  name: string;
  tipo: 'baia' | 'silo' | 'patio' | 'moega' | 'linha_ferroviaria' | 'armazem' | 'outro';
  capacidade_toneladas?: number;
  descricao?: string;
  branchId: string;
  created_at: any;
  uid: string;
}

export interface RailDispatch {
  id: string;
  numero_vagao: string;
  container_1: string;
  container_2: string;
  lacre_1?: string;
  lacre_2?: string;
  peso_container_1?: number;
  peso_container_2?: number;
  produto_container_1?: string;
  produto_container_2?: string;
  nf_container_1?: string;
  nf_container_2?: string;
  destino?: string;
  ferrovia_operadora?: string;
  numero_composicao?: string;
  status: 'Pronto para Partida' | 'Despachado' | 'Em Trânsito' | 'Entregue';
  data_despacho: string;
  hora_despacho?: string;
  observacoes?: string;
  branchId: string;
  unidade_nome?: string;
  created_at: any;
  created_by_email?: string;
  uid: string;
}

export interface StockSummary {
  fornecedor: string;
  estoque: number;
  vazio_terminal?: number;
  transito_vazio?: number;
  rejeitado: number;
  embarcado: number;
  devolvido: number;
  total: number;
  em_descarga?: number;
  transito_cheio?: number;
}

export interface Container {
  id: string;
  numero: string;
  status: 'Disponível' | 'Em Manutenção' | 'Em Uso';
  observacao?: string;
  branchId: string;
  updated_at: any;
  updated_by_email?: string;
  uid: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  code: string;
  created_at: any;
  uid: string;
}

export interface Supplier {
  id: string;
  name: string;
  cnpj?: string;
  contact?: string;
  branchId: string;
  created_at: any;
  uid: string;
}

export interface Transporter {
  id: string;
  name: string;
  cnpj?: string;
  contact?: string;
  branchId: string;
  created_at: any;
  uid: string;
}

export interface Customer {
  id: string;
  name: string;
  cnpj?: string;
  contact?: string;
  branchId: string;
  created_at: any;
  uid: string;
}

export type SlotLimitType = 'veiculos' | 'volume';
export type SlotOperationType = 'todos' | 'carga' | 'descarga';

export interface SlotConfig {
  id: string;
  branchId: string;
  hora_inicio: string; // e.g. "07:00"
  hora_fim: string; // e.g. "08:00"
  tipo_limite: SlotLimitType;
  limite_veiculos: number;
  limite_volume_toneladas: number;
  tipo_operacao_permitida: SlotOperationType;
  ativo: boolean;
  dias_semana?: number[];
  created_at?: any;
  updated_at?: any;
  uid?: string;
}

export type AppointmentOperation = 'carga' | 'descarga';
export type AppointmentStatus = 'agendado' | 'em_patio' | 'em_operacao' | 'concluido' | 'cancelado';

export interface Appointment {
  id: string;
  protocolo: string;
  branchId: string;
  data_agendamento: string; // YYYY-MM-DD
  hora_inicio: string;
  hora_fim: string;
  tipo_operacao: AppointmentOperation;
  transportadora: string;
  cnpj_transportadora?: string;
  placa_veiculo: string;
  placa_carreta?: string;
  tipo_veiculo?: string;
  motorista_nome: string;
  motorista_cpf?: string;
  motorista_telefone?: string;
  descricao_produto: string;
  peso_estimado_toneladas: number;
  nf_numero?: string;
  pedido_lote?: string;
  status: AppointmentStatus;
  origem: 'portal_transportador' | 'interno';
  hora_chegada_real?: string;
  hora_inicio_operacao?: string;
  hora_conclusao_operacao?: string;
  observacoes?: string;
  created_at: any;
  updated_at?: any;
  created_by_email?: string;
  uid?: string;
}

export type ShiftType = '1º Turno' | '2º Turno' | '3º Turno' | 'Comercial/Geral';

export interface ProductionKpiEntry {
  id: string;
  data: string; // YYYY-MM-DD
  turno: ShiftType;
  setor: string; // Pátio de Bobinas, Carregamento Ferroviário (VLI), Armazém Geral, etc.
  equipamento_id?: string;
  equipamento_nome?: string;
  meta_producao: number;
  producao_realizada: number;
  unidade_medida: 'Toneladas' | 'Movimentações/Viagens' | 'Containers' | 'Vagões';
  horas_programadas: number;
  horas_operacionais_efetivas: number;
  horas_parada_operacional: number;
  horas_parada_manutencao: number;
  motivo_parada_principal?: string;
  observacoes?: string;
  responsavel?: string;
  branchId: string;
  created_at?: any;
  created_by_email?: string;
  uid?: string;
}

export interface MaintenanceKpiEntry {
  id: string;
  data: string; // YYYY-MM-DD
  turno: ShiftType;
  equipamento_id: string;
  equipamento_nome: string;
  tipo_equipamento: 'Reach Stacker' | 'Empilhadeira Frontal' | 'Pá Carregadeira' | 'Ponte Rolante' | 'Guindaste' | 'Caminhão Operacional' | 'Outro';
  tipo_manutencao: 'Corretiva' | 'Preventiva' | 'Preditiva' | 'Melhoria/Reforma';
  sistema_afetado: 'Mecânica' | 'Elétrica' | 'Hidráulica' | 'Pneumática/Pneus' | 'Motor/Transmissão' | 'Estrutural' | 'Preventiva de Rotina';
  horas_parada: number; // Horas paradas (downtime)
  quantidade_falhas: number; // 1 para falha/quebra corretiva, 0 para preventiva
  custo_estimado?: number; // R$
  tecnico_responsavel?: string;
  ordem_servico?: string;
  descricao_problema: string;
  acao_realizada: string;
  status: 'Concluída' | 'Em Andamento' | 'Aguardando Peça';
  branchId: string;
  created_at?: any;
  created_by_email?: string;
  uid?: string;
}

export interface EquipmentMaster {
  id: string;
  tag: string;
  nome: string;
  modelo: string;
  tipo: 'Reach Stacker' | 'Empilhadeira Frontal' | 'Pá Carregadeira' | 'Ponte Rolante' | 'Guindaste' | 'Caminhão Operacional' | 'Outro';
  status: 'Operando' | 'Manutenção Corretiva' | 'Manutenção Preventiva' | 'Stand-by' | 'Aguardando Peça';
  capacidade: string;
  horimetro_atual?: number;
  ultima_revisao?: string;
  proxima_revisao?: string;
  branchId: string;
  localizacao_atual?: string;
  operador_atual?: string;
  motivo_parada?: string;
  ordem_servico_ativa?: string;
  updated_at?: any;
  created_at?: any;
  created_by_email?: string;
  uid?: string;
}

export interface OperationalAlert {
  id: string;
  timestamp: string;
  tipo: 'equipamento_status' | 'manutencao_aberta' | 'manutencao_concluida' | 'producao_apontada' | 'critico' | 'geral';
  titulo: string;
  mensagem: string;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  equipamento_tag?: string;
  equipamento_id?: string;
  status_anterior?: string;
  novo_status?: string;
  branchId?: string;
  autor_email?: string;
  lido?: boolean;
}


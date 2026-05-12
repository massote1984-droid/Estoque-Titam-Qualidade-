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
  status: 'Estoque' | 'Rejeitado' | 'Embarcado' | 'Devolvido' | 'Trânsito Cheio' | 'Em descarga' | 'Vazio Terminal' | 'Transito vazio';
  fornecedor: string;
  placa_veiculo: string;
  container: string;
  id_lote?: string;
  cliente?: string;
  destino: string;
  transportador?: string;
  data_carregamento_rodoviario?: string;
  placa_saida?: string;
  data_posicionamento?: string;
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
  branchId: string;
  created_at: any;
  created_by_email?: string;
  updated_at?: any;
  updated_by_email?: string;
  uid: string;
  isPending?: boolean;
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

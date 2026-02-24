export interface Entry {
  id: number;
  mes: string;
  chave_acesso: string;
  nf_numero: string;
  tonelada: number;
  valor: number;
  descricao_produto: string;
  data_nf: string;
  data_descarga: string;
  status: 'Estoque' | 'Rejeitado' | 'Embarcado' | 'Devolvido';
  fornecedor: string;
  placa_veiculo: string;
  container: string;
  destino: string;
  data_faturamento_vli?: string;
  cte_vli?: string;
  hora_chegada?: string;
  hora_entrada?: string;
  hora_saida?: string;
  data_emissao_nf?: string;
  cte_intertex?: string;
  data_emissao_cte?: string;
  cte_transportador?: string;
  created_at: string;
}

export interface StockSummary {
  fornecedor: string;
  in_stock: number;
  exited: number;
}

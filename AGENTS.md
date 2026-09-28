# Diretrizes do Projeto: Estoque Titam

## Princípio Fundamental: Sistema 100% Autocontido e Unificado

1. **Sem Integrações com Outros Apps**:
   - Este aplicativo **NÃO** deve possuir integrações com outros sistemas ou aplicativos externos (sem webhooks externos, sem sincronização com ERPs ou ferramentas terceiras).
   - Todas as funcionalidades, telas, fluxos de trabalho e automações devem residir e operar exclusivamente dentro desta aplicação.

2. **Módulos e Recursos Nativos**:
   - Toda a gestão de estoque, controle de pátio, movimentações, pesagem, faturamento ferroviário (VLI/vagões), containers, notas fiscais (NF-e/XML), relatórios executivos, cadastros (filiais, fornecedores, clientes, transportadoras) e painéis analíticos são recursos nativos deste aplicativo.
   - Qualquer nova solicitação de funcionalidade deve ser implementada como módulo ou melhoria interna dentro deste mesmo sistema.

3. **Arquitetura de Dados**:
   - Persistência e regras de segurança centralizadas diretamente no banco Firestore interno do projeto (`ai-studio-10512360-ce8d-4236-a23c-a32335187c49`).
   - Servidor Express local (`server.ts`) dedicado exclusivamente a apoiar a aplicação (extração de dados de NF-e e rotas essenciais locais).

/**
 * Definições de coleções isoladas para este aplicativo independente.
 * O prefixo 'app2_' assegura que todas as leituras, gravações, atualizações e exclusões
 * ocorram em um espaço de dados totalmente segregado, garantindo 100% de independência
 * e NENHUMA interferência com os dados do aplicativo "Estoque Titam - (Produção)".
 */

export const COLLECTION_PREFIX = 'app2_';

export const COLLECTIONS = {
  entries: `${COLLECTION_PREFIX}entries`,
  containers: `${COLLECTION_PREFIX}containers`,
  branches: `${COLLECTION_PREFIX}branches`,
  suppliers: `${COLLECTION_PREFIX}suppliers`,
  transporters: `${COLLECTION_PREFIX}transporters`,
  customers: `${COLLECTION_PREFIX}customers`,
  products: `${COLLECTION_PREFIX}products`,
  destinations: `${COLLECTION_PREFIX}destinations`,
  slot_configs: `${COLLECTION_PREFIX}slot_configs`,
  appointments: `${COLLECTION_PREFIX}appointments`,
  internal_movements: `${COLLECTION_PREFIX}internal_movements`,
  yard_locations: `${COLLECTION_PREFIX}yard_locations`,
  dispatches: `${COLLECTION_PREFIX}dispatches`,
  users: `${COLLECTION_PREFIX}users`,
  settings: `${COLLECTION_PREFIX}settings`,
  production_kpis: `${COLLECTION_PREFIX}production_kpis`,
  maintenance_kpis: `${COLLECTION_PREFIX}maintenance_kpis`,
  equipments: `${COLLECTION_PREFIX}equipments`,
  operational_alerts: `${COLLECTION_PREFIX}operational_alerts`,
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;

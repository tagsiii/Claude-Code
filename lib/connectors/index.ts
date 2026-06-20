import { GdeltConnector } from './gdelt';
import { WorldBankConnector } from './worldbank';
import { NewsApiConnector } from './newsapi';
import type { BaseConnector } from './base';

export const ALL_CONNECTORS: BaseConnector[] = [
  new GdeltConnector(),
  new WorldBankConnector(),
  new NewsApiConnector(),
];

export function getAvailableConnectors(): BaseConnector[] {
  return ALL_CONNECTORS.filter((c) => c.isAvailable());
}

export function getConnectorByName(name: string): BaseConnector | undefined {
  return ALL_CONNECTORS.find((c) => c.name === name);
}

export { GdeltConnector, WorldBankConnector, NewsApiConnector };

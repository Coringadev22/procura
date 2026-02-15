import { PncpSource } from "./pncp.source.js";
import { PncpContratosSource } from "./pncp-contratos.source.js";
import { SicafSource } from "./sicaf.source.js";
import { TceRjSource } from "./tce-rj.source.js";
import { TransparenciaSource } from "./transparencia.source.js";
import type { DataSource } from "./types.js";

const sources: DataSource[] = [
  new PncpSource(),
  new PncpContratosSource(),
  new SicafSource(),
  new TceRjSource(),
  new TransparenciaSource(),
];

const sourceMap = new Map(sources.map((s) => [s.name, s]));

export function getSource(name: string): DataSource | undefined {
  return sourceMap.get(name);
}

export function getAllSources(): DataSource[] {
  return sources;
}

export function getAvailableSources(): Array<{
  name: string;
  label: string;
}> {
  return sources.map((s) => ({ name: s.name, label: s.label }));
}

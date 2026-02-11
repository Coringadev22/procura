import { fetchWithRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { PncpItem, PncpResultado } from "../types/pncp.types.js";

const BASE_URL = "https://pncp.gov.br/api/pncp/v1";

export async function getCompraItems(
  orgaoCnpj: string,
  anoCompra: number,
  sequencialCompra: number
): Promise<PncpItem[]> {
  const url = `${BASE_URL}/orgaos/${orgaoCnpj}/compras/${anoCompra}/${sequencialCompra}/itens`;

  logger.info(`PNCP Integration itens: ${url}`);

  const res = await fetchWithRetry(url);

  if (!res.ok) {
    throw new Error(
      `PNCP Integration items error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<PncpItem[]>;
}

export async function getItemResultados(
  orgaoCnpj: string,
  anoCompra: number,
  sequencialCompra: number,
  numeroItem: number
): Promise<PncpResultado[]> {
  const url = `${BASE_URL}/orgaos/${orgaoCnpj}/compras/${anoCompra}/${sequencialCompra}/itens/${numeroItem}/resultados`;

  logger.info(`PNCP Integration resultados item ${numeroItem}: ${url}`);

  const res = await fetchWithRetry(url);

  if (!res.ok) {
    if (res.status === 404) {
      return [];
    }
    throw new Error(
      `PNCP Integration results error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<PncpResultado[]>;
}

export async function getAllResultados(
  orgaoCnpj: string,
  anoCompra: number,
  sequencialCompra: number
): Promise<
  Array<PncpResultado & { numeroItem: number; itemDescricao: string }>
> {
  const items = await getCompraItems(orgaoCnpj, anoCompra, sequencialCompra);

  const itemsComResultado = items.filter((item) => item.temResultado);

  if (itemsComResultado.length === 0) {
    logger.info("Nenhum item com resultado encontrado");
    return [];
  }

  logger.info(
    `Buscando resultados de ${itemsComResultado.length} itens com resultado`
  );

  // Fetch results for all items in parallel (up to 5 concurrent)
  const allResults: Array<
    PncpResultado & { numeroItem: number; itemDescricao: string }
  > = [];

  const batchSize = 5;
  for (let i = 0; i < itemsComResultado.length; i += batchSize) {
    const batch = itemsComResultado.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const resultados = await getItemResultados(
          orgaoCnpj,
          anoCompra,
          sequencialCompra,
          item.numeroItem
        );
        return resultados.map((r) => ({
          ...r,
          numeroItem: item.numeroItem,
          itemDescricao: item.descricao,
        }));
      })
    );
    for (const results of batchResults) {
      allResults.push(...results);
    }
  }

  return allResults;
}

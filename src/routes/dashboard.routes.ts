import type { FastifyInstance } from "fastify";

const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Procura - Emails de Licitacoes</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }

    .header { background: linear-gradient(135deg, #1e293b, #334155); padding: 28px 32px; border-bottom: 1px solid #475569; }
    .header h1 { font-size: 26px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 10px; }
    .header h1 span { background: #22c55e; color: #fff; font-size: 11px; padding: 3px 10px; border-radius: 99px; font-weight: 600; }
    .header p { color: #94a3b8; font-size: 14px; margin-top: 6px; max-width: 700px; line-height: 1.5; }

    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }

    .tabs { display: flex; gap: 4px; margin-bottom: 24px; flex-wrap: wrap; background: #1e293b; border-radius: 12px; padding: 4px; border: 1px solid #334155; }
    .tab { padding: 10px 18px; border-radius: 8px; background: transparent; color: #94a3b8; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; border: none; display: flex; align-items: center; gap: 6px; }
    .tab:hover { color: #e2e8f0; background: #334155; }
    .tab.active { background: #3b82f6; color: #fff; font-weight: 600; }
    .tab.tab-green.active { background: #22c55e; }
    .tab-badge { background: rgba(255,255,255,0.2); color: #fff; font-size: 10px; padding: 1px 7px; border-radius: 99px; font-weight: 700; }

    .panel { display: none; }
    .panel.active { display: block; }

    .info-box { background: #162032; border-radius: 10px; padding: 16px 20px; border-left: 3px solid #3b82f6; margin-bottom: 20px; font-size: 13px; line-height: 1.6; color: #94a3b8; }
    .info-box strong { color: #e2e8f0; }
    .info-box.warn { border-left-color: #eab308; }
    .info-box.success { border-left-color: #22c55e; }

    .search-box { background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; margin-bottom: 20px; }
    .search-box h2 { font-size: 18px; margin-bottom: 6px; color: #f8fafc; }
    .search-box .desc { color: #64748b; font-size: 13px; margin-bottom: 16px; line-height: 1.5; }

    .form-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
    .form-group { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 140px; }
    .form-group label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .form-group input, .form-group select { padding: 10px 14px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; font-size: 14px; outline: none; transition: border 0.2s; }
    .form-group input:focus { border-color: #3b82f6; }
    .form-group input::placeholder { color: #475569; }

    .btn { padding: 10px 24px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-primary:hover { background: #2563eb; }
    .btn-primary:disabled { background: #475569; cursor: wait; }
    .btn-green { background: #22c55e; color: #fff; }
    .btn-green:hover { background: #16a34a; }
    .btn-green:disabled { background: #475569; cursor: wait; }
    .btn-red { background: #ef4444; color: #fff; }
    .btn-red:hover { background: #dc2626; }
    .btn-sm { font-size: 11px; padding: 6px 14px; }
    .btn-xs { font-size: 11px; padding: 5px 10px; }
    .btn-add { background: #22c55e; color: #fff; font-size: 14px; padding: 4px 10px; border-radius: 6px; border: none; cursor: pointer; font-weight: 700; line-height: 1; }
    .btn-add:hover { background: #16a34a; }
    .btn-add.added { background: #475569; cursor: default; }

    .stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .stat { background: #1e293b; border-radius: 10px; padding: 14px 18px; border: 1px solid #334155; flex: 1; min-width: 130px; }
    .stat-value { font-size: 26px; font-weight: 700; color: #f8fafc; }
    .stat-label { font-size: 11px; color: #64748b; margin-top: 2px; }
    .stat-value.green { color: #22c55e; }
    .stat-value.yellow { color: #eab308; }
    .stat-value.blue { color: #3b82f6; }
    .stat-value.red { color: #ef4444; }

    .results { background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .results-header { padding: 14px 20px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .results-header h3 { font-size: 15px; color: #f8fafc; }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 14px; text-align: left; font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #334155; background: #162032; font-weight: 600; }
    td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid rgba(51,65,85,0.5); vertical-align: top; }
    tr:hover td { background: #162032; }
    tr.clickable { cursor: pointer; }
    tr.clickable:hover td { background: #1a2744; }

    .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
    .badge-green { background: #052e16; color: #22c55e; }
    .badge-red { background: #2a0a0a; color: #ef4444; }
    .badge-blue { background: #0c1e3a; color: #3b82f6; }
    .badge-yellow { background: #2a2100; color: #eab308; }
    .badge-gray { background: #1e293b; color: #64748b; }

    .email-link { color: #3b82f6; text-decoration: none; }
    .email-link:hover { text-decoration: underline; }

    .empty { padding: 48px; text-align: center; color: #475569; font-size: 14px; }

    .loading { display: none; padding: 32px; text-align: center; }
    .loading.show { display: block; }
    .spinner { width: 28px; height: 28px; border: 3px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 10px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { color: #94a3b8; font-size: 13px; }

    .wrap { word-break: break-word; }

    .card { background: #162032; border-radius: 10px; padding: 20px; margin-bottom: 12px; border: 1px solid #334155; }
    .card h4 { font-size: 15px; color: #f8fafc; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 12px; }
    .info-grid .item label { font-size: 11px; color: #475569; display: block; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    .info-grid .item span { font-size: 13px; color: #e2e8f0; }

    .toast { position: fixed; bottom: 24px; right: 24px; background: #1e293b; border: 1px solid #22c55e; color: #22c55e; border-radius: 10px; padding: 14px 20px; font-size: 13px; display: none; z-index: 9999; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    .toast.error { border-color: #ef4444; color: #fca5a5; }
    .toast.warn { border-color: #eab308; color: #fde047; }

    .step-bar { display: flex; gap: 4px; margin-bottom: 16px; }
    .step { flex: 1; height: 4px; border-radius: 2px; background: #334155; transition: background 0.3s; }
    .step.done { background: #22c55e; }
    .step.active { background: #3b82f6; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

    /* Modal */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; justify-content: center; align-items: center; padding: 24px; }
    .modal-overlay.show { display: flex; }
    .modal-content { background: #1e293b; border-radius: 16px; border: 1px solid #475569; max-width: 800px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 28px; position: relative; }
    .modal-close { position: absolute; top: 16px; right: 16px; background: #334155; border: none; color: #94a3b8; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; }
    .modal-close:hover { background: #475569; color: #fff; }
    .modal-title { font-size: 18px; font-weight: 700; color: #f8fafc; margin-bottom: 16px; padding-right: 40px; }

    /* Actions bar */
    .actions-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }

    @media (max-width: 640px) {
      .form-row { flex-direction: column; }
      .form-group { min-width: 100%; }
      .stats { flex-direction: column; }
      .modal-content { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Procura <span>v3.0</span></h1>
    <p>Plataforma para busca de emails de empresas participantes de licitacoes do governo brasileiro. Os dados vem do PNCP (Portal Nacional de Contratacoes Publicas) e os emails sao obtidos via consulta de CNPJ na Receita Federal.</p>
  </div>

  <div class="container">
    <div class="tabs">
      <div class="tab tab-green active" data-tab="emails">Busca de Emails</div>
      <div class="tab tab-green" data-tab="leads">Meus Leads <span class="tab-badge" id="leads-count">0</span></div>
      <div class="tab" data-tab="licitacoes">Explorar Licitacoes</div>
      <div class="tab" data-tab="fornecedores">Fornecedores</div>
      <div class="tab" data-tab="contratos">Contratos</div>
      <div class="tab" data-tab="cnpj">Consulta CNPJ</div>
    </div>

    <!-- ============ BUSCA DE EMAILS ============ -->
    <div class="panel active" id="panel-emails">
      <div class="info-box success">
        <strong>Como funciona:</strong> A busca varre licitacoes no PNCP que ja possuem resultado (vencedores definidos), extrai os CNPJs das empresas participantes e consulta o email cadastrado na Receita Federal via 3 APIs simultaneas (CNPJa, ReceitaWS, CNPJ.ws). Os resultados sao cacheados por 30 dias - buscas repetidas sao instantaneas.
      </div>
      <div class="info-box warn">
        <strong>Sobre o tempo:</strong> A primeira busca pode levar 1-5 minutos dependendo da quantidade de licitacoes. As APIs gratuitas de CNPJ possuem limite de ~8 consultas por minuto. Buscas subsequentes com os mesmos fornecedores sao instantaneas (cache de 30 dias). Quanto mais licitacoes voce varrer, mais empresas e emails encontrara.
      </div>

      <div class="search-box">
        <h2>Busca de Emails de Fornecedores</h2>
        <div class="desc">Busque por palavra-chave do objeto da licitacao (ex: informatica, medicamentos, mobiliario). Filtre por estado e periodo. O sistema varre ate 1500 licitacoes para encontrar as que possuem resultado, extrai os CNPJs de todas as empresas vencedoras e busca seus emails. Aumente a "Qtd. Licitacoes" para encontrar mais empresas.</div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>Palavra-chave</label>
            <input type="text" id="be-q" placeholder="Ex: informatica, medicamentos... ou deixe vazio para ver tudo">
          </div>
          <div class="form-group" style="flex:0.5">
            <label>Estado (UF)</label>
            <input type="text" id="be-uf" placeholder="SP" maxlength="2" style="text-transform:uppercase">
          </div>
          <div class="form-group" style="flex:0.8">
            <label>Qtd. Licitacoes</label>
            <input type="number" id="be-limit" value="20" min="3" max="200">
          </div>
        </div>
        <div class="form-row" style="margin-top:12px">
          <div class="form-group">
            <label>Data Publicacao - De (opcional)</label>
            <input type="date" id="be-data-ini">
          </div>
          <div class="form-group">
            <label>Data Publicacao - Ate (opcional)</label>
            <input type="date" id="be-data-fim">
          </div>
          <div class="form-group" style="flex:0">
            <label>&nbsp;</label>
            <button class="btn btn-green" id="be-btn" onclick="buscaEmails()">Buscar Emails</button>
          </div>
        </div>
      </div>

      <div id="be-progress" style="display:none">
        <div class="step-bar"><div class="step" id="step1"></div><div class="step" id="step2"></div><div class="step" id="step3"></div></div>
        <div class="loading show" style="padding:16px">
          <div class="spinner"></div>
          <div class="loading-text" id="be-loading-text">Iniciando busca...</div>
        </div>
      </div>

      <div id="be-stats" class="stats" style="display:none"></div>
      <div id="be-email-list" style="display:none;margin-bottom:20px"></div>
      <div id="be-results"></div>
    </div>

    <!-- ============ MEUS LEADS ============ -->
    <div class="panel" id="panel-leads">
      <div class="info-box success">
        <strong>Meus Leads:</strong> Aqui ficam os fornecedores que voce selecionou das buscas. Use o botao "+" nas abas de Busca de Emails, Fornecedores e Contratos para adicionar empresas aqui. Os dados ficam salvos no seu navegador (localStorage) e persistem entre sessoes. CNPJs ou emails duplicados nao sao adicionados.
      </div>

      <div id="leads-stats" class="stats"></div>
      <div class="actions-bar" id="leads-actions">
        <button class="btn btn-green btn-sm" onclick="copyLeadEmails()">Copiar Emails</button>
        <button class="btn btn-primary btn-sm" onclick="exportLeadsCSV()">Exportar CSV</button>
        <button class="btn btn-red btn-sm" onclick="clearLeads()">Limpar Tudo</button>
      </div>
      <div id="leads-results"></div>
    </div>

    <!-- ============ EXPLORAR LICITACOES ============ -->
    <div class="panel" id="panel-licitacoes">
      <div class="info-box">
        <strong>Explorar Licitacoes:</strong> Busque licitacoes publicadas no PNCP por palavra-chave e estado. Clique em uma licitacao para ver os detalhes completos. As licitacoes com <span class="badge badge-green">resultado</span> ja possuem vencedores definidos - voce pode clicar em "Ver Fornecedores" para buscar os emails.
      </div>

      <div class="search-box">
        <h2>Buscar Licitacoes no PNCP</h2>
        <div class="desc">Pesquise por palavra-chave no objeto/descricao da licitacao. Resultados ordenados por data mais recente.</div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>Palavra-chave (opcional)</label>
            <input type="text" id="lic-q" placeholder="Ex: informatica, medicamentos... ou deixe vazio para ver todas">
          </div>
          <div class="form-group" style="flex:0.5">
            <label>Estado (UF)</label>
            <input type="text" id="lic-uf" placeholder="SP" maxlength="2" style="text-transform:uppercase">
          </div>
          <div class="form-group" style="flex:0">
            <label>&nbsp;</label>
            <button class="btn btn-primary" onclick="licPage=1;searchLicitacoes()">Buscar</button>
          </div>
        </div>
        <div class="form-row" style="margin-top:12px">
          <div class="form-group">
            <label>Data Publicacao - De (opcional)</label>
            <input type="date" id="lic-data-ini">
          </div>
          <div class="form-group">
            <label>Data Publicacao - Ate (opcional)</label>
            <input type="date" id="lic-data-fim">
          </div>
        </div>
      </div>
      <div id="lic-stats" class="stats" style="display:none"></div>
      <div id="lic-loading" class="loading"><div class="spinner"></div><div class="loading-text">Buscando licitacoes no PNCP...</div></div>
      <div id="lic-results"></div>
    </div>

    <!-- ============ FORNECEDORES ============ -->
    <div class="panel" id="panel-fornecedores">
      <div class="info-box">
        <strong>Fornecedores de uma Licitacao:</strong> Dado o CNPJ do orgao, ano e numero sequencial de uma compra, o sistema busca todos os itens e resultados no PNCP, extrai os CNPJs das empresas vencedoras (somente PJ) e consulta os emails na Receita Federal. Use o botao "Ver Fornecedores" na aba Licitacoes para preencher automaticamente.
      </div>

      <div class="search-box">
        <h2>Buscar Fornecedores de uma Licitacao Especifica</h2>
        <div class="desc">Informe os dados da licitacao. Esses dados aparecem no numero de controle PNCP no formato: CNPJ-1-SEQUENCIAL/ANO.</div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>CNPJ do Orgao</label>
            <input type="text" id="forn-cnpj" placeholder="Ex: 11240009000196">
          </div>
          <div class="form-group" style="flex:0.5">
            <label>Ano da Compra</label>
            <input type="number" id="forn-ano" placeholder="2025">
          </div>
          <div class="form-group" style="flex:0.5">
            <label>Sequencial</label>
            <input type="number" id="forn-seq" placeholder="15">
          </div>
          <div class="form-group" style="flex:0">
            <label>&nbsp;</label>
            <button class="btn btn-primary" onclick="searchFornecedores()">Buscar Emails</button>
          </div>
        </div>
      </div>
      <div id="forn-stats" class="stats" style="display:none"></div>
      <div id="forn-loading" class="loading"><div class="spinner"></div><div class="loading-text">Buscando fornecedores e consultando emails... (pode levar 1-2 min)</div></div>
      <div id="forn-results"></div>
    </div>

    <!-- ============ CONTRATOS ============ -->
    <div class="panel" id="panel-contratos">
      <div class="info-box">
        <strong>Contratos Publicos:</strong> Busque contratos firmados no PNCP por periodo e estado. Cada contrato mostra o orgao, o fornecedor, o objeto e o valor. Clique em "Ver Email" para consultar o email da empresa fornecedora, ou "+" para adicionar direto aos Meus Leads.
      </div>

      <div class="search-box">
        <h2>Buscar Contratos por Periodo</h2>
        <div class="desc">Informe o periodo de assinatura dos contratos. Os dados vem da API de Consulta do PNCP.</div>
        <div class="form-row">
          <div class="form-group">
            <label>Data Inicial</label>
            <input type="date" id="cont-inicio" value="${new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label>Data Final</label>
            <input type="date" id="cont-fim" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group" style="flex:0.5">
            <label>Estado (UF)</label>
            <input type="text" id="cont-uf" placeholder="SP" maxlength="2" style="text-transform:uppercase">
          </div>
          <div class="form-group" style="flex:0">
            <label>&nbsp;</label>
            <button class="btn btn-primary" onclick="contPage=1;searchContratos()">Buscar</button>
          </div>
        </div>
      </div>
      <div id="cont-stats" class="stats" style="display:none"></div>
      <div id="cont-loading" class="loading"><div class="spinner"></div><div class="loading-text">Buscando contratos no PNCP...</div></div>
      <div id="cont-results"></div>
    </div>

    <!-- ============ CONSULTA CNPJ ============ -->
    <div class="panel" id="panel-cnpj">
      <div class="info-box">
        <strong>Consulta Direta de CNPJ:</strong> Digite um CNPJ para consultar os dados cadastrais da empresa na Receita Federal, incluindo email, telefone, endereco e atividade economica. Os dados sao buscados via BrasilAPI (dados cadastrais) e CNPJa/ReceitaWS (email). Resultados ficam em cache por 30 dias.
      </div>

      <div class="search-box">
        <h2>Consultar Empresa por CNPJ</h2>
        <div class="desc">Informe o CNPJ com ou sem pontuacao. O sistema busca os dados na Receita Federal e retorna email, telefone e demais informacoes cadastrais.</div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>CNPJ da Empresa</label>
            <input type="text" id="cnpj-input" placeholder="Ex: 12.981.310/0001-13 ou 12981310000113">
          </div>
          <div class="form-group" style="flex:0">
            <label>&nbsp;</label>
            <button class="btn btn-primary" onclick="lookupCnpj()">Consultar</button>
          </div>
        </div>
      </div>
      <div id="cnpj-loading" class="loading"><div class="spinner"></div><div class="loading-text">Consultando CNPJ na Receita Federal...</div></div>
      <div id="cnpj-results"></div>
    </div>
  </div>

  <!-- Modal de Detalhes da Licitacao -->
  <div class="modal-overlay" id="lic-modal" onclick="if(event.target===this)closeLicModal()">
    <div class="modal-content">
      <button class="modal-close" onclick="closeLicModal()">&times;</button>
      <div id="lic-modal-body">
        <div class="loading show"><div class="spinner"></div><div class="loading-text">Carregando detalhes...</div></div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

<script>
const API = '';
let licPage = 1;
let contPage = 1;

// ============ LEADS (localStorage) ============
let leads = [];

function loadLeads() {
  try { leads = JSON.parse(localStorage.getItem('procura-leads') || '[]'); } catch(e) { leads = []; }
  updateLeadsBadge();
}

function saveLeads() {
  localStorage.setItem('procura-leads', JSON.stringify(leads));
  updateLeadsBadge();
}

function updateLeadsBadge() {
  const badge = document.getElementById('leads-count');
  if (badge) badge.textContent = leads.length;
}

function addLead(data) {
  const cnpj = (data.cnpj || '').replace(/\\D/g, '');
  if (!cnpj) return showToast('CNPJ invalido', true);

  // Check duplicate CNPJ
  if (leads.some(l => l.cnpj === cnpj)) {
    showToast('CNPJ ' + cnpj + ' ja esta nos Meus Leads', false, true);
    return false;
  }

  // Check duplicate email
  if (data.email && leads.some(l => l.email && l.email.toLowerCase() === data.email.toLowerCase())) {
    showToast('Email ' + data.email + ' ja existe nos Meus Leads (outro CNPJ)', false, true);
    return false;
  }

  leads.push({
    cnpj: cnpj,
    razaoSocial: data.razaoSocial || null,
    nomeFantasia: data.nomeFantasia || null,
    email: data.email || null,
    telefones: data.telefones || null,
    municipio: data.municipio || null,
    uf: data.uf || null,
    origem: data.origem || 'manual',
    valorHomologado: data.valorHomologado || null,
    adicionadoEm: new Date().toISOString()
  });
  saveLeads();
  showToast('Adicionado aos Meus Leads!');
  return true;
}

function removeLead(cnpj) {
  leads = leads.filter(l => l.cnpj !== cnpj);
  saveLeads();
  renderLeads();
}

function clearLeads() {
  if (!confirm('Tem certeza que deseja limpar todos os leads? Esta acao nao pode ser desfeita.')) return;
  leads = [];
  saveLeads();
  renderLeads();
  showToast('Todos os leads foram removidos');
}

function renderLeads() {
  const statsEl = document.getElementById('leads-stats');
  const resultsEl = document.getElementById('leads-results');
  const actionsEl = document.getElementById('leads-actions');

  const comEmail = leads.filter(l => l.email).length;
  const semEmail = leads.length - comEmail;

  statsEl.innerHTML =
    '<div class="stat"><div class="stat-value blue">' + leads.length + '</div><div class="stat-label">Total de leads</div></div>' +
    '<div class="stat"><div class="stat-value green">' + comEmail + '</div><div class="stat-label">Com email</div></div>' +
    '<div class="stat"><div class="stat-value yellow">' + semEmail + '</div><div class="stat-label">Sem email</div></div>';

  actionsEl.style.display = leads.length > 0 ? 'flex' : 'none';

  if (leads.length === 0) {
    resultsEl.innerHTML = '<div class="results"><div class="empty">Nenhum lead adicionado ainda. Use o botao "+" nas abas de Busca de Emails, Fornecedores ou Contratos para adicionar empresas aqui.</div></div>';
    return;
  }

  let html = '<div class="results"><div class="results-header"><h3>Meus Leads (' + leads.length + ')</h3></div><div class="table-wrap"><table><thead><tr>' +
    '<th>Empresa</th><th>Email</th><th>Telefone</th><th>Cidade/UF</th><th>Origem</th><th>Valor</th><th></th>' +
    '</tr></thead><tbody>';

  leads.forEach(l => {
    html += '<tr>' +
      '<td><div style="font-weight:600;font-size:12px">' + (l.razaoSocial || 'Sem nome') + '</div><div style="color:#475569;font-size:11px">' + l.cnpj + '</div></td>' +
      '<td>' + (l.email ? '<a class="email-link" href="mailto:' + l.email + '">' + l.email + '</a>' : '<span class="badge badge-red">Sem email</span>') + '</td>' +
      '<td style="font-size:12px">' + (l.telefones || '-') + '</td>' +
      '<td style="font-size:12px">' + (l.municipio || '') + (l.uf ? '/' + l.uf : '') + '</td>' +
      '<td><span class="badge badge-blue">' + (l.origem || '-') + '</span></td>' +
      '<td style="font-size:12px;color:#22c55e;font-weight:600">' + money(l.valorHomologado) + '</td>' +
      '<td><button class="btn btn-xs btn-red" onclick="removeLead(\\''+l.cnpj+'\\')">X</button></td>' +
      '</tr>';
  });

  html += '</tbody></table></div></div>';
  resultsEl.innerHTML = html;
}

function copyLeadEmails() {
  const emails = leads.filter(l => l.email).map(l => l.email);
  if (emails.length === 0) return showToast('Nenhum lead com email', true);
  navigator.clipboard.writeText(emails.join('\\n')).then(() => showToast(emails.length + ' emails copiados!'));
}

function exportLeadsCSV() {
  if (leads.length === 0) return showToast('Nenhum lead para exportar', true);
  const header = 'CNPJ,Razao Social,Email,Telefone,Municipio,UF,Origem,Valor Homologado';
  const rows = leads.map(l => {
    return [l.cnpj, '"'+(l.razaoSocial||'')+'"', l.email||'', '"'+(l.telefones||'')+'"', '"'+(l.municipio||'')+'"', l.uf||'', l.origem||'', l.valorHomologado||''].join(',');
  });
  const csv = header + '\\n' + rows.join('\\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'procura-leads-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  showToast('CSV exportado com ' + leads.length + ' leads!');
}

function addAllLeads(dataArray, origem) {
  let added = 0;
  let dupes = 0;
  dataArray.forEach(f => {
    const cnpj = (f.cnpj || '').replace(/\\D/g, '');
    if (!cnpj) return;
    if (leads.some(l => l.cnpj === cnpj)) { dupes++; return; }
    if (f.email && leads.some(l => l.email && l.email.toLowerCase() === f.email.toLowerCase())) { dupes++; return; }
    leads.push({
      cnpj, razaoSocial: f.razaoSocial||null, nomeFantasia: f.nomeFantasia||null,
      email: f.email||null, telefones: f.telefones||null, municipio: f.municipio||null,
      uf: f.uf||null, origem: origem, valorHomologado: f.valorHomologado||null,
      adicionadoEm: new Date().toISOString()
    });
    added++;
  });
  saveLeads();
  if (added > 0) showToast(added + ' leads adicionados!' + (dupes > 0 ? ' (' + dupes + ' duplicados ignorados)' : ''));
  else if (dupes > 0) showToast('Todos ' + dupes + ' ja estavam nos Meus Leads', false, true);
}

// ============ UTILITIES ============
function dateToYMD(d) { return d.replace(/-/g, ''); }

function showToast(msg, isError, isWarn) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : isWarn ? ' warn' : '');
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 4000);
}

async function apiFetch(url) {
  const res = await fetch(API + url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erro ' + res.status);
  }
  return res.json();
}

function money(v) {
  if (v == null) return '-';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function setStep(n) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('step' + i);
    el.className = 'step' + (i < n ? ' done' : i === n ? ' active' : '');
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector('.tab[data-tab="' + tabName + '"]');
  if (tab) tab.classList.add('active');
  const panel = document.getElementById('panel-' + tabName);
  if (panel) panel.classList.add('active');
}

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    switchTab(tab.dataset.tab);
    if (tab.dataset.tab === 'leads') renderLeads();
  });
});

// Store last busca-emails data for "add all"
let lastBuscaData = [];
let lastFornData = [];

// ============ BUSCA DE EMAILS ============
async function buscaEmails() {
  const q = document.getElementById('be-q').value;
  const uf = document.getElementById('be-uf').value.toUpperCase();
  const limit = document.getElementById('be-limit').value || '20';
  const dataIni = document.getElementById('be-data-ini').value;
  const dataFim = document.getElementById('be-data-fim').value;

  const btn = document.getElementById('be-btn');
  const progress = document.getElementById('be-progress');
  const loadingText = document.getElementById('be-loading-text');
  const results = document.getElementById('be-results');
  const stats = document.getElementById('be-stats');
  const emailList = document.getElementById('be-email-list');

  btn.disabled = true;
  progress.style.display = 'block';
  results.innerHTML = '';
  stats.style.display = 'none';
  emailList.style.display = 'none';
  lastBuscaData = [];

  setStep(1);
  loadingText.textContent = 'Fase 1/3: Varrendo licitacoes no PNCP com resultado...';

  const timer1 = setTimeout(() => {
    setStep(2);
    loadingText.textContent = 'Fase 2/3: Extraindo CNPJs dos fornecedores vencedores...';
  }, 3000);
  const timer2 = setTimeout(() => {
    setStep(3);
    loadingText.textContent = 'Fase 3/3: Consultando emails na Receita Federal (~8 CNPJs/min)...';
  }, 8000);

  try {
    let url = '/api/busca-emails?q=' + encodeURIComponent(q) + '&minResultados=' + limit;
    if (uf) url += '&uf=' + uf;
    if (dataIni) url += '&dataInicial=' + dateToYMD(dataIni);
    if (dataFim) url += '&dataFinal=' + dateToYMD(dataFim);

    const data = await apiFetch(url);
    lastBuscaData = data.data || [];

    clearTimeout(timer1);
    clearTimeout(timer2);
    progress.style.display = 'none';
    btn.disabled = false;

    stats.style.display = 'flex';
    stats.innerHTML =
      '<div class="stat"><div class="stat-value blue">' + data.licitacoesAnalisadas + '</div><div class="stat-label">Licitacoes varridas</div></div>' +
      '<div class="stat"><div class="stat-value">' + data.licitacoesComResultado + '</div><div class="stat-label">Com resultado</div></div>' +
      '<div class="stat"><div class="stat-value">' + data.total + '</div><div class="stat-label">Fornecedores PJ</div></div>' +
      '<div class="stat"><div class="stat-value green">' + data.comEmail + '</div><div class="stat-label">Emails encontrados</div></div>' +
      '<div class="stat"><div class="stat-value yellow">' + data.semEmail + '</div><div class="stat-label">Sem email</div></div>';

    if (data.emails && data.emails.length > 0) {
      emailList.style.display = 'block';
      emailList.innerHTML = '<div class="results" style="padding:20px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
          '<h3 style="font-size:15px;color:#f8fafc">Emails Encontrados (' + data.emails.length + ')</h3>' +
          '<div style="display:flex;gap:8px"><button class="btn btn-green btn-sm" onclick="copyEmails()">Copiar Emails</button>' +
          '<button class="btn btn-primary btn-sm" onclick="addAllLeads(lastBuscaData,\\'busca-emails\\')">Adicionar Todos aos Leads</button></div>' +
        '</div>' +
        '<textarea id="be-emails-text" readonly style="width:100%;height:100px;background:#0f172a;color:#22c55e;border:1px solid #334155;border-radius:8px;padding:12px;font-size:13px;font-family:monospace;resize:vertical">' +
        data.emails.join('\\n') +
        '</textarea></div>';
    }

    if (data.message) {
      results.innerHTML = '<div class="results"><div class="empty">' + data.message + '</div></div>';
      return;
    }

    if (!data.data || !data.data.length) {
      results.innerHTML = '<div class="results"><div class="empty">Nenhum fornecedor PJ encontrado nas licitacoes analisadas.</div></div>';
      return;
    }

    let html = '<div class="results"><div class="results-header"><h3>Detalhes dos Fornecedores</h3></div><div class="table-wrap"><table><thead><tr>' +
      '<th>Empresa</th><th>Email</th><th>Telefone</th><th>Cidade/UF</th><th>Valor</th><th>Fonte</th><th></th>' +
      '</tr></thead><tbody>';

    data.data.forEach((f, i) => {
      const isInLeads = leads.some(l => l.cnpj === (f.cnpj||'').replace(/\\D/g,''));
      html += '<tr>' +
        '<td><div style="font-weight:600;font-size:12px">' + (f.razaoSocial||'Sem nome') + '</div><div style="color:#475569;font-size:11px">' + f.cnpj + '</div></td>' +
        '<td>' + (f.email ? '<a class="email-link" href="mailto:' + f.email + '">' + f.email + '</a>' : '<span class="badge badge-red">Nao encontrado</span>') + '</td>' +
        '<td style="font-size:12px">' + (f.telefones||'-') + '</td>' +
        '<td style="font-size:12px">' + (f.municipio||'') + (f.uf ? '/' + f.uf : '') + '</td>' +
        '<td style="font-size:12px;font-weight:600;color:#22c55e">' + money(f.valorHomologado) + '</td>' +
        '<td><span class="badge ' + (f.emailSource === 'not_found' || f.emailSource === 'lookup_failed' ? 'badge-gray' : 'badge-blue') + '">' + f.emailSource + '</span></td>' +
        '<td><button class="btn-add' + (isInLeads ? ' added' : '') + '" onclick="addLeadFromBusca(' + i + ',this)" title="Adicionar aos Meus Leads">' + (isInLeads ? '\\u2713' : '+') + '</button></td>' +
        '</tr>';
    });

    html += '</tbody></table></div></div>';
    results.innerHTML = html;
  } catch(e) {
    clearTimeout(timer1);
    clearTimeout(timer2);
    progress.style.display = 'none';
    btn.disabled = false;
    showToast(e.message, true);
  }
}

function addLeadFromBusca(index, btnEl) {
  const f = lastBuscaData[index];
  if (!f) return;
  const ok = addLead({ ...f, origem: 'busca-emails' });
  if (ok && btnEl) { btnEl.textContent = '\\u2713'; btnEl.classList.add('added'); }
}

function copyEmails() {
  const t = document.getElementById('be-emails-text');
  if (t) { navigator.clipboard.writeText(t.value).then(() => showToast('Emails copiados!')); }
}

// ============ LICITACOES ============
async function searchLicitacoes() {
  const q = document.getElementById('lic-q').value;
  const uf = document.getElementById('lic-uf').value.toUpperCase();
  const dataIni = document.getElementById('lic-data-ini').value;
  const dataFim = document.getElementById('lic-data-fim').value;

  const loading = document.getElementById('lic-loading');
  const results = document.getElementById('lic-results');
  const stats = document.getElementById('lic-stats');
  loading.classList.add('show'); results.innerHTML = ''; stats.style.display = 'none';

  try {
    let url = '/api/licitacoes/search?q=' + encodeURIComponent(q) + '&tamanhoPagina=15&pagina=' + licPage;
    if (uf) url += '&uf=' + uf;
    if (dataIni) url += '&dataInicial=' + dateToYMD(dataIni);
    if (dataFim) url += '&dataFinal=' + dateToYMD(dataFim);
    const data = await apiFetch(url);
    loading.classList.remove('show');

    const totalPages = Math.ceil((data.total || 0) / 15);
    const comResultado = data.data.filter(l => l.temResultado).length;
    stats.style.display = 'flex';
    stats.innerHTML =
      '<div class="stat"><div class="stat-value blue">' + (data.total||0).toLocaleString() + '</div><div class="stat-label">Total encontrado</div></div>' +
      '<div class="stat"><div class="stat-value">' + data.data.length + '</div><div class="stat-label">Nesta pagina</div></div>' +
      '<div class="stat"><div class="stat-value green">' + comResultado + '</div><div class="stat-label">Com resultado</div></div>' +
      '<div class="stat"><div class="stat-value">' + licPage + ' / ' + (totalPages||1) + '</div><div class="stat-label">Pagina</div></div>';

    if (!data.data.length) {
      results.innerHTML = '<div class="results"><div class="empty">Nenhuma licitacao encontrada para esta busca.</div></div>';
      return;
    }

    let html = '<div class="results"><div class="results-header"><h3>Licitacoes</h3><div style="display:flex;gap:8px">' +
      (licPage > 1 ? '<button class="btn btn-primary btn-sm" onclick="licPage--;searchLicitacoes()">Anterior</button>' : '') +
      (data.data.length >= 15 ? '<button class="btn btn-primary btn-sm" onclick="licPage++;searchLicitacoes()">Proxima</button>' : '') +
      '</div></div><div class="table-wrap"><table><thead><tr>' +
      '<th>Orgao</th><th>Objeto da Compra</th><th>Modalidade</th><th>UF</th><th>Data</th><th>Resultado</th><th>Acao</th>' +
      '</tr></thead><tbody>';

    data.data.forEach(l => {
      const hasRes = l.temResultado;
      html += '<tr class="clickable" onclick="showLicModal(\\'' + l.orgaoCnpj + '\\',' + l.anoCompra + ',' + l.sequencialCompra + ')">' +
        '<td><div style="font-weight:600;font-size:12px">' + (l.orgaoNome||'') + '</div><div style="color:#475569;font-size:11px">' + l.orgaoCnpj + '</div></td>' +
        '<td style="max-width:300px"><div class="wrap" style="font-size:12px">' + (l.objetoCompra||'').substring(0,150) + '</div></td>' +
        '<td><span class="badge badge-blue">' + (l.modalidade||'-') + '</span></td>' +
        '<td>' + (l.uf||'-') + '</td>' +
        '<td style="white-space:nowrap;font-size:12px">' + (l.dataPublicacao||'').substring(0,10) + '</td>' +
        '<td>' + (hasRes ? '<span class="badge badge-green">Sim</span>' : '<span class="badge badge-yellow">Nao</span>') + '</td>' +
        '<td>' + (hasRes ? '<button class="btn btn-green btn-xs" onclick="event.stopPropagation();goFornecedores(\\'' + l.orgaoCnpj + '\\',' + l.anoCompra + ',' + l.sequencialCompra + ')">Ver Fornecedores</button>' : '<span class="badge badge-gray">Aguardando</span>') + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    // Bottom pagination
    if (licPage > 1 || data.data.length >= 15) {
      html += '<div style="padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #334155">' +
        '<span style="font-size:12px;color:#64748b">Pagina ' + licPage + ' de ' + (totalPages||1) + '</span>' +
        '<div style="display:flex;gap:8px">' +
        (licPage > 1 ? '<button class="btn btn-primary btn-sm" onclick="licPage--;searchLicitacoes()">Anterior</button>' : '') +
        (data.data.length >= 15 ? '<button class="btn btn-primary btn-sm" onclick="licPage++;searchLicitacoes()">Proxima</button>' : '') +
        '</div></div>';
    }
    html += '</div>';
    results.innerHTML = html;
  } catch(e) {
    loading.classList.remove('show');
    showToast(e.message, true);
  }
}

// ============ LICITACAO MODAL ============
async function showLicModal(cnpj, ano, seq) {
  const modal = document.getElementById('lic-modal');
  const body = document.getElementById('lic-modal-body');
  modal.classList.add('show');
  body.innerHTML = '<div class="loading show"><div class="spinner"></div><div class="loading-text">Carregando detalhes da licitacao...</div></div>';

  try {
    const data = await apiFetch('/api/licitacoes/' + cnpj + '/' + ano + '/' + seq);
    const d = data.data;

    const orgao = d.orgaoEntidade || {};
    const unidade = d.unidadeOrgao || {};

    body.innerHTML =
      '<div class="modal-title">' + (d.objetoCompra || 'Sem objeto') + '</div>' +
      '<div class="info-grid">' +
        '<div class="item"><label>Orgao</label><span>' + (orgao.razaoSocial || '-') + '</span></div>' +
        '<div class="item"><label>CNPJ do Orgao</label><span>' + (orgao.cnpj || cnpj) + '</span></div>' +
        '<div class="item"><label>Unidade</label><span>' + (unidade.nomeUnidade || '-') + '</span></div>' +
        '<div class="item"><label>Municipio/UF</label><span>' + (unidade.municipioNome || '') + '/' + (unidade.ufSigla || '') + '</span></div>' +
        '<div class="item"><label>Modalidade</label><span>' + (d.modalidadeNome || '-') + '</span></div>' +
        '<div class="item"><label>Situacao</label><span>' + (d.situacaoCompraNome || '-') + '</span></div>' +
        '<div class="item"><label>Numero Compra</label><span>' + (d.numeroCompra || '-') + '</span></div>' +
        '<div class="item"><label>Processo</label><span>' + (d.processo || '-') + '</span></div>' +
        '<div class="item"><label>Numero Controle PNCP</label><span style="font-weight:600">' + (d.numeroControlePNCP || '-') + '</span></div>' +
        '<div class="item"><label>Ano/Sequencial</label><span>' + ano + '/' + seq + '</span></div>' +
        '<div class="item"><label>Valor Estimado</label><span style="color:#3b82f6;font-weight:600">' + money(d.valorTotalEstimado) + '</span></div>' +
        '<div class="item"><label>Valor Homologado</label><span style="color:#22c55e;font-weight:600">' + money(d.valorTotalHomologado) + '</span></div>' +
        '<div class="item"><label>Data Publicacao</label><span>' + (d.dataPublicacaoPncp || '-').substring(0, 10) + '</span></div>' +
        '<div class="item"><label>Data Abertura Propostas</label><span>' + (d.dataAberturaProposta || '-').substring(0, 10) + '</span></div>' +
        '<div class="item"><label>SRP (Registro de Precos)</label><span>' + (d.srp ? 'Sim' : 'Nao') + '</span></div>' +
        '<div class="item"><label>Orcamento Sigiloso</label><span>' + (d.orcamentoSigilosoDescricao || '-') + '</span></div>' +
      '</div>' +
      (d.linkSistemaOrigem ? '<div style="margin-top:16px"><a href="' + d.linkSistemaOrigem + '" target="_blank" class="btn btn-primary btn-sm">Abrir no Sistema de Origem</a></div>' : '') +
      '<div style="margin-top:16px;display:flex;gap:8px">' +
        '<button class="btn btn-green btn-sm" onclick="closeLicModal();goFornecedores(\\'' + cnpj + '\\',' + ano + ',' + seq + ')">Ver Fornecedores / Emails</button>' +
      '</div>';
  } catch(e) {
    body.innerHTML = '<div class="empty">Erro ao carregar detalhes: ' + e.message + '</div>';
  }
}

function closeLicModal() {
  document.getElementById('lic-modal').classList.remove('show');
}

function goFornecedores(cnpj, ano, seq) {
  switchTab('fornecedores');
  document.getElementById('forn-cnpj').value = cnpj;
  document.getElementById('forn-ano').value = ano;
  document.getElementById('forn-seq').value = seq;
  searchFornecedores();
}

// ============ FORNECEDORES ============
async function searchFornecedores() {
  const cnpj = document.getElementById('forn-cnpj').value.replace(/\\D/g,'');
  const ano = document.getElementById('forn-ano').value;
  const seq = document.getElementById('forn-seq').value;
  if (!cnpj || !ano || !seq) return showToast('Preencha CNPJ do orgao, ano e sequencial', true);

  const loading = document.getElementById('forn-loading');
  const results = document.getElementById('forn-results');
  const stats = document.getElementById('forn-stats');
  loading.classList.add('show'); results.innerHTML = ''; stats.style.display = 'none';
  lastFornData = [];

  try {
    const data = await apiFetch('/api/licitacoes/' + cnpj + '/' + ano + '/' + seq + '/fornecedores');
    loading.classList.remove('show');
    lastFornData = data.data || [];

    stats.style.display = 'flex';
    stats.innerHTML =
      '<div class="stat"><div class="stat-value blue">' + data.total + '</div><div class="stat-label">Fornecedores PJ</div></div>' +
      '<div class="stat"><div class="stat-value green">' + data.comEmail + '</div><div class="stat-label">Com email</div></div>' +
      '<div class="stat"><div class="stat-value yellow">' + data.semEmail + '</div><div class="stat-label">Sem email</div></div>';

    if (!data.data.length) {
      results.innerHTML = '<div class="results"><div class="empty">Nenhum fornecedor PJ encontrado.</div></div>';
      return;
    }

    let html = '<div class="actions-bar"><button class="btn btn-green btn-sm" onclick="addAllLeads(lastFornData,\\'fornecedores\\')">Adicionar Todos aos Leads</button></div>';

    data.data.forEach((f, i) => {
      const isInLeads = leads.some(l => l.cnpj === (f.cnpj||'').replace(/\\D/g,''));
      html += '<div class="card">' +
        '<div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px">' +
          '<div><h4>' + (f.razaoSocial||'Sem nome') + '</h4>' +
          (f.nomeFantasia ? '<div style="color:#64748b;font-size:12px">' + f.nomeFantasia + '</div>' : '') + '</div>' +
          '<div style="display:flex;gap:8px;align-items:center">' +
            (f.email ? '<span class="badge badge-green">Email encontrado</span>' : '<span class="badge badge-red">Sem email</span>') +
            '<button class="btn-add' + (isInLeads ? ' added' : '') + '" onclick="addLeadFromForn(' + i + ',this)" title="Adicionar aos Meus Leads">' + (isInLeads ? '\\u2713' : '+') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="info-grid">' +
          '<div class="item"><label>CNPJ</label><span>' + f.cnpj + '</span></div>' +
          '<div class="item"><label>Email</label><span>' + (f.email ? '<a class="email-link" href="mailto:' + f.email + '" style="font-size:15px;font-weight:600">' + f.email + '</a>' : 'Nao encontrado') + '</span></div>' +
          '<div class="item"><label>Telefone</label><span>' + (f.telefones||'-') + '</span></div>' +
          '<div class="item"><label>Cidade/UF</label><span>' + (f.municipio||'') + (f.uf ? '/' + f.uf : '') + '</span></div>' +
          '<div class="item"><label>Porte</label><span>' + (f.porte||'-') + '</span></div>' +
          '<div class="item"><label>Valor Homologado</label><span style="color:#22c55e;font-weight:600">' + money(f.valorHomologado) + '</span></div>' +
          '<div class="item"><label>Fonte do Email</label><span><span class="badge badge-blue">' + f.emailSource + '</span></span></div>' +
          '<div class="item"><label>Itens Fornecidos</label><span style="font-size:11px;color:#94a3b8">' + (f.itemDescricao||'-').substring(0,200) + '</span></div>' +
        '</div>' +
      '</div>';
    });
    results.innerHTML = html;
  } catch(e) {
    loading.classList.remove('show');
    showToast(e.message, true);
  }
}

function addLeadFromForn(index, btnEl) {
  const f = lastFornData[index];
  if (!f) return;
  const ok = addLead({ ...f, origem: 'fornecedores' });
  if (ok && btnEl) { btnEl.textContent = '\\u2713'; btnEl.classList.add('added'); }
}

// ============ CONTRATOS ============
async function searchContratos() {
  const diRaw = document.getElementById('cont-inicio').value;
  const dfRaw = document.getElementById('cont-fim').value;
  const uf = document.getElementById('cont-uf').value.toUpperCase();
  if (!diRaw || !dfRaw) return showToast('Informe as datas inicial e final', true);

  const loading = document.getElementById('cont-loading');
  const results = document.getElementById('cont-results');
  const stats = document.getElementById('cont-stats');
  loading.classList.add('show'); results.innerHTML = ''; stats.style.display = 'none';

  try {
    let url = '/api/contratos/search?dataInicial=' + dateToYMD(diRaw) + '&dataFinal=' + dateToYMD(dfRaw) + '&pagina=' + contPage + '&tamanhoPagina=15';
    if (uf) url += '&uf=' + uf;
    const data = await apiFetch(url);
    loading.classList.remove('show');

    stats.style.display = 'flex';
    stats.innerHTML =
      '<div class="stat"><div class="stat-value blue">' + (data.total||0).toLocaleString() + '</div><div class="stat-label">Total encontrado</div></div>' +
      '<div class="stat"><div class="stat-value">' + data.data.length + '</div><div class="stat-label">Nesta pagina</div></div>';

    if (!data.data.length) {
      results.innerHTML = '<div class="results"><div class="empty">Nenhum contrato encontrado para este periodo' + (uf ? ' no estado ' + uf : '') + '.</div></div>';
      return;
    }

    let html = '<div class="results"><div class="results-header"><h3>Contratos - Pagina ' + contPage + '</h3><div style="display:flex;gap:8px">' +
      (contPage > 1 ? '<button class="btn btn-primary btn-sm" onclick="contPage--;searchContratos()">Anterior</button>' : '') +
      (data.data.length >= 15 ? '<button class="btn btn-primary btn-sm" onclick="contPage++;searchContratos()">Proxima</button>' : '') +
      '</div></div><div class="table-wrap"><table><thead><tr>' +
      '<th>Orgao</th><th>Fornecedor</th><th>Objeto do Contrato</th><th>Valor Global</th><th>Assinatura</th><th>UF</th><th>Acao</th>' +
      '</tr></thead><tbody>';

    data.data.forEach(c => {
      html += '<tr>' +
        '<td><div style="font-size:12px;font-weight:600">' + (c.orgaoNome||'').substring(0,50) + '</div></td>' +
        '<td><div style="font-size:12px">' + (c.fornecedorNome||'-') + '</div><div style="color:#475569;font-size:11px">' + (c.fornecedorCnpj||'') + '</div></td>' +
        '<td style="max-width:250px"><div class="wrap" style="font-size:12px">' + (c.objetoContrato||'').substring(0,120) + '</div></td>' +
        '<td style="white-space:nowrap;font-size:13px;font-weight:600;color:#22c55e">' + money(c.valorGlobal) + '</td>' +
        '<td style="font-size:12px;white-space:nowrap">' + (c.dataAssinatura||'-') + '</td>' +
        '<td>' + (c.uf||'-') + '</td>' +
        '<td style="white-space:nowrap">' + (c.fornecedorCnpj ? '<button class="btn btn-primary btn-xs" onclick="goCnpj(\\'' + c.fornecedorCnpj + '\\')">Ver Email</button> <button class="btn-add" onclick="addContractLead(\\'' + (c.fornecedorCnpj||'') + '\\',\\'' + (c.fornecedorNome||'').replace(/'/g,'') + '\\',' + (c.valorGlobal||0) + ',\\'' + (c.uf||'') + '\\',this)" title="Adicionar aos Leads">+</button>' : '-') + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div></div>';
    results.innerHTML = html;
  } catch(e) {
    loading.classList.remove('show');
    showToast(e.message, true);
  }
}

async function addContractLead(cnpj, nome, valor, uf, btnEl) {
  cnpj = cnpj.replace(/\\D/g, '');
  if (leads.some(l => l.cnpj === cnpj)) {
    showToast('CNPJ ' + cnpj + ' ja esta nos Meus Leads', false, true);
    return;
  }
  // Lookup CNPJ to get email
  try {
    if (btnEl) { btnEl.textContent = '...'; btnEl.disabled = true; }
    const data = await apiFetch('/api/fornecedores/' + cnpj);
    const f = data.data;
    const ok = addLead({
      cnpj: cnpj, razaoSocial: f.razaoSocial || nome, nomeFantasia: f.nomeFantasia,
      email: f.email, telefones: f.telefones, municipio: f.municipio,
      uf: f.uf || uf, origem: 'contratos', valorHomologado: valor
    });
    if (ok && btnEl) { btnEl.textContent = '\\u2713'; btnEl.classList.add('added'); }
    else if (btnEl) { btnEl.textContent = '+'; btnEl.disabled = false; }
  } catch(e) {
    // Add without email
    addLead({ cnpj, razaoSocial: nome, uf, origem: 'contratos', valorHomologado: valor });
    if (btnEl) { btnEl.textContent = '\\u2713'; btnEl.classList.add('added'); }
  }
}

function goCnpj(cnpj) {
  switchTab('cnpj');
  document.getElementById('cnpj-input').value = cnpj;
  lookupCnpj();
}

// ============ CNPJ LOOKUP ============
async function lookupCnpj() {
  const cnpj = document.getElementById('cnpj-input').value.replace(/\\D/g,'');
  if (!cnpj || cnpj.length < 11) return showToast('Informe um CNPJ valido (14 digitos)', true);

  const loading = document.getElementById('cnpj-loading');
  const results = document.getElementById('cnpj-results');
  loading.classList.add('show'); results.innerHTML = '';

  try {
    const data = await apiFetch('/api/fornecedores/' + cnpj);
    loading.classList.remove('show');
    const f = data.data;
    const isInLeads = leads.some(l => l.cnpj === cnpj);

    results.innerHTML = '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px">' +
        '<div><h4 style="font-size:18px">' + (f.razaoSocial||'Sem nome') + '</h4>' +
        (f.nomeFantasia ? '<div style="color:#64748b;font-size:13px;margin-top:2px">' + f.nomeFantasia + '</div>' : '') + '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          (f.email ? '<span class="badge badge-green" style="font-size:13px;padding:5px 14px">Email encontrado</span>' : '<span class="badge badge-red" style="font-size:13px;padding:5px 14px">Sem email</span>') +
          '<button class="btn btn-green btn-sm" onclick="addLead({cnpj:\\''+cnpj+'\\',razaoSocial:\\''+(f.razaoSocial||'').replace(/'/g,'')+'\\',nomeFantasia:\\''+(f.nomeFantasia||'').replace(/'/g,'')+'\\',email:\\''+(f.email||'')+'\\',telefones:\\''+(f.telefones||'')+'\\',municipio:\\''+(f.municipio||'')+'\\',uf:\\''+(f.uf||'')+'\\',origem:\\'cnpj\\'})">' + (isInLeads ? 'Ja nos Leads' : 'Adicionar aos Leads') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="info-grid" style="margin-top:16px">' +
        '<div class="item"><label>CNPJ</label><span style="font-size:15px;font-weight:600">' + f.cnpj + '</span></div>' +
        '<div class="item"><label>Email</label><span>' + (f.email ? '<a class="email-link" href="mailto:' + f.email + '" style="font-size:16px;font-weight:700;color:#22c55e">' + f.email + '</a>' : 'Nao cadastrado na Receita Federal') + '</span></div>' +
        '<div class="item"><label>Telefone</label><span>' + (f.telefones||'Nao informado') + '</span></div>' +
        '<div class="item"><label>Endereco</label><span>' + (f.logradouro||'-') + '</span></div>' +
        '<div class="item"><label>Cidade/UF</label><span>' + (f.municipio||'') + (f.uf ? '/' + f.uf : '') + '</span></div>' +
        '<div class="item"><label>CEP</label><span>' + (f.cep||'-') + '</span></div>' +
        '<div class="item"><label>Atividade Principal</label><span>' + (f.cnaePrincipal||'-') + '</span></div>' +
        '<div class="item"><label>Situacao Cadastral</label><span>' + (f.situacaoCadastral||'-') + '</span></div>' +
        '<div class="item"><label>Fonte do Email</label><span><span class="badge ' + (f.emailSource === 'not_found' || f.emailSource === 'lookup_failed' ? 'badge-gray' : 'badge-blue') + '">' + (f.emailSource||'-') + '</span></span></div>' +
      '</div>' +
    '</div>';
  } catch(e) {
    loading.classList.remove('show');
    showToast(e.message, true);
  }
}

// ============ INIT ============
// Enter key support
document.getElementById('be-q').addEventListener('keydown', e => { if(e.key==='Enter') buscaEmails(); });
document.getElementById('lic-q').addEventListener('keydown', e => { if(e.key==='Enter'){licPage=1;searchLicitacoes();} });
document.getElementById('cnpj-input').addEventListener('keydown', e => { if(e.key==='Enter') lookupCnpj(); });

// Escape to close modal
document.addEventListener('keydown', e => { if(e.key==='Escape') closeLicModal(); });

// Auto-load licitacoes when tab is clicked
let licLoaded = false;
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'licitacoes' && !licLoaded) {
      licLoaded = true;
      licPage = 1;
      searchLicitacoes();
    }
  });
});

// Load leads from localStorage on startup
loadLeads();
</script>
</body>
</html>`;

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8");
    return HTML;
  });
}

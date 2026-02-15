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

    .app-layout { min-height: 100vh; }
    .sidebar { background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border-right: 1px solid #334155; display: flex; flex-direction: column; position: fixed; left: 0; top: 0; bottom: 0; width: 260px; z-index: 100; overflow-y: auto; }
    .sidebar-logo { padding: 24px 20px 20px; border-bottom: 1px solid #334155; }
    .sidebar-logo h1 { font-size: 22px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 8px; }
    .sidebar-logo h1 span { background: #22c55e; color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
    .sidebar-logo p { color: #475569; font-size: 11px; margin-top: 4px; }
    .sidebar-nav { flex: 1; padding: 12px 8px; }
    .sidebar-section { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; padding: 16px 12px 6px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; color: #94a3b8; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; margin-bottom: 2px; border: none; background: transparent; width: 100%; text-align: left; }
    .nav-item:hover { color: #e2e8f0; background: #334155; }
    .nav-item.active { background: #3b82f6; color: #fff; font-weight: 600; }
    .nav-item.active-green { background: #22c55e; color: #fff; font-weight: 600; }
    .nav-item.active-purple { background: #8b5cf6; color: #fff; font-weight: 600; }
    .nav-item.active-amber { background: #f59e0b; color: #000; font-weight: 600; }
    .nav-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
    .nav-badge { margin-left: auto; background: rgba(255,255,255,0.15); color: #fff; font-size: 10px; padding: 1px 7px; border-radius: 99px; font-weight: 700; }
    .sidebar-footer { padding: 12px 20px; border-top: 1px solid #334155; font-size: 11px; color: #475569; }
    .main-content { margin-left: 260px; padding: 24px 32px; min-height: 100vh; max-width: 1460px; }
    .mobile-header { display: none; position: fixed; top: 0; left: 0; right: 0; background: #1e293b; padding: 12px 16px; z-index: 200; border-bottom: 1px solid #334155; align-items: center; justify-content: space-between; }
    .hamburger { background: none; border: none; color: #e2e8f0; font-size: 24px; cursor: pointer; padding: 4px; }
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }

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
    .badge-orange { background: #2a1600; color: #f97316; }
    .badge-cat { cursor: pointer; border: none; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 99px; display: inline-block; }
    .badge-cat:hover { opacity: 0.8; }
    .filter-btn { padding: 6px 14px; border-radius: 8px; border: 1px solid #334155; background: transparent; color: #94a3b8; font-size: 12px; cursor: pointer; font-weight: 500; }
    .filter-btn:hover { background: #334155; color: #e2e8f0; }
    .filter-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    .filter-btn.active-green { background: #22c55e; color: #fff; border-color: #22c55e; }
    .filter-btn.active-yellow { background: #eab308; color: #000; border-color: #eab308; }
    .filter-btn.active-orange { background: #f97316; color: #fff; border-color: #f97316; }

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

    @media (max-width: 768px) {
      .app-layout { }
      .sidebar { transform: translateX(-100%); transition: transform 0.3s; }
      .sidebar.open { transform: translateX(0); }
      .sidebar-overlay.show { display: block; }
      .mobile-header { display: flex; }
      .main-content { margin-left: 0; padding: 72px 16px 24px; }
    }
    @media (max-width: 640px) {
      .form-row { flex-direction: column; }
      .form-group { min-width: 100%; }
      .stats { flex-direction: column; }
      .modal-content { padding: 20px; }
    }

    /* Template Editor - Split Pane */
    .tpl-editor-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border: 1px solid #334155;
      border-radius: 10px;
      overflow: hidden;
      margin-top: 12px;
      min-height: 500px;
    }
    .tpl-editor-pane {
      display: flex;
      flex-direction: column;
    }
    .tpl-editor-pane-header {
      background: #162032;
      padding: 8px 14px;
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .tpl-toolbar {
      display: flex;
      gap: 4px;
      padding: 8px 10px;
      background: #1a2236;
      border-bottom: 1px solid #334155;
      flex-wrap: wrap;
      align-items: center;
    }
    .tpl-toolbar-btn {
      background: #334155;
      border: none;
      color: #94a3b8;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.15s;
    }
    .tpl-toolbar-btn:hover {
      background: #475569;
      color: #e2e8f0;
    }
    .tpl-toolbar-sep {
      width: 1px;
      height: 20px;
      background: #475569;
      margin: 0 4px;
    }
    .tpl-code-area {
      flex: 1;
      width: 100%;
      background: #0f172a;
      color: #e2e8f0;
      border: none;
      padding: 14px;
      font-size: 13px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      resize: none;
      outline: none;
      line-height: 1.6;
      tab-size: 2;
    }
    .tpl-preview-frame {
      flex: 1;
      border: none;
      background: #fff;
      width: 100%;
    }
    .tpl-starter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      margin: 12px 0;
    }
    .tpl-starter-card {
      background: #162032;
      border: 2px solid #334155;
      border-radius: 10px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    }
    .tpl-starter-card:hover {
      border-color: #3b82f6;
      background: #1a2744;
    }
    .tpl-starter-card.selected {
      border-color: #22c55e;
      background: #0a2a1a;
    }
    .tpl-starter-card h5 {
      color: #f8fafc;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .tpl-starter-card p {
      color: #64748b;
      font-size: 11px;
      margin: 0;
    }
    .tpl-var-dropdown {
      position: relative;
      display: inline-block;
    }
    .tpl-var-menu {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      background: #1e293b;
      border: 1px solid #475569;
      border-radius: 8px;
      z-index: 50;
      min-width: 200px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      padding: 4px;
    }
    .tpl-var-menu.show { display: block; }
    .tpl-var-item {
      display: block;
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      color: #e2e8f0;
      padding: 8px 12px;
      font-size: 12px;
      cursor: pointer;
      border-radius: 4px;
    }
    .tpl-var-item:hover { background: #334155; }
    .tpl-var-item code {
      color: #22c55e;
      font-weight: 700;
      margin-right: 8px;
    }
    @media (max-width: 900px) {
      .tpl-editor-layout { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="mobile-header">
    <button class="hamburger" onclick="toggleSidebar()">&#9776;</button>
    <span style="font-weight:700;font-size:16px;color:#f8fafc">Procura</span>
    <span></span>
  </div>
  <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>

  <div class="app-layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <h1>Procura <span>v3.1</span></h1>
        <p>Licitacoes + Emails + Automacao</p>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-section">Prospectar</div>
        <button class="nav-item active-green" data-tab="emails" data-active-class="active-green" onclick="switchTab('emails')"><span class="nav-icon">&#128269;</span> Busca de Emails</button>
        <button class="nav-item" data-tab="leads" data-active-class="active-green" onclick="switchTab('leads')"><span class="nav-icon">&#128101;</span> Meus Leads <span class="nav-badge" id="leads-count">0</span></button>

        <div class="sidebar-section">Dados PNCP</div>
        <button class="nav-item" data-tab="licitacoes" data-active-class="active" onclick="switchTab('licitacoes')"><span class="nav-icon">&#128203;</span> Licitacoes</button>
        <button class="nav-item" data-tab="fornecedores" data-active-class="active" onclick="switchTab('fornecedores')"><span class="nav-icon">&#127970;</span> Fornecedores</button>
        <button class="nav-item" data-tab="contratos" data-active-class="active" onclick="switchTab('contratos')"><span class="nav-icon">&#128196;</span> Contratos</button>
        <button class="nav-item" data-tab="cnpj" data-active-class="active" onclick="switchTab('cnpj')"><span class="nav-icon">&#128270;</span> Consulta CNPJ</button>

        <div class="sidebar-section">Comunicacao</div>
        <button class="nav-item" data-tab="email" data-active-class="active-purple" onclick="switchTab('email')"><span class="nav-icon">&#9993;</span> Email</button>
        <button class="nav-item" data-tab="automacao" data-active-class="active-amber" onclick="switchTab('automacao')"><span class="nav-icon">&#9889;</span> Automacao</button>
      </nav>
      <div class="sidebar-footer">v3.1 — Dados do PNCP</div>
    </aside>
    <main class="main-content">

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
        <strong>Meus Leads:</strong> Aqui ficam os fornecedores que voce selecionou das buscas. Use o botao "+" nas abas de Busca de Emails, Fornecedores e Contratos para adicionar empresas aqui. Os dados ficam salvos no banco de dados e acessiveis de qualquer dispositivo. CNPJs ou emails duplicados nao sao adicionados.
      </div>

      <div id="leads-stats" class="stats"></div>
      <div class="actions-bar" id="leads-actions">
        <button class="filter-btn active" id="filter-todos" onclick="filterLeads('todos')">Todos</button>
        <button class="filter-btn" id="filter-empresa" onclick="filterLeads('empresa')">Empresas</button>
        <button class="filter-btn" id="filter-contabilidade" onclick="filterLeads('contabilidade')">Contabilidades</button>
        <span style="border-left:1px solid #334155;height:24px;margin:0 4px"></span>
        <input type="text" id="leads-cnae-filter" placeholder="Filtrar por CNAE / Atividade..." oninput="leadPage=1;renderLeads()" style="padding:6px 12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:12px;width:200px">
        <select id="leads-uf-filter" onchange="leadPage=1;renderLeads()" style="padding:6px 10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:12px"><option value="all">Todos UFs</option><option value="AC">AC</option><option value="AL">AL</option><option value="AM">AM</option><option value="AP">AP</option><option value="BA">BA</option><option value="CE">CE</option><option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option><option value="MA">MA</option><option value="MG">MG</option><option value="MS">MS</option><option value="MT">MT</option><option value="PA">PA</option><option value="PB">PB</option><option value="PE">PE</option><option value="PI">PI</option><option value="PR">PR</option><option value="RJ">RJ</option><option value="RN">RN</option><option value="RO">RO</option><option value="RR">RR</option><option value="RS">RS</option><option value="SC">SC</option><option value="SE">SE</option><option value="SP">SP</option><option value="TO">TO</option></select>
        <span style="border-left:1px solid #334155;height:24px;margin:0 4px"></span>
        <button class="btn btn-green btn-sm" onclick="copyLeadEmails()">Copiar Emails</button>
        <button class="btn btn-primary btn-sm" onclick="exportLeadsCSV()">Exportar CSV</button>
        <button class="btn btn-sm" style="background:#8b5cf6;color:#fff" onclick="reclassifyLeads()">Reclassificar</button>
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
    <!-- ============ EMAIL (RESEND) ============ -->
    <div class="panel" id="panel-email">
      <div class="info-box" id="email-status-box">
        <strong>Email:</strong> Envie emails diretamente da plataforma via Resend. Crie templates com variaveis como {empresa}, {cnpj}, {valor} e envie em lote para seus leads filtrados por categoria.
      </div>

      <div id="email-config-section" class="card" style="display:none">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <h4 style="color:#22c55e">Resend Configurado</h4>
            <div id="email-from" style="color:#64748b;font-size:13px"></div>
            <div id="email-quota" style="color:#94a3b8;font-size:12px;margin-top:4px"></div>
          </div>
          <span class="badge badge-green">Ativo</span>
        </div>
      </div>

      <div id="email-not-configured" class="info-box warn" style="display:none">
        <strong>Email nao configurado.</strong> Adicione RESEND_API_KEY nas variaveis de ambiente para habilitar o envio de emails.
      </div>

      <div class="search-box" style="margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h2>Templates de Email</h2>
          <button class="btn btn-green btn-sm" onclick="showTemplateForm()">Novo Template</button>
        </div>

        <div id="email-template-form" style="display:none;margin-bottom:16px;padding:16px;background:#0f172a;border-radius:10px;border:1px solid #334155">
          <input type="hidden" id="tpl-edit-id" value="">

          <div id="tpl-starter-section">
            <div style="font-size:13px;color:#94a3b8;margin-bottom:8px">Comece com um template profissional ou inicie do zero:</div>
            <div class="tpl-starter-grid">
              <div class="tpl-starter-card" onclick="selectStarter('blank')"><h5>Em Branco</h5><p>Comece do zero</p></div>
              <div class="tpl-starter-card" onclick="selectStarter('professional')"><h5>Profissional</h5><p>Layout corporativo clean</p></div>
              <div class="tpl-starter-card" onclick="selectStarter('modern')"><h5>Moderno</h5><p>Design com gradiente e CTA</p></div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:2"><label>Nome do Template</label><input type="text" id="tpl-name" placeholder="Ex: Proposta para empresas"></div>
            <div class="form-group" style="flex:1"><label>Categoria Alvo</label><select id="tpl-category" style="padding:10px 14px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px"><option value="">Todos</option><option value="empresa">Empresa</option><option value="contabilidade">Contabilidade</option></select></div>
          </div>
          <div class="form-group" style="margin-top:12px"><label>Assunto</label><input type="text" id="tpl-subject" placeholder="Ex: Proposta de parceria - {empresa}"></div>

          <div class="tpl-editor-layout">
            <div class="tpl-editor-pane" style="border-right:1px solid #334155">
              <div class="tpl-editor-pane-header"><span>Codigo HTML</span></div>
              <div class="tpl-toolbar">
                <button class="tpl-toolbar-btn" onclick="tplInsertTag('b')" title="Negrito"><b>B</b></button>
                <button class="tpl-toolbar-btn" onclick="tplInsertTag('i')" title="Italico"><i>I</i></button>
                <button class="tpl-toolbar-btn" onclick="tplInsertTag('u')" title="Sublinhado"><u>U</u></button>
                <div class="tpl-toolbar-sep"></div>
                <button class="tpl-toolbar-btn" onclick="tplInsertTag('h2')" title="Titulo">H</button>
                <button class="tpl-toolbar-btn" onclick="tplInsertLink()" title="Link">Link</button>
                <button class="tpl-toolbar-btn" onclick="tplInsertImage()" title="Imagem">Img</button>
                <div class="tpl-toolbar-sep"></div>
                <div class="tpl-var-dropdown">
                  <button class="tpl-toolbar-btn" onclick="toggleVarMenu()" style="background:#0a2a1a;color:#22c55e">{var}</button>
                  <div class="tpl-var-menu" id="tpl-var-menu">
                    <button class="tpl-var-item" onclick="tplInsertVar('empresa')"><code>{empresa}</code> Razao Social</button>
                    <button class="tpl-var-item" onclick="tplInsertVar('cnpj')"><code>{cnpj}</code> CNPJ</button>
                    <button class="tpl-var-item" onclick="tplInsertVar('contato')"><code>{contato}</code> Nome Contato</button>
                    <button class="tpl-var-item" onclick="tplInsertVar('email')"><code>{email}</code> Email</button>
                    <button class="tpl-var-item" onclick="tplInsertVar('valor')"><code>{valor}</code> Valor</button>
                    <button class="tpl-var-item" onclick="tplInsertVar('cidade')"><code>{cidade}</code> Cidade</button>
                    <button class="tpl-var-item" onclick="tplInsertVar('uf')"><code>{uf}</code> Estado</button>
                  </div>
                </div>
              </div>
              <textarea id="tpl-body" class="tpl-code-area" oninput="updateTplPreview()" placeholder="Digite ou cole o HTML do email aqui..."></textarea>
            </div>
            <div class="tpl-editor-pane">
              <div class="tpl-editor-pane-header">
                <span>Preview</span>
                <span style="font-size:10px;color:#475569;text-transform:none;font-weight:400">Atualiza em tempo real</span>
              </div>
              <iframe id="tpl-preview-iframe" class="tpl-preview-frame" sandbox="allow-same-origin"></iframe>
            </div>
          </div>

          <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
            <button class="btn btn-green btn-sm" onclick="saveTemplate()">Salvar Template</button>
            <button class="btn btn-sm" style="background:#334155;color:#94a3b8" onclick="hideTemplateForm()">Cancelar</button>
            <span style="flex:1"></span>
            <span style="font-size:11px;color:#475569">Use {empresa}, {cnpj}, {contato}, {valor}, {cidade}, {uf} no corpo e assunto</span>
          </div>
        </div>

        <div id="email-templates-list"></div>
      </div>

      <div class="search-box" style="margin-top:20px" id="email-send-section">
        <h2>Enviar Emails</h2>
        <div class="desc">Selecione um template e filtre os leads por categoria. O sistema envia 1 email por segundo.</div>
        <div class="form-row">
          <div class="form-group">
            <label>Template</label>
            <select id="email-send-template" style="padding:10px 14px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px"></select>
          </div>
          <div class="form-group">
            <label>Filtro de Leads</label>
            <select id="email-send-filter" style="padding:10px 14px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px">
              <option value="todos">Todos com email</option>
              <option value="empresa">Apenas Empresas</option>
              <option value="contabilidade">Apenas Contabilidades</option>
            </select>
          </div>
          <div class="form-group" style="flex:0">
            <label>&nbsp;</label>
            <button class="btn btn-green" id="email-send-btn" onclick="sendEmails()">Enviar</button>
          </div>
        </div>
        <div id="email-send-preview" style="margin-top:12px;font-size:12px;color:#94a3b8"></div>
        <div id="email-send-results" style="margin-top:12px"></div>
      </div>

      <div style="margin-top:20px" id="email-history"></div>
    </div>

    <!-- ============ AUTOMACAO ============ -->
    <div class="panel" id="panel-automacao">
      <div class="info-box" style="border-left-color:#f59e0b">
        <strong>Automacao de Leads:</strong> O sistema busca automaticamente fornecedores em diversas APIs governamentais, extrai os CNPJs, enriquece com email/telefone via consulta CNPJ e salva como leads categorizados por estado e tipo (empresa/contabilidade).
        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
          <div style="background:#1e293b;padding:8px 10px;border-radius:6px;border-left:3px solid #3b82f6">
            <strong style="color:#60a5fa">B-XX: PNCP Licitacoes</strong><br>
            <span style="color:#94a3b8">Busca licitacoes no PNCP (pncp.gov.br/api/search), filtra por estado e resultado, extrai fornecedores vencedores. Roda a cada 6h.</span>
          </div>
          <div style="background:#1e293b;padding:8px 10px;border-radius:6px;border-left:3px solid #3b82f6">
            <strong style="color:#60a5fa">C-XX: PNCP Contratos</strong><br>
            <span style="color:#94a3b8">Busca contratos firmados via API de consulta do PNCP (pncp.gov.br/api/consulta/v1/contratos). Inclui dispensas e inexigibilidades. Roda a cada 8h.</span>
          </div>
          <div style="background:#1e293b;padding:8px 10px;border-radius:6px;border-left:3px solid #22c55e">
            <strong style="color:#4ade80">S-XX: SICAF (Compras.gov)</strong><br>
            <span style="color:#94a3b8">Fornecedores cadastrados no Sistema de Cadastro de Fornecedores (compras.dados.gov.br). Filtra por UF, retorna PJ com CNPJ. Roda a cada 12h.</span>
          </div>
          <div style="background:#1e293b;padding:8px 10px;border-radius:6px;border-left:3px solid #eab308">
            <strong style="color:#facc15">TCE-RJ</strong><br>
            <span style="color:#94a3b8">Contratos do Tribunal de Contas do RJ (dados.tcerj.tc.br/api/v1). Somente estado do Rio de Janeiro.</span>
          </div>
        </div>
        <div style="margin-top:8px;font-size:11px;color:#64748b">
          <strong>Enriquecimento:</strong> CNPJs sao consultados via BrasilAPI, ReceitaWS e CNPJ.ws para obter email, telefone, CNAE e municipio. Leads sao classificados automaticamente como empresa ou contabilidade.
        </div>
      </div>

      <div id="auto-status" class="stats"></div>

      <div class="search-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h2>Jobs de Automacao</h2>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm" style="background:#334155;color:#94a3b8" onclick="showTestEmailModal()">Testar Email</button>
            <button class="btn btn-green btn-sm" onclick="showAutoJobForm()">Novo Job</button>
          </div>
        </div>

        <div id="auto-job-form" style="display:none;margin-bottom:16px;padding:16px;background:#0f172a;border-radius:10px;border:1px solid #334155">
          <input type="hidden" id="auto-edit-id" value="">
          <div class="form-row">
            <div class="form-group" style="flex:2"><label>Nome do Job</label><input type="text" id="auto-name" placeholder="Ex: Busca diaria informatica SP"></div>
            <div class="form-group" style="flex:0.8"><label>Tipo</label><select id="auto-job-type" onchange="toggleAutoJobType()" style="padding:10px 14px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px"><option value="populate_leads">Popular Leads</option><option value="email_send">Enviar Emails</option></select></div>
            <div class="form-group" style="flex:0.8"><label>Intervalo</label><select id="auto-interval" style="padding:10px 14px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px"><option value="6">A cada 6h</option><option value="12">A cada 12h</option><option value="24">A cada 24h</option><option value="48">A cada 2 dias</option><option value="72">A cada 3 dias</option><option value="168">Semanal</option></select></div>
          </div>
          <div class="form-row" style="margin-top:12px">
            <div class="form-group" style="flex:2"><label>Palavra-chave de Busca</label><input type="text" id="auto-keyword" placeholder="Ex: informatica, medicamentos..."></div>
            <div class="form-group" style="flex:0.5"><label>Estado (UF)</label><input type="text" id="auto-uf" placeholder="SP" maxlength="2" style="text-transform:uppercase"></div>
            <div class="form-group" style="flex:0.5"><label>Qtd. Licitacoes</label><input type="number" id="auto-qty" value="20" min="3" max="200"></div>
          </div>
          <div class="form-row" style="margin-top:12px">
            <div class="form-group"><label>Filtro CNAE (opcional)</label><input type="text" id="auto-cnae" placeholder="Ex: informatica, alimentacao..."></div>
            <div class="form-group"><label>Fonte de Dados</label><select id="auto-source" style="padding:10px 14px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px"><option value="pncp">PNCP Licitacoes</option><option value="pncp_contratos">PNCP Contratos</option><option value="sicaf">SICAF (Compras.gov)</option><option value="tce_rj">TCE-RJ</option><option value="fornecedores">Fornecedores ja salvos</option></select></div>
          </div>
          <div id="auto-email-fields" class="form-row" style="margin-top:12px;display:none">
            <div class="form-group"><label>Template</label><select id="auto-template" style="padding:10px 14px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px"><option value="">Selecione...</option></select></div>
          </div>
          <div class="form-row" style="margin-top:12px">
            <div class="form-group"><label>Categoria Alvo</label><select id="auto-category" style="padding:10px 14px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px"><option value="all">Todos</option><option value="empresa">Empresas</option><option value="contabilidade">Contabilidades</option></select></div>
            <div class="form-group" style="flex:0.5"><label>Max Leads/Execucao</label><input type="number" id="auto-max" value="50" min="1" max="450"></div>
          </div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn btn-green btn-sm" onclick="saveAutoJob()">Salvar</button>
            <button class="btn btn-green btn-sm" onclick="saveAutoJob(true)">Salvar e Iniciar</button>
            <button class="btn btn-sm" style="background:#334155;color:#94a3b8" onclick="hideAutoJobForm()">Cancelar</button>
          </div>
        </div>

        <div id="auto-jobs-list"></div>
      </div>

      <div id="auto-logs-section" style="display:none;margin-top:20px">
        <div class="search-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h2 id="auto-logs-title">Historico de Execucoes</h2>
            <button class="btn btn-sm" style="background:#334155;color:#94a3b8" onclick="document.getElementById('auto-logs-section').style.display='none'">Fechar</button>
          </div>
          <div id="auto-logs-list"></div>
        </div>
      </div>
    </div>

    </main>
  </div>

  <!-- Modal de Teste de Email -->
  <div class="modal-overlay" id="test-email-modal" onclick="if(event.target===this)closeTestModal()">
    <div class="modal-content" style="max-width:600px">
      <button class="modal-close" onclick="closeTestModal()">&times;</button>
      <div class="modal-title">Testar Envio de Email</div>
      <div class="form-group" style="margin-bottom:12px">
        <label>Template</label>
        <select id="test-template" style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;font-size:14px" onchange="previewTestEmail()"><option value="">Selecione...</option></select>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>Email de Teste</label>
        <input type="email" id="test-email-input" placeholder="seu@email.com" style="width:100%">
      </div>
      <div id="test-preview" style="margin-bottom:12px"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-green btn-sm" onclick="sendTestEmail()">Enviar Teste</button>
        <button class="btn btn-sm" style="background:#334155;color:#94a3b8" onclick="closeTestModal()">Cancelar</button>
      </div>
      <div id="test-result" style="margin-top:12px"></div>
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

// ============ LEADS (banco de dados) ============
let leads = [];
let leadFilter = 'todos';
let leadSort = { col: 'razaoSocial', dir: 'asc' };
let leadPage = 1;
const leadsPerPage = 50;

function autoCategoria(emailCategory, email) {
  if (emailCategory === 'contabilidade') return 'contabilidade';
  if (emailCategory === 'provavel_contabilidade') return 'contabilidade';
  if (emailCategory === 'empresa') return 'empresa';
  if (email) {
    const domain = (email.split('@')[1] || '').toLowerCase();
    const patterns = ['contab', 'assessor', 'escritorio', 'contador', 'fiscal', 'tribut'];
    if (patterns.some(p => domain.includes(p))) return 'contabilidade';
  }
  return 'empresa';
}

async function loadLeads() {
  try {
    leads = await apiFetch('/api/leads');
    updateLeadsBadge();
    if (document.getElementById('panel-leads')?.classList.contains('active')) renderLeads();
  } catch(e) { leads = []; }
}

function updateLeadsBadge() {
  const badge = document.getElementById('leads-count');
  if (badge) badge.textContent = leads.length;
}

async function addLead(data) {
  const cnpj = (data.cnpj || '').replace(/\\D/g, '');
  if (!cnpj) return showToast('CNPJ invalido', true);
  try {
    await apiPost('/api/leads', {
      cnpj,
      razaoSocial: data.razaoSocial || null,
      nomeFantasia: data.nomeFantasia || null,
      email: data.email || null,
      telefones: data.telefones || null,
      municipio: data.municipio || null,
      uf: data.uf || null,
      cnaePrincipal: data.cnaePrincipal || null,
      origem: data.origem || 'manual',
      fonte: data.fonte || null,
      valorHomologado: data.valorHomologado || null,
      categoria: data.categoria || autoCategoria(data.emailCategory, data.email),
    });
    await loadLeads();
    showToast('Adicionado aos Meus Leads!');
    return true;
  } catch(e) {
    if (e.message && e.message.includes('duplicado')) {
      showToast('Lead ja existe nos Meus Leads', false, true);
    } else if (e.message && e.message.includes('ja existe')) {
      showToast(e.message, false, true);
    } else {
      showToast('Erro ao adicionar lead: ' + e.message, true);
    }
    return false;
  }
}

async function removeLead(cnpj) {
  await apiDelete('/api/leads/' + cnpj);
  await loadLeads();
  renderLeads();
}

async function clearLeads() {
  if (!confirm('Tem certeza que deseja limpar todos os leads? Esta acao nao pode ser desfeita.')) return;
  await apiDelete('/api/leads');
  await loadLeads();
  renderLeads();
  showToast('Todos os leads foram removidos');
}

async function reclassifyLeads() {
  if (!confirm('Reclassificar todos os leads? Isso vai analisar email, CNAE e razao social para corrigir categorias.')) return;
  try {
    const res = await apiPost('/api/leads/reclassify', {});
    await loadLeads();
    renderLeads();
    if (res.reclassified > 0) {
      showToast(res.reclassified + ' de ' + res.total + ' leads reclassificados!');
    } else {
      showToast('Nenhum lead precisou ser reclassificado (' + res.total + ' analisados)');
    }
  } catch(e) { showToast('Erro ao reclassificar: ' + e.message, true); }
}

function catBadge(cat) {
  if (cat === 'empresa') return 'badge-green';

  if (cat === 'contabilidade') return 'badge-orange';
  return 'badge-gray';
}
function catLabel(cat) {
  if (cat === 'empresa') return 'Empresa';
  if (cat === 'contabilidade') return 'Contabilidade';
  return 'N/D';
}
function fonteBadge(f) {
  var c = { pncp:'badge-blue', pncp_contratos:'badge-blue', sicaf:'badge-green', tce_rj:'badge-yellow', transparencia:'badge-orange', manual:'badge-gray', fornecedores:'badge-gray' };
  return c[f] || 'badge-gray';
}
function fonteLabel(f) {
  var c = { pncp:'PNCP', pncp_contratos:'PNCP Contratos', sicaf:'SICAF', tce_rj:'TCE-RJ', transparencia:'TransfereGov', manual:'Manual', fornecedores:'Fornecedores' };
  if (c[f]) return c[f];
  if (f && f.startsWith('auto_job_')) return 'PNCP';
  return f || '-';
}
async function toggleCategoria(cnpj) {
  try {
    const res = await fetch('/api/leads/' + cnpj + '/categoria', { method: 'PATCH' });
    const data = await res.json();
    if (data.success) {
      const lead = leads.find(l => l.cnpj === cnpj);
      if (lead) lead.categoria = data.categoria;
      renderLeads();
      updateLeadsBadge();
      showToast('Categoria alterada: ' + catLabel(data.categoria));
    }
  } catch(e) { showToast('Erro ao alterar categoria', true); }
}
function filterLeads(f) {
  leadFilter = f;
  leadPage = 1;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active','active-green','active-yellow','active-orange'));
  const btn = document.getElementById('filter-' + f);
  if (btn) {
    if (f === 'empresa') btn.classList.add('active-green');
    else if (f === 'contabilidade') btn.classList.add('active-orange');
    else btn.classList.add('active');
  }
  renderLeads();
}
function sortLeads(col) {
  if (leadSort.col === col) leadSort.dir = leadSort.dir === 'asc' ? 'desc' : 'asc';
  else { leadSort.col = col; leadSort.dir = 'asc'; }
  leadPage = 1;
  renderLeads();
}
function leadsGoPage(p) { leadPage = p; renderLeads(); }

function renderLeads() {
  const statsEl = document.getElementById('leads-stats');
  const resultsEl = document.getElementById('leads-results');
  const actionsEl = document.getElementById('leads-actions');

  const comEmail = leads.filter(l => l.email).length;
  const empresas = leads.filter(l => l.categoria === 'empresa').length;
  const contabs = leads.filter(l => l.categoria === 'contabilidade').length;

  const emailsSentTotal = leads.reduce(function(s,l){ return s + (Number(l.emailSentCount) || 0); }, 0);
  const leadsEmailed = leads.filter(function(l){ return (Number(l.emailSentCount) || 0) > 0; }).length;

  statsEl.innerHTML =
    '<div class="stat"><div class="stat-value blue">' + leads.length + '</div><div class="stat-label">Total de leads</div></div>' +
    '<div class="stat"><div class="stat-value green">' + comEmail + '</div><div class="stat-label">Com email</div></div>' +
    '<div class="stat"><div class="stat-value" style="color:#22c55e">' + empresas + '</div><div class="stat-label">Empresas</div></div>' +
    '<div class="stat"><div class="stat-value" style="color:#f97316">' + contabs + '</div><div class="stat-label">Contabilidades</div></div>' +
    '<div class="stat"><div class="stat-value" style="color:#8b5cf6">' + emailsSentTotal + '</div><div class="stat-label">Emails enviados</div></div>' +
    '<div class="stat"><div class="stat-value" style="color:#8b5cf6">' + leadsEmailed + '</div><div class="stat-label">Leads contatados</div></div>';

  actionsEl.style.display = leads.length > 0 ? 'flex' : 'none';

  let filtered = leadFilter === 'todos' ? leads.slice() : leads.filter(l => l.categoria === leadFilter);
  const cnaeFilter = (document.getElementById('leads-cnae-filter')?.value || '').toLowerCase().trim();
  if (cnaeFilter) filtered = filtered.filter(l => (l.cnaePrincipal || '').toLowerCase().includes(cnaeFilter));
  const ufFilter = document.getElementById('leads-uf-filter')?.value || 'all';
  if (ufFilter && ufFilter !== 'all') filtered = filtered.filter(l => (l.uf || '').toUpperCase() === ufFilter);

  if (filtered.length === 0) {
    resultsEl.innerHTML = '<div class="results"><div class="empty">' + (leads.length === 0 ? 'Nenhum lead adicionado ainda. Use o botao "+" nas abas de Busca de Emails, Fornecedores ou Contratos.' : 'Nenhum lead neste filtro.') + '</div></div>';
    return;
  }

  // Sorting
  const sc = leadSort.col;
  const sd = leadSort.dir === 'asc' ? 1 : -1;
  filtered.sort(function(a, b) {
    let va, vb;
    if (sc === 'valor') { va = Number(a.valorHomologado) || 0; vb = Number(b.valorHomologado) || 0; return (va - vb) * sd; }
    if (sc === 'razaoSocial') { va = (a.razaoSocial || '').toLowerCase(); vb = (b.razaoSocial || '').toLowerCase(); }
    else if (sc === 'email') { va = (a.email || '').toLowerCase(); vb = (b.email || '').toLowerCase(); }
    else if (sc === 'categoria') { va = a.categoria || ''; vb = b.categoria || ''; }
    else if (sc === 'cnae') { va = (a.cnaePrincipal || '').toLowerCase(); vb = (b.cnaePrincipal || '').toLowerCase(); }
    else if (sc === 'cidade') { va = ((a.municipio || '') + (a.uf || '')).toLowerCase(); vb = ((b.municipio || '') + (b.uf || '')).toLowerCase(); }
    else if (sc === 'fonte') { va = (a.fonte || a.origem || '').toLowerCase(); vb = (b.fonte || b.origem || '').toLowerCase(); }
    else if (sc === 'telefone') { va = (a.telefones || '').toLowerCase(); vb = (b.telefones || '').toLowerCase(); }
    else if (sc === 'enviado') { va = Number(a.emailSentCount) || 0; vb = Number(b.emailSentCount) || 0; return (va - vb) * sd; }
    else { va = (a.razaoSocial || '').toLowerCase(); vb = (b.razaoSocial || '').toLowerCase(); }
    if (va < vb) return -1 * sd;
    if (va > vb) return 1 * sd;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / leadsPerPage);
  if (leadPage > totalPages) leadPage = totalPages;
  if (leadPage < 1) leadPage = 1;
  const startIdx = (leadPage - 1) * leadsPerPage;
  const pageItems = filtered.slice(startIdx, startIdx + leadsPerPage);

  function sortIcon(col) {
    if (leadSort.col !== col) return ' <span style="color:#475569;font-size:10px">\\u2195</span>';
    return leadSort.dir === 'asc' ? ' <span style="color:#3b82f6">\\u2191</span>' : ' <span style="color:#3b82f6">\\u2193</span>';
  }

  let html = '<div class="results"><div class="results-header"><h3>' + (leadFilter === 'todos' ? 'Todos os Leads' : catLabel(leadFilter)) + ' (' + filtered.length + ')</h3>' +
    '<div style="font-size:12px;color:#64748b">Pagina ' + leadPage + ' de ' + totalPages + ' | Mostrando ' + (startIdx + 1) + '-' + Math.min(startIdx + leadsPerPage, filtered.length) + ' de ' + filtered.length + '</div>' +
    '</div><div class="table-wrap"><table><thead><tr>' +
    '<th style="cursor:pointer;user-select:none" onclick="sortLeads(\\'razaoSocial\\')">Empresa' + sortIcon('razaoSocial') + '</th>' +
    '<th style="cursor:pointer;user-select:none" onclick="sortLeads(\\'email\\')">Email' + sortIcon('email') + '</th>' +
    '<th style="cursor:pointer;user-select:none" onclick="sortLeads(\\'categoria\\')">Categoria' + sortIcon('categoria') + '</th>' +
    '<th style="cursor:pointer;user-select:none" onclick="sortLeads(\\'cnae\\')">Atividade (CNAE)' + sortIcon('cnae') + '</th>' +
    '<th style="cursor:pointer;user-select:none" onclick="sortLeads(\\'cidade\\')">Cidade/UF' + sortIcon('cidade') + '</th>' +
    '<th style="cursor:pointer;user-select:none" onclick="sortLeads(\\'telefone\\')">Telefone' + sortIcon('telefone') + '</th>' +
    '<th style="cursor:pointer;user-select:none" onclick="sortLeads(\\'fonte\\')">Fonte' + sortIcon('fonte') + '</th>' +
    '<th style="cursor:pointer;user-select:none" onclick="sortLeads(\\'valor\\')">Valor' + sortIcon('valor') + '</th>' +
    '<th style="cursor:pointer;user-select:none" onclick="sortLeads(\\'enviado\\')">Enviado' + sortIcon('enviado') + '</th>' +
    '<th></th>' +
    '</tr></thead><tbody>';

  pageItems.forEach(l => {
    const cnaeShort = (l.cnaePrincipal || '-').length > 40 ? (l.cnaePrincipal || '').substring(0,37) + '...' : (l.cnaePrincipal || '-');
    html += '<tr>' +
      '<td><div style="font-weight:600;font-size:12px">' + (l.razaoSocial || 'Sem nome') + '</div><div style="color:#475569;font-size:11px">' + l.cnpj + '</div></td>' +
      '<td>' + (l.email ? '<a class="email-link" href="mailto:' + l.email + '">' + l.email + '</a>' : '<span class="badge badge-red">Sem email</span>') + '</td>' +
      '<td><button class="badge-cat badge ' + catBadge(l.categoria) + '" onclick="toggleCategoria(\\''+l.cnpj+'\\');event.stopPropagation()" title="Clique para alterar">' + catLabel(l.categoria) + '</button></td>' +
      '<td style="font-size:11px;color:#94a3b8;max-width:180px" title="' + (l.cnaePrincipal||'').replace(/"/g,'') + '">' + cnaeShort + '</td>' +
      '<td style="font-size:12px">' + (l.municipio || '') + (l.uf ? '/' + l.uf : '') + '</td>' +
      '<td style="font-size:12px;color:#94a3b8">' + (l.telefones || '-') + '</td>' +
      '<td><span class="badge ' + fonteBadge(l.fonte || l.origem) + '">' + fonteLabel(l.fonte || l.origem || '-') + '</span></td>' +
      '<td style="font-size:12px;color:#22c55e;font-weight:600">' + money(l.valorHomologado) + '</td>' +
      '<td>' + ((Number(l.emailSentCount)||0) > 0 ? '<span class="badge badge-green">' + l.emailSentCount + 'x</span>' : '<span class="badge badge-gray">N/A</span>') + '</td>' +
      '<td><button class="btn btn-xs btn-red" onclick="removeLead(\\''+l.cnpj+'\\')">X</button></td>' +
      '</tr>';
  });

  html += '</tbody></table></div>';

  // Pagination controls
  if (totalPages > 1) {
    html += '<div style="display:flex;justify-content:center;align-items:center;gap:6px;padding:12px;border-top:1px solid #334155">';
    html += '<button class="btn btn-xs" style="background:#334155;color:' + (leadPage > 1 ? '#e2e8f0' : '#475569') + '" ' + (leadPage > 1 ? 'onclick="leadsGoPage(1)"' : 'disabled') + '>&laquo;</button>';
    html += '<button class="btn btn-xs" style="background:#334155;color:' + (leadPage > 1 ? '#e2e8f0' : '#475569') + '" ' + (leadPage > 1 ? 'onclick="leadsGoPage(' + (leadPage - 1) + ')"' : 'disabled') + '>&lsaquo;</button>';
    var startP = Math.max(1, leadPage - 3);
    var endP = Math.min(totalPages, leadPage + 3);
    for (var p = startP; p <= endP; p++) {
      html += '<button class="btn btn-xs" style="background:' + (p === leadPage ? '#3b82f6' : '#334155') + ';color:#fff;min-width:32px" ' + (p !== leadPage ? 'onclick="leadsGoPage(' + p + ')"' : '') + '>' + p + '</button>';
    }
    html += '<button class="btn btn-xs" style="background:#334155;color:' + (leadPage < totalPages ? '#e2e8f0' : '#475569') + '" ' + (leadPage < totalPages ? 'onclick="leadsGoPage(' + (leadPage + 1) + ')"' : 'disabled') + '>&rsaquo;</button>';
    html += '<button class="btn btn-xs" style="background:#334155;color:' + (leadPage < totalPages ? '#e2e8f0' : '#475569') + '" ' + (leadPage < totalPages ? 'onclick="leadsGoPage(' + totalPages + ')"' : 'disabled') + '>&raquo;</button>';
    html += '</div>';
  }

  html += '</div>';
  resultsEl.innerHTML = html;
}

function getFilteredLeads() {
  var f = leadFilter === 'todos' ? leads.slice() : leads.filter(l => l.categoria === leadFilter);
  var ufF = document.getElementById('leads-uf-filter')?.value || 'all';
  if (ufF && ufF !== 'all') f = f.filter(l => (l.uf || '').toUpperCase() === ufF);
  var cnaeF = (document.getElementById('leads-cnae-filter')?.value || '').toLowerCase().trim();
  if (cnaeF) f = f.filter(l => (l.cnaePrincipal || '').toLowerCase().includes(cnaeF));
  return f;
}

function copyLeadEmails() {
  const source = getFilteredLeads();
  const emails = source.filter(l => l.email).map(l => l.email);
  if (emails.length === 0) return showToast('Nenhum lead com email neste filtro', true);
  navigator.clipboard.writeText(emails.join('\\n')).then(() => showToast(emails.length + ' emails copiados!'));
}

function exportLeadsCSV() {
  const source = getFilteredLeads();
  if (source.length === 0) return showToast('Nenhum lead para exportar', true);
  const header = 'CNPJ,Razao Social,Email,Telefone,Municipio,UF,Atividade (CNAE),Fonte,Categoria,Valor Homologado,Emails Enviados';
  const rows = source.map(l => {
    return [l.cnpj, '"'+(l.razaoSocial||'')+'"', l.email||'', '"'+(l.telefones||'')+'"', '"'+(l.municipio||'')+'"', l.uf||'', '"'+(l.cnaePrincipal||'')+'"', l.fonte||l.origem||'', l.categoria||'', l.valorHomologado||'', l.emailSentCount||0].join(',');
  });
  const csv = header + '\\n' + rows.join('\\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  var ufF = document.getElementById('leads-uf-filter')?.value || 'all';
  a.download = 'procura-leads-' + (ufF !== 'all' ? ufF + '-' : '') + (leadFilter !== 'todos' ? leadFilter + '-' : '') + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  showToast('CSV exportado com ' + source.length + ' leads!');
}

async function addAllLeads(dataArray, origem, fonte) {
  const items = dataArray.map(f => ({
    cnpj: (f.cnpj || '').replace(/\\D/g, ''),
    razaoSocial: f.razaoSocial || null,
    nomeFantasia: f.nomeFantasia || null,
    email: f.email || null,
    telefones: f.telefones || null,
    municipio: f.municipio || null,
    uf: f.uf || null,
    cnaePrincipal: f.cnaePrincipal || null,
    origem: origem,
    fonte: fonte || null,
    valorHomologado: f.valorHomologado || null,
    categoria: autoCategoria(f.emailCategory, f.email),
  })).filter(i => i.cnpj);

  try {
    const res = await apiPost('/api/leads/batch', { leads: items });
    await loadLeads();
    if (res.added > 0) showToast(res.added + ' leads adicionados!' + (res.skipped > 0 ? ' (' + res.skipped + ' duplicados ignorados)' : ''));
    else if (res.skipped > 0) showToast('Todos ' + res.skipped + ' ja estavam nos Meus Leads', false, true);
  } catch(e) { showToast('Erro ao adicionar leads: ' + e.message, true); }
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
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('active','active-green','active-purple','active-amber');
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const nav = document.querySelector('.nav-item[data-tab="' + tabName + '"]');
  if (nav) nav.classList.add(nav.dataset.activeClass || 'active');
  const panel = document.getElementById('panel-' + tabName);
  if (panel) panel.classList.add('active');
  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
  // Lazy-load hooks
  if (tabName === 'leads') renderLeads();
  if (tabName === 'licitacoes' && !licLoaded) { licLoaded = true; licPage = 1; searchLicitacoes(); }
  if (tabName === 'email' && !emailLoaded) { emailLoaded = true; loadEmailStatus(); }
  if (tabName === 'automacao' && !autoLoaded) { autoLoaded = true; loadAutomacao(); }
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}

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
          '<button class="btn btn-primary btn-sm" onclick="addAllLeads(lastBuscaData,\\'busca-emails\\',\\'pncp\\')">Adicionar Todos aos Leads</button></div>' +
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
      '<th>Empresa</th><th>Email</th><th>Atividade</th><th>Cidade/UF</th><th>Valor</th><th>Fonte</th><th></th>' +
      '</tr></thead><tbody>';

    data.data.forEach((f, i) => {
      const isInLeads = leads.some(l => l.cnpj === (f.cnpj||'').replace(/\\D/g,''));
      const cnaeTag = f.cnaePrincipal ? '<span class="badge badge-gray" style="font-size:10px" title="' + (f.cnaePrincipal||'').replace(/"/g,'') + '">' + (f.cnaePrincipal||'').substring(0,25) + '</span>' : '-';
      html += '<tr>' +
        '<td><div style="font-weight:600;font-size:12px">' + (f.razaoSocial||'Sem nome') + '</div><div style="color:#475569;font-size:11px">' + f.cnpj + '</div></td>' +
        '<td>' + (f.email ? '<a class="email-link" href="mailto:' + f.email + '">' + f.email + '</a>' : '<span class="badge badge-red">Nao encontrado</span>') + '</td>' +
        '<td>' + cnaeTag + '</td>' +
        '<td style="font-size:12px">' + (f.municipio||'') + (f.uf ? '/' + f.uf : '') + '</td>' +
        '<td style="font-size:12px;font-weight:600;color:#22c55e">' + money(f.valorHomologado) + '</td>' +
        '<td><span class="badge ' + (f.emailSource === 'not_found' || f.emailSource === 'lookup_failed' ? 'badge-gray' : 'badge-blue') + '">' + f.emailSource + '</span>' +
        (f.emailCategory === 'contabilidade' ? ' <span class="badge badge-orange" title="Contabilidade">CONTAB</span>' : '') + '</td>' +
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

async function addLeadFromBusca(index, btnEl) {
  const f = lastBuscaData[index];
  if (!f) return;
  const ok = await addLead({ ...f, origem: 'busca-emails', fonte: 'pncp' });
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
          '<div class="item"><label>Atividade (CNAE)</label><span style="font-size:12px">' + (f.cnaePrincipal||'-') + '</span></div>' +
          '<div class="item"><label>Valor Homologado</label><span style="color:#22c55e;font-weight:600">' + money(f.valorHomologado) + '</span></div>' +
          '<div class="item"><label>Fonte do Email</label><span><span class="badge badge-blue">' + f.emailSource + '</span>' +
            (f.emailCategory === 'contabilidade' ? ' <span class="badge badge-orange">CONTAB</span>' : '') + '</span></div>' +
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

async function addLeadFromForn(index, btnEl) {
  const f = lastFornData[index];
  if (!f) return;
  const ok = await addLead({ ...f, origem: 'fornecedores', fonte: 'pncp' });
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
    const ok = await addLead({
      cnpj: cnpj, razaoSocial: f.razaoSocial || nome, nomeFantasia: f.nomeFantasia,
      email: f.email, telefones: f.telefones, municipio: f.municipio,
      uf: f.uf || uf, origem: 'contratos', valorHomologado: valor
    });
    if (ok && btnEl) { btnEl.textContent = '\\u2713'; btnEl.classList.add('added'); }
    else if (btnEl) { btnEl.textContent = '+'; btnEl.disabled = false; }
  } catch(e) {
    // Add without email
    await addLead({ cnpj, razaoSocial: nome, uf, origem: 'contratos', valorHomologado: valor });
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

// ============ STARTER TEMPLATES ============
const STARTER_TEMPLATES = {
  blank: '',
  professional: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)"><tr><td style="background:#1e293b;padding:28px 40px"><h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">Alvaro Gonzaga</h1></td></tr><tr><td style="padding:32px 40px"><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 16px">Prezado(a) <strong>{contato}</strong>,</p><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 16px">Gostaríamos de apresentar nossos serviços para a <strong>{empresa}</strong>.</p><p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 24px">Temos ampla experiência no atendimento a empresas de {cidade}/{uf} e gostaríamos de agendar uma conversa para apresentar como podemos ajudar.</p><table cellpadding="0" cellspacing="0"><tr><td style="background:#3b82f6;border-radius:6px;padding:12px 28px"><a href="mailto:{email}" style="color:#ffffff;text-decoration:none;font-weight:700;font-size:14px">Responder Email</a></td></tr></table><p style="color:#64748b;font-size:13px;line-height:1.6;margin:24px 0 0">Atenciosamente,<br><strong>Alvaro Gonzaga</strong></p></td></tr><tr><td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0"><p style="color:#94a3b8;font-size:11px;margin:0;text-align:center">Email enviado para {email} | CNPJ: {cnpj}</p></td></tr></table></td></tr></table></body></html>',
  modern: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#0f172a;font-family:Segoe UI,Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:36px 40px;text-align:center"><h1 style="margin:0;color:#fff;font-size:26px;font-weight:800">Transforme seu Negocio</h1><p style="color:rgba(255,255,255,0.85);font-size:14px;margin:8px 0 0">Solucoes sob medida para {empresa}</p></td></tr><tr><td style="padding:32px 40px"><p style="color:#e2e8f0;font-size:15px;line-height:1.7;margin:0 0 16px">Ola <strong style="color:#fff">{contato}</strong>,</p><p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px">Identificamos que a <strong style="color:#e2e8f0">{empresa}</strong> em {cidade}/{uf} pode se beneficiar dos nossos servicos.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#162032;border-radius:8px;margin:0 0 20px"><tr><td style="padding:20px"><p style="color:#f8fafc;font-size:14px;font-weight:700;margin:0 0 8px">O que oferecemos:</p><p style="color:#94a3b8;font-size:13px;line-height:1.8;margin:0">&#10003; Consultoria especializada<br>&#10003; Atendimento personalizado<br>&#10003; Resultados comprovados</p></td></tr></table><table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td style="background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:8px;padding:14px 32px"><a href="mailto:{email}" style="color:#fff;text-decoration:none;font-weight:700;font-size:14px">Quero Saber Mais</a></td></tr></table></td></tr><tr><td style="padding:20px 40px;border-top:1px solid #334155;text-align:center"><p style="color:#475569;font-size:11px;margin:0">{empresa} | CNPJ: {cnpj} | {cidade}/{uf}</p></td></tr></table></td></tr></table></body></html>'
};

const SAMPLE_VARS = {
  empresa: 'Empresa Teste LTDA',
  cnpj: '12.345.678/0001-90',
  email: 'teste@empresa.com',
  contato: 'Joao da Silva',
  valor: 'R$ 150.000,00',
  cidade: 'Sao Paulo',
  uf: 'SP'
};

function selectStarter(key) {
  document.querySelectorAll('.tpl-starter-card').forEach(c => c.classList.remove('selected'));
  if (event && event.currentTarget) event.currentTarget.classList.add('selected');
  document.getElementById('tpl-body').value = STARTER_TEMPLATES[key] || '';
  updateTplPreview();
}

function updateTplPreview() {
  const body = document.getElementById('tpl-body').value;
  const iframe = document.getElementById('tpl-preview-iframe');
  if (!iframe) return;
  let rendered = body;
  Object.keys(SAMPLE_VARS).forEach(k => {
    rendered = rendered.replace(new RegExp('\\\\{' + k + '\\\\}', 'g'), SAMPLE_VARS[k]);
  });
  if (!rendered.toLowerCase().includes('<html') && !rendered.toLowerCase().includes('<body')) {
    rendered = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:20px;color:#333;line-height:1.6;}</style></head><body>' + rendered + '</body></html>';
  }
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(rendered);
  doc.close();
}

function tplInsertTag(tag) {
  const ta = document.getElementById('tpl-body');
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.substring(start, end);
  const replacement = '<' + tag + '>' + (selected || 'texto') + '</' + tag + '>';
  ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
  ta.selectionStart = start + tag.length + 2;
  ta.selectionEnd = start + tag.length + 2 + (selected || 'texto').length;
  ta.focus();
  updateTplPreview();
}

function tplInsertLink() {
  const url = prompt('URL do link:', 'https://');
  if (!url) return;
  const ta = document.getElementById('tpl-body');
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.substring(start, end) || 'clique aqui';
  const html = '<a href="' + url + '" style="color:#3b82f6;text-decoration:underline">' + selected + '</a>';
  ta.value = ta.value.substring(0, start) + html + ta.value.substring(end);
  ta.focus();
  updateTplPreview();
}

function tplInsertImage() {
  const url = prompt('URL da imagem:', 'https://');
  if (!url) return;
  const width = prompt('Largura da imagem (px ou %):', '100%');
  const ta = document.getElementById('tpl-body');
  const pos = ta.selectionStart;
  const html = '<img src="' + url + '" alt="Imagem" style="max-width:' + (width || '100%') + ';height:auto;display:block;margin:12px 0" />';
  ta.value = ta.value.substring(0, pos) + html + ta.value.substring(pos);
  ta.focus();
  updateTplPreview();
}

function tplInsertVar(varName) {
  const ta = document.getElementById('tpl-body');
  const pos = ta.selectionStart;
  const text = '{' + varName + '}';
  ta.value = ta.value.substring(0, pos) + text + ta.value.substring(pos);
  ta.selectionStart = ta.selectionEnd = pos + text.length;
  ta.focus();
  toggleVarMenu();
  updateTplPreview();
}

function toggleVarMenu() {
  document.getElementById('tpl-var-menu').classList.toggle('show');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.tpl-var-dropdown')) {
    const menu = document.getElementById('tpl-var-menu');
    if (menu) menu.classList.remove('show');
  }
});

// ============ EMAIL (RESEND) ============
let emailConfigured = false;
let emailTemplates = [];
let emailLoaded = false;

async function apiPost(url, body) {
  const res = await fetch(API + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Erro ' + res.status); }
  return res.json();
}
async function apiPut(url, body) {
  const res = await fetch(API + url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Erro ' + res.status); }
  return res.json();
}
async function apiDelete(url) {
  const res = await fetch(API + url, { method: 'DELETE' });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Erro ' + res.status); }
  return res.json();
}

async function loadEmailStatus() {
  try {
    const data = await apiFetch('/api/email/status');
    emailConfigured = data.configured;
    if (!data.configured) {
      document.getElementById('email-not-configured').style.display = 'block';
      document.getElementById('email-config-section').style.display = 'none';
      return;
    }
    document.getElementById('email-not-configured').style.display = 'none';
    document.getElementById('email-config-section').style.display = 'block';
    document.getElementById('email-from').textContent = (data.fromName || 'Procura') + ' <' + (data.fromEmail || '') + '>';
    document.getElementById('email-quota').textContent = (data.todaySent || 0) + ' emails enviados hoje | ' + (data.totalSent || 0) + ' total';
    await loadTemplates();
    updateSendPreview();
  } catch(e) {
    document.getElementById('email-status-box').innerHTML = '<strong>Erro:</strong> ' + e.message;
  }
}

async function loadTemplates() {
  emailTemplates = await apiFetch('/api/email/templates');
  renderTemplatesList();
  updateSendTemplateSelect();
}

function renderTemplatesList() {
  const el = document.getElementById('email-templates-list');
  if (emailTemplates.length === 0) {
    el.innerHTML = '<div style="color:#64748b;font-size:13px;padding:8px">Nenhum template criado ainda.</div>';
    return;
  }
  let html = '';
  emailTemplates.forEach(t => {
    const catText = t.targetCategory ? catLabel(t.targetCategory) : 'Todos';
    html += '<div class="card" style="margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<div><strong style="color:#f8fafc">' + t.name + '</strong> <span class="badge badge-blue" style="font-size:10px">' + catText + '</span>' +
        '<div style="color:#64748b;font-size:12px;margin-top:2px">Assunto: ' + t.subject + '</div></div>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn btn-xs" style="background:#8b5cf6;color:#fff" onclick="quickPreviewTemplate(' + t.id + ')">Preview</button>' +
          '<button class="btn btn-primary btn-xs" onclick="editTemplate(' + t.id + ')">Editar</button>' +
          '<button class="btn btn-red btn-xs" onclick="deleteTemplate(' + t.id + ')">Excluir</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  el.innerHTML = html;
}

function updateSendTemplateSelect() {
  const sel = document.getElementById('email-send-template');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione um template</option>' +
    emailTemplates.map(t => '<option value="' + t.id + '">' + t.name + (t.targetCategory ? ' (' + catLabel(t.targetCategory) + ')' : '') + '</option>').join('');
}

function updateSendPreview() {
  const filter = document.getElementById('email-send-filter')?.value || 'todos';
  const eligible = leads.filter(l => {
    if (!l.email) return false;
    if (filter === 'todos') return true;
    return l.categoria === filter;
  });
  const el = document.getElementById('email-send-preview');
  if (el) el.textContent = eligible.length + ' leads com email serao enviados';
}

function showTemplateForm(id) {
  document.getElementById('email-template-form').style.display = 'block';
  document.getElementById('tpl-edit-id').value = id || '';
  const starterSection = document.getElementById('tpl-starter-section');
  if (id) {
    if (starterSection) starterSection.style.display = 'none';
    const t = emailTemplates.find(x => x.id === id);
    if (t) {
      document.getElementById('tpl-name').value = t.name;
      document.getElementById('tpl-subject').value = t.subject;
      document.getElementById('tpl-body').value = t.body;
      document.getElementById('tpl-category').value = t.targetCategory || '';
    }
  } else {
    if (starterSection) starterSection.style.display = 'block';
    document.querySelectorAll('.tpl-starter-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('tpl-name').value = '';
    document.getElementById('tpl-subject').value = '';
    document.getElementById('tpl-body').value = '';
    document.getElementById('tpl-category').value = '';
  }
  setTimeout(updateTplPreview, 50);
}

function hideTemplateForm() {
  document.getElementById('email-template-form').style.display = 'none';
}

async function quickPreviewTemplate(id) {
  try {
    const data = await apiPost('/api/email/preview-template', { templateId: id });
    const modal = document.getElementById('lic-modal');
    const body = document.getElementById('lic-modal-body');
    body.innerHTML = '<h3 style="color:#f8fafc;margin-bottom:8px">' + (data.templateName || 'Template') + '</h3>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:12px">Assunto: <strong style="color:#e2e8f0">' + (data.subject || '') + '</strong></div>' +
      '<iframe id="quick-preview-frame" style="width:100%;height:500px;border:1px solid #334155;border-radius:8px;background:#fff" sandbox="allow-same-origin"></iframe>';
    modal.classList.add('show');
    setTimeout(() => {
      const f = document.getElementById('quick-preview-frame');
      if (f) {
        const doc = f.contentDocument || f.contentWindow.document;
        doc.open(); doc.write(data.body || ''); doc.close();
      }
    }, 50);
  } catch(e) { showToast('Erro no preview: ' + e.message, true); }
}

async function saveTemplate() {
  const id = document.getElementById('tpl-edit-id').value;
  const name = document.getElementById('tpl-name').value.trim();
  const subject = document.getElementById('tpl-subject').value.trim();
  const body = document.getElementById('tpl-body').value.trim();
  const targetCategory = document.getElementById('tpl-category').value;
  if (!name || !subject || !body) return showToast('Preencha nome, assunto e corpo', true);
  try {
    if (id) {
      await apiPut('/api/email/templates/' + id, { name, subject, body, targetCategory });
      showToast('Template atualizado!');
    } else {
      await apiPost('/api/email/templates', { name, subject, body, targetCategory });
      showToast('Template criado!');
    }
    hideTemplateForm();
    await loadTemplates();
  } catch(e) { showToast(e.message, true); }
}

function editTemplate(id) { showTemplateForm(id); }

async function deleteTemplate(id) {
  if (!confirm('Excluir este template?')) return;
  await apiDelete('/api/email/templates/' + id);
  await loadTemplates();
  showToast('Template excluido');
}

async function sendEmails() {
  if (!emailConfigured) return showToast('Configure o RESEND_API_KEY primeiro', true);
  const templateId = document.getElementById('email-send-template').value;
  if (!templateId) return showToast('Selecione um template', true);
  const filter = document.getElementById('email-send-filter').value;
  const eligible = leads.filter(l => {
    if (!l.email) return false;
    if (filter === 'todos') return true;
    return l.categoria === filter;
  });
  if (eligible.length === 0) return showToast('Nenhum lead com email nesta categoria', true);
  if (!confirm('Enviar email para ' + eligible.length + ' leads?')) return;

  const btn = document.getElementById('email-send-btn');
  btn.disabled = true; btn.textContent = 'Enviando...';

  try {
    const payload = {
      templateId: Number(templateId),
      leads: eligible.map(l => ({
        email: l.email, cnpj: l.cnpj,
        empresa: l.razaoSocial || l.nomeFantasia || '',
        contato: l.razaoSocial || '',
        valor: l.valorHomologado ? money(l.valorHomologado) : '',
        cidade: l.municipio || '', uf: l.uf || ''
      }))
    };
    const data = await apiPost('/api/email/send', payload);
    document.getElementById('email-send-results').innerHTML =
      '<div class="info-box success"><strong>' + data.successCount + '</strong> emails enviados, <strong>' + data.failCount + '</strong> falharam de <strong>' + data.total + '</strong> total</div>';
    await loadEmailStatus();
    await loadLeads();
  } catch(e) {
    showToast('Erro ao enviar: ' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar';
  }
}

// Update preview when filter changes
document.getElementById('email-send-filter')?.addEventListener('change', updateSendPreview);

// ============ AUTOMACAO ============
let autoLoaded = false;
let autoJobs = [];

async function loadAutomacao() {
  try {
    const [statusData, jobsData] = await Promise.all([
      apiFetch('/api/automation/status'),
      apiFetch('/api/automation/jobs')
    ]);
    autoJobs = jobsData;
    const st = document.getElementById('auto-status');
    st.innerHTML =
      '<div class="stat"><div class="stat-value" style="color:#f59e0b">' + statusData.activeJobs + '</div><div class="stat-label">Jobs ativos</div></div>' +
      '<div class="stat"><div class="stat-value blue">' + statusData.totalJobs + '</div><div class="stat-label">Total de jobs</div></div>' +
      '<div class="stat"><div class="stat-value green">' + statusData.emailsToday + '</div><div class="stat-label">Emails hoje</div></div>' +
      '<div class="stat"><div class="stat-value">' + (statusData.nextRun ? timeSince(statusData.nextRun) : 'N/A') + '</div><div class="stat-label">Proxima execucao</div></div>';
    renderAutoJobs();
    // Load email templates for form selects
    if (!emailLoaded) { emailLoaded = true; await loadEmailStatus(); }
    updateAutoFormSelects();
  } catch(e) { showToast('Erro ao carregar automacao: ' + e.message, true); }
}

function updateAutoFormSelects() {
  const tplSel = document.getElementById('auto-template');
  tplSel.innerHTML = '<option value="">Selecione...</option>' +
    emailTemplates.map(t => '<option value="' + t.id + '">' + t.name + '</option>').join('');
}

function renderAutoJobs() {
  const el = document.getElementById('auto-jobs-list');
  if (autoJobs.length === 0) {
    el.innerHTML = '<div style="color:#64748b;font-size:13px;padding:8px">Nenhum job criado ainda.</div>';
    return;
  }
  let html = '';
  autoJobs.forEach(j => {
    const stats = j.lastRunStats ? JSON.parse(j.lastRunStats) : null;
    const statusBadge = j.isActive ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-gray">Pausado</span>';
    const isPopulate = j.jobType === 'populate_leads';
    const typeBadge = isPopulate ? '<span class="badge badge-blue">Popular Leads</span>' : '<span class="badge badge-yellow">Enviar Emails</span>';
    const lastBadge = j.lastRunStatus ? ('<span class="badge ' + (j.lastRunStatus === 'completed' || j.lastRunStatus === 'success' ? 'badge-green' : j.lastRunStatus === 'failed' ? 'badge-red' : 'badge-yellow') + '">' + j.lastRunStatus + '</span>') : '<span class="badge badge-gray">Nunca executado</span>';
    const hours = j.intervalHours || (j.intervalDays ? j.intervalDays * 24 : 24);
    const intervalLabel = hours < 24 ? 'A cada ' + hours + 'h' : hours === 24 ? 'Diario' : 'A cada ' + (hours / 24) + ' dia(s)';
    const statsLabel = isPopulate && stats
      ? ' | Encontrados: ' + (stats.emailsFound||0) + ' | Adicionados: ' + (stats.leadsAdded||stats.emailsSent||0) + ' | Ignorados: ' + (stats.leadsSkipped||stats.emailsSkipped||0)
      : stats
        ? ' | Encontrados: ' + (stats.emailsFound||0) + ' | Enviados: ' + (stats.emailsSent||0) + ' | Falhas: ' + (stats.emailsFailed||0)
        : '';
    html += '<div class="card" style="margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px">' +
        '<div><strong style="color:#f8fafc;font-size:15px">' + j.name + '</strong> ' + statusBadge + ' ' + typeBadge +
        '<div style="color:#64748b;font-size:12px;margin-top:4px">Busca: "' + (j.searchKeyword || '*') + '"' + (j.searchUf ? ' | ' + j.searchUf : '') + ' | ' + j.searchQuantity + ' licit. | ' + intervalLabel + ' | Max ' + j.maxEmailsPerRun + (isPopulate ? ' leads' : ' emails') + '</div>' +
        (j.searchCnae ? '<div style="color:#94a3b8;font-size:11px">CNAE: ' + j.searchCnae + '</div>' : '') +
        '<div style="color:#64748b;font-size:11px;margin-top:2px">Ultima exec: ' + lastBadge + (j.lastRunAt ? ' em ' + new Date(j.lastRunAt).toLocaleString('pt-BR') : '') + statsLabel + '</div>' +
        (j.nextRunAt && j.isActive ? '<div style="color:#f59e0b;font-size:11px">Proxima: ' + new Date(j.nextRunAt).toLocaleString('pt-BR') + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          (j.isActive ? '<button class="btn btn-xs" style="background:#334155;color:#94a3b8" onclick="pauseAutoJob(' + j.id + ')">Pausar</button>' : '<button class="btn btn-xs btn-green" onclick="startAutoJob(' + j.id + ')">Iniciar</button>') +
          '<button class="btn btn-xs" style="background:#f59e0b;color:#000" onclick="runAutoJobNow(' + j.id + ')">Executar Agora</button>' +
          '<button class="btn btn-xs btn-primary" onclick="editAutoJob(' + j.id + ')">Editar</button>' +
          '<button class="btn btn-xs" style="background:#334155;color:#94a3b8" onclick="showAutoLogs(' + j.id + ',\\'' + j.name.replace(/'/g,'') + '\\')">Historico</button>' +
          '<button class="btn btn-xs btn-red" onclick="deleteAutoJob(' + j.id + ')">Excluir</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  el.innerHTML = html;
}

function toggleAutoJobType() {
  const jobType = document.getElementById('auto-job-type').value;
  const emailFields = document.getElementById('auto-email-fields');
  emailFields.style.display = jobType === 'email_send' ? 'flex' : 'none';
}

function showAutoJobForm(id) {
  document.getElementById('auto-job-form').style.display = 'block';
  document.getElementById('auto-edit-id').value = id || '';
  if (id) {
    const j = autoJobs.find(x => x.id === id);
    if (j) {
      document.getElementById('auto-name').value = j.name;
      document.getElementById('auto-job-type').value = j.jobType || 'populate_leads';
      document.getElementById('auto-interval').value = j.intervalHours || (j.intervalDays ? j.intervalDays * 24 : 24);
      document.getElementById('auto-keyword').value = j.searchKeyword || '';
      document.getElementById('auto-uf').value = j.searchUf || '';
      document.getElementById('auto-qty').value = j.searchQuantity;
      document.getElementById('auto-cnae').value = j.searchCnae || '';
      document.getElementById('auto-source').value = j.sourceType || 'pncp';
      document.getElementById('auto-template').value = j.templateId || '';
      document.getElementById('auto-category').value = j.targetCategory || 'all';
      document.getElementById('auto-max').value = j.maxEmailsPerRun;
    }
  } else {
    document.getElementById('auto-name').value = '';
    document.getElementById('auto-job-type').value = 'populate_leads';
    document.getElementById('auto-keyword').value = '';
    document.getElementById('auto-uf').value = '';
    document.getElementById('auto-qty').value = '20';
    document.getElementById('auto-cnae').value = '';
    document.getElementById('auto-source').value = 'pncp';
    document.getElementById('auto-category').value = 'all';
    document.getElementById('auto-max').value = '50';
  }
  updateAutoFormSelects();
  toggleAutoJobType();
}

function hideAutoJobForm() {
  document.getElementById('auto-job-form').style.display = 'none';
}

function editAutoJob(id) { showAutoJobForm(id); }

async function saveAutoJob(startAfter) {
  const id = document.getElementById('auto-edit-id').value;
  const name = document.getElementById('auto-name').value.trim();
  if (!name) return showToast('Informe um nome para o job', true);
  const jobType = document.getElementById('auto-job-type').value;
  const templateId = document.getElementById('auto-template').value;
  if (jobType === 'email_send') {
    if (!templateId) return showToast('Selecione um template', true);
  }

  const body = {
    name,
    jobType,
    searchKeyword: document.getElementById('auto-keyword').value,
    searchUf: document.getElementById('auto-uf').value.toUpperCase() || null,
    searchQuantity: Number(document.getElementById('auto-qty').value) || 20,
    searchCnae: document.getElementById('auto-cnae').value || null,
    sourceType: document.getElementById('auto-source').value,
    templateId: templateId ? Number(templateId) : null,
    targetCategory: document.getElementById('auto-category').value || 'all',
    intervalHours: Number(document.getElementById('auto-interval').value),
    maxEmailsPerRun: Number(document.getElementById('auto-max').value) || 50
  };

  try {
    if (id) {
      await apiPut('/api/automation/jobs/' + id, body);
      showToast('Job atualizado!');
    } else {
      const res = await apiPost('/api/automation/jobs', body);
      if (startAfter && res.id) {
        await apiPost('/api/automation/jobs/' + res.id + '/start', {});
        showToast('Job criado e iniciado!');
      } else {
        showToast('Job criado!');
      }
    }
    hideAutoJobForm();
    await loadAutomacao();
  } catch(e) { showToast(e.message, true); }
}

async function startAutoJob(id) {
  try {
    await apiPost('/api/automation/jobs/' + id + '/start', {});
    showToast('Job iniciado!');
    await loadAutomacao();
  } catch(e) { showToast(e.message, true); }
}

async function pauseAutoJob(id) {
  try {
    await apiPost('/api/automation/jobs/' + id + '/pause', {});
    showToast('Job pausado');
    await loadAutomacao();
  } catch(e) { showToast(e.message, true); }
}

async function runAutoJobNow(id) {
  if (!confirm('Executar este job agora?')) return;
  try {
    await apiPost('/api/automation/jobs/' + id + '/run-now', {});
    showToast('Execucao iniciada! Verifique o historico em alguns instantes.');
    setTimeout(() => loadAutomacao(), 3000);
  } catch(e) { showToast(e.message, true); }
}

async function deleteAutoJob(id) {
  if (!confirm('Excluir este job permanentemente?')) return;
  try {
    await apiDelete('/api/automation/jobs/' + id);
    showToast('Job excluido');
    await loadAutomacao();
  } catch(e) { showToast(e.message, true); }
}

async function showAutoLogs(jobId, jobName) {
  const section = document.getElementById('auto-logs-section');
  const title = document.getElementById('auto-logs-title');
  const list = document.getElementById('auto-logs-list');
  section.style.display = 'block';
  title.textContent = 'Historico: ' + jobName;
  list.innerHTML = '<div class="loading show"><div class="spinner"></div><div class="loading-text">Carregando historico...</div></div>';

  try {
    const logs = await apiFetch('/api/automation/jobs/' + jobId + '/logs');
    if (!logs.length) {
      list.innerHTML = '<div style="color:#64748b;font-size:13px;padding:8px">Nenhuma execucao registrada.</div>';
      return;
    }
    let html = '<div class="table-wrap"><table><thead><tr><th>Data</th><th>Status</th><th>Encontrados</th><th>Enviados</th><th>Falhas</th><th>Ignorados</th><th>Duracao</th></tr></thead><tbody>';
    logs.forEach(l => {
      const dur = l.completedAt && l.startedAt ? Math.round((new Date(l.completedAt) - new Date(l.startedAt)) / 1000) + 's' : '-';
      html += '<tr>' +
        '<td style="font-size:12px;white-space:nowrap">' + new Date(l.startedAt).toLocaleString('pt-BR') + '</td>' +
        '<td><span class="badge ' + (l.status === 'completed' ? 'badge-green' : l.status === 'failed' ? 'badge-red' : 'badge-yellow') + '">' + l.status + '</span>' +
        (l.errorMessage ? '<div style="color:#fca5a5;font-size:11px;margin-top:2px">' + l.errorMessage.substring(0,100) + '</div>' : '') + '</td>' +
        '<td style="text-align:center">' + l.emailsFound + '</td>' +
        '<td style="text-align:center;color:#22c55e;font-weight:600">' + l.emailsSent + '</td>' +
        '<td style="text-align:center;color:#ef4444">' + l.emailsFailed + '</td>' +
        '<td style="text-align:center;color:#64748b">' + l.emailsSkipped + '</td>' +
        '<td style="font-size:12px">' + dur + '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    list.innerHTML = html;
  } catch(e) { list.innerHTML = '<div class="empty">Erro: ' + e.message + '</div>'; }
}

function timeSince(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return 'agora';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return h + 'h ' + m + 'min';
  return m + 'min';
}

// ============ TESTE DE EMAIL ============
function showTestEmailModal() {
  const modal = document.getElementById('test-email-modal');
  modal.classList.add('show');
  const sel = document.getElementById('test-template');
  sel.innerHTML = '<option value="">Selecione...</option>' +
    emailTemplates.map(t => '<option value="' + t.id + '">' + t.name + '</option>').join('');
  document.getElementById('test-email-input').value = '';
  document.getElementById('test-preview').innerHTML = '';
  document.getElementById('test-result').innerHTML = '';
}

function closeTestModal() {
  document.getElementById('test-email-modal').classList.remove('show');
}

async function previewTestEmail() {
  const templateId = document.getElementById('test-template').value;
  if (!templateId) { document.getElementById('test-preview').innerHTML = ''; return; }
  try {
    const data = await apiPost('/api/email/preview-template', { templateId: Number(templateId) });
    document.getElementById('test-preview').innerHTML =
      '<div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;margin-top:8px">' +
      '<div style="font-size:11px;color:#475569;margin-bottom:4px">ASSUNTO:</div>' +
      '<div style="font-size:13px;color:#f8fafc;margin-bottom:8px">' + data.subject + '</div>' +
      '<div style="font-size:11px;color:#475569;margin-bottom:4px">CORPO:</div>' +
      '<div style="font-size:12px;color:#e2e8f0;white-space:pre-wrap;line-height:1.5">' + data.body + '</div></div>';
  } catch(e) { document.getElementById('test-preview').innerHTML = '<div style="color:#fca5a5;font-size:12px">Erro: ' + e.message + '</div>'; }
}

async function sendTestEmail() {
  const templateId = document.getElementById('test-template').value;
  const testEmail = document.getElementById('test-email-input').value.trim();
  if (!templateId) return showToast('Selecione um template', true);
  if (!testEmail) return showToast('Informe um email de teste', true);
  if (!emailConfigured) return showToast('Configure o RESEND_API_KEY primeiro', true);

  const resEl = document.getElementById('test-result');
  resEl.innerHTML = '<div class="loading show" style="padding:8px"><div class="spinner"></div><div class="loading-text">Enviando...</div></div>';

  try {
    const data = await apiPost('/api/email/send-test', {
      templateId: Number(templateId),
      testEmail: testEmail
    });
    resEl.innerHTML = '<div class="info-box success" style="margin:0"><strong>Enviado!</strong> Email de teste enviado para ' + testEmail + '</div>';
  } catch(e) {
    resEl.innerHTML = '<div class="info-box" style="margin:0;border-left-color:#ef4444"><strong>Erro:</strong> ' + e.message + '</div>';
  }
}

// ============ INIT ============
let licLoaded = false;

// Enter key support
document.getElementById('be-q').addEventListener('keydown', e => { if(e.key==='Enter') buscaEmails(); });
document.getElementById('lic-q').addEventListener('keydown', e => { if(e.key==='Enter'){licPage=1;searchLicitacoes();} });
document.getElementById('cnpj-input').addEventListener('keydown', e => { if(e.key==='Enter') lookupCnpj(); });

// Escape to close modals
document.addEventListener('keydown', e => { if(e.key==='Escape') { closeLicModal(); closeTestModal(); } });

// Tab key inserts spaces in template editor
const tplBodyEl = document.getElementById('tpl-body');
if (tplBodyEl) tplBodyEl.addEventListener('keydown', function(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = this.selectionStart;
    const end = this.selectionEnd;
    this.value = this.value.substring(0, start) + '  ' + this.value.substring(end);
    this.selectionStart = this.selectionEnd = start + 2;
    updateTplPreview();
  }
});

// Load leads from database on startup
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

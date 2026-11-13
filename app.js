(function(){
'use strict';
var LOGO = 'logo.png';

var STATUS = [
  ['orcamento','Orçamento','gray'],
  ['novo','Novo','gray'],
  ['aguardando_pagamento','Aguardando pagamento','gold'],
  ['aguardando_arte','Aguardando arte','gold'],
  ['em_producao','Em produção','teal'],
  ['pronto_envio','Pronto para envio','blue'],
  ['enviado','Enviado','blue'],
  ['finalizado','Finalizado','green'],
  ['cancelado','Cancelado','red']
];
var ORIGENS = ['Shopee','WhatsApp','Instagram','Outros'];
var FORMAS = ['Pix','Cartão','Dinheiro','Repasse Shopee','Transferência'];
var CAT_ENTRADA = ['Repasse Shopee','Outras entradas'];
var CAT_SAIDA = ['Materiais','Fornecedores','Embalagens','Frete','Taxas','Retirada dos sócios','Outras despesas'];
var MSG_WPP = {
  orcamento:'Olá! Segue o orçamento do seu pedido na LP Personalizados.',
  novo:'Olá! Recebemos seu pedido na LP Personalizados. Obrigado!',
  aguardando_pagamento:'Olá! Seu pedido está aguardando o pagamento para seguir.',
  aguardando_arte:'Olá! A arte do seu pedido está pronta para sua aprovação.',
  em_producao:'Olá! Seu pedido já está em produção.',
  pronto_envio:'Olá! Seu pedido está pronto!',
  enviado:'Olá! Seu pedido foi enviado.',
  finalizado:'Olá! Obrigado por comprar na LP Personalizados!',
  cancelado:'Olá! Sobre o seu pedido na LP Personalizados:'
};

/* ---------- utilidades ---------- */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var fmtBRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function brl(v){return fmtBRL.format(Number(v)||0);}
var fmtBRL4 = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
function brl4(v){return fmtBRL4.format(Number(v)||0);}
function qtdTxt(v){return String(Math.round(num(v)*100)/100).replace('.',',');}
function pad(n){return (n<10?'0':'')+n;}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function hoje(){return iso(new Date());}
function maisDias(n){var d=new Date();d.setDate(d.getDate()+n);return iso(d);}
function paraData(s){var p=String(s).split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
function difDias(s){if(!s)return null;var a=paraData(s),h=paraData(hoje());return Math.round((a-h)/864e5);}
function dataCurta(s){if(!s)return '—';var p=s.split('-');return p[2]+'/'+p[1];}
function dataLonga(s){if(!s)return '—';var p=s.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
var MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
var DIAS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
function hojeExtenso(){var d=new Date();return DIAS[d.getDay()]+', '+d.getDate()+' de '+MESES[d.getMonth()];}
function num(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));return isNaN(n)?0:n;}
function statusInfo(id){for(var i=0;i<STATUS.length;i++){if(STATUS[i][0]===id)return STATUS[i];}return STATUS[1];}
function chipStatus(id){var s=statusInfo(id);return '<span class="chip '+s[2]+'">'+esc(s[1])+'</span>';}
function aberto(p){return p.status!=='finalizado'&&p.status!=='cancelado'&&p.status!=='orcamento';}
function chipPrazo(p){
  if(!p.prazoProducao) return '';
  if(!aberto(p)) return '<span class="chip gray">'+dataCurta(p.prazoProducao)+'</span>';
  var d=difDias(p.prazoProducao);
  if(d<0) return '<span class="chip red">Atrasado '+(-d)+'d</span>';
  if(d===0) return '<span class="chip red">Hoje</span>';
  if(d===1) return '<span class="chip gold">Amanhã</span>';
  if(d===2) return '<span class="chip gold">'+dataCurta(p.prazoProducao)+'</span>';
  return '<span class="chip gray">'+dataCurta(p.prazoProducao)+'</span>';
}
function numPedido(n){return '#'+String(n).padStart(4,'0');}
function iniciais(nome){return String(nome||'?').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0].toUpperCase();}).join('');}
function ordenarPrazo(a,b){var x=a.prazoProducao||'9999',y=b.prazoProducao||'9999';return x<y?-1:x>y?1:b.num-a.num;}

/* ---------- conexão com o Supabase ---------- */
var CFG=window.LP_CONFIG||{};
var configurado=CFG.url&&CFG.url.indexOf('http')===0&&CFG.chave&&CFG.chave.indexOf('COLE_AQUI')<0;
var sb=configurado&&window.supabase?window.supabase.createClient(CFG.url,CFG.chave):null;

var db={pedidos:[],caixa:[],materiais:[],clientes:[],usos:[],meta:0};
var usuario=null; // {id, nome}
var ocupado=false;

function msgErro(e){
  var m=(e&&(e.message||e.error_description))||String(e||'Erro desconhecido');
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return 'Sem conexão com a internet. Tente de novo.';
  if(/Invalid login credentials/i.test(m))return 'E-mail ou senha incorretos.';
  if(/row-level security/i.test(m))return 'Seu usuário não tem permissão para isso.';
  if(/violates foreign key/i.test(m)&&/caixa/i.test(m))return 'Este pedido tem lançamentos no caixa. Use a situação “Cancelado” em vez de excluir.';
  return m;
}
function checar(r){if(r.error)throw r.error;return r.data;}
function carregandoSim(){if(document.querySelector('.carregando'))return;var d=document.createElement('div');d.className='carregando';d.textContent='Salvando…';document.body.appendChild(d);}
function carregandoNao(){var d=document.querySelectorAll('.carregando');d.forEach(function(x){x.remove();});}
async function executar(fn,sucesso){
  if(ocupado)return false;
  ocupado=true;carregandoSim();
  try{await fn();await recarregar();if(sucesso)aviso(sucesso);return true;}
  catch(e){aviso(msgErro(e));return false;}
  finally{ocupado=false;carregandoNao();}
}

function mapPedido(r){
  return {
    id:r.id,num:r.numero,clienteId:r.cliente_id,cliente:r.cliente_nome,telefone:r.telefone||'',origem:r.origem,numExterno:r.numero_externo||'',
    itens:(r.pedido_itens||[]).slice().sort(function(a,b){return a.ordem-b.ordem;}).map(function(i){return {produto:i.produto,qtd:num(i.quantidade),valor:num(i.valor_unitario),pers:i.personalizacao||''};}),
    frete:num(r.frete),desconto:num(r.desconto),status:r.status,prazoProducao:r.prazo_producao,prazoEntrega:r.prazo_entrega,
    custo:num(r.custo),taxa:num(r.taxa_shopee),obs:r.observacoes||'',transportadora:r.transportadora||'',rastreio:r.rastreio||'',nf:!!r.nf_emitida,
    criado:iso(new Date(r.criado_em)),criadoPor:r.criado_por||'',
    historico:(r.pedido_historico||[]).slice().sort(function(a,b){return a.criado_em<b.criado_em?-1:1;}).map(function(h){return {data:iso(new Date(h.criado_em)),texto:h.texto,usuario:h.usuario||''};})
  };
}
async function recarregar(){
  var res=await Promise.all([
    sb.from('pedidos').select('*, pedido_itens(*), pedido_historico(*)').order('numero',{ascending:false}),
    sb.from('caixa').select('*').order('data',{ascending:false}),
    sb.from('materiais').select('*').order('nome'),
    sb.from('clientes').select('id,nome,telefone').order('nome'),
    sb.from('configuracoes').select('meta_mensal').eq('id',1).maybeSingle(),
    sb.from('movimentos_estoque').select('id,material_id,pedido_id,tipo,quantidade,custo_unitario,criado_em').not('pedido_id','is',null)
  ]);
  db.pedidos=checar(res[0]).map(mapPedido);
  db.caixa=checar(res[1]).map(function(c){return {id:c.id,data:c.data,tipo:c.tipo,categoria:c.categoria,descricao:c.descricao,valor:num(c.valor),forma:c.forma,pedidoId:c.pedido_id,criadoPor:c.criado_por||''};});
  db.materiais=checar(res[2]).map(function(m){return {id:m.id,nome:m.nome,unidade:m.unidade,qtd:num(m.quantidade),minimo:num(m.minimo),custo:num(m.custo_unitario),fornecedor:m.fornecedor||'',ultimaCompra:m.ultima_compra,categoria:m.categoria||'',embalagem:m.embalagem||'',unidEmb:num(m.unidades_embalagem),valorEmb:m.valor_embalagem==null?null:num(m.valor_embalagem)};});
  db.clientes=checar(res[3]);
  var cfg=checar(res[4]);db.meta=cfg?num(cfg.meta_mensal):0;
  db.usos=checar(res[5]).map(function(u){return {id:u.id,materialId:u.material_id,pedidoId:u.pedido_id,tipo:u.tipo,qtd:num(u.quantidade),custo:num(u.custo_unitario),data:iso(new Date(u.criado_em))};});
}
function usosPedido(p){return (db.usos||[]).filter(function(u){return u.pedidoId===p.id;});}
function custoMateriais(p){var s=0;usosPedido(p).forEach(function(u){s+=u.qtd*u.custo;});return Math.round(s*100)/100;}

function totalPedido(p){var s=0;(p.itens||[]).forEach(function(i){s+=num(i.qtd)*num(i.valor);});return s+num(p.frete)-num(p.desconto);}
function recebidoPedido(p){var s=0;db.caixa.forEach(function(c){if(c.pedidoId===p.id&&c.tipo==='entrada')s+=num(c.valor);});return s;}
function saldoPedido(p){return Math.max(0,Math.round((totalPedido(p)-recebidoPedido(p))*100)/100);}
function acharPedido(n){for(var i=0;i<db.pedidos.length;i++)if(String(db.pedidos[i].num)===String(n))return db.pedidos[i];return null;}
function acharMaterial(id){for(var i=0;i<db.materiais.length;i++)if(db.materiais[i].id===id)return db.materiais[i];return null;}
function resumoItens(p){return (p.itens||[]).map(function(i){return i.qtd+'× '+i.produto;}).join(', ');}
function abaixoMinimo(){return db.materiais.filter(function(m){return num(m.qtd)<=num(m.minimo);});}

/* ---------- rotas ---------- */
var estado={filtroStatus:'abertos',busca:'',mesCaixa:null,tipoNovo:'entrada',erroLogin:''};
function rota(){var h=(location.hash||'').replace('#','');return h||'painel';}
function ir(r){if(location.hash==='#'+r){desenhar();}else{location.hash=r;}}
window.addEventListener('hashchange',function(){desenhar();window.scrollTo(0,0);});
var raiz=document.getElementById('raiz');

function desenhar(){
  if(!sb){raiz.innerHTML=telaSemConfig();return;}
  if(!usuario){raiz.innerHTML=estado.configurado===false?telaPrimeiroAcesso():telaLogin();return;}
  var r=rota(),titulo='Painel',corpo='',sec='painel';
  if(r==='pedidos'){titulo='Pedidos';corpo=telaPedidos();sec='pedidos';}
  else if(r==='novo-pedido'){titulo='Novo pedido';corpo=telaNovoPedido();sec='novo';}
  else if(r.indexOf('pedido-')===0){var p=acharPedido(r.slice(7));titulo=p?'Pedido '+numPedido(p.num):'Pedido';corpo=p?telaPedido(p):'<div class="card">Pedido não encontrado.</div>';sec='pedidos';}
  else if(r==='caixa'){titulo='Caixa';corpo=telaCaixa();sec='caixa';}
  else if(r==='estoque'){titulo='Estoque';corpo=telaEstoque();sec='estoque';}
  else {corpo=telaPainel();}
  raiz.innerHTML=casca(titulo,sec,corpo);
  if(r==='pedidos')desenharListaPedidos();
}

function icone(n){
  var p={
    painel:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    pedidos:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/>',
    caixa:'<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 6V4h12v2"/>',
    estoque:'<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    mais:'<path d="M12 5v14M5 12h14"/>',
    menu:'<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
    voltar:'<path d="M15 18l-6-6 6-6"/>',
    wpp:'<path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 21l2.2-5.3A8.4 8.4 0 1 1 21 11.5z"/>'
  }[n]||'';
  return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
}

function casca(titulo,sec,corpo){
  function lk(r,nome,ic){return '<a href="#'+r+'" class="'+(sec===r?'ativo':'')+'">'+icone(ic)+nome+'</a>';}
  return '<div class="app">'+
    '<aside class="side"><img src="'+LOGO+'" alt="LP Personalizados">'+
      '<nav aria-label="Menu principal">'+lk('painel','Painel','painel')+lk('pedidos','Pedidos','pedidos')+
      '<a href="#novo-pedido" class="'+(sec==='novo'?'ativo':'')+'">'+icone('mais')+'Novo pedido</a>'+
      lk('caixa','Caixa','caixa')+lk('estoque','Estoque','estoque')+'</nav>'+
      '<div class="usuario"><span>Conectado como <b style="color:#fff">'+esc(usuario.nome)+'</b></span>'+
      '<button type="button" data-acao="atualizar">Atualizar dados</button>'+
      '<button type="button" data-acao="sair">Sair</button></div>'+
    '</aside>'+
    '<div class="principal">'+
      '<header class="topo"><img src="'+LOGO+'" alt="LP Personalizados"><div class="tit"><b>'+esc(titulo)+'</b><span>'+esc(hojeExtenso())+'</span></div>'+
      '<button type="button" data-acao="menu" aria-label="Mais opções">'+icone('menu')+'</button></header>'+
      '<main class="conteudo">'+corpo+'</main>'+
    '</div>'+
    '<nav class="inferior" aria-label="Menu principal">'+
      '<a href="#painel" class="'+(sec==='painel'?'ativo':'')+'">'+icone('painel')+'Painel</a>'+
      '<a href="#pedidos" class="'+(sec==='pedidos'?'ativo':'')+'">'+icone('pedidos')+'Pedidos</a>'+
      '<a href="#novo-pedido" class="mais" aria-label="Novo pedido">'+icone('mais')+'</a>'+
      '<a href="#caixa" class="'+(sec==='caixa'?'ativo':'')+'">'+icone('caixa')+'Caixa</a>'+
      '<a href="#estoque" class="'+(sec==='estoque'?'ativo':'')+'">'+icone('estoque')+'Estoque</a>'+
    '</nav></div>';
}

/* ---------- login ---------- */
function telaSemConfig(){
  return '<div class="login"><img src="'+LOGO+'" alt="LP Personalizados"><div class="card" style="padding:24px"><h1>Quase pronto</h1><p style="margin:0;color:var(--sec);font-size:14px">Preencha o arquivo <b>config.js</b> com o endereço e a chave pública do projeto no Supabase.</p></div></div>';
}
function telaLogin(){
  return '<div class="login"><img src="'+LOGO+'" alt="LP Personalizados">'+
  '<form class="card" data-form="login" style="padding:26px 22px;gap:16px">'+
    '<div><h1>Entrar</h1><p style="margin:4px 0 0;color:var(--sec);font-size:14px">Gestão interna da LP Personalizados</p></div>'+
    (estado.erroLogin?'<div class="erro-login" role="alert">'+esc(estado.erroLogin)+'</div>':'')+
    '<div class="campo"><label for="lg-u">E-mail</label><input id="lg-u" name="email" type="email" autocomplete="username" required placeholder="seu@email.com"></div>'+
    '<div class="campo"><label for="lg-s">Senha</label><input id="lg-s" name="senha" type="password" autocomplete="current-password" required placeholder="Sua senha"></div>'+
    '<button class="btn cheio" type="submit">Entrar</button>'+
  '</form><div class="rodape"><i></i>Acesso restrito aos responsáveis<i></i></div></div>';
}
function telaPrimeiroAcesso(){
  return '<div class="login"><img src="'+LOGO+'" alt="LP Personalizados">'+
  '<form class="card" data-form="primeiro" style="padding:26px 22px;gap:16px">'+
    '<div><h1>Primeiro acesso</h1><p style="margin:4px 0 0;color:var(--sec);font-size:14px">Crie o login que vocês vão usar no sistema. Depois disso, esta tela some e só esse login entra.</p></div>'+
    (estado.erroLogin?'<div class="erro-login" role="alert">'+esc(estado.erroLogin)+'</div>':'')+
    '<div class="campo"><label for="pa-n">Nome que aparece no sistema</label><input id="pa-n" name="nome" required value="LP Personalizados"></div>'+
    '<div class="campo"><label for="pa-e">E-mail</label><input id="pa-e" name="email" type="email" autocomplete="username" required placeholder="seu@email.com"></div>'+
    '<div class="campo"><label for="pa-s">Senha (mínimo 8 caracteres)</label><input id="pa-s" name="senha" type="password" autocomplete="new-password" minlength="8" required></div>'+
    '<div class="campo"><label for="pa-c">Repita a senha</label><input id="pa-c" name="confirma" type="password" autocomplete="new-password" minlength="8" required></div>'+
    '<button class="btn cheio" type="submit">Criar login e entrar</button>'+
  '</form><div class="rodape"><i></i>Acesso restrito aos responsáveis<i></i></div></div>';
}
async function aposLogin(user){
  var r=await sb.from('membros').select('nome').eq('user_id',user.id).maybeSingle();
  if(r.error||!r.data){
    estado.erroLogin='Este usuário ainda não tem acesso ao sistema. Peça para liberar o seu e-mail.';
    await sb.auth.signOut();usuario=null;desenhar();return;
  }
  usuario={id:user.id,nome:r.data.nome};estado.erroLogin='';
  raiz.innerHTML='<div class="carregando">Carregando…</div>';
  try{await recarregar();}catch(e){aviso(msgErro(e));}
  desenhar();
}

/* ---------- painel ---------- */
function resumoMes(a,m){
  var ent=0,sai=0,itens=[];
  db.caixa.forEach(function(c){var d=paraData(c.data);if(d.getFullYear()===a&&d.getMonth()===m){itens.push(c);if(c.tipo==='entrada')ent+=num(c.valor);else sai+=num(c.valor);}});
  return {ent:ent,sai:sai,itens:itens};
}
function telaPainel(){
  var cont={};STATUS.forEach(function(s){cont[s[0]]=0;});
  var atrasados=0,proximos=0,aReceber=0;
  db.pedidos.forEach(function(p){
    cont[p.status]=(cont[p.status]||0)+1;
    if(aberto(p)){
      var d=difDias(p.prazoProducao);
      if(d!==null&&d<0)atrasados++;else if(d!==null&&d<=2)proximos++;
      aReceber+=saldoPedido(p);
    }
  });
  var baixos=abaixoMinimo();
  var agora=new Date(),m=resumoMes(agora.getFullYear(),agora.getMonth());
  var pct=db.meta>0?Math.min(100,Math.round(m.ent/db.meta*100)):0;
  function tile(id,nome,cls){return '<button type="button" class="tile '+(cls||'')+'" data-acao="filtrar" data-status="'+id+'"><b>'+(id==='atrasados'?atrasados:cont[id])+'</b><span>'+nome+'</span></button>';}
  var prox=db.pedidos.filter(aberto).sort(ordenarPrazo).slice(0,5);
  var alertas='';
  if(atrasados)alertas+='<div class="alerta"><i class="v"></i><span><b>'+atrasados+' pedido'+(atrasados>1?'s':'')+' atrasado'+(atrasados>1?'s':'')+'</b></span></div>';
  if(proximos)alertas+='<div class="alerta"><i class="o"></i><span><b>'+proximos+' pedido'+(proximos>1?'s':'')+'</b> vence'+(proximos>1?'m':'')+' em até 2 dias</span></div>';
  baixos.forEach(function(b){alertas+='<div class="alerta"><i class="o"></i><span><b>'+esc(b.nome)+'</b>: '+b.qtd+' '+esc(b.unidade)+' (mínimo '+b.minimo+')</span></div>';});
  if(aReceber>0)alertas+='<div class="alerta"><i class="t"></i><span><b>'+brl(aReceber)+'</b> a receber de pedidos em aberto</span></div>';
  if(!alertas)alertas='<div class="alerta"><i class="t"></i><span>Tudo em dia.</span></div>';
  var meta=db.meta>0?
    '<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;color:var(--sec)"><span>Meta do mês</span><span>'+pct+'% de '+brl(db.meta)+'</span></div><div class="barra"><div style="width:'+pct+'%"></div></div><button type="button" class="btn contorno peq" data-acao="meta" style="align-self:flex-start">Mudar meta</button></div>':
    '<button type="button" class="btn contorno peq" data-acao="meta" style="align-self:flex-start">Definir meta do mês</button>';
  return '<div class="cab"><div><h1 class="so-desk">Painel</h1><p>Olá, '+esc(usuario.nome)+' · '+esc(hojeExtenso())+'</p></div><a class="btn ouro" href="#novo-pedido">+ Novo pedido</a></div>'+
  '<div class="grade">'+tile('orcamento','Orçamentos')+tile('novo','Novos')+tile('aguardando_pagamento','Aguard. pagamento')+tile('aguardando_arte','Aguardando arte','ouro')+tile('em_producao','Em produção','teal')+tile('pronto_envio','Pronto para envio')+tile('enviado','Enviados')+tile('atrasados','Atrasados','verm')+'</div>'+
  '<div class="dupla"><section class="card larga"><div class="linha-tit"><h2>Prazos próximos</h2><a href="#pedidos" style="font-size:13.5px;font-weight:600;text-decoration:none">Ver todos</a></div><div class="lista">'+
  (prox.length?prox.map(itemPedido).join(''):'<div class="vazio">Nenhum pedido em aberto. Toque em “+ Novo pedido” para começar.</div>')+'</div></section>'+
  '<div class="estreita" style="display:flex;flex-direction:column;gap:14px"><section class="card escuro"><h2>Alertas</h2>'+alertas+'</section>'+
  '<section class="card"><h2>Caixa de '+MESES[agora.getMonth()]+'</h2><div class="valores"><div><span>Entradas</span><b class="pos">'+brl(m.ent)+'</b></div><div><span>Saídas</span><b class="neg">'+brl(m.sai)+'</b></div><div class="total"><span style="color:var(--texto)">Saldo</span><span>'+brl(m.ent-m.sai)+'</span></div></div>'+meta+'</section></div></div>';
}
function itemPedido(p){
  return '<a class="item" href="#pedido-'+p.num+'"><div class="info"><b>'+numPedido(p.num)+' · '+esc(p.cliente)+'</b><span>'+esc(resumoItens(p))+'</span></div><div class="dir">'+chipPrazo(p)+'<span style="font-size:12.5px;color:var(--sec)">'+esc(statusInfo(p.status)[1])+'</span></div></a>';
}

/* ---------- lista de pedidos ---------- */
function telaPedidos(){
  var f=[['abertos','Em aberto'],['atrasados','Atrasados']].concat(STATUS.map(function(s){return [s[0],s[1]];})).concat([['todos','Todos']]);
  return '<div class="cab"><div><h1>Pedidos</h1><p>Toque num pedido para ver detalhes e mudar a situação.</p></div><a class="btn ouro" href="#novo-pedido">+ Novo pedido</a></div>'+
  '<label class="sr" for="busca">Buscar pedido</label><input id="busca" class="busca" type="search" placeholder="Buscar por cliente, número ou produto" value="'+esc(estado.busca)+'">'+
  '<div class="filtros" role="group" aria-label="Filtrar por situação">'+f.map(function(x){return '<button type="button" data-acao="filtro" data-status="'+x[0]+'" class="'+(estado.filtroStatus===x[0]?'ativo':'')+'">'+esc(x[1])+'</button>';}).join('')+'</div>'+
  '<section class="card"><div class="lista" id="lista-pedidos"></div></section>';
}
function desenharListaPedidos(){
  var el=document.getElementById('lista-pedidos');if(!el)return;
  var b=estado.busca.trim().toLowerCase(),fs=estado.filtroStatus;
  var lst=db.pedidos.filter(function(p){
    if(fs==='abertos'&&!aberto(p))return false;
    if(fs==='atrasados'&&!(aberto(p)&&difDias(p.prazoProducao)<0))return false;
    if(fs!=='abertos'&&fs!=='todos'&&fs!=='atrasados'&&p.status!==fs)return false;
    if(b){var t=(p.cliente+' '+p.num+' '+numPedido(p.num)+' '+resumoItens(p)+' '+p.origem+' '+(p.numExterno||'')).toLowerCase();if(t.indexOf(b)<0)return false;}
    return true;
  }).sort(fs==='finalizado'||fs==='cancelado'||fs==='todos'?function(a,b){return b.num-a.num;}:ordenarPrazo);
  el.innerHTML=lst.length?lst.map(function(p){
    return '<a class="item" href="#pedido-'+p.num+'"><div class="info"><b>'+numPedido(p.num)+' · '+esc(p.cliente)+'</b><span>'+esc(p.origem)+' · '+esc(resumoItens(p))+'</span></div><div class="dir">'+chipStatus(p.status)+'<span style="display:flex;gap:6px;align-items:center">'+chipPrazo(p)+'<b style="font-size:13.5px">'+brl(totalPedido(p))+'</b></span></div></a>';
  }).join(''):'<div class="vazio">Nenhum pedido encontrado.</div>';
}

/* ---------- novo pedido ---------- */
var uidN=0;
function linhaItem(i){
  i=i||{produto:'',qtd:1,valor:'',pers:''};
  var k=++uidN;
  return '<div class="item-pedido" data-item>'+
  '<button type="button" class="remover" data-acao="remover-item" aria-label="Remover item">×</button>'+
  '<div class="campo" style="grid-column:1/-1;padding-right:36px"><label for="pr-'+k+'">Produto</label><input id="pr-'+k+'" name="produto" required value="'+esc(i.produto)+'" placeholder="Ex.: Caneca 325 ml" list="lista-produtos"></div>'+
  '<div class="campo"><label for="qt-'+k+'">Quantidade</label><input id="qt-'+k+'" name="qtd" type="number" min="1" step="1" required value="'+esc(i.qtd)+'"></div>'+
  '<div class="campo"><label for="vl-'+k+'">Valor unitário (R$)</label><input id="vl-'+k+'" name="valor" type="number" min="0" step="0.01" required value="'+esc(i.valor)+'"></div>'+
  '<div class="campo" style="grid-column:1/-1"><label for="ps-'+k+'">Personalização</label><input id="ps-'+k+'" name="pers" value="'+esc(i.pers)+'" placeholder="Nome, tema, cores..."></div></div>';
}
function telaNovoPedido(){
  var prods={};db.pedidos.forEach(function(p){p.itens.forEach(function(i){prods[i.produto]=1;});});
  return '<div class="cab"><div><h1>Novo pedido</h1><p>O número é gerado automaticamente ao salvar.</p></div></div>'+
  '<form data-form="pedido" style="display:flex;flex-direction:column;gap:14px">'+
  '<datalist id="lista-produtos">'+Object.keys(prods).map(function(p){return '<option value="'+esc(p)+'">';}).join('')+'</datalist>'+
  '<datalist id="lista-clientes">'+db.clientes.map(function(c){return '<option value="'+esc(c.nome)+'">';}).join('')+'</datalist>'+
  '<section class="card"><h2>Cliente e origem</h2><div class="campos">'+
    '<div class="campo"><label for="np-cli">Cliente</label><input id="np-cli" name="cliente" required placeholder="Nome do cliente" list="lista-clientes" autocomplete="off"></div>'+
    '<div class="campo"><label for="np-tel">WhatsApp</label><input id="np-tel" name="telefone" inputmode="tel" placeholder="(19) 90000-0000"></div>'+
    '<div class="campo"><label for="np-ori">Origem</label><select id="np-ori" name="origem">'+ORIGENS.map(function(o){return '<option>'+o+'</option>';}).join('')+'</select></div>'+
    '<div class="campo"><label for="np-ext">Nº do pedido na Shopee</label><input id="np-ext" name="numExterno" placeholder="Se houver"></div>'+
  '</div><p class="dica" style="margin:0">Cliente já cadastrado aparece na lista ao digitar, e o WhatsApp é preenchido sozinho.</p></section>'+
  '<section class="card"><div class="linha-tit"><h2>Itens</h2><button type="button" class="btn contorno peq" data-acao="add-item">+ Adicionar item</button></div><div id="itens" style="display:flex;flex-direction:column;gap:10px">'+linhaItem()+'</div></section>'+
  '<section class="card"><h2>Valores e prazos</h2><div class="campos">'+
    '<div class="campo"><label for="np-fr">Frete cobrado do cliente (R$)</label><input id="np-fr" name="frete" type="number" min="0" step="0.01" value="0"></div>'+
    '<div class="campo"><label for="np-de">Desconto (R$)</label><input id="np-de" name="desconto" type="number" min="0" step="0.01" value="0"></div>'+
    '<div class="campo"><label for="np-si">Sinal recebido agora (R$)</label><input id="np-si" name="sinal" type="number" min="0" step="0.01" value="0"></div>'+
    '<div class="campo"><label for="np-fs">Forma do sinal</label><select id="np-fs" name="formaSinal">'+FORMAS.map(function(o){return '<option>'+o+'</option>';}).join('')+'</select></div>'+
    '<div class="campo"><label for="np-pp">Prazo de produção</label><input id="np-pp" name="prazoProducao" type="date" required value="'+maisDias(7)+'"></div>'+
    '<div class="campo"><label for="np-pe">Prazo de entrega ou despacho</label><input id="np-pe" name="prazoEntrega" type="date" value="'+maisDias(9)+'"></div>'+
    '<div class="campo"><label for="np-st">Situação inicial</label><select id="np-st" name="status">'+STATUS.slice(0,5).map(function(s){return '<option value="'+s[0]+'"'+(s[0]==='novo'?' selected':'')+'>'+s[1]+'</option>';}).join('')+'</select></div>'+
  '</div><div class="aviso-demo" id="np-total" style="background:var(--teal-cl);color:var(--teal-esc);font-weight:600">Total do pedido: '+brl(0)+'</div></section>'+
  '<section class="card"><h2>Custos (para o lucro estimado)</h2><div class="campos">'+
    '<div class="campo"><label for="np-cu">Outros custos: mão de obra, embalagem, etc. (R$)</label><input id="np-cu" name="custo" type="number" min="0" step="0.01" value="0"></div>'+
    '<div class="campo"><label for="np-tx">Taxa da Shopee (R$)</label><input id="np-tx" name="taxa" type="number" min="0" step="0.01" value="0"></div>'+
    '<div class="campo todo"><label for="np-ob">Observações</label><textarea id="np-ob" name="obs"></textarea></div>'+
  '</div><p class="dica" style="margin:0">O custo dos materiais (folhas, adesivos, etc.) é calculado sozinho quando você lança os materiais usados na tela do pedido.</p></section>'+
  '<div class="acoes"><button class="btn" type="submit">Salvar pedido</button><a class="btn contorno" href="#pedidos">Cancelar</a></div>'+
  '</form>';
}
function atualizarTotalNovo(){
  var f=document.querySelector('[data-form="pedido"]');if(!f)return;
  var s=0;f.querySelectorAll('[data-item]').forEach(function(r){s+=num(r.querySelector('[name=qtd]').value)*num(r.querySelector('[name=valor]').value);});
  s+=num(f.frete.value)-num(f.desconto.value);
  var el=document.getElementById('np-total');if(el)el.textContent='Total do pedido: '+brl(s);
}
async function salvarNovoPedido(f){
  var itens=[];
  f.querySelectorAll('[data-item]').forEach(function(r){
    itens.push({produto:r.querySelector('[name=produto]').value.trim(),quantidade:num(r.querySelector('[name=qtd]').value),valor_unitario:num(r.querySelector('[name=valor]').value),personalizacao:r.querySelector('[name=pers]').value.trim()});
  });
  var total=0;itens.forEach(function(i){total+=i.quantidade*i.valor_unitario;});total+=num(f.frete.value)-num(f.desconto.value);
  if(num(f.sinal.value)>total+0.001){aviso('O sinal não pode ser maior que o total do pedido.');return;}
  var dados={cliente_nome:f.cliente.value.trim(),telefone:f.telefone.value.trim(),origem:f.origem.value,numero_externo:f.numExterno.value.trim(),status:f.status.value,
    prazo_producao:f.prazoProducao.value,prazo_entrega:f.prazoEntrega.value,frete:num(f.frete.value),desconto:num(f.desconto.value),
    custo:num(f.custo.value),taxa_shopee:num(f.taxa.value),observacoes:f.obs.value.trim(),sinal:num(f.sinal.value),forma_sinal:f.formaSinal.value,itens:itens};
  var numero=null;
  var ok=await executar(async function(){numero=checar(await sb.rpc('criar_pedido',{p:dados}));});
  if(ok){aviso('Pedido '+numPedido(numero)+' salvo.');ir('pedido-'+numero);}
}

/* ---------- detalhe do pedido ---------- */
function telaPedido(p){
  var total=totalPedido(p),rec=recebidoPedido(p),saldo=saldoPedido(p);
  var cMat=custoMateriais(p),usos=usosPedido(p);
  var lucro=total-cMat-num(p.custo)-num(p.taxa),margem=total>0?Math.round(lucro/total*100):0;
  var d=difDias(p.prazoProducao);
  var digitos=String(p.telefone||'').replace(/\D/g,'');
  if(digitos&&digitos.length<=11)digitos='55'+digitos;
  var wpp=digitos?('https://wa.me/'+digitos+'?text='+encodeURIComponent((MSG_WPP[p.status]||'')+' (Pedido '+numPedido(p.num)+')')):'';
  var pagamentos=db.caixa.filter(function(c){return c.pedidoId===p.id;});
  return '<div class="cab"><div style="display:flex;align-items:center;gap:10px"><a href="#pedidos" class="btn contorno peq" aria-label="Voltar para pedidos">'+icone('voltar')+'</a><div><h1>Pedido '+numPedido(p.num)+'</h1><p>'+esc(p.origem)+(p.numExterno?' · nº '+esc(p.numExterno):'')+' · aberto em '+dataCurta(p.criado)+(p.criadoPor?' por '+esc(p.criadoPor):'')+'</p></div></div>'+
  '<div class="acoes">'+chipStatus(p.status)+chipPrazo(p)+'</div></div>'+
  '<div class="dupla"><div class="larga" style="display:flex;flex-direction:column;gap:14px">'+
  '<section class="card"><h2>Situação</h2><div class="campos" style="grid-template-columns:1fr">'+
    '<div class="campo"><label for="mud-st">Mudar situação</label><select id="mud-st" data-acao="mudar-status" data-num="'+p.num+'">'+STATUS.map(function(s){return '<option value="'+s[0]+'"'+(s[0]===p.status?' selected':'')+'>'+s[1]+'</option>';}).join('')+'</select></div></div>'+
    '<div class="trio"><div><span>Prazo de produção</span><b class="'+(aberto(p)&&d!==null&&d<=0?'neg':'')+'">'+dataLonga(p.prazoProducao)+'</b></div><div><span>Entrega / despacho</span><b>'+dataLonga(p.prazoEntrega)+'</b></div><div><span>Origem</span><b>'+esc(p.origem)+'</b></div></div>'+
    ((p.transportadora||p.rastreio)?'<div class="valores"><div><span>Envio</span><span>'+esc(p.transportadora||'—')+(p.rastreio?' · '+esc(p.rastreio):'')+'</span></div></div>':'')+
    '<div class="acoes"><button type="button" class="btn contorno peq" data-acao="editar" data-num="'+p.num+'">Editar dados</button></div></section>'+
  '<section class="card"><div class="linha-tit" style="flex-wrap:nowrap"><div style="display:flex;align-items:center;gap:12px;min-width:0"><div style="width:42px;height:42px;border-radius:21px;background:var(--teal-cl);color:var(--teal-esc);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">'+esc(iniciais(p.cliente))+'</div><div style="min-width:0"><b>'+esc(p.cliente)+'</b><div style="font-size:13px;color:var(--sec)">'+esc(p.telefone||'Sem telefone')+'</div></div></div>'+
    (wpp?'<a class="btn contorno peq" href="'+esc(wpp)+'" target="_blank" rel="noopener">'+icone('wpp')+'WhatsApp</a>':'')+'</div>'+
    (wpp?'<p class="dica" style="margin:0">Abre o WhatsApp com a mensagem: “'+esc(MSG_WPP[p.status])+'”</p>':'')+'</section>'+
  '<section class="card"><h2>Itens</h2><div class="lista">'+p.itens.map(function(i){return '<div class="item"><div class="info"><b>'+esc(i.produto)+' × '+esc(i.qtd)+'</b><span>'+esc(i.pers||'Sem personalização')+'</span></div><b style="white-space:nowrap">'+brl(num(i.qtd)*num(i.valor))+'</b></div>';}).join('')+'</div>'+
    '<div class="valores">'+(num(p.frete)?'<div><span>Frete cobrado</span><span>'+brl(p.frete)+'</span></div>':'')+(num(p.desconto)?'<div><span>Desconto</span><span>− '+brl(p.desconto)+'</span></div>':'')+
    '<div class="total"><span>Total</span><span>'+brl(total)+'</span></div><div><span>Recebido</span><span class="pos" style="font-weight:600">'+brl(rec)+'</span></div><div><span>Saldo a receber</span><span class="'+(saldo>0?'neg':'pos')+'" style="font-weight:600">'+brl(saldo)+'</span></div></div>'+
    '<div class="acoes">'+(saldo>0&&p.status!=='cancelado'?'<button type="button" class="btn" data-acao="receber" data-num="'+p.num+'">Registrar recebimento</button>':(saldo<=0?'<span class="chip green">Pago</span>':''))+'</div>'+
    (pagamentos.length?'<div class="hist">'+pagamentos.map(function(c){return '<div><span>'+dataCurta(c.data)+'</span><span style="color:var(--texto)">'+brl(c.valor)+' · '+esc(c.forma)+'</span></div>';}).join('')+'</div>':'')+
  '</section>'+
  '<section class="card"><div class="linha-tit"><h2>Materiais usados</h2><button type="button" class="btn contorno peq" data-acao="usar-mat" data-num="'+p.num+'">+ Adicionar material</button></div>'+
    (usos.length?'<div class="lista">'+usos.map(function(u){var m=acharMaterial(u.materialId)||{nome:'Material',unidade:''};return '<div class="item"><div class="info"><b>'+esc(m.nome)+(u.tipo==='perda'?' <span class="chip red">perda</span>':'')+'</b><span>'+qtdTxt(u.qtd)+' '+esc(m.unidade)+' × '+brl4(u.custo)+'</span></div><div class="dir"><b>'+brl(u.qtd*u.custo)+'</b><button type="button" class="btn perigo peq" data-acao="desfazer-uso" data-id="'+u.id+'">Remover</button></div></div>';}).join('')+'</div><div class="valores"><div class="total"><span>Custo dos materiais</span><span>'+brl(cMat)+'</span></div></div>':'<div class="vazio">Nenhum material lançado. Ao adicionar, a quantidade sai do estoque e o custo entra no lucro do pedido.</div>')+
  '</section>'+
  (p.obs?'<section class="card"><h2>Observações</h2><p style="margin:0;font-size:14px;white-space:pre-line">'+esc(p.obs)+'</p></section>':'')+
  '</div><div class="estreita" style="display:flex;flex-direction:column;gap:14px">'+
  '<section class="card escuro"><h2>Lucro estimado</h2><div class="valores"><div><span>Venda</span><span>'+brl(total)+'</span></div><div><span>Materiais</span><span>− '+brl(cMat)+'</span></div><div><span>Outros custos</span><span>− '+brl(p.custo)+'</span></div><div><span>Taxa Shopee</span><span>− '+brl(p.taxa)+'</span></div>'+
    '<div class="total" style="border-color:var(--linha-esc)"><span>Lucro</span><span class="'+(lucro>=0?'pos':'neg')+'">'+brl(lucro)+'</span></div><div><span>Margem</span><span style="color:var(--ouro);font-weight:700">'+margem+'%</span></div></div>'+
    '<button type="button" class="btn ouro peq" data-acao="custos" data-num="'+p.num+'">Ajustar custos</button></section>'+
  '<section class="card"><h2>Ações</h2><div class="acoes" style="flex-direction:column"><button type="button" class="btn contorno cheio" data-acao="repetir" data-num="'+p.num+'">Repetir pedido</button><button type="button" class="btn contorno cheio" data-acao="ordem" data-num="'+p.num+'">Ordem de produção</button></div></section>'+
  '<section class="card"><h2>Histórico</h2><div class="hist">'+p.historico.slice().reverse().map(function(h){return '<div><span>'+dataCurta(h.data)+'</span><span>'+esc(h.texto)+(h.usuario?' <span style="color:var(--sec)">('+esc(h.usuario)+')</span>':'')+'</span></div>';}).join('')+'</div></section>'+
  '</div></div>';
}

/* ---------- caixa ---------- */
function telaCaixa(){
  if(!estado.mesCaixa){var d=new Date();estado.mesCaixa=[d.getFullYear(),d.getMonth()];}
  var a=estado.mesCaixa[0],m=estado.mesCaixa[1],r=resumoMes(a,m);
  var lst=r.itens.slice().sort(function(x,y){return x.data<y.data?1:x.data>y.data?-1:0;});
  var cats=estado.tipoNovo==='entrada'?CAT_ENTRADA:CAT_SAIDA;
  return '<div class="cab"><div><h1>Caixa</h1><p>Só entra aqui o dinheiro que foi recebido ou pago de verdade.</p></div>'+
  '<div class="mes"><button type="button" data-acao="mes" data-d="-1" aria-label="Mês anterior">‹</button><b>'+MESES[m]+' '+a+'</b><button type="button" data-acao="mes" data-d="1" aria-label="Próximo mês">›</button></div></div>'+
  '<div class="grade"><div class="tile teal"><b>'+brl(r.ent)+'</b><span>Entradas</span></div><div class="tile verm"><b>'+brl(r.sai)+'</b><span>Saídas</span></div><div class="tile"><b>'+brl(r.ent-r.sai)+'</b><span>Saldo do mês</span></div></div>'+
  '<div class="dupla"><section class="card larga"><h2>Lançamentos</h2><div class="tabela"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th class="num">Valor</th><th><span class="sr">Ações</span></th></tr></thead><tbody>'+
  (lst.length?lst.map(function(c){return '<tr><td>'+dataCurta(c.data)+'</td><td>'+esc(c.descricao)+'</td><td>'+esc(c.categoria)+'</td><td>'+esc(c.forma)+'</td><td class="num '+(c.tipo==='entrada'?'pos':'neg')+'" style="font-weight:600">'+(c.tipo==='entrada'?'+ ':'− ')+brl(c.valor)+'</td><td class="num"><button type="button" class="btn perigo peq" data-acao="excluir-lanc" data-id="'+c.id+'">Excluir</button></td></tr>';}).join(''):'<tr><td colspan="6" class="vazio">Nenhum lançamento neste mês.</td></tr>')+
  '</tbody></table></div><p class="dica" style="margin:0">Recebimentos de pedidos são lançados pela tela do pedido, para não duplicar.</p></section>'+
  '<form class="card estreita" data-form="lanc"><h2>Novo lançamento</h2>'+
    '<div class="filtros" role="group" aria-label="Tipo"><button type="button" data-acao="tipo" data-t="entrada" class="'+(estado.tipoNovo==='entrada'?'ativo':'')+'">Entrada</button><button type="button" data-acao="tipo" data-t="saida" class="'+(estado.tipoNovo==='saida'?'ativo':'')+'">Saída</button></div>'+
    '<div class="campo"><label for="lc-de">Descrição</label><input id="lc-de" name="descricao" required placeholder="'+(estado.tipoNovo==='entrada'?'Ex.: Repasse Shopee da semana':'Ex.: Compra de canecas')+'"></div>'+
    '<div class="campo"><label for="lc-ca">Categoria</label><select id="lc-ca" name="categoria">'+cats.map(function(c){return '<option>'+c+'</option>';}).join('')+'</select></div>'+
    '<div class="campo"><label for="lc-va">Valor (R$)</label><input id="lc-va" name="valor" type="number" min="0.01" step="0.01" required></div>'+
    '<div class="campo"><label for="lc-fo">Forma de pagamento</label><select id="lc-fo" name="forma">'+FORMAS.map(function(c){return '<option>'+c+'</option>';}).join('')+'</select></div>'+
    '<div class="campo"><label for="lc-da">Data</label><input id="lc-da" name="data" type="date" required value="'+hoje()+'"></div>'+
    '<button class="btn" type="submit">Lançar '+(estado.tipoNovo==='entrada'?'entrada':'saída')+'</button></form></div>';
}

/* ---------- estoque ---------- */
function telaEstoque(){
  var baixos=abaixoMinimo();
  return '<div class="cab"><div><h1>Estoque de materiais</h1><p>O alerta aparece quando o material chega ao mínimo.</p></div><button type="button" class="btn ouro" data-acao="novo-mat">+ Novo material</button></div>'+
  (baixos.length?'<section class="card escuro"><h2>Lista de compras</h2>'+baixos.map(function(b){var sug=Math.max(1,num(b.minimo)*2-num(b.qtd));return '<div class="alerta"><i class="o"></i><span><b>'+esc(b.nome)+'</b>: tem '+b.qtd+', comprar '+sug+' '+esc(b.unidade)+(b.fornecedor?' · '+esc(b.fornecedor):'')+' · previsto '+brl(sug*num(b.custo))+'</span></div>';}).join('')+'</section>':'')+
  '<section class="card">'+(db.materiais.length?'<div class="tabela"><table><thead><tr><th>Material</th><th class="num">Quantidade</th><th class="num">Mínimo</th><th class="num">Custo por unidade</th><th>Fornecedor</th><th><span class="sr">Ações</span></th></tr></thead><tbody>'+
  db.materiais.map(function(m){var baixo=num(m.qtd)<=num(m.minimo);return '<tr><td><b>'+esc(m.nome)+'</b>'+(baixo?' <span class="chip red">Abaixo do mínimo</span>':'')+(m.unidEmb>0?'<div style="font-size:12.5px;color:var(--sec)">'+esc(m.embalagem||'embalagem')+' com '+qtdTxt(m.unidEmb)+' '+esc(m.unidade)+(m.valorEmb!=null?' · '+brl(m.valorEmb):'')+'</div>':'')+'</td><td class="num">'+qtdTxt(m.qtd)+' '+esc(m.unidade)+'</td><td class="num">'+qtdTxt(m.minimo)+'</td><td class="num">'+brl4(m.custo)+'</td><td>'+esc(m.fornecedor||'')+'</td><td class="num"><div class="acoes" style="justify-content:flex-end;flex-wrap:nowrap"><button type="button" class="btn contorno peq" data-acao="editar-mat" data-id="'+m.id+'">Editar</button><button type="button" class="btn contorno peq" data-acao="mov" data-t="entrada" data-id="'+m.id+'">Entrada</button><button type="button" class="btn contorno peq" data-acao="mov" data-t="saida" data-id="'+m.id+'">Saída</button></div></td></tr>';}).join('')+
  '</tbody></table></div>':'<div class="vazio">Nenhum material cadastrado ainda. Toque em “+ Novo material”.</div>')+'</section>';
}

/* ---------- modal e aviso ---------- */
function modal(html){
  fecharModal();
  var f=document.createElement('div');f.className='fundo-modal';f.id='modal';
  f.innerHTML='<div class="modal" role="dialog" aria-modal="true">'+html+'</div>';
  f.addEventListener('click',function(e){if(e.target===f)fecharModal();});
  document.body.appendChild(f);
  var i=f.querySelector('input,select');if(i)i.focus();
}
function fecharModal(){var m=document.getElementById('modal');if(m)m.remove();}
var tAviso;
function aviso(t){
  var a=document.querySelector('.toast');if(a)a.remove();
  a=document.createElement('div');a.className='toast';a.setAttribute('role','status');a.textContent=t;document.body.appendChild(a);
  clearTimeout(tAviso);tAviso=setTimeout(function(){a.remove();},3500);
}
function botoesForm(rotulo){return '<div class="acoes"><button class="btn" type="submit">'+rotulo+'</button><button type="button" class="btn contorno" data-acao="fechar">Cancelar</button></div>';}

function formMaterial(m){
  var e=!!m;m=m||{nome:'',categoria:'',unidade:'un',qtd:0,minimo:0,fornecedor:'',embalagem:'',unidEmb:0,valorEmb:null,custo:0};
  var temPac=m.unidEmb>0;
  return '<h2>'+(e?'Editar material':'Novo material')+'</h2><form data-form="mat" '+(e?'data-id="'+m.id+'"':'')+' style="display:flex;flex-direction:column;gap:12px">'+
    '<div class="campo"><label for="nm-n">Nome</label><input id="nm-n" name="nome" required value="'+esc(m.nome)+'" placeholder="Ex.: Folha sulfite A4"></div>'+
    '<div class="campos"><div class="campo"><label for="nm-u">Unidade (como você usa)</label><input id="nm-u" name="unidade" required value="'+esc(m.unidade)+'" placeholder="folha, un, adesivo, metro"></div>'+
    '<div class="campo"><label for="nm-g">Categoria</label><input id="nm-g" name="categoria" value="'+esc(m.categoria)+'" placeholder="Papéis, adesivos, embalagens…"></div>'+
    '<div class="campo"><label for="nm-q">Quantidade em estoque</label><input id="nm-q" name="qtd" type="number" min="0" step="0.01" required value="'+num(m.qtd)+'"></div>'+
    '<div class="campo"><label for="nm-m">Estoque mínimo</label><input id="nm-m" name="minimo" type="number" min="0" step="0.01" required value="'+num(m.minimo)+'"></div></div>'+
    '<div class="campo"><label for="nm-f">Fornecedor</label><input id="nm-f" name="fornecedor" value="'+esc(m.fornecedor)+'"></div>'+
    '<section class="card" style="padding:14px;gap:10px;background:var(--fundo)"><h3>Custo</h3><p class="dica" style="margin:0">Se compra em pacote, caixa ou rolo, preencha a embalagem e o sistema calcula o custo de cada unidade.</p>'+
    '<div class="campos"><div class="campo"><label for="nm-e">Embalagem</label><input id="nm-e" name="embalagem" value="'+esc(m.embalagem)+'" placeholder="pacote, caixa, rolo"></div>'+
    '<div class="campo"><label for="nm-ue">Unidades na embalagem</label><input id="nm-ue" name="unidEmb" type="number" min="0" step="0.01" value="'+(temPac?num(m.unidEmb):'')+'" placeholder="Ex.: 500"></div>'+
    '<div class="campo"><label for="nm-ve">Valor da embalagem (R$)</label><input id="nm-ve" name="valorEmb" type="number" min="0" step="0.01" value="'+(temPac&&m.valorEmb!=null?num(m.valorEmb):'')+'" placeholder="Ex.: 25,00"></div></div>'+
    '<div class="campo" id="nm-direto"><label for="nm-c">Ou custo por unidade, se não compra em embalagem (R$)</label><input id="nm-c" name="custo" type="number" min="0" step="0.0001" value="'+(temPac?'':num(m.custo))+'"></div>'+
    '<div class="aviso-demo" id="nm-prev" style="background:var(--teal-cl);color:var(--teal-esc);font-weight:600"></div></section>'+
    botoesForm('Salvar')+'</form>';
}
function calcCustoMat(f){
  var u=num(f.unidEmb.value),v=f.valorEmb.value===''?null:num(f.valorEmb.value);
  if(u>0&&v!==null)return {pacote:true,custo:Math.round(v/u*10000)/10000,u:u,v:v};
  return {pacote:false,custo:num(f.custo.value)};
}
function atualizarPreviaMat(){
  var f=document.querySelector('[data-form="mat"]');if(!f)return;
  var c=calcCustoMat(f),un=f.unidade.value.trim()||'unidade',el=document.getElementById('nm-prev');
  document.getElementById('nm-direto').style.display=c.pacote?'none':'';
  el.textContent=c.pacote?('Custo por '+un+': '+brl(c.v)+' ÷ '+qtdTxt(c.u)+' = '+brl4(c.custo)):('Custo por '+un+': '+brl4(c.custo));
}
function atualizarPreviaUso(){
  var f=document.querySelector('[data-form="uso"]');if(!f)return;
  var m=acharMaterial(f.material.value),q=num(f.qtd.value),el=document.getElementById('us-prev');
  if(m)el.textContent=qtdTxt(q)+' '+m.unidade+' × '+brl4(m.custo)+' = '+brl(q*m.custo)+' de custo no pedido';
}

/* ---------- eventos ---------- */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-acao]');if(!b||b.tagName==='SELECT')return;
  var a=b.getAttribute('data-acao'),p;
  if(a==='sair'){fecharModal();sb.auth.signOut().finally(function(){usuario=null;desenhar();});}
  else if(a==='menu'){modal('<h2>Opções</h2><p style="margin:0;color:var(--sec)">Conectado como <b>'+esc(usuario.nome)+'</b></p><button type="button" class="btn contorno" data-acao="atualizar">Atualizar dados</button><button type="button" class="btn perigo" data-acao="sair">Sair</button><button type="button" class="btn contorno" data-acao="fechar">Fechar</button>');}
  else if(a==='fechar'){fecharModal();}
  else if(a==='atualizar'){fecharModal();executar(async function(){},'Dados atualizados.').then(desenhar);}
  else if(a==='filtrar'){estado.filtroStatus=b.getAttribute('data-status');estado.busca='';ir('pedidos');}
  else if(a==='filtro'){estado.filtroStatus=b.getAttribute('data-status');document.querySelectorAll('.filtros [data-acao=filtro]').forEach(function(x){x.classList.toggle('ativo',x===b);});desenharListaPedidos();}
  else if(a==='add-item'){var c=document.getElementById('itens');c.insertAdjacentHTML('beforeend',linhaItem());var ins=c.querySelectorAll('[name=produto]');ins[ins.length-1].focus();}
  else if(a==='remover-item'){var its=document.querySelectorAll('[data-item]');if(its.length>1){b.closest('[data-item]').remove();atualizarTotalNovo();}else aviso('O pedido precisa de pelo menos um item.');}
  else if(a==='meta'){modal('<h2>Meta de vendas do mês</h2><form data-form="meta" style="display:flex;flex-direction:column;gap:12px"><div class="campo"><label for="mt-v">Valor da meta (R$)</label><input id="mt-v" name="valor" type="number" min="0" step="0.01" required value="'+(db.meta||'')+'"></div><p class="dica" style="margin:0">A barra compara a meta com as entradas do caixa no mês.</p>'+botoesForm('Salvar')+'</form>');}
  else if(a==='receber'){p=acharPedido(b.getAttribute('data-num'));var s=saldoPedido(p);
    modal('<h2>Registrar recebimento</h2><p style="margin:0;color:var(--sec)">Pedido '+numPedido(p.num)+' · saldo de '+brl(s)+'</p><form data-form="receber" data-num="'+p.num+'" style="display:flex;flex-direction:column;gap:12px"><div class="campo"><label for="rc-v">Valor recebido (R$)</label><input id="rc-v" name="valor" type="number" min="0.01" max="'+s+'" step="0.01" required value="'+s+'"></div><div class="campo"><label for="rc-f">Forma</label><select id="rc-f" name="forma">'+FORMAS.map(function(o){return '<option'+(p.origem==='Shopee'&&o==='Repasse Shopee'?' selected':'')+'>'+o+'</option>';}).join('')+'</select></div><div class="campo"><label for="rc-d">Data</label><input id="rc-d" name="data" type="date" required value="'+hoje()+'"></div>'+botoesForm('Lançar no caixa')+'</form>');}
  else if(a==='custos'){p=acharPedido(b.getAttribute('data-num'));
    modal('<h2>Ajustar custos</h2><form data-form="custos" data-num="'+p.num+'" style="display:flex;flex-direction:column;gap:12px"><div class="campo"><label for="cu-c">Outros custos: mão de obra, embalagem, etc. (R$)</label><input id="cu-c" name="custo" type="number" min="0" step="0.01" value="'+num(p.custo)+'"></div><div class="campo"><label for="cu-t">Taxa da Shopee (R$)</label><input id="cu-t" name="taxa" type="number" min="0" step="0.01" value="'+num(p.taxa)+'"></div>'+botoesForm('Salvar')+'</form>');}
  else if(a==='editar'){p=acharPedido(b.getAttribute('data-num'));
    modal('<h2>Editar pedido '+numPedido(p.num)+'</h2><form data-form="editar" data-num="'+p.num+'" style="display:flex;flex-direction:column;gap:12px">'+
      '<div class="campo"><label for="ed-tel">WhatsApp</label><input id="ed-tel" name="telefone" value="'+esc(p.telefone)+'"></div>'+
      '<div class="campo"><label for="ed-ext">Nº do pedido na Shopee</label><input id="ed-ext" name="numExterno" value="'+esc(p.numExterno)+'"></div>'+
      '<div class="campos"><div class="campo"><label for="ed-pp">Prazo de produção</label><input id="ed-pp" name="prazoProducao" type="date" value="'+esc(p.prazoProducao||'')+'"></div><div class="campo"><label for="ed-pe">Entrega / despacho</label><input id="ed-pe" name="prazoEntrega" type="date" value="'+esc(p.prazoEntrega||'')+'"></div></div>'+
      '<div class="campos"><div class="campo"><label for="ed-tr">Transportadora</label><input id="ed-tr" name="transportadora" value="'+esc(p.transportadora)+'"></div><div class="campo"><label for="ed-ra">Código de rastreio</label><input id="ed-ra" name="rastreio" value="'+esc(p.rastreio)+'"></div></div>'+
      '<div class="campo"><label for="ed-ob">Observações</label><textarea id="ed-ob" name="obs">'+esc(p.obs)+'</textarea></div>'+botoesForm('Salvar')+'</form>');}
  else if(a==='repetir'){p=acharPedido(b.getAttribute('data-num'));
    modal('<h2>Repetir pedido '+numPedido(p.num)+'?</h2><p style="margin:0;color:var(--sec)">Cria um pedido novo para '+esc(p.cliente)+' com os mesmos itens e valores, prazo de produção em 7 dias.</p><div class="acoes"><button type="button" class="btn" data-acao="repetir-ok" data-num="'+p.num+'">Criar pedido</button><button type="button" class="btn contorno" data-acao="fechar">Cancelar</button></div>');}
  else if(a==='repetir-ok'){p=acharPedido(b.getAttribute('data-num'));fecharModal();
    var dados={cliente_nome:p.cliente,telefone:p.telefone,origem:p.origem,status:'novo',prazo_producao:maisDias(7),prazo_entrega:maisDias(9),frete:p.frete,desconto:p.desconto,custo:p.custo,taxa_shopee:p.taxa,
      observacoes:'Repetição do pedido '+numPedido(p.num),itens:p.itens.map(function(i){return {produto:i.produto,quantidade:i.qtd,valor_unitario:i.valor,personalizacao:i.pers};})};
    var novo=null;
    executar(async function(){novo=checar(await sb.rpc('criar_pedido',{p:dados}));}).then(function(ok){if(ok){aviso('Pedido '+numPedido(novo)+' criado.');ir('pedido-'+novo);}});}
  else if(a==='ordem'){p=acharPedido(b.getAttribute('data-num'));
    modal('<h2>Ordem de produção '+numPedido(p.num)+'</h2><div class="valores"><div><span>Cliente</span><span>'+esc(p.cliente)+'</span></div><div><span>Prazo de produção</span><b>'+dataLonga(p.prazoProducao)+'</b></div></div><div class="lista">'+p.itens.map(function(i){return '<div class="item"><div class="info"><b>'+esc(i.qtd)+'× '+esc(i.produto)+'</b><span style="white-space:normal">'+esc(i.pers||'Sem personalização')+'</span></div></div>';}).join('')+'</div>'+(p.obs?'<p style="margin:0;font-size:14px"><b>Obs.:</b> '+esc(p.obs)+'</p>':'')+'<div class="acoes"><button type="button" class="btn" data-acao="imprimir">Imprimir</button><button type="button" class="btn contorno" data-acao="fechar">Fechar</button></div>');}
  else if(a==='imprimir'){window.print();}
  else if(a==='mes'){var d=+b.getAttribute('data-d'),mm=estado.mesCaixa[1]+d,aa=estado.mesCaixa[0];if(mm<0){mm=11;aa--;}if(mm>11){mm=0;aa++;}estado.mesCaixa=[aa,mm];desenhar();}
  else if(a==='tipo'){estado.tipoNovo=b.getAttribute('data-t');desenhar();}
  else if(a==='excluir-lanc'){var id=b.getAttribute('data-id'),c2=db.caixa.filter(function(x){return x.id===id;})[0];
    modal('<h2>Excluir lançamento?</h2><p style="margin:0;color:var(--sec)">'+esc(c2.descricao)+' · '+brl(c2.valor)+(c2.pedidoId?'<br>Este valor sairá do recebido do pedido.':'')+'</p><div class="acoes"><button type="button" class="btn perigo" data-acao="excluir-ok" data-id="'+id+'">Excluir</button><button type="button" class="btn contorno" data-acao="fechar">Cancelar</button></div>');}
  else if(a==='excluir-ok'){var id2=b.getAttribute('data-id');fecharModal();executar(async function(){checar(await sb.from('caixa').delete().eq('id',id2));},'Lançamento excluído.').then(desenhar);}
  else if(a==='mov'){var mt=acharMaterial(b.getAttribute('data-id')),t=b.getAttribute('data-t');
    var pac=t==='entrada'&&mt.unidEmb>0;
    modal('<h2>'+(t==='entrada'?'Entrada':'Saída')+' de material</h2><p style="margin:0;color:var(--sec)">'+esc(mt.nome)+' · hoje: '+qtdTxt(mt.qtd)+' '+esc(mt.unidade)+'</p><form data-form="mov" data-id="'+mt.id+'" data-t="'+t+'" style="display:flex;flex-direction:column;gap:12px">'+
      (pac?'<div class="campo"><label for="mv-q">Quantas embalagens? ('+esc(mt.embalagem||'embalagem')+' com '+qtdTxt(mt.unidEmb)+' '+esc(mt.unidade)+')</label><input id="mv-q" name="qtd" type="number" min="1" step="1" required value="1"></div><input type="hidden" name="pacote" value="1">':'<div class="campo"><label for="mv-q">Quantidade ('+esc(mt.unidade)+')</label><input id="mv-q" name="qtd" type="number" min="0.01" step="0.01" required value="1"></div>')+
      (t==='saida'?'<div class="campo"><label for="mv-m">Motivo</label><select id="mv-m" name="motivo"><option value="consumo">Consumo em pedido</option><option value="perda">Perda ou erro</option></select></div><div class="campo"><label for="mv-p">Pedido (opcional)</label><select id="mv-p" name="pedido"><option value="">—</option>'+db.pedidos.filter(aberto).map(function(x){return '<option value="'+x.id+'">'+numPedido(x.num)+' · '+esc(x.cliente)+'</option>';}).join('')+'</select></div>':
      '<div class="campo"><label for="mv-c">Valor total pago (R$)</label><input id="mv-c" name="valor" type="number" min="0" step="0.01" placeholder="Deixe vazio para não lançar no caixa"></div><p class="dica" style="margin:0">Com o valor, a compra entra no caixa e o custo por unidade é atualizado.</p><div class="campo"><label for="mv-f">Forma de pagamento</label><select id="mv-f" name="forma">'+FORMAS.map(function(o){return '<option>'+o+'</option>';}).join('')+'</select></div>')+
      botoesForm('Confirmar')+'</form>');}
  else if(a==='novo-mat'){modal(formMaterial(null));atualizarPreviaMat();}
  else if(a==='editar-mat'){modal(formMaterial(acharMaterial(b.getAttribute('data-id'))));atualizarPreviaMat();}
  else if(a==='usar-mat'){p=acharPedido(b.getAttribute('data-num'));
    if(!db.materiais.length){aviso('Cadastre os materiais no Estoque primeiro.');return;}
    modal('<h2>Material usado no pedido '+numPedido(p.num)+'</h2><form data-form="uso" data-num="'+p.num+'" style="display:flex;flex-direction:column;gap:12px">'+
      '<div class="campo"><label for="us-m">Material</label><select id="us-m" name="material">'+db.materiais.map(function(m){return '<option value="'+m.id+'">'+esc(m.nome)+' · '+brl4(m.custo)+' por '+esc(m.unidade)+' · tem '+qtdTxt(m.qtd)+'</option>';}).join('')+'</select></div>'+
      '<div class="campo"><label for="us-q">Quantidade usada</label><input id="us-q" name="qtd" type="number" min="0.01" step="0.01" required value="1"></div>'+
      '<div class="campo"><label for="us-t">Tipo</label><select id="us-t" name="tipo"><option value="consumo">Usado no pedido</option><option value="perda">Perda ou erro (também entra no custo)</option></select></div>'+
      '<div class="aviso-demo" id="us-prev" style="background:var(--teal-cl);color:var(--teal-esc);font-weight:600"></div>'+
      botoesForm('Lançar')+'</form>');atualizarPreviaUso();}
  else if(a==='desfazer-uso'){var idu=b.getAttribute('data-id');
    modal('<h2>Remover este material do pedido?</h2><p style="margin:0;color:var(--sec)">A quantidade volta para o estoque e o custo sai do pedido.</p><div class="acoes"><button type="button" class="btn perigo" data-acao="desfazer-ok" data-id="'+idu+'">Remover</button><button type="button" class="btn contorno" data-acao="fechar">Cancelar</button></div>');}
  else if(a==='desfazer-ok'){var idd=b.getAttribute('data-id');fecharModal();executar(async function(){checar(await sb.from('movimentos_estoque').delete().eq('id',idd));},'Material devolvido ao estoque.').then(desenhar);}
});

document.addEventListener('change',function(e){
  var s=e.target;
  if(s.closest&&s.closest('[data-form="uso"]')){atualizarPreviaUso();return;}
  if(s.getAttribute&&s.getAttribute('data-acao')==='mudar-status'){
    var p=acharPedido(s.getAttribute('data-num')),novo=s.value;
    executar(async function(){checar(await sb.from('pedidos').update({status:novo}).eq('id',p.id));},'Situação atualizada: '+statusInfo(novo)[1]+'.').then(desenhar);
  }
});
document.addEventListener('input',function(e){
  if(e.target.id==='busca'){estado.busca=e.target.value;desenharListaPedidos();}
  if(e.target.id==='np-cli'){
    var nome=e.target.value.trim().toLowerCase(),tel=document.getElementById('np-tel');
    var c=db.clientes.filter(function(x){return x.nome.toLowerCase()===nome;})[0];
    if(c&&c.telefone&&tel&&!tel.value)tel.value=c.telefone;
  }
  if(e.target.closest&&e.target.closest('[data-form="pedido"]'))atualizarTotalNovo();
  if(e.target.closest&&e.target.closest('[data-form="mat"]'))atualizarPreviaMat();
  if(e.target.closest&&e.target.closest('[data-form="uso"]'))atualizarPreviaUso();
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')fecharModal();});

document.addEventListener('submit',function(e){
  var f=e.target,t=f.getAttribute('data-form');if(!t)return;
  e.preventDefault();
  if(t==='login'){
    var btn=f.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Entrando…';
    sb.auth.signInWithPassword({email:f.email.value.trim(),password:f.senha.value}).then(function(r){
      if(r.error){estado.erroLogin=msgErro(r.error);desenhar();return;}
      return aposLogin(r.data.user);
    }).catch(function(err){estado.erroLogin=msgErro(err);desenhar();});
    return;
  }
  if(t==='primeiro'){
    if(f.senha.value!==f.confirma.value){estado.erroLogin='As senhas não são iguais.';desenhar();return;}
    var bt=f.querySelector('button[type=submit]');bt.disabled=true;bt.textContent='Criando…';
    var em=f.email.value.trim(),se=f.senha.value;
    sb.rpc('primeiro_acesso',{p_nome:f.nome.value.trim(),p_email:em,p_senha:se}).then(function(r){
      if(r.error)throw r.error;
      estado.configurado=true;
      return sb.auth.signInWithPassword({email:em,password:se});
    }).then(function(r){
      if(r.error)throw r.error;
      aviso('Login criado. Bem-vindos!');
      return aposLogin(r.data.user);
    }).catch(function(err){estado.erroLogin=msgErro(err);desenhar();});
    return;
  }
  if(t==='pedido'){salvarNovoPedido(f);return;}
  var fim=function(ok){if(ok){fecharModal();desenhar();}};
  if(t==='receber'){
    var p=acharPedido(f.getAttribute('data-num')),v=num(f.valor.value),s=saldoPedido(p);
    if(v<=0){aviso('Informe um valor.');return;}
    if(v>s+0.001){aviso('O valor passa do saldo a receber ('+brl(s)+').');return;}
    executar(async function(){checar(await sb.from('caixa').insert({data:f.data.value,tipo:'entrada',categoria:'Recebimento de pedido',descricao:'Pedido '+numPedido(p.num)+' · recebimento',valor:v,forma:f.forma.value,pedido_id:p.id}));},'Recebimento lançado no caixa.').then(fim);
  }
  else if(t==='custos'){
    var p2=acharPedido(f.getAttribute('data-num'));
    executar(async function(){checar(await sb.from('pedidos').update({custo:num(f.custo.value),taxa_shopee:num(f.taxa.value)}).eq('id',p2.id));},'Custos atualizados.').then(fim);
  }
  else if(t==='editar'){
    var p3=acharPedido(f.getAttribute('data-num'));
    executar(async function(){checar(await sb.from('pedidos').update({telefone:f.telefone.value.trim()||null,numero_externo:f.numExterno.value.trim()||null,prazo_producao:f.prazoProducao.value||null,prazo_entrega:f.prazoEntrega.value||null,transportadora:f.transportadora.value.trim()||null,rastreio:f.rastreio.value.trim()||null,observacoes:f.obs.value.trim()||null}).eq('id',p3.id));},'Pedido atualizado.').then(fim);
  }
  else if(t==='meta'){
    executar(async function(){checar(await sb.from('configuracoes').update({meta_mensal:num(f.valor.value)}).eq('id',1));},'Meta salva.').then(fim);
  }
  else if(t==='lanc'){
    var tipo=estado.tipoNovo,dt=f.data.value;
    executar(async function(){checar(await sb.from('caixa').insert({data:dt,tipo:tipo,categoria:f.categoria.value,descricao:f.descricao.value.trim(),valor:num(f.valor.value),forma:f.forma.value}));},(tipo==='entrada'?'Entrada':'Saída')+' lançada.')
      .then(function(ok){if(ok){var d=paraData(dt);estado.mesCaixa=[d.getFullYear(),d.getMonth()];desenhar();}});
  }
  else if(t==='mov'){
    var m=acharMaterial(f.getAttribute('data-id')),tp=f.getAttribute('data-t'),q=num(f.qtd.value);
    var pac=!!f.pacote,emb=q;if(pac)q=emb*m.unidEmb;
    if(tp==='saida'&&q>num(m.qtd)){aviso('Não há '+qtdTxt(q)+' '+m.unidade+' em estoque.');return;}
    executar(async function(){
      if(tp==='entrada'){
        checar(await sb.from('movimentos_estoque').insert({material_id:m.id,tipo:'entrada',quantidade:q}));
        var valor=num(f.valor.value);
        if(valor>0){
          checar(await sb.from('caixa').insert({tipo:'saida',categoria:'Materiais',descricao:'Compra: '+(pac?emb+' '+(m.embalagem||'embalagem')+' ('+qtdTxt(q)+' '+m.unidade+')':qtdTxt(q)+' '+m.unidade)+' de '+m.nome,valor:valor,forma:f.forma.value}));
          if(pac)checar(await sb.from('materiais').update({valor_embalagem:Math.round(valor/emb*100)/100}).eq('id',m.id));
          else checar(await sb.from('materiais').update({custo_unitario:Math.round(valor/q*10000)/10000,valor_embalagem:null,unidades_embalagem:null}).eq('id',m.id));
        }
      } else {
        checar(await sb.from('movimentos_estoque').insert({material_id:m.id,tipo:f.motivo.value,quantidade:q,pedido_id:f.pedido.value||null}));
      }
    },tp==='entrada'?'Entrada registrada.':'Saída registrada.').then(fim);
  }
  else if(t==='uso'){
    var pu=acharPedido(f.getAttribute('data-num')),mu=acharMaterial(f.material.value),qu=num(f.qtd.value);
    if(qu<=0){aviso('Informe a quantidade.');return;}
    if(qu>num(mu.qtd)){aviso('Só tem '+qtdTxt(mu.qtd)+' '+mu.unidade+' de '+mu.nome+' no estoque.');return;}
    executar(async function(){checar(await sb.from('movimentos_estoque').insert({material_id:mu.id,tipo:f.tipo.value,quantidade:qu,pedido_id:pu.id}));},'Material lançado no pedido.').then(fim);
  }
  else if(t==='mat'){
    var idm=f.getAttribute('data-id'),c=calcCustoMat(f);
    var dadosM={nome:f.nome.value.trim(),unidade:f.unidade.value.trim(),categoria:f.categoria.value.trim()||null,minimo:num(f.minimo.value),fornecedor:f.fornecedor.value.trim()||null,
      embalagem:f.embalagem.value.trim()||null,unidades_embalagem:c.pacote?c.u:null,valor_embalagem:c.pacote?c.v:null,custo_unitario:c.custo};
    var novaQ=num(f.qtd.value);
    if(!idm){
      dadosM.quantidade=novaQ;
      executar(async function(){checar(await sb.from('materiais').insert(dadosM));},'Material cadastrado.').then(fim);
    } else {
      var mAnt=acharMaterial(idm);
      executar(async function(){
        checar(await sb.from('materiais').update(dadosM).eq('id',idm));
        if(Math.abs(novaQ-num(mAnt.qtd))>0.0001)checar(await sb.from('movimentos_estoque').insert({material_id:idm,tipo:'ajuste',quantidade:novaQ,observacao:'Ajuste na edição do material'}));
      },'Material atualizado.').then(fim);
    }
  }
});

/* atualiza ao voltar para o app (a outra pessoa pode ter mudado algo) */
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState!=='visible'||!usuario||ocupado||document.getElementById('modal')||rota()==='novo-pedido')return;
  recarregar().then(desenhar).catch(function(){});
});

/* ---------- início ---------- */
async function iniciar(){
  if(!sb){desenhar();return;}
  sb.auth.onAuthStateChange(function(ev){if(ev==='SIGNED_OUT'){usuario=null;desenhar();}});
  try{
    var r=await sb.auth.getSession();
    var s=r.data&&r.data.session;
    if(s&&s.user){await aposLogin(s.user);return;}
  }catch(e){}
  try{var c=await sb.rpc('sistema_configurado');if(!c.error)estado.configurado=c.data;}catch(e){}
  desenhar();
}
iniciar();
})();

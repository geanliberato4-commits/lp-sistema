(function(){
'use strict';
var LOGO = 'logo.png';

/* =====================================================================
   Constantes
   ===================================================================== */
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
var ORDEM_STATUS={orcamento:0,novo:1,aguardando_pagamento:2,aguardando_arte:3,em_producao:4,pronto_envio:5,enviado:6,finalizado:7,cancelado:-1};
var STATUS_ORC=[['elaboracao','Em elaboração','gray'],['enviado','Enviado','blue'],['aprovado','Aprovado','green'],['recusado','Recusado','red'],['vencido','Vencido','gold']];
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
var SUGESTOES=[80,100,150];

/* =====================================================================
   Utilidades
   ===================================================================== */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var fmtBRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
var fmtBRL4=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:4});
function brl(v){return fmtBRL.format(Number(v)||0);}
function brl4(v){return fmtBRL4.format(Number(v)||0);}
function pct(v){return (Math.round((Number(v)||0)*10)/10).toString().replace('.',',')+'%';}
function qtdTxt(v){return String(Math.round(num(v)*1000)/1000).replace('.',',');}
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
function r2(v){return Math.round(v*100)/100;}
function statusInfo(id){for(var i=0;i<STATUS.length;i++){if(STATUS[i][0]===id)return STATUS[i];}return STATUS[1];}
function chipStatus(id){var s=statusInfo(id);return '<span class="chip '+s[2]+'">'+esc(s[1])+'</span>';}
function aberto(p){return !p.excluido&&p.status!=='finalizado'&&p.status!=='cancelado'&&p.status!=='orcamento';}
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
function opcoes(lista,sel){return lista.map(function(o){var v=Array.isArray(o)?o[0]:o,t=Array.isArray(o)?o[1]:o;return '<option value="'+esc(v)+'"'+(String(v)===String(sel)?' selected':'')+'>'+esc(t)+'</option>';}).join('');}
function digitosWpp(t){var d=String(t||'').replace(/\D/g,'');if(d&&d.length<=11)d='55'+d;return d;}

/* =====================================================================
   Conexão com o Supabase
   ===================================================================== */
var CFG=window.LP_CONFIG||{};
var configurado=CFG.url&&CFG.url.indexOf('http')===0&&CFG.chave&&CFG.chave.indexOf('COLE_AQUI')<0;
var sb=configurado&&window.supabase?window.supabase.createClient(CFG.url,CFG.chave):null;

var db={pedidos:[],caixa:[],materiais:[],clientes:[],usos:[],produtos:[],orcamentos:[],cfg:{meta:0,shopeePct:0,shopeeFixo:0,shopeeFixoPor:'pedido',outrasPct:0,statusBaixa:'em_producao'}};
var usuario=null;
var ocupado=false;

function msgErro(e){
  var m=(e&&(e.message||e.error_description))||String(e||'Erro desconhecido');
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return 'Sem conexão com a internet. Tente de novo.';
  if(/Invalid login credentials/i.test(m))return 'E-mail ou senha incorretos.';
  if(/row-level security/i.test(m))return 'Seu usuário não tem permissão para isso.';
  if(/violates foreign key/i.test(m)&&/produto_insumos/i.test(m))return 'Este material está na ficha técnica de algum produto. Tire-o da ficha antes.';
  if(/violates foreign key/i.test(m))return 'Este registro está ligado a outros dados e não pode ser apagado.';
  return m;
}
function checar(r){if(r.error)throw r.error;return r.data;}
function carregandoSim(t){if(document.querySelector('.carregando'))return;var d=document.createElement('div');d.className='carregando';d.textContent=t||'Salvando…';document.body.appendChild(d);}
function carregandoNao(){document.querySelectorAll('.carregando').forEach(function(x){x.remove();});}
async function executar(fn,sucesso){
  if(ocupado)return false;
  ocupado=true;carregandoSim();
  try{await fn();await recarregar();if(sucesso)aviso(sucesso);return true;}
  catch(e){var m=msgErro(e);if(m.indexOf('\n')>=0){modal('<h2>Não foi possível</h2><p style="margin:0;white-space:pre-line">'+esc(m)+'</p><button type="button" class="btn contorno" data-acao="fechar">Entendi</button>');}else aviso(m);return false;}
  finally{ocupado=false;carregandoNao();}
}

function mapPedido(r){
  return {
    id:r.id,num:r.numero,clienteId:r.cliente_id,cliente:r.cliente_nome,telefone:r.telefone||'',origem:r.origem,numExterno:r.numero_externo||'',
    itens:(r.pedido_itens||[]).slice().sort(function(a,b){return a.ordem-b.ordem;}).map(function(i){return {produtoId:i.produto_id,produto:i.produto,variacao:i.variacao||'',qtd:num(i.quantidade),valor:num(i.valor_unitario),pers:i.personalizacao||'',cMat:num(i.custo_materiais_unit),cExt:num(i.custo_extra_unit),insumos:i.insumos||[]};}),
    frete:num(r.frete),desconto:num(r.desconto),status:r.status,prazoProducao:r.prazo_producao,prazoEntrega:r.prazo_entrega,
    custo:num(r.custo),taxa:num(r.taxa_shopee),obs:r.observacoes||'',transportadora:r.transportadora||'',rastreio:r.rastreio||'',
    criado:iso(new Date(r.criado_em)),criadoPor:r.criado_por||'',orcamentoId:r.orcamento_id,
    excluido:!!r.excluido_em,excluidoEm:r.excluido_em?iso(new Date(r.excluido_em)):'',excluidoPor:r.excluido_por||'',motivoExclusao:r.motivo_exclusao||'',
    historico:(r.pedido_historico||[]).slice().sort(function(a,b){return a.criado_em<b.criado_em?-1:1;}).map(function(h){return {data:iso(new Date(h.criado_em)),texto:h.texto,usuario:h.usuario||''};})
  };
}
function mapProduto(r){
  return {id:r.id,codigo:r.codigo||'',nome:r.nome,categoria:r.categoria||'',descricao:r.descricao||'',variacoes:r.variacoes||'',foto:r.foto_url||'',
    preco:num(r.preco_venda),maoObra:num(r.mao_obra),embalagem:num(r.custo_embalagem),outros:num(r.outros_custos),acrescimo:r.acrescimo_percentual==null?null:num(r.acrescimo_percentual),ativo:r.ativo!==false,
    insumos:(r.produto_insumos||[]).map(function(i){return {materialId:i.material_id,qtd:num(i.quantidade)};})};
}
function mapOrcamento(r){
  return {id:r.id,num:r.numero,cliente:r.cliente_nome,contato:r.contato||'',data:r.data,validade:r.validade,prazo:r.prazo||'',canal:r.canal,status:r.status,
    desconto:num(r.desconto),frete:num(r.frete),obs:r.observacoes||'',pedidoId:r.pedido_id,criadoPor:r.criado_por||'',
    itens:(r.orcamento_itens||[]).slice().sort(function(a,b){return a.ordem-b.ordem;}).map(function(i){return {produtoId:i.produto_id,descricao:i.descricao,variacao:i.variacao||'',qtd:num(i.quantidade),custo:num(i.custo_unitario),acrescimo:i.acrescimo_percentual==null?null:num(i.acrescimo_percentual),preco:num(i.preco_unitario),insumos:i.insumos||[]};})};
}
async function recarregar(){
  var res=await Promise.all([
    sb.from('pedidos').select('*, pedido_itens(*), pedido_historico(*)').order('numero',{ascending:false}),
    sb.from('caixa').select('*').order('data',{ascending:false}),
    sb.from('materiais').select('*').order('nome'),
    sb.from('clientes').select('id,nome,telefone').order('nome'),
    sb.from('configuracoes').select('*').eq('id',1).maybeSingle(),
    sb.from('movimentos_estoque').select('id,material_id,pedido_id,tipo,origem,quantidade,custo_unitario,criado_em').not('pedido_id','is',null),
    sb.from('produtos').select('*, produto_insumos(*)').order('nome'),
    sb.from('orcamentos').select('*, orcamento_itens(*)').order('numero',{ascending:false})
  ]);
  db.pedidos=checar(res[0]).map(mapPedido);
  db.caixa=checar(res[1]).map(function(c){return {id:c.id,data:c.data,tipo:c.tipo,categoria:c.categoria,descricao:c.descricao,valor:num(c.valor),forma:c.forma,pedidoId:c.pedido_id,criadoPor:c.criado_por||''};});
  db.materiais=checar(res[2]).map(function(m){return {id:m.id,nome:m.nome,descricao:m.descricao||'',unidade:m.unidade,qtd:num(m.quantidade),minimo:num(m.minimo),custo:num(m.custo_unitario),fornecedor:m.fornecedor||'',ultimaCompra:m.ultima_compra,categoria:m.categoria||'',embalagem:m.embalagem||'',unidEmb:num(m.unidades_embalagem),valorEmb:m.valor_embalagem==null?null:num(m.valor_embalagem)};});
  db.clientes=checar(res[3]);
  var c=checar(res[4])||{};
  db.cfg={meta:num(c.meta_mensal),shopeePct:num(c.shopee_percentual),shopeeFixo:num(c.shopee_fixo),shopeeFixoPor:c.shopee_fixo_por||'pedido',outrasPct:num(c.outras_despesas_percentual),statusBaixa:c.status_baixa||'em_producao'};
  db.usos=checar(res[5]).map(function(u){return {id:u.id,materialId:u.material_id,pedidoId:u.pedido_id,tipo:u.tipo,origem:u.origem||'manual',qtd:num(u.quantidade),custo:num(u.custo_unitario),data:iso(new Date(u.criado_em))};});
  db.produtos=checar(res[6]).map(mapProduto);
  db.orcamentos=checar(res[7]).map(mapOrcamento);
}

/* =====================================================================
   Cálculos
   ===================================================================== */
function acharPedido(n){for(var i=0;i<db.pedidos.length;i++)if(String(db.pedidos[i].num)===String(n))return db.pedidos[i];return null;}
function acharPedidoId(id){for(var i=0;i<db.pedidos.length;i++)if(db.pedidos[i].id===id)return db.pedidos[i];return null;}
function acharMaterial(id){for(var i=0;i<db.materiais.length;i++)if(db.materiais[i].id===id)return db.materiais[i];return null;}
function acharProduto(id){for(var i=0;i<db.produtos.length;i++)if(db.produtos[i].id===id)return db.produtos[i];return null;}
function acharOrc(n){for(var i=0;i<db.orcamentos.length;i++)if(String(db.orcamentos[i].num)===String(n))return db.orcamentos[i];return null;}
function resumoItens(p){return (p.itens||[]).map(function(i){return qtdTxt(i.qtd)+'× '+i.produto+(i.variacao?' ('+i.variacao+')':'');}).join(', ');}
function abaixoMinimo(){return db.materiais.filter(function(m){return num(m.qtd)<=num(m.minimo);});}

function totalPedido(p){var s=0;(p.itens||[]).forEach(function(i){s+=num(i.qtd)*num(i.valor);});return s+num(p.frete)-num(p.desconto);}
function recebidoPedido(p){var s=0;db.caixa.forEach(function(c){if(c.pedidoId!==p.id)return;if(c.tipo==='entrada')s+=num(c.valor);else if(c.categoria==='Devolução ao cliente')s-=num(c.valor);});return r2(s);}
function entradasPedido(p){var s=0;db.caixa.forEach(function(c){if(c.pedidoId===p.id&&c.tipo==='entrada')s+=num(c.valor);});return s;}
function saldoPedido(p){return Math.max(0,r2(totalPedido(p)-entradasPedido(p)));}
function usosPedido(p){return (db.usos||[]).filter(function(u){return u.pedidoId===p.id;});}
function custoMateriaisReal(p){var s=0;usosPedido(p).forEach(function(u){if(u.tipo==='consumo'||u.tipo==='perda')s+=u.qtd*u.custo;else if(u.tipo==='estorno')s-=u.qtd*u.custo;});return r2(s);}
function custoMateriaisEst(p){var s=0;p.itens.forEach(function(i){s+=i.qtd*i.cMat;});return r2(s);}
function custoExtras(p){var s=0;p.itens.forEach(function(i){s+=i.qtd*i.cExt;});return r2(s);}
function teveBaixa(p){return usosPedido(p).some(function(u){return u.tipo!=='entrada';});}
function usosManuais(p){
  // lançamentos manuais ainda em vigor (consumo/perda), para mostrar e permitir remover
  return usosPedido(p).filter(function(u){return u.origem==='manual'&&(u.tipo==='consumo'||u.tipo==='perda');});
}

/* custo de fabricação de um produto (ficha + extras) */
function custoMatProduto(pr){var s=0;(pr.insumos||[]).forEach(function(i){var m=acharMaterial(i.materialId);if(m)s+=i.qtd*m.custo;});return s;}
function custoProduto(pr){return custoMatProduto(pr)+pr.maoObra+pr.embalagem+pr.outros;}
function custoInsumos(lista){var s=0;(lista||[]).forEach(function(i){var m=acharMaterial(i.material_id||i.materialId);if(m)s+=num(i.quantidade!=null?i.quantidade:i.qtd)*m.custo;});return s;}

/* taxas da Shopee para um valor de venda (qtdItens para a tarifa por item) */
function taxasCanal(canal,valor,qtdItens){
  if(canal!=='Shopee')return {taxa:0,outras:0,total:0};
  var c=db.cfg,t=valor*c.shopeePct/100+c.shopeeFixo*(c.shopeeFixoPor==='item'?Math.max(1,qtdItens||1):1),o=valor*c.outrasPct/100;
  return {taxa:r2(t),outras:r2(o),total:r2(t+o)};
}
function analisePreco(custo,preco,canal){
  var tx=taxasCanal(canal,preco,1),lucro=preco-custo-tx.total;
  return {preco:preco,custo:custo,taxa:tx.taxa,outras:tx.outras,lucro:lucro,efetivo:preco>0?lucro/preco*100:0,sobreCusto:custo>0?lucro/custo*100:0};
}
function precoParaLucro(custo,lucro,canal){
  var c=db.cfg,p=canal==='Shopee'?(c.shopeePct+c.outrasPct)/100:0,f=canal==='Shopee'?c.shopeeFixo:0;
  if(p>=1)return 0;return r2((custo+f+lucro)/(1-p));
}

/* materiais necessários de uma lista de itens {insumos, qtd} */
function necessidades(itens){
  var mapa={};
  itens.forEach(function(i){(i.insumos||[]).forEach(function(x){var id=x.material_id||x.materialId;mapa[id]=(mapa[id]||0)+num(i.qtd)*num(x.quantidade!=null?x.quantidade:x.qtd);});});
  return Object.keys(mapa).map(function(id){var m=acharMaterial(id)||{nome:'Material removido',unidade:'',qtd:0,custo:0};return {id:id,m:m,q:mapa[id]};});
}
function baixadoFicha(p,materialId){var s=0;usosPedido(p).forEach(function(u){if(u.origem!=='ficha'||u.materialId!==materialId)return;if(u.tipo==='consumo')s+=u.qtd;else if(u.tipo==='estorno')s-=u.qtd;});return s;}
function etapaBaixaNome(){return statusInfo(db.cfg.statusBaixa)[1];}

/* =====================================================================
   Rotas
   ===================================================================== */
var estado={filtroStatus:'abertos',busca:'',mesCaixa:null,tipoNovo:'entrada',erroLogin:'',filtroOrc:'abertos',buscaProd:'',caixaAba:'lanc'};
function rota(){var h=(location.hash||'').replace('#','');return h||'painel';}
function ir(r){if(location.hash==='#'+r){desenhar();}else{location.hash=r;}}
window.addEventListener('hashchange',function(){desenhar();window.scrollTo(0,0);});
var raiz=document.getElementById('raiz');

function desenhar(){
  if(!sb){raiz.innerHTML=telaSemConfig();return;}
  if(!usuario){raiz.innerHTML=estado.configurado===false?telaPrimeiroAcesso():telaLogin();return;}
  var r=rota(),titulo='Painel',corpo='',sec='painel',m;
  if(r==='pedidos'){titulo='Pedidos';corpo=telaPedidos();sec='pedidos';}
  else if(r==='novo-pedido'){titulo='Novo pedido';corpo=telaFormPedido(null);sec='pedidos';}
  else if((m=r.match(/^editar-pedido-(\d+)$/))){var pe=acharPedido(m[1]);titulo='Editar pedido';corpo=pe?telaFormPedido(pe):'<div class="card">Pedido não encontrado.</div>';sec='pedidos';}
  else if((m=r.match(/^pedido-(\d+)$/))){var p=acharPedido(m[1]);titulo=p?'Pedido '+numPedido(p.num):'Pedido';corpo=p?telaPedido(p):'<div class="card">Pedido não encontrado.</div>';sec='pedidos';}
  else if(r==='orcamentos'){titulo='Orçamentos';corpo=telaOrcamentos();sec='orcamentos';}
  else if(r==='novo-orcamento'){titulo='Novo orçamento';corpo=telaFormOrc(null,false);sec='orcamentos';}
  else if((m=r.match(/^editar-orcamento-(\d+)$/))){var oe=acharOrc(m[1]);titulo='Editar orçamento';corpo=oe?telaFormOrc(oe,false):'<div class="card">Orçamento não encontrado.</div>';sec='orcamentos';}
  else if((m=r.match(/^duplicar-orcamento-(\d+)$/))){var od=acharOrc(m[1]);titulo='Duplicar orçamento';corpo=od?telaFormOrc(od,true):'<div class="card">Orçamento não encontrado.</div>';sec='orcamentos';}
  else if((m=r.match(/^orcamento-(\d+)$/))){var o=acharOrc(m[1]);titulo=o?'Orçamento '+numPedido(o.num):'Orçamento';corpo=o?telaOrcamento(o):'<div class="card">Orçamento não encontrado.</div>';sec='orcamentos';}
  else if(r==='produtos'){titulo='Produtos';corpo=telaProdutos();sec='produtos';}
  else if(r==='novo-produto'){titulo='Novo produto';corpo=telaFormProduto(null);sec='produtos';}
  else if((m=r.match(/^produto-([0-9a-f-]{36})$/))){var pr=acharProduto(m[1]);titulo='Produto';corpo=pr?telaFormProduto(pr):'<div class="card">Produto não encontrado.</div>';sec='produtos';}
  else if(r==='caixa'){titulo='Caixa';corpo=telaCaixa();sec='caixa';}
  else if(r==='estoque'){titulo='Estoque';corpo=telaEstoque();sec='estoque';}
  else if(r==='ajustes'){titulo='Ajustes';corpo=telaAjustes();sec='ajustes';}
  else {corpo=telaPainel();}
  raiz.innerHTML=casca(titulo,sec,corpo);
  if(r==='pedidos')desenharListaPedidos();
  if(r==='novo-pedido'||/^editar-pedido-/.test(r))atualizarFormPedido();
  if(r==='novo-orcamento'||/^(editar|duplicar)-orcamento-/.test(r))atualizarFormOrc();
  if(r==='novo-produto'||/^produto-/.test(r))atualizarFormProduto();
}

function icone(n){
  var p={
    painel:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    pedidos:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/>',
    orc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/>',
    produtos:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    caixa:'<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 6V4h12v2"/>',
    estoque:'<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    ajustes:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    mais:'<path d="M12 5v14M5 12h14"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    voltar:'<path d="M15 18l-6-6 6-6"/>',
    wpp:'<path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 21l2.2-5.3A8.4 8.4 0 1 1 21 11.5z"/>',
    copiar:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    pdf:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15l3 3 3-3"/>'
  }[n]||'';
  return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
}

function casca(titulo,sec,corpo){
  function lk(r,nome,ic){return '<a href="#'+r+'" class="'+(sec===r?'ativo':'')+'">'+icone(ic)+nome+'</a>';}
  var maisAtivo=['produtos','estoque','caixa','ajustes'].indexOf(sec)>=0;
  return '<div class="app">'+
    '<aside class="side"><img src="'+LOGO+'" alt="LP Personalizados">'+
      '<nav aria-label="Menu principal">'+lk('painel','Painel','painel')+lk('pedidos','Pedidos','pedidos')+lk('orcamentos','Orçamentos','orc')+lk('produtos','Produtos','produtos')+
      lk('estoque','Estoque','estoque')+lk('caixa','Caixa','caixa')+lk('ajustes','Ajustes','ajustes')+'</nav>'+
      '<div class="usuario"><span>Conectado como <b style="color:#fff">'+esc(usuario.nome)+'</b></span>'+
      '<button type="button" data-acao="atualizar">Atualizar dados</button>'+
      '<button type="button" data-acao="sair">Sair</button></div>'+
    '</aside>'+
    '<div class="principal">'+
      '<header class="topo"><img src="'+LOGO+'" alt="LP Personalizados"><div class="tit"><b>'+esc(titulo)+'</b><span>'+esc(hojeExtenso())+'</span></div></header>'+
      '<main class="conteudo">'+corpo+'</main>'+
    '</div>'+
    '<nav class="inferior" aria-label="Menu principal">'+
      '<a href="#painel" class="'+(sec==='painel'?'ativo':'')+'">'+icone('painel')+'Painel</a>'+
      '<a href="#pedidos" class="'+(sec==='pedidos'?'ativo':'')+'">'+icone('pedidos')+'Pedidos</a>'+
      '<a href="#" class="mais" data-acao="novo" aria-label="Novo pedido ou orçamento">'+icone('mais')+'</a>'+
      '<a href="#orcamentos" class="'+(sec==='orcamentos'?'ativo':'')+'">'+icone('orc')+'Orçamentos</a>'+
      '<a href="#" data-acao="menu" class="'+(maisAtivo?'ativo':'')+'">'+icone('menu')+'Mais</a>'+
    '</nav></div>';
}

/* =====================================================================
   Login
   ===================================================================== */
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
    '<div><h1>Primeiro acesso</h1><p style="margin:4px 0 0;color:var(--sec);font-size:14px">Crie o login que vocês vão usar no sistema.</p></div>'+
    (estado.erroLogin?'<div class="erro-login" role="alert">'+esc(estado.erroLogin)+'</div>':'')+
    '<div class="campo"><label for="pa-n">Nome que aparece no sistema</label><input id="pa-n" name="nome" required value="LP Personalizados"></div>'+
    '<div class="campo"><label for="pa-e">E-mail</label><input id="pa-e" name="email" type="email" autocomplete="username" required></div>'+
    '<div class="campo"><label for="pa-s">Senha (mínimo 8 caracteres)</label><input id="pa-s" name="senha" type="password" autocomplete="new-password" minlength="8" required></div>'+
    '<div class="campo"><label for="pa-c">Repita a senha</label><input id="pa-c" name="confirma" type="password" autocomplete="new-password" minlength="8" required></div>'+
    '<button class="btn cheio" type="submit">Criar login e entrar</button>'+
  '</form></div>';
}
async function aposLogin(user){
  var r=await sb.from('membros').select('nome').eq('user_id',user.id).maybeSingle();
  if(r.error||!r.data){
    estado.erroLogin='Este usuário ainda não tem acesso ao sistema.';
    await sb.auth.signOut();usuario=null;desenhar();return;
  }
  usuario={id:user.id,nome:r.data.nome};estado.erroLogin='';
  raiz.innerHTML='<div class="carregando">Carregando…</div>';
  try{await recarregar();}catch(e){aviso(msgErro(e));}
  desenhar();
}

/* =====================================================================
   Painel
   ===================================================================== */
function resumoMes(a,m){
  var ent=0,sai=0,itens=[];
  db.caixa.forEach(function(c){var d=paraData(c.data);if(d.getFullYear()===a&&d.getMonth()===m){itens.push(c);if(c.tipo==='entrada')ent+=num(c.valor);else sai+=num(c.valor);}});
  return {ent:ent,sai:sai,itens:itens};
}
function statusOrc(o){if(o.pedidoId)return 'aprovado';if((o.status==='elaboracao'||o.status==='enviado')&&o.validade&&difDias(o.validade)<0)return 'vencido';return o.status;}
function chipOrc(o){var s=statusOrc(o),i=STATUS_ORC.filter(function(x){return x[0]===s;})[0]||STATUS_ORC[0];return '<span class="chip '+i[2]+'">'+esc(i[1])+'</span>'+(o.pedidoId?' <span class="chip teal">Virou pedido</span>':'');}
function telaPainel(){
  var cont={};STATUS.forEach(function(s){cont[s[0]]=0;});
  var atrasados=0,proximos=0,aReceber=0;
  db.pedidos.forEach(function(p){
    if(p.excluido)return;
    cont[p.status]=(cont[p.status]||0)+1;
    if(aberto(p)){
      var d=difDias(p.prazoProducao);
      if(d!==null&&d<0)atrasados++;else if(d!==null&&d<=2)proximos++;
      aReceber+=saldoPedido(p);
    }
  });
  var orcAbertos=db.orcamentos.filter(function(o){var s=statusOrc(o);return s==='elaboracao'||s==='enviado';}).length;
  var baixos=abaixoMinimo();
  var agora=new Date(),m=resumoMes(agora.getFullYear(),agora.getMonth());
  var pc=db.cfg.meta>0?Math.min(100,Math.round(m.ent/db.cfg.meta*100)):0;
  function tile(id,nome,cls){return '<button type="button" class="tile '+(cls||'')+'" data-acao="filtrar" data-status="'+id+'"><b>'+(id==='atrasados'?atrasados:cont[id])+'</b><span>'+nome+'</span></button>';}
  var prox=db.pedidos.filter(aberto).sort(ordenarPrazo).slice(0,5);
  var alertas='';
  if(atrasados)alertas+='<div class="alerta"><i class="v"></i><span><b>'+atrasados+' pedido'+(atrasados>1?'s':'')+' atrasado'+(atrasados>1?'s':'')+'</b></span></div>';
  if(proximos)alertas+='<div class="alerta"><i class="o"></i><span><b>'+proximos+' pedido'+(proximos>1?'s':'')+'</b> vence'+(proximos>1?'m':'')+' em até 2 dias</span></div>';
  baixos.forEach(function(b){alertas+='<div class="alerta"><i class="o"></i><span><b>'+esc(b.nome)+'</b>: '+qtdTxt(b.qtd)+' '+esc(b.unidade)+' (mínimo '+qtdTxt(b.minimo)+')</span></div>';});
  if(orcAbertos)alertas+='<div class="alerta"><i class="t"></i><span><b>'+orcAbertos+' orçamento'+(orcAbertos>1?'s':'')+'</b> aguardando resposta</span></div>';
  if(aReceber>0)alertas+='<div class="alerta"><i class="t"></i><span><b>'+brl(aReceber)+'</b> a receber de pedidos em aberto</span></div>';
  if(!alertas)alertas='<div class="alerta"><i class="t"></i><span>Tudo em dia.</span></div>';
  var meta=db.cfg.meta>0?
    '<div style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;color:var(--sec)"><span>Meta do mês</span><span>'+pc+'% de '+brl(db.cfg.meta)+'</span></div><div class="barra"><div style="width:'+pc+'%"></div></div></div>':
    '<a href="#ajustes" class="btn contorno peq" style="align-self:flex-start">Definir meta do mês</a>';
  return '<div class="cab"><div><h1 class="so-desk">Painel</h1><p>Olá, '+esc(usuario.nome)+' · '+esc(hojeExtenso())+'</p></div><div class="acoes"><a class="btn contorno" href="#novo-orcamento">+ Orçamento</a><a class="btn ouro" href="#novo-pedido">+ Pedido</a></div></div>'+
  '<div class="grade">'+tile('novo','Novos')+tile('aguardando_pagamento','Aguard. pagamento')+tile('aguardando_arte','Aguardando arte','ouro')+tile('em_producao','Em produção','teal')+tile('pronto_envio','Pronto para envio')+tile('enviado','Enviados')+tile('atrasados','Atrasados','verm')+'</div>'+
  '<div class="dupla"><section class="card larga"><div class="linha-tit"><h2>Prazos próximos</h2><a href="#pedidos" style="font-size:13.5px;font-weight:600;text-decoration:none">Ver todos</a></div><div class="lista">'+
  (prox.length?prox.map(itemPedido).join(''):'<div class="vazio">Nenhum pedido em aberto.</div>')+'</div></section>'+
  '<div class="estreita" style="display:flex;flex-direction:column;gap:14px"><section class="card escuro"><h2>Alertas</h2>'+alertas+'</section>'+
  '<section class="card"><h2>Caixa de '+MESES[agora.getMonth()]+'</h2><div class="valores"><div><span>Entradas</span><b class="pos">'+brl(m.ent)+'</b></div><div><span>Saídas</span><b class="neg">'+brl(m.sai)+'</b></div><div class="total"><span style="color:var(--texto)">Saldo</span><span>'+brl(m.ent-m.sai)+'</span></div></div>'+meta+'</section></div></div>';
}
function itemPedido(p){
  return '<a class="item" href="#pedido-'+p.num+'"><div class="info"><b>'+numPedido(p.num)+' · '+esc(p.cliente)+'</b><span>'+esc(resumoItens(p))+'</span></div><div class="dir">'+chipPrazo(p)+'<span style="font-size:12.5px;color:var(--sec)">'+esc(statusInfo(p.status)[1])+'</span></div></a>';
}

/* =====================================================================
   Lista de pedidos
   ===================================================================== */
function telaPedidos(){
  var f=[['abertos','Em aberto'],['atrasados','Atrasados']].concat(STATUS.filter(function(s){return s[0]!=='orcamento';}).map(function(s){return [s[0],s[1]];})).concat([['todos','Todos'],['excluidos','Excluídos']]);
  return '<div class="cab"><div><h1>Pedidos</h1><p>Toque num pedido para ver, editar ou mudar a situação.</p></div><a class="btn ouro" href="#novo-pedido">+ Novo pedido</a></div>'+
  '<label class="sr" for="busca">Buscar pedido</label><input id="busca" class="busca" type="search" placeholder="Buscar por cliente, número ou produto" value="'+esc(estado.busca)+'">'+
  '<div class="filtros" role="group" aria-label="Filtrar por situação">'+f.map(function(x){return '<button type="button" data-acao="filtro" data-status="'+x[0]+'" class="'+(estado.filtroStatus===x[0]?'ativo':'')+'">'+esc(x[1])+'</button>';}).join('')+'</div>'+
  '<section class="card"><div class="lista" id="lista-pedidos"></div></section>';
}
function desenharListaPedidos(){
  var el=document.getElementById('lista-pedidos');if(!el)return;
  var b=estado.busca.trim().toLowerCase(),fs=estado.filtroStatus;
  var lst=db.pedidos.filter(function(p){
    if(fs==='excluidos')return p.excluido&&(!b||filtroTexto(p,b));
    if(p.excluido)return false;
    if(fs==='abertos'&&!aberto(p))return false;
    if(fs==='atrasados'&&!(aberto(p)&&difDias(p.prazoProducao)<0))return false;
    if(['abertos','todos','atrasados'].indexOf(fs)<0&&p.status!==fs)return false;
    return !b||filtroTexto(p,b);
  }).sort(['finalizado','cancelado','todos','excluidos'].indexOf(fs)>=0?function(a,b){return b.num-a.num;}:ordenarPrazo);
  el.innerHTML=lst.length?lst.map(function(p){
    return '<a class="item" href="#pedido-'+p.num+'"><div class="info"><b>'+numPedido(p.num)+' · '+esc(p.cliente)+'</b><span>'+esc(p.origem)+' · '+esc(resumoItens(p))+'</span></div><div class="dir">'+(p.excluido?'<span class="chip red">Excluído</span>':chipStatus(p.status))+'<span style="display:flex;gap:6px;align-items:center">'+(p.excluido?'':chipPrazo(p))+'<b style="font-size:13.5px">'+brl(totalPedido(p))+'</b></span></div></a>';
  }).join(''):'<div class="vazio">Nenhum pedido encontrado.</div>';
}
function filtroTexto(p,b){var t=(p.cliente+' '+p.num+' '+numPedido(p.num)+' '+resumoItens(p)+' '+p.origem+' '+(p.numExterno||'')+' '+statusInfo(p.status)[1]).toLowerCase();return t.indexOf(b)>=0;}

/* =====================================================================
   Formulário de pedido (novo e edição)
   ===================================================================== */
var uidN=0;
function opcoesProdutos(sel){
  var ativos=db.produtos.filter(function(p){return p.ativo||p.id===sel;});
  return '<option value="">Personalizado (sem cadastro)</option>'+ativos.map(function(p){return '<option value="'+p.id+'"'+(p.id===sel?' selected':'')+'>'+esc(p.nome)+(p.codigo?' · '+esc(p.codigo):'')+'</option>';}).join('');
}
function opcoesVariacao(prodId,sel){
  var pr=prodId?acharProduto(prodId):null,vs=pr&&pr.variacoes?pr.variacoes.split(/[,;\n]/).map(function(x){return x.trim();}).filter(Boolean):[];
  if(sel&&vs.indexOf(sel)<0)vs.push(sel);
  return '<option value="">—</option>'+vs.map(function(v){return '<option'+(v===sel?' selected':'')+'>'+esc(v)+'</option>';}).join('');
}
function linhaItemPedido(i){
  i=i||{produtoId:'',produto:'',variacao:'',qtd:1,valor:'',pers:'',cMat:0,cExt:0,insumos:[]};
  var k=++uidN,custoPers=r2(num(i.cMat)+num(i.cExt));
  return '<div class="item-pedido" data-item data-insumos="'+esc(JSON.stringify(i.produtoId?[]:(i.insumos||[])))+'">'+
  '<button type="button" class="remover" data-acao="remover-item" aria-label="Remover item">×</button>'+
  '<div class="campo" style="grid-column:1/-1;padding-right:36px"><label for="ip-'+k+'">Produto</label><select id="ip-'+k+'" name="produtoId" data-acao-mudar="item-produto">'+opcoesProdutos(i.produtoId)+'</select></div>'+
  '<div class="campo campo-desc" style="grid-column:1/-1'+(i.produtoId?';display:none':'')+'"><label for="pr-'+k+'">Descrição do item</label><input id="pr-'+k+'" name="produto" value="'+esc(i.produtoId?'':i.produto)+'" placeholder="Ex.: Topo de bolo personalizado"></div>'+
  '<div class="campo campo-var"'+(i.produtoId?'':' style="display:none"')+'><label for="va-'+k+'">Variação</label><select id="va-'+k+'" name="variacao">'+opcoesVariacao(i.produtoId,i.variacao)+'</select></div>'+
  '<div class="campo"><label for="qt-'+k+'">Quantidade</label><input id="qt-'+k+'" name="qtd" type="number" min="1" step="1" required value="'+esc(i.qtd)+'"></div>'+
  '<div class="campo"><label for="vl-'+k+'">Valor unitário (R$)</label><input id="vl-'+k+'" name="valor" type="number" min="0" step="0.01" required value="'+esc(i.valor)+'"></div>'+
  '<div class="campo campo-custo"'+(i.produtoId?' style="display:none"':'')+'><label for="cp-'+k+'">Custo unitário estimado (R$)</label><input id="cp-'+k+'" name="custoPers" type="number" min="0" step="0.01" value="'+(i.produtoId?'':custoPers)+'"></div>'+
  '<div class="campo" style="grid-column:1/-1"><label for="ps-'+k+'">Personalização</label><input id="ps-'+k+'" name="pers" value="'+esc(i.pers)+'" placeholder="Nome, tema, cores..."></div>'+
  '<div class="dica info-item" style="grid-column:1/-1"></div></div>';
}
function telaFormPedido(p){
  var ed=!!p;
  p=p||{origem:'WhatsApp',status:'novo',prazoProducao:maisDias(7),prazoEntrega:maisDias(9),frete:0,desconto:0,custo:0,taxa:0,itens:[null],cliente:'',telefone:'',numExterno:'',obs:''};
  var avisos='';
  if(ed&&p.status==='finalizado')avisos+='<div class="aviso-demo">Este pedido já está <b>finalizado</b>. As mudanças vão alterar custos e lucro já apurados.</div>';
  if(ed&&entradasPedido(p)>0)avisos+='<div class="aviso-demo">Este pedido tem <b>'+brl(entradasPedido(p))+'</b> recebidos no caixa. Se o total mudar, confira o saldo depois.</div>';
  if(ed&&teveBaixa(p))avisos+='<div class="aviso-demo" style="background:var(--teal-cl);color:var(--teal-esc)">Os materiais deste pedido já saíram do estoque. Ao salvar, o sistema ajusta só a diferença.</div>';
  return '<div class="cab"><div><h1>'+(ed?'Editar pedido '+numPedido(p.num):'Novo pedido')+'</h1><p>'+(ed?'Corrija o que precisar e salve.':'O número é gerado automaticamente ao salvar.')+'</p></div>'+(ed?'<a class="btn contorno" href="#pedido-'+p.num+'">Voltar</a>':'')+'</div>'+avisos+
  '<form data-form="pedido" '+(ed?'data-id="'+p.id+'" data-num="'+p.num+'"':'')+' style="display:flex;flex-direction:column;gap:14px">'+
  '<datalist id="lista-clientes">'+db.clientes.map(function(c){return '<option value="'+esc(c.nome)+'">';}).join('')+'</datalist>'+
  '<section class="card"><h2>Cliente e canal</h2><div class="campos">'+
    '<div class="campo"><label for="np-cli">Cliente</label><input id="np-cli" name="cliente" required placeholder="Nome do cliente" list="lista-clientes" autocomplete="off" value="'+esc(p.cliente)+'"></div>'+
    '<div class="campo"><label for="np-tel">WhatsApp</label><input id="np-tel" name="telefone" inputmode="tel" placeholder="(19) 90000-0000" value="'+esc(p.telefone)+'"></div>'+
    '<div class="campo"><label for="np-ori">Canal de venda</label><select id="np-ori" name="origem">'+opcoes(ORIGENS,p.origem)+'</select></div>'+
    '<div class="campo"><label for="np-ext">Nº do pedido na Shopee</label><input id="np-ext" name="numExterno" placeholder="Se houver" value="'+esc(p.numExterno)+'"></div>'+
  '</div></section>'+
  '<section class="card"><div class="linha-tit"><h2>Itens</h2><button type="button" class="btn contorno peq" data-acao="add-item">+ Adicionar item</button></div>'+
    (db.produtos.length?'':'<p class="dica" style="margin:0">Cadastre seus produtos com ficha técnica na aba Produtos para o custo e a baixa do estoque serem automáticos.</p>')+
    '<div id="itens" style="display:flex;flex-direction:column;gap:10px">'+p.itens.map(linhaItemPedido).join('')+'</div></section>'+
  '<section class="card"><h2>Valores e prazos</h2><div class="campos">'+
    '<div class="campo"><label for="np-fr">Frete cobrado do cliente (R$)</label><input id="np-fr" name="frete" type="number" min="0" step="0.01" value="'+num(p.frete)+'"></div>'+
    '<div class="campo"><label for="np-de">Desconto (R$)</label><input id="np-de" name="desconto" type="number" min="0" step="0.01" value="'+num(p.desconto)+'"></div>'+
    (ed?'':'<div class="campo"><label for="np-si">Sinal recebido agora (R$)</label><input id="np-si" name="sinal" type="number" min="0" step="0.01" value="0"></div>'+
    '<div class="campo"><label for="np-fs">Forma do sinal</label><select id="np-fs" name="formaSinal">'+opcoes(FORMAS)+'</select></div>')+
    '<div class="campo"><label for="np-pp">Prazo de produção</label><input id="np-pp" name="prazoProducao" type="date" value="'+esc(p.prazoProducao||'')+'"></div>'+
    '<div class="campo"><label for="np-pe">Prazo de entrega ou despacho</label><input id="np-pe" name="prazoEntrega" type="date" value="'+esc(p.prazoEntrega||'')+'"></div>'+
    '<div class="campo"><label for="np-st">Situação</label><select id="np-st" name="status">'+opcoes(STATUS.filter(function(s){return s[0]!=='cancelado'&&s[0]!=='orcamento';}).map(function(s){return [s[0],s[1]];}),p.status==='cancelado'?'novo':p.status)+'</select></div>'+
  '</div><div class="aviso-demo" id="np-total" style="background:var(--teal-cl);color:var(--teal-esc);font-weight:600"></div></section>'+
  '<section class="card"><h2>Custos e taxas</h2><div class="campos">'+
    '<div class="campo"><label for="np-tx">Taxas e despesas da Shopee (R$)</label><input id="np-tx" name="taxa" type="number" min="0" step="0.01" value="'+num(p.taxa)+'"'+(ed?' data-manual="1"':'')+'></div>'+
    '<div class="campo"><label for="np-cu">Outros custos do pedido (R$)</label><input id="np-cu" name="custo" type="number" min="0" step="0.01" value="'+num(p.custo)+'"></div>'+
    '<div class="campo todo"><label for="np-ob">Observações</label><textarea id="np-ob" name="obs">'+esc(p.obs)+'</textarea></div>'+
  '</div><p class="dica" id="np-taxa-dica" style="margin:0"></p><div id="np-custos"></div></section>'+
  '<section class="card"><h2>Materiais necessários</h2><div id="np-mats"></div></section>'+
  '<div class="acoes"><button class="btn" type="submit">'+(ed?'Salvar alterações':'Salvar pedido')+'</button><a class="btn contorno" href="'+(ed?'#pedido-'+p.num:'#pedidos')+'">Cancelar</a></div>'+
  '</form>';
}
function lerItensForm(f){
  var itens=[];
  f.querySelectorAll('[data-item]').forEach(function(r){
    var pid=r.querySelector('[name=produtoId]').value,pr=pid?acharProduto(pid):null;
    var ins=[];try{ins=JSON.parse(r.getAttribute('data-insumos')||'[]');}catch(e){}
    itens.push({produtoId:pid||null,pr:pr,produto:pr?pr.nome:r.querySelector('[name=produto]').value.trim(),variacao:r.querySelector('[name=variacao]').value,
      qtd:num(r.querySelector('[name=qtd]').value),valor:num(r.querySelector('[name=valor]').value),pers:r.querySelector('[name=pers]').value.trim(),
      custoPers:num(r.querySelector('[name=custoPers]').value),insumos:pr?pr.insumos.map(function(x){return {material_id:x.materialId,quantidade:x.qtd};}):ins,el:r});
  });
  return itens;
}
function atualizarFormPedido(){
  var f=document.querySelector('[data-form="pedido"]');if(!f)return;
  var itens=lerItensForm(f),sub=0,qtdT=0,custoEst=0;
  itens.forEach(function(i){
    sub+=i.qtd*i.valor;qtdT+=i.qtd;
    var cu=i.pr?custoProduto(i.pr):i.custoPers;custoEst+=i.qtd*cu;
    var info=i.el.querySelector('.info-item');
    info.textContent=i.pr?('Custo de fabricação: '+brl(cu)+' por unidade'+(i.pr.preco?' · preço cadastrado '+brl(i.pr.preco):'')+' · subtotal '+brl(i.qtd*i.valor)):(i.qtd*i.valor>0?'Subtotal '+brl(i.qtd*i.valor):'');
  });
  var total=sub+num(f.frete.value)-num(f.desconto.value);
  document.getElementById('np-total').textContent='Total do pedido: '+brl(total);
  var tx=taxasCanal(f.origem.value,total,qtdT),campo=f.taxa;
  if(!campo.getAttribute('data-manual'))campo.value=tx.total?tx.total.toFixed(2):'0';
  document.getElementById('np-taxa-dica').textContent=f.origem.value==='Shopee'?('Estimativa pelas taxas em Ajustes: '+brl(tx.total)+'. Pode corrigir à mão.'):'Taxas da Shopee só se aplicam ao canal Shopee.';
  var lucro=total-custoEst-num(campo.value)-num(f.custo.value);
  document.getElementById('np-custos').innerHTML='<div class="valores" style="margin-top:8px"><div><span>Custo de fabricação estimado</span><span>'+brl(custoEst)+'</span></div><div><span>Lucro estimado</span><b class="'+(lucro>=0?'pos':'neg')+'">'+brl(lucro)+(total>0?' ('+pct(lucro/total*100)+')':'')+'</b></div></div>';
  var nec=necessidades(itens),el=document.getElementById('np-mats');
  var id=f.getAttribute('data-id'),ped=id?acharPedidoId(id):null;
  el.innerHTML=nec.length?tabelaNecessidades(nec,ped):'<div class="vazio">Itens com ficha técnica mostram aqui os materiais necessários.</div>';
}
function tabelaNecessidades(nec,ped){
  var falta=false;
  var linhas=nec.map(function(n){
    var ja=ped?baixadoFicha(ped,n.id):0,precisa=Math.max(0,n.q-ja),fal=Math.max(0,precisa-n.m.qtd);if(fal>0.0001)falta=true;
    return '<tr><td>'+esc(n.m.nome)+'</td><td class="num">'+qtdTxt(n.q)+' '+esc(n.m.unidade)+'</td>'+(ped?'<td class="num">'+qtdTxt(ja)+'</td>':'')+'<td class="num">'+qtdTxt(n.m.qtd)+'</td><td class="num">'+(fal>0.0001?'<span class="chip red">comprar '+qtdTxt(fal)+'</span>':'<span class="chip green">ok</span>')+'</td></tr>';
  }).join('');
  return '<div class="tabela"><table style="min-width:420px"><thead><tr><th>Material</th><th class="num">Necessário</th>'+(ped?'<th class="num">Já baixado</th>':'')+'<th class="num">Em estoque</th><th class="num">Situação</th></tr></thead><tbody>'+linhas+'</tbody></table></div>'+
    '<p class="dica" style="margin:0">'+(falta?'<b style="color:var(--verm)">Falta material.</b> ':'')+'A baixa do estoque acontece uma única vez, quando o pedido chega em “'+esc(etapaBaixaNome())+'”.</p>';
}
async function salvarPedidoForm(f){
  var itens=lerItensForm(f);
  if(!itens.length){aviso('Adicione pelo menos um item.');return;}
  for(var i=0;i<itens.length;i++){if(!itens[i].produto){aviso('Escolha o produto ou descreva o item.');return;}if(itens[i].qtd<=0){aviso('Informe a quantidade de cada item.');return;}}
  var total=0;itens.forEach(function(i){total+=i.qtd*i.valor;});total+=num(f.frete.value)-num(f.desconto.value);
  if(f.sinal&&num(f.sinal.value)>total+0.001){aviso('O sinal não pode ser maior que o total do pedido.');return;}
  var dados={id:f.getAttribute('data-id')||null,cliente_nome:f.cliente.value.trim(),telefone:f.telefone.value.trim(),origem:f.origem.value,numero_externo:f.numExterno.value.trim(),status:f.status.value,
    prazo_producao:f.prazoProducao.value,prazo_entrega:f.prazoEntrega.value,frete:num(f.frete.value),desconto:num(f.desconto.value),
    custo:num(f.custo.value),taxa_shopee:num(f.taxa.value),observacoes:f.obs.value.trim(),sinal:f.sinal?num(f.sinal.value):0,forma_sinal:f.formaSinal?f.formaSinal.value:'Pix',
    itens:itens.map(function(i){return {produto_id:i.produtoId,produto:i.produto,variacao:i.variacao,quantidade:i.qtd,valor_unitario:i.valor,personalizacao:i.pers,custo_unitario:i.produtoId?null:i.custoPers,insumos:i.produtoId?[]:i.insumos};})};
  var numero=null;
  var ok=await executar(async function(){numero=checar(await sb.rpc('salvar_pedido',{p:dados}));});
  if(ok){aviso(dados.id?'Pedido atualizado.':'Pedido '+numPedido(numero)+' salvo.');ir('pedido-'+numero);}
}

/* =====================================================================
   Detalhe do pedido
   ===================================================================== */
function telaPedido(p){
  var total=totalPedido(p),rec=recebidoPedido(p),saldo=saldoPedido(p);
  var cMatEst=custoMateriaisEst(p),cExt=custoExtras(p),cMatReal=custoMateriaisReal(p),baixou=teveBaixa(p);
  var custoEst=cMatEst+cExt+num(p.custo)+num(p.taxa),lucroEst=total-custoEst;
  var custoReal=cMatReal+cExt+num(p.custo)+num(p.taxa),lucroReal=rec-custoReal;
  var d=difDias(p.prazoProducao),dig=digitosWpp(p.telefone);
  var wpp=dig?('https://wa.me/'+dig+'?text='+encodeURIComponent((MSG_WPP[p.status]||'')+' (Pedido '+numPedido(p.num)+')')):'';
  var pagamentos=db.caixa.filter(function(c){return c.pedidoId===p.id;});
  var manuais=usosManuais(p),nec=necessidades(p.itens);
  var orc=p.orcamentoId?db.orcamentos.filter(function(o){return o.id===p.orcamentoId;})[0]:null;
  var faixa=p.excluido?'<div class="erro-login" role="status"><b>Pedido excluído</b> em '+dataLonga(p.excluidoEm)+(p.excluidoPor?' por '+esc(p.excluidoPor):'')+(p.motivoExclusao?' · Motivo: '+esc(p.motivoExclusao):'')+'. Fica guardado só para consulta.</div>':'';
  return '<div class="cab"><div style="display:flex;align-items:center;gap:10px"><a href="#pedidos" class="btn contorno peq" aria-label="Voltar para pedidos">'+icone('voltar')+'</a><div><h1>Pedido '+numPedido(p.num)+'</h1><p>'+esc(p.origem)+(p.numExterno?' · nº '+esc(p.numExterno):'')+' · aberto em '+dataCurta(p.criado)+(p.criadoPor?' por '+esc(p.criadoPor):'')+(orc?' · <a href="#orcamento-'+orc.num+'">orçamento '+numPedido(orc.num)+'</a>':'')+'</p></div></div>'+
  '<div class="acoes">'+(p.excluido?'<span class="chip red">Excluído</span>':chipStatus(p.status)+chipPrazo(p))+'</div></div>'+faixa+
  (p.excluido?'':'<div class="acoes"><a class="btn contorno peq" href="#editar-pedido-'+p.num+'">Editar pedido</a><button type="button" class="btn perigo peq" data-acao="excluir-pedido" data-num="'+p.num+'">Excluir pedido</button></div>')+
  '<div class="dupla"><div class="larga" style="display:flex;flex-direction:column;gap:14px">'+
  (p.excluido?'':'<section class="card"><h2>Situação</h2><div class="campos" style="grid-template-columns:1fr">'+
    '<div class="campo"><label for="mud-st">Mudar situação</label><select id="mud-st" data-acao="mudar-status" data-num="'+p.num+'">'+STATUS.filter(function(s){return s[0]!=='orcamento';}).map(function(s){return '<option value="'+s[0]+'"'+(s[0]===p.status?' selected':'')+'>'+s[1]+'</option>';}).join('')+'</select></div></div>'+
    '<div class="trio"><div><span>Prazo de produção</span><b class="'+(aberto(p)&&d!==null&&d<=0?'neg':'')+'">'+dataLonga(p.prazoProducao)+'</b></div><div><span>Entrega / despacho</span><b>'+dataLonga(p.prazoEntrega)+'</b></div><div><span>Canal</span><b>'+esc(p.origem)+'</b></div></div>'+
    ((p.transportadora||p.rastreio)?'<div class="valores"><div><span>Envio</span><span>'+esc(p.transportadora||'—')+(p.rastreio?' · '+esc(p.rastreio):'')+'</span></div></div>':'')+
    '<div class="acoes"><button type="button" class="btn contorno peq" data-acao="envio" data-num="'+p.num+'">Dados de envio</button></div></section>')+
  '<section class="card"><div class="linha-tit" style="flex-wrap:nowrap"><div style="display:flex;align-items:center;gap:12px;min-width:0"><div style="width:42px;height:42px;border-radius:21px;background:var(--teal-cl);color:var(--teal-esc);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">'+esc(iniciais(p.cliente))+'</div><div style="min-width:0"><b>'+esc(p.cliente)+'</b><div style="font-size:13px;color:var(--sec)">'+esc(p.telefone||'Sem telefone')+'</div></div></div>'+
    (wpp&&!p.excluido?'<a class="btn contorno peq" href="'+esc(wpp)+'" target="_blank" rel="noopener">'+icone('wpp')+'WhatsApp</a>':'')+'</div></section>'+
  '<section class="card"><h2>Itens</h2><div class="lista">'+p.itens.map(function(i){return '<div class="item"><div class="info"><b>'+esc(i.produto)+(i.variacao?' ('+esc(i.variacao)+')':'')+' × '+qtdTxt(i.qtd)+'</b><span>'+esc(i.pers||'Sem personalização')+' · custo '+brl(i.cMat+i.cExt)+'/un.</span></div><b style="white-space:nowrap">'+brl(num(i.qtd)*num(i.valor))+'</b></div>';}).join('')+'</div>'+
    '<div class="valores">'+(num(p.frete)?'<div><span>Frete cobrado</span><span>'+brl(p.frete)+'</span></div>':'')+(num(p.desconto)?'<div><span>Desconto</span><span>− '+brl(p.desconto)+'</span></div>':'')+
    '<div class="total"><span>Total</span><span>'+brl(total)+'</span></div><div><span>Recebido</span><span class="pos" style="font-weight:600">'+brl(rec)+'</span></div><div><span>Saldo a receber</span><span class="'+(saldo>0?'neg':'pos')+'" style="font-weight:600">'+brl(saldo)+'</span></div></div>'+
    (p.excluido?'':'<div class="acoes">'+(saldo>0&&p.status!=='cancelado'?'<button type="button" class="btn" data-acao="receber" data-num="'+p.num+'">Registrar recebimento</button>':(saldo<=0?'<span class="chip green">Pago</span>':''))+'</div>')+
    (pagamentos.length?'<div class="hist">'+pagamentos.map(function(c){return '<div><span>'+dataCurta(c.data)+'</span><span style="color:var(--texto)">'+(c.tipo==='saida'?'− ':'')+brl(c.valor)+' · '+esc(c.categoria==='Devolução ao cliente'?'devolução ao cliente':c.forma)+'</span></div>';}).join('')+'</div>':'')+
  '</section>'+
  (nec.length?'<section class="card"><h2>Materiais da ficha técnica</h2>'+tabelaNecessidades(nec,p)+'</section>':'')+
  '<section class="card"><div class="linha-tit"><h2>Materiais lançados à mão</h2>'+(p.excluido?'':'<button type="button" class="btn contorno peq" data-acao="usar-mat" data-num="'+p.num+'">+ Adicionar material</button>')+'</div>'+
    (manuais.length?'<div class="lista">'+manuais.map(function(u){var m=acharMaterial(u.materialId)||{nome:'Material',unidade:''};return '<div class="item"><div class="info"><b>'+esc(m.nome)+(u.tipo==='perda'?' <span class="chip red">perda</span>':'')+'</b><span>'+qtdTxt(u.qtd)+' '+esc(m.unidade)+' × '+brl4(u.custo)+'</span></div><div class="dir"><b>'+brl(u.qtd*u.custo)+'</b>'+(p.excluido?'':'<button type="button" class="btn perigo peq" data-acao="desfazer-uso" data-id="'+u.id+'">Remover</button>')+'</div></div>';}).join('')+'</div>':'<div class="vazio">Use para materiais fora da ficha técnica ou perdas. A quantidade sai do estoque e o custo entra no pedido.</div>')+
  '</section>'+
  (p.obs?'<section class="card"><h2>Observações</h2><p style="margin:0;font-size:14px;white-space:pre-line">'+esc(p.obs)+'</p></section>':'')+
  '</div><div class="estreita" style="display:flex;flex-direction:column;gap:14px">'+
  '<section class="card escuro"><h2>Lucro do pedido</h2><div class="tabela"><table style="min-width:0;color:#fff"><thead><tr><th style="color:var(--prata)"></th><th class="num" style="color:var(--prata)">Estimado</th><th class="num" style="color:var(--prata)">Realizado</th></tr></thead><tbody>'+
    '<tr><td>Venda / recebido</td><td class="num">'+brl(total)+'</td><td class="num">'+brl(rec)+'</td></tr>'+
    '<tr><td>Materiais</td><td class="num">− '+brl(cMatEst)+'</td><td class="num">− '+brl(cMatReal)+'</td></tr>'+
    '<tr><td>Mão de obra, embalagem e extras</td><td class="num">− '+brl(cExt)+'</td><td class="num">− '+brl(cExt)+'</td></tr>'+
    '<tr><td>Outros custos</td><td class="num">− '+brl(p.custo)+'</td><td class="num">− '+brl(p.custo)+'</td></tr>'+
    '<tr><td>Taxas Shopee</td><td class="num">− '+brl(p.taxa)+'</td><td class="num">− '+brl(p.taxa)+'</td></tr>'+
    '<tr><td><b>Lucro</b></td><td class="num"><b class="'+(lucroEst>=0?'pos':'neg')+'">'+brl(lucroEst)+'</b></td><td class="num"><b class="'+(lucroReal>=0?'pos':'neg')+'">'+brl(lucroReal)+'</b></td></tr>'+
    '<tr><td>Margem</td><td class="num" style="color:var(--ouro)">'+(total>0?pct(lucroEst/total*100):'—')+'</td><td class="num" style="color:var(--ouro)">'+(rec>0?pct(lucroReal/rec*100):'—')+'</td></tr>'+
    '</tbody></table></div><p class="dica" style="margin:0;color:var(--prata)">Realizado usa o dinheiro já recebido e os materiais que saíram de fato do estoque'+(baixou?'':' (ainda não houve baixa)')+'.</p>'+
    (p.excluido?'':'<button type="button" class="btn ouro peq" data-acao="custos" data-num="'+p.num+'">Ajustar custos e taxas</button>')+'</section>'+
  '<section class="card"><h2>Ações</h2><div class="acoes" style="flex-direction:column"><button type="button" class="btn contorno cheio" data-acao="repetir" data-num="'+p.num+'">Repetir pedido</button><button type="button" class="btn contorno cheio" data-acao="ordem" data-num="'+p.num+'">Ordem de produção</button></div></section>'+
  '<section class="card"><h2>Histórico</h2><div class="hist">'+p.historico.slice().reverse().map(function(h){return '<div><span>'+dataCurta(h.data)+'</span><span>'+esc(h.texto)+(h.usuario?' <span style="color:var(--sec)">('+esc(h.usuario)+')</span>':'')+'</span></div>';}).join('')+'</div></section>'+
  '</div></div>';
}

/* =====================================================================
   Produtos e precificação
   ===================================================================== */
function telaProdutos(){
  var b=estado.buscaProd.trim().toLowerCase();
  var lst=db.produtos.filter(function(p){return !b||(p.nome+' '+p.codigo+' '+p.categoria).toLowerCase().indexOf(b)>=0;});
  return '<div class="cab"><div><h1>Produtos</h1><p>Cadastre cada produto com a ficha técnica. O custo e a baixa do estoque saem daqui.</p></div><a class="btn ouro" href="#novo-produto">+ Novo produto</a></div>'+
  '<label class="sr" for="busca-prod">Buscar produto</label><input id="busca-prod" class="busca" type="search" placeholder="Buscar por nome, código ou categoria" value="'+esc(estado.buscaProd)+'">'+
  '<section class="card"><div class="lista">'+(lst.length?lst.map(function(p){
    var c=custoProduto(p),a=analisePreco(c,p.preco,'WhatsApp');
    return '<a class="item" href="#produto-'+p.id+'">'+(p.foto?'<img src="'+esc(p.foto)+'" alt="" style="width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0">':'<div style="width:52px;height:52px;border-radius:10px;background:var(--teal-cl);color:var(--teal-esc);display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">'+esc(iniciais(p.nome))+'</div>')+
      '<div class="info"><b>'+esc(p.nome)+(p.ativo?'':' <span class="chip gray">inativo</span>')+'</b><span>'+esc([p.codigo,p.categoria].filter(Boolean).join(' · ')||'Sem código')+' · custo '+brl(c)+'</span></div>'+
      '<div class="dir"><b>'+(p.preco?brl(p.preco):'sem preço')+'</b>'+(p.preco?'<span class="chip '+(a.lucro>=0?'green':'red')+'">lucro '+pct(a.efetivo)+'</span>':'')+'</div></a>';
  }).join(''):'<div class="vazio">Nenhum produto cadastrado. Toque em “+ Novo produto”.</div>')+'</div></section>';
}
function linhaInsumo(i){
  i=i||{materialId:'',qtd:1};var k=++uidN;
  return '<div class="item-pedido" data-insumo style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">'+
    '<button type="button" class="remover" data-acao="remover-insumo" aria-label="Remover material">×</button>'+
    '<div class="campo" style="padding-right:36px;grid-column:1/-1"><label for="in-'+k+'">Material do estoque</label><select id="in-'+k+'" name="material"><option value="">Escolha…</option>'+db.materiais.map(function(m){return '<option value="'+m.id+'"'+(m.id===i.materialId?' selected':'')+'>'+esc(m.nome)+' · '+brl4(m.custo)+'/'+esc(m.unidade)+'</option>';}).join('')+'</select></div>'+
    '<div class="campo"><label for="iq-'+k+'">Quantidade por unidade fabricada</label><input id="iq-'+k+'" name="qtd" type="number" min="0.001" step="0.001" value="'+esc(i.qtd)+'"></div>'+
    '<div class="campo"><span style="font-size:13px;font-weight:600">Custo</span><b class="custo-insumo" style="padding-top:12px">—</b></div></div>';
}
function telaFormProduto(p){
  var ed=!!p;
  p=p||{nome:'',codigo:'',categoria:'',descricao:'',variacoes:'',foto:'',preco:0,maoObra:0,embalagem:0,outros:0,acrescimo:100,ativo:true,insumos:[]};
  return '<div class="cab"><div style="display:flex;align-items:center;gap:10px"><a href="#produtos" class="btn contorno peq" aria-label="Voltar para produtos">'+icone('voltar')+'</a><div><h1>'+(ed?esc(p.nome):'Novo produto')+'</h1><p>Ficha técnica, custo e preço de venda.</p></div></div></div>'+
  '<form data-form="produto" '+(ed?'data-id="'+p.id+'"':'')+' style="display:flex;flex-direction:column;gap:14px">'+
  '<section class="card"><h2>Dados do produto</h2>'+
    '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div id="pf-foto" style="width:96px;height:96px;border-radius:14px;background:var(--fundo);border:1px dashed var(--prata);display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--sec);font-size:12px;text-align:center">'+(p.foto?'<img src="'+esc(p.foto)+'" alt="Foto do produto" style="width:100%;height:100%;object-fit:cover">':'Sem foto')+'</div>'+
    '<div class="campo"><label for="pf-arq">Foto</label><input id="pf-arq" name="arquivo" type="file" accept="image/*" style="height:auto;padding:10px"><input type="hidden" name="foto" value="'+esc(p.foto)+'"></div></div>'+
    '<div class="campos">'+
    '<div class="campo"><label for="pf-n">Nome</label><input id="pf-n" name="nome" required value="'+esc(p.nome)+'" placeholder="Ex.: Caderneta"></div>'+
    '<div class="campo"><label for="pf-c">Código</label><input id="pf-c" name="codigo" value="'+esc(p.codigo)+'" placeholder="Ex.: CAD-A5"></div>'+
    '<div class="campo"><label for="pf-g">Categoria</label><input id="pf-g" name="categoria" value="'+esc(p.categoria)+'" placeholder="Papelaria, festa…"></div>'+
    '<div class="campo"><label for="pf-v">Variações (separe por vírgula)</label><input id="pf-v" name="variacoes" value="'+esc(p.variacoes)+'" placeholder="A5, A6"></div>'+
    '<div class="campo todo"><label for="pf-d">Descrição</label><textarea id="pf-d" name="descricao">'+esc(p.descricao)+'</textarea></div>'+
    '<div class="campo"><label for="pf-a">Situação</label><select id="pf-a" name="ativo">'+opcoes([['1','Ativo'],['0','Inativo (não aparece em pedidos)']],p.ativo?'1':'0')+'</select></div>'+
  '</div></section>'+
  '<section class="card"><div class="linha-tit"><h2>Ficha técnica</h2><button type="button" class="btn contorno peq" data-acao="add-insumo">+ Material</button></div>'+
    (db.materiais.length?'':'<p class="dica" style="margin:0">Cadastre os materiais no Estoque primeiro.</p>')+
    '<div id="insumos" style="display:flex;flex-direction:column;gap:10px">'+p.insumos.map(linhaInsumo).join('')+'</div>'+
    '<div class="campos">'+
    '<div class="campo"><label for="pf-mo">Mão de obra por unidade (R$)</label><input id="pf-mo" name="maoObra" type="number" min="0" step="0.01" value="'+num(p.maoObra)+'"></div>'+
    '<div class="campo"><label for="pf-em">Embalagem por unidade (R$)</label><input id="pf-em" name="embalagem" type="number" min="0" step="0.01" value="'+num(p.embalagem)+'"></div>'+
    '<div class="campo"><label for="pf-ou">Outros custos por unidade (R$)</label><input id="pf-ou" name="outros" type="number" min="0" step="0.01" value="'+num(p.outros)+'"></div>'+
    '</div><div id="pf-custo"></div></section>'+
  '<section class="card"><div class="linha-tit"><h2>Preço de venda</h2><div class="filtros" role="group" aria-label="Canal para o cálculo"><button type="button" data-acao="canal-prod" data-c="WhatsApp" class="ativo">Venda direta</button><button type="button" data-acao="canal-prod" data-c="Shopee">Shopee</button></div></div>'+
    '<input type="hidden" name="canal" value="WhatsApp">'+
    '<div id="pf-sug"></div>'+
    '<div class="campos">'+
    '<div class="campo"><label for="pf-pc">Acréscimo sobre o custo (%)</label><input id="pf-pc" name="acrescimo" type="number" min="0" step="1" value="'+(p.acrescimo==null?'':num(p.acrescimo))+'" placeholder="Ex.: 120"></div>'+
    '<div class="campo"><label for="pf-pv">Preço de venda final (R$)</label><input id="pf-pv" name="preco" type="number" min="0" step="0.01" value="'+num(p.preco)+'"></div>'+
    '</div><div id="pf-res"></div>'+
    '<div class="card" style="padding:14px;gap:10px;background:var(--fundo)"><h3>Quanto cobrar para lucrar…</h3><div class="campos">'+
    '<div class="campo"><label for="pf-ld">Lucro desejado por unidade (R$)</label><input id="pf-ld" name="lucroDesejado" type="number" min="0" step="0.01" placeholder="Ex.: 15"></div>'+
    '<div class="campo"><label for="pf-lp">ou lucro sobre o custo (%)</label><input id="pf-lp" name="lucroPct" type="number" min="0" step="1" placeholder="Ex.: 100"></div>'+
    '</div><div id="pf-inv"></div></div>'+
  '</section>'+
  '<div class="acoes"><button class="btn" type="submit">Salvar produto</button><a class="btn contorno" href="#produtos">Cancelar</a>'+(ed?'<button type="button" class="btn perigo" data-acao="excluir-produto" data-id="'+p.id+'">Excluir produto</button>':'')+'</div>'+
  '</form>';
}
function lerProdutoForm(f){
  var ins=[];f.querySelectorAll('[data-insumo]').forEach(function(r){var id=r.querySelector('[name=material]').value,q=num(r.querySelector('[name=qtd]').value);ins.push({materialId:id,qtd:q,el:r});});
  return {insumos:ins,maoObra:num(f.maoObra.value),embalagem:num(f.embalagem.value),outros:num(f.outros.value)};
}
function atualizarFormProduto(){
  var f=document.querySelector('[data-form="produto"]');if(!f)return;
  var p=lerProdutoForm(f),cMat=0;
  p.insumos.forEach(function(i){var m=acharMaterial(i.materialId),c=m?i.qtd*m.custo:0;cMat+=c;i.el.querySelector('.custo-insumo').textContent=m?brl4(c):'—';});
  var custo=cMat+p.maoObra+p.embalagem+p.outros,canal=f.canal.value;
  document.getElementById('pf-custo').innerHTML='<div class="valores"><div><span>Materiais</span><span>'+brl4(cMat)+'</span></div><div><span>Mão de obra, embalagem e outros</span><span>'+brl(p.maoObra+p.embalagem+p.outros)+'</span></div><div class="total"><span>Custo de fabricação por unidade</span><span>'+brl(custo)+'</span></div></div>';
  var acr=f.acrescimo.value===''?null:num(f.acrescimo.value);
  var linhas=SUGESTOES.concat(acr!=null&&SUGESTOES.indexOf(acr)<0?[acr]:[]).map(function(pc){
    var preco=r2(custo*(1+pc/100)),a=analisePreco(custo,preco,canal);
    return '<tr><td>'+pc+'%'+(pc===acr&&SUGESTOES.indexOf(acr)<0?' (seu)':'')+'</td><td class="num"><b>'+brl(preco)+'</b></td><td class="num">'+brl(preco-custo)+'</td>'+(canal==='Shopee'?'<td class="num">− '+brl(a.taxa+a.outras)+'</td>':'')+'<td class="num '+(a.lucro>=0?'pos':'neg')+'"><b>'+brl(a.lucro)+'</b></td><td class="num">'+pct(a.efetivo)+'</td><td class="num"><button type="button" class="btn contorno peq" data-acao="usar-preco" data-preco="'+preco+'" data-pc="'+pc+'">Usar</button></td></tr>';
  }).join('');
  document.getElementById('pf-sug').innerHTML='<div class="tabela"><table style="min-width:520px"><thead><tr><th>Acréscimo</th><th class="num">Preço sugerido</th><th class="num">Lucro bruto</th>'+(canal==='Shopee'?'<th class="num">Taxas e despesas</th>':'')+'<th class="num">Lucro líquido</th><th class="num">% efetivo</th><th><span class="sr">Usar</span></th></tr></thead><tbody>'+linhas+'</tbody></table></div><p class="dica" style="margin:0">Preço = custo × (1 + acréscimo ÷ 100). O acréscimo é sobre o custo; o % efetivo é o lucro líquido dividido pelo preço.'+(canal==='Shopee'?' Taxas da Shopee conforme Ajustes ('+pct(db.cfg.shopeePct)+' + '+brl(db.cfg.shopeeFixo)+' por '+(db.cfg.shopeeFixoPor==='item'?'item':'pedido')+(db.cfg.outrasPct?' + '+pct(db.cfg.outrasPct)+' de outras despesas':'')+').':'')+'</p>';
  var preco=num(f.preco.value),a=analisePreco(custo,preco,canal);
  document.getElementById('pf-res').innerHTML=preco>0?'<div class="valores"><div><span>Venda</span><span>'+brl(preco)+'</span></div><div><span>Custo de fabricação</span><span>− '+brl(custo)+'</span></div>'+(canal==='Shopee'?'<div><span>Taxas Shopee</span><span>− '+brl(a.taxa)+'</span></div><div><span>Outras despesas</span><span>− '+brl(a.outras)+'</span></div>':'')+'<div class="total"><span>Lucro líquido estimado</span><span class="'+(a.lucro>=0?'pos':'neg')+'">'+brl(a.lucro)+' ('+pct(a.efetivo)+' do preço)</span></div></div>':'';
  var ld=f.lucroDesejado.value,lp=f.lucroPct.value,inv='';
  if(ld!==''||lp!==''){var alvo=ld!==''?num(ld):custo*num(lp)/100,pr=precoParaLucro(custo,alvo,canal);inv='<div class="valores"><div class="total"><span>Preço necessário'+(canal==='Shopee'?' (já com taxas)':'')+'</span><span>'+brl(pr)+'</span></div><div><span>Lucro após taxas</span><span>'+brl(alvo)+'</span></div></div><button type="button" class="btn contorno peq" data-acao="usar-preco" data-preco="'+pr+'">Usar este preço</button>';}
  document.getElementById('pf-inv').innerHTML=inv;
}
async function reduzirImagem(arq){
  return new Promise(function(ok,erro){
    var img=new Image(),url=URL.createObjectURL(arq);
    img.onload=function(){var max=900,w=img.width,h=img.height,e=Math.min(1,max/Math.max(w,h));var c=document.createElement('canvas');c.width=Math.round(w*e);c.height=Math.round(h*e);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);c.toBlob(function(b){b?ok(b):erro(new Error('Não foi possível ler a imagem.'));},'image/jpeg',0.85);};
    img.onerror=function(){erro(new Error('Não foi possível ler a imagem.'));};
    img.src=url;
  });
}
async function salvarProdutoForm(f){
  var id=f.getAttribute('data-id'),p=lerProdutoForm(f);
  var ins=p.insumos.filter(function(i){return i.materialId&&i.qtd>0;});
  var vistos={};for(var i=0;i<ins.length;i++){if(vistos[ins[i].materialId]){aviso('Um material aparece duas vezes na ficha. Junte em uma linha só.');return;}vistos[ins[i].materialId]=1;}
  var dados={nome:f.nome.value.trim(),codigo:f.codigo.value.trim()||null,categoria:f.categoria.value.trim()||null,descricao:f.descricao.value.trim()||null,variacoes:f.variacoes.value.trim()||null,
    ativo:f.ativo.value==='1',mao_obra:p.maoObra,custo_embalagem:p.embalagem,outros_custos:p.outros,acrescimo_percentual:f.acrescimo.value===''?null:num(f.acrescimo.value),preco_venda:num(f.preco.value),foto_url:f.foto.value||null};
  var arq=f.arquivo.files&&f.arquivo.files[0];
  var novoId=null;
  var ok=await executar(async function(){
    if(arq){
      var blob=await reduzirImagem(arq),cam=(id||'novo')+'/'+Date.now()+'.jpg';
      checar(await sb.storage.from('produtos').upload(cam,blob,{contentType:'image/jpeg',upsert:false}));
      dados.foto_url=sb.storage.from('produtos').getPublicUrl(cam).data.publicUrl;
    }
    if(id){checar(await sb.from('produtos').update(dados).eq('id',id));novoId=id;}
    else{var r=checar(await sb.from('produtos').insert(dados).select('id').single());novoId=r.id;}
    checar(await sb.from('produto_insumos').delete().eq('produto_id',novoId));
    if(ins.length)checar(await sb.from('produto_insumos').insert(ins.map(function(i){return {produto_id:novoId,material_id:i.materialId,quantidade:i.qtd};})));
  },'Produto salvo.');
  if(ok)ir('produtos');
}

/* =====================================================================
   Orçamentos
   ===================================================================== */
function totalOrc(o){var s=0;o.itens.forEach(function(i){s+=i.qtd*i.preco;});return r2(s-o.desconto+o.frete);}
function telaOrcamentos(){
  var fs=estado.filtroOrc;
  var f=[['abertos','Em aberto'],['elaboracao','Em elaboração'],['enviado','Enviados'],['aprovado','Aprovados'],['recusado','Recusados'],['vencido','Vencidos'],['todos','Todos']];
  var lst=db.orcamentos.filter(function(o){var s=statusOrc(o);if(fs==='todos')return true;if(fs==='abertos')return s==='elaboracao'||s==='enviado';return s===fs;});
  return '<div class="cab"><div><h1>Orçamentos</h1><p>Propostas para clientes. Não mexem no estoque.</p></div><a class="btn ouro" href="#novo-orcamento">+ Novo orçamento</a></div>'+
  '<div class="filtros" role="group" aria-label="Filtrar orçamentos">'+f.map(function(x){return '<button type="button" data-acao="filtro-orc" data-s="'+x[0]+'" class="'+(fs===x[0]?'ativo':'')+'">'+esc(x[1])+'</button>';}).join('')+'</div>'+
  '<section class="card"><div class="lista">'+(lst.length?lst.map(function(o){
    return '<a class="item" href="#orcamento-'+o.num+'"><div class="info"><b>'+numPedido(o.num)+' · '+esc(o.cliente)+'</b><span>'+dataCurta(o.data)+(o.validade?' · válido até '+dataCurta(o.validade):'')+' · '+esc(o.itens.map(function(i){return qtdTxt(i.qtd)+'× '+i.descricao;}).join(', '))+'</span></div><div class="dir">'+chipOrc(o)+'<b style="font-size:13.5px">'+brl(totalOrc(o))+'</b></div></a>';
  }).join(''):'<div class="vazio">Nenhum orçamento aqui.</div>')+'</div></section>';
}
function linhaItemOrc(i){
  i=i||{produtoId:'',descricao:'',variacao:'',qtd:1,custo:0,acrescimo:100,preco:'',insumos:[]};
  var k=++uidN;
  return '<div class="item-pedido" data-item-orc data-insumos="'+esc(JSON.stringify(i.produtoId?[]:(i.insumos||[])))+'">'+
  '<button type="button" class="remover" data-acao="remover-item-orc" aria-label="Remover item">×</button>'+
  '<div class="campo" style="grid-column:1/-1;padding-right:36px"><label for="op-'+k+'">Produto</label><select id="op-'+k+'" name="produtoId" data-acao-mudar="orc-produto">'+opcoesProdutos(i.produtoId)+'</select></div>'+
  '<div class="campo" style="grid-column:1/-1"><label for="od-'+k+'">Descrição para o cliente</label><input id="od-'+k+'" name="descricao" value="'+esc(i.descricao)+'" placeholder="Ex.: Caderneta personalizada com capa dura"></div>'+
  '<div class="campo campo-var"'+(i.produtoId?'':' style="display:none"')+'><label for="ov-'+k+'">Variação</label><select id="ov-'+k+'" name="variacao">'+opcoesVariacao(i.produtoId,i.variacao)+'</select></div>'+
  '<div class="campo"><label for="oq-'+k+'">Quantidade</label><input id="oq-'+k+'" name="qtd" type="number" min="1" step="1" value="'+esc(i.qtd)+'"></div>'+
  '<div class="campo campo-custo"><label for="oc-'+k+'">Custo interno por unidade (R$)</label><input id="oc-'+k+'" name="custo" type="number" min="0" step="0.01" value="'+r2(num(i.custo))+'"'+(i.produtoId?' readonly':'')+'></div>'+
  '<div class="campo"><label for="oa-'+k+'">Lucro sobre o custo (%)</label><input id="oa-'+k+'" name="acrescimo" type="number" min="0" step="1" value="'+(i.acrescimo==null?'':i.acrescimo)+'"></div>'+
  '<div class="campo"><label for="oo-'+k+'">Preço unitário (R$)</label><input id="oo-'+k+'" name="preco" type="number" min="0" step="0.01" value="'+esc(i.preco)+'"></div>'+
  '<div class="campo-mats" style="grid-column:1/-1'+(i.produtoId?';display:none':'')+'"><div class="linha-tit"><span style="font-size:13px;font-weight:600">Materiais deste item (para calcular o custo)</span><button type="button" class="btn contorno peq" data-acao="orc-add-mat">+ Material</button></div><div class="orc-mats" style="display:flex;flex-direction:column;gap:8px;margin-top:8px">'+
    (i.produtoId?'':(i.insumos||[]).map(function(x){return linhaMatOrc(x.material_id||x.materialId,num(x.quantidade!=null?x.quantidade:x.qtd));}).join(''))+'</div>'+
    '<div class="campo" style="margin-top:8px"><label for="oe-'+k+'">Mão de obra e outros por unidade (R$)</label><input id="oe-'+k+'" name="extra" type="number" min="0" step="0.01" value="0"></div></div>'+
  '<div class="dica info-item" style="grid-column:1/-1"></div></div>';
}
function linhaMatOrc(mid,q){
  var k=++uidN;
  return '<div class="orc-mat" style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) auto;gap:8px;align-items:end"><div class="campo"><label for="om-'+k+'">Material</label><select id="om-'+k+'" name="mat"><option value="">Escolha…</option>'+db.materiais.map(function(m){return '<option value="'+m.id+'"'+(m.id===mid?' selected':'')+'>'+esc(m.nome)+' · '+brl4(m.custo)+'/'+esc(m.unidade)+'</option>';}).join('')+'</select></div><div class="campo"><label for="omq-'+k+'">Qtd. por unidade</label><input id="omq-'+k+'" name="matq" type="number" min="0.001" step="0.001" value="'+(q||1)+'"></div><button type="button" class="btn perigo peq" data-acao="orc-rem-mat" aria-label="Remover material">×</button></div>';
}
function telaFormOrc(o,dup){
  var ed=!!o&&!dup;
  var base=o||{cliente:'',contato:'',data:hoje(),validade:maisDias(7),prazo:'',canal:'WhatsApp',status:'elaboracao',desconto:0,frete:0,obs:'',itens:[null]};
  var dataO=dup||!o?hoje():base.data,val=dup?maisDias(7):(base.validade||'');
  return '<div class="cab"><div><h1>'+(ed?'Editar orçamento '+numPedido(o.num):dup?'Duplicar orçamento '+numPedido(o.num):'Novo orçamento')+'</h1><p>'+(ed?'':'O número é gerado ao salvar.')+'</p></div>'+(o?'<a class="btn contorno" href="#orcamento-'+o.num+'">Voltar</a>':'')+'</div>'+
  (ed&&o.pedidoId?'<div class="aviso-demo">Este orçamento já virou pedido. Mudanças aqui não alteram o pedido.</div>':'')+
  '<form data-form="orcamento" '+(ed?'data-id="'+o.id+'"':'')+' style="display:flex;flex-direction:column;gap:14px">'+
  '<datalist id="lista-clientes">'+db.clientes.map(function(c){return '<option value="'+esc(c.nome)+'">';}).join('')+'</datalist>'+
  '<section class="card"><h2>Cliente</h2><div class="campos">'+
    '<div class="campo"><label for="oc-cli">Nome do cliente</label><input id="oc-cli" name="cliente" required list="lista-clientes" autocomplete="off" value="'+esc(base.cliente)+'"></div>'+
    '<div class="campo"><label for="oc-con">Contato (WhatsApp)</label><input id="oc-con" name="contato" inputmode="tel" value="'+esc(base.contato)+'"></div>'+
    '<div class="campo"><label for="oc-can">Canal</label><select id="oc-can" name="canal">'+opcoes(ORIGENS,base.canal)+'</select></div>'+
    '<div class="campo"><label for="oc-st">Situação</label><select id="oc-st" name="status">'+opcoes(STATUS_ORC.filter(function(s){return s[0]!=='vencido';}).map(function(s){return [s[0],s[1]];}),dup?'elaboracao':base.status)+'</select></div>'+
    '<div class="campo"><label for="oc-dt">Data</label><input id="oc-dt" name="data" type="date" value="'+esc(dataO)+'"></div>'+
    '<div class="campo"><label for="oc-va">Válido até</label><input id="oc-va" name="validade" type="date" value="'+esc(val)+'"></div>'+
  '</div></section>'+
  '<section class="card"><div class="linha-tit"><h2>Itens</h2><button type="button" class="btn contorno peq" data-acao="add-item-orc">+ Adicionar item</button></div><div id="itens-orc" style="display:flex;flex-direction:column;gap:10px">'+base.itens.map(linhaItemOrc).join('')+'</div></section>'+
  '<section class="card"><h2>Valores e condições</h2><div class="campos">'+
    '<div class="campo"><label for="oc-de">Desconto (R$)</label><input id="oc-de" name="desconto" type="number" min="0" step="0.01" value="'+num(base.desconto)+'"></div>'+
    '<div class="campo"><label for="oc-fr">Frete (R$)</label><input id="oc-fr" name="frete" type="number" min="0" step="0.01" value="'+num(base.frete)+'"></div>'+
    '<div class="campo"><label for="oc-pz">Prazo de produção</label><input id="oc-pz" name="prazo" value="'+esc(base.prazo)+'" placeholder="Ex.: 10 dias úteis após a aprovação da arte"></div>'+
    '<div class="campo todo"><label for="oc-ob">Observações para o cliente</label><textarea id="oc-ob" name="obs">'+esc(base.obs)+'</textarea></div>'+
  '</div><div id="oc-tot"></div></section>'+
  '<section class="card escuro"><h2>Só para vocês</h2><div id="oc-int"></div></section>'+
  '<div class="acoes"><button class="btn" type="submit">Salvar orçamento</button><a class="btn contorno" href="'+(o?'#orcamento-'+o.num:'#orcamentos')+'">Cancelar</a></div>'+
  '</form>';
}
function lerItensOrc(f){
  var itens=[];
  f.querySelectorAll('[data-item-orc]').forEach(function(r){
    var pid=r.querySelector('[name=produtoId]').value,pr=pid?acharProduto(pid):null,mats=[];
    r.querySelectorAll('.orc-mat').forEach(function(x){var id=x.querySelector('[name=mat]').value,q=num(x.querySelector('[name=matq]').value);if(id&&q>0)mats.push({material_id:id,quantidade:q});});
    itens.push({el:r,produtoId:pid||null,pr:pr,descricao:r.querySelector('[name=descricao]').value.trim(),variacao:r.querySelector('[name=variacao]').value,qtd:num(r.querySelector('[name=qtd]').value),
      custo:num(r.querySelector('[name=custo]').value),acrescimo:r.querySelector('[name=acrescimo]').value,preco:num(r.querySelector('[name=preco]').value),mats:mats,extra:num(r.querySelector('[name=extra]').value)});
  });
  return itens;
}
function atualizarFormOrc(origem){
  var f=document.querySelector('[data-form="orcamento"]');if(!f)return;
  var itens=lerItensOrc(f),sub=0,custoT=0,qtdT=0;
  itens.forEach(function(i){
    var cInp=i.el.querySelector('[name=custo]'),pInp=i.el.querySelector('[name=preco]');
    if(i.pr){i.custo=r2(custoProduto(i.pr));cInp.value=i.custo;}
    else if(i.mats.length||i.extra){i.custo=r2(custoInsumos(i.mats)+i.extra);cInp.value=i.custo;}
    if(origem&&origem.name!=='preco'&&i.acrescimo!==''&&(origem.closest('[data-item-orc]')===i.el||origem.name==='canal')){i.preco=r2(i.custo*(1+num(i.acrescimo)/100));pInp.value=i.preco.toFixed(2);}
    sub+=i.qtd*i.preco;custoT+=i.qtd*i.custo;qtdT+=i.qtd;
    i.el.querySelector('.info-item').textContent=i.preco>0?('Subtotal '+brl(i.qtd*i.preco)+(i.custo>0?' · lucro de '+pct((i.preco-i.custo)/i.custo*100)+' sobre o custo':'')):'';
  });
  var total=sub-num(f.desconto.value)+num(f.frete.value),tx=taxasCanal(f.canal.value,total,qtdT),lucro=total-custoT-tx.total-num(f.frete.value);
  document.getElementById('oc-tot').innerHTML='<div class="valores"><div><span>Subtotal</span><span>'+brl(sub)+'</span></div>'+(num(f.desconto.value)?'<div><span>Desconto</span><span>− '+brl(f.desconto.value)+'</span></div>':'')+(num(f.frete.value)?'<div><span>Frete</span><span>'+brl(f.frete.value)+'</span></div>':'')+'<div class="total"><span>Total para o cliente</span><span>'+brl(total)+'</span></div></div>';
  document.getElementById('oc-int').innerHTML='<div class="valores"><div><span>Custo interno</span><span>'+brl(custoT)+'</span></div>'+(f.canal.value==='Shopee'?'<div><span>Taxas e despesas Shopee</span><span>− '+brl(tx.total)+'</span></div>':'')+'<div class="total" style="border-color:var(--linha-esc)"><span>Lucro estimado</span><span class="'+(lucro>=0?'pos':'neg')+'">'+brl(lucro)+(total>0?' ('+pct(lucro/total*100)+')':'')+'</span></div></div><p class="dica" style="margin:0;color:var(--prata)">Nada desta parte aparece no PDF nem na mensagem para o cliente.</p>';
}
async function salvarOrcForm(f){
  var itens=lerItensOrc(f);
  if(!itens.length){aviso('Adicione pelo menos um item.');return;}
  for(var i=0;i<itens.length;i++){if(!itens[i].descricao&&!itens[i].pr){aviso('Descreva cada item.');return;}if(itens[i].qtd<=0){aviso('Informe a quantidade de cada item.');return;}}
  var dados={id:f.getAttribute('data-id')||null,cliente_nome:f.cliente.value.trim(),contato:f.contato.value.trim(),canal:f.canal.value,status:f.status.value,data:f.data.value,validade:f.validade.value,
    prazo:f.prazo.value.trim(),desconto:num(f.desconto.value),frete:num(f.frete.value),observacoes:f.obs.value.trim(),
    itens:itens.map(function(i){return {produto_id:i.produtoId,descricao:i.descricao||(i.pr?i.pr.nome:''),variacao:i.variacao,quantidade:i.qtd,custo_unitario:i.custo,acrescimo_percentual:i.acrescimo===''?null:num(i.acrescimo),preco_unitario:i.preco,insumos:i.produtoId?[]:i.mats};})};
  var numero=null;
  var ok=await executar(async function(){numero=checar(await sb.rpc('salvar_orcamento',{p:dados}));});
  if(ok){aviso('Orçamento '+numPedido(numero)+' salvo.');ir('orcamento-'+numero);}
}
function telaOrcamento(o){
  var sub=0,custoT=0,qtdT=0;o.itens.forEach(function(i){sub+=i.qtd*i.preco;custoT+=i.qtd*i.custo;qtdT+=i.qtd;});
  var total=totalOrc(o),tx=taxasCanal(o.canal,total,qtdT),lucro=total-custoT-tx.total-o.frete,ped=o.pedidoId?acharPedidoId(o.pedidoId):null;
  var nec=necessidades(o.itens.map(function(i){var pr=i.produtoId?acharProduto(i.produtoId):null;return {qtd:i.qtd,insumos:pr?pr.insumos.map(function(x){return {material_id:x.materialId,quantidade:x.qtd};}):i.insumos};}));
  return '<div class="cab"><div style="display:flex;align-items:center;gap:10px"><a href="#orcamentos" class="btn contorno peq" aria-label="Voltar para orçamentos">'+icone('voltar')+'</a><div><h1>Orçamento '+numPedido(o.num)+'</h1><p>'+dataLonga(o.data)+(o.validade?' · válido até '+dataLonga(o.validade):'')+' · '+esc(o.canal)+'</p></div></div><div class="acoes">'+chipOrc(o)+'</div></div>'+
  '<div class="acoes"><button type="button" class="btn" data-acao="orc-copiar" data-num="'+o.num+'">'+icone('copiar')+'Copiar para WhatsApp</button><button type="button" class="btn ouro" data-acao="orc-pdf" data-num="'+o.num+'">'+icone('pdf')+'Gerar PDF</button>'+
    (ped?'<a class="btn contorno" href="#pedido-'+ped.num+'">Ver pedido '+numPedido(ped.num)+'</a>':'<button type="button" class="btn contorno" data-acao="orc-converter" data-num="'+o.num+'">Transformar em pedido</button>')+'</div>'+
  '<div class="dupla"><div class="larga" style="display:flex;flex-direction:column;gap:14px">'+
  '<section class="card"><h2>'+esc(o.cliente)+'</h2>'+(o.contato?'<p style="margin:0;color:var(--sec)">'+esc(o.contato)+'</p>':'')+
    '<div class="lista">'+o.itens.map(function(i){return '<div class="item"><div class="info"><b>'+esc(i.descricao)+(i.variacao?' ('+esc(i.variacao)+')':'')+'</b><span>'+qtdTxt(i.qtd)+' × '+brl(i.preco)+'</span></div><b>'+brl(i.qtd*i.preco)+'</b></div>';}).join('')+'</div>'+
    '<div class="valores"><div><span>Subtotal</span><span>'+brl(sub)+'</span></div>'+(o.desconto?'<div><span>Desconto</span><span>− '+brl(o.desconto)+'</span></div>':'')+(o.frete?'<div><span>Frete</span><span>'+brl(o.frete)+'</span></div>':'')+'<div class="total"><span>Total</span><span>'+brl(total)+'</span></div></div>'+
    (o.prazo?'<p style="margin:0;font-size:14px"><b>Prazo:</b> '+esc(o.prazo)+'</p>':'')+(o.obs?'<p style="margin:0;font-size:14px;white-space:pre-line"><b>Observações:</b> '+esc(o.obs)+'</p>':'')+
  '</section>'+
  (nec.length?'<section class="card"><h2>Materiais necessários</h2>'+tabelaNecessidades(nec,null).replace(/<p class="dica"[\s\S]*<\/p>$/,'<p class="dica" style="margin:0">O orçamento não baixa o estoque. A baixa acontece só no pedido.</p>')+'</section>':'')+
  '</div><div class="estreita" style="display:flex;flex-direction:column;gap:14px">'+
  '<section class="card escuro"><h2>Só para vocês</h2><div class="valores"><div><span>Custo interno</span><span>'+brl(custoT)+'</span></div>'+(o.canal==='Shopee'?'<div><span>Taxas Shopee</span><span>− '+brl(tx.total)+'</span></div>':'')+'<div class="total" style="border-color:var(--linha-esc)"><span>Lucro estimado</span><span class="'+(lucro>=0?'pos':'neg')+'">'+brl(lucro)+(total>0?' ('+pct(lucro/total*100)+')':'')+'</span></div></div></section>'+
  '<section class="card"><h2>Situação</h2><div class="campo"><label for="orc-st">Mudar situação</label><select id="orc-st" data-acao="orc-status" data-num="'+o.num+'"'+(o.pedidoId?' disabled':'')+'>'+opcoes(STATUS_ORC.filter(function(s){return s[0]!=='vencido';}).map(function(s){return [s[0],s[1]];}),o.status)+'</select></div>'+
    '<div class="acoes" style="flex-direction:column"><a class="btn contorno cheio" href="#editar-orcamento-'+o.num+'">Editar orçamento</a><a class="btn contorno cheio" href="#duplicar-orcamento-'+o.num+'">Duplicar</a>'+(o.pedidoId?'':'<button type="button" class="btn perigo cheio" data-acao="orc-excluir" data-num="'+o.num+'">Excluir orçamento</button>')+'</div>'+
    '<p class="dica" style="margin:0">Criado por '+esc(o.criadoPor||'—')+'.</p></section>'+
  '</div></div>';
}
function textoOrc(o){
  var sub=0,l=[];
  l.push('*Orçamento nº '+String(o.num).padStart(4,'0')+' — LP Personalizados*');
  l.push('Cliente: '+o.cliente);
  l.push('Data: '+dataLonga(o.data)+(o.validade?' · Válido até '+dataLonga(o.validade):''));
  l.push('');
  o.itens.forEach(function(i){sub+=i.qtd*i.preco;l.push('• '+qtdTxt(i.qtd)+'× '+i.descricao+(i.variacao?' ('+i.variacao+')':'')+' — '+brl(i.preco)+' cada = '+brl(i.qtd*i.preco));});
  l.push('');
  if(o.desconto||o.frete)l.push('Subtotal: '+brl(sub));
  if(o.desconto)l.push('Desconto: − '+brl(o.desconto));
  if(o.frete)l.push('Frete: '+brl(o.frete));
  l.push('*Total: '+brl(totalOrc(o))+'*');
  if(o.prazo)l.push('Prazo: '+o.prazo);
  if(o.obs)l.push('Obs.: '+o.obs);
  return l.join('\n');
}
var logoDataUrl=null;
async function carregarLogo(){
  if(logoDataUrl)return logoDataUrl;
  return new Promise(function(ok){var img=new Image();img.crossOrigin='anonymous';img.onload=function(){var c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);try{logoDataUrl=c.toDataURL('image/png');}catch(e){logoDataUrl=null;}ok(logoDataUrl);};img.onerror=function(){ok(null);};img.src=LOGO;});
}
async function gerarPdfOrc(o){
  if(!window.jspdf){aviso('O gerador de PDF não carregou. Confira a internet e tente de novo.');return;}
  var J=window.jspdf.jsPDF,doc=new J({unit:'mm',format:'a4'}),W=210,M=16,y=16;
  var logo=await carregarLogo();
  doc.setFillColor(17,19,24);doc.rect(0,0,W,42,'F');doc.setFillColor(242,194,48);doc.rect(0,42,W,1.6,'F');
  if(logo)doc.addImage(logo,'PNG',M,5,45,32);
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text('ORÇAMENTO',W-M,18,{align:'right'});
  doc.setFontSize(11);doc.setFont('helvetica','normal');doc.text('Nº '+String(o.num).padStart(4,'0'),W-M,25,{align:'right'});
  doc.text('Data: '+dataLonga(o.data),W-M,31,{align:'right'});if(o.validade)doc.text('Válido até: '+dataLonga(o.validade),W-M,37,{align:'right'});
  y=54;doc.setTextColor(17,19,24);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('CLIENTE',M,y);
  doc.setFont('helvetica','normal');doc.setFontSize(12);doc.text(o.cliente,M,y+6);if(o.contato){doc.setFontSize(10);doc.setTextColor(91,98,112);doc.text(o.contato,M,y+11.5);}
  y+=22;
  var cx=[M,M+104,M+128,M+154];
  doc.setFillColor(11,122,136);doc.rect(M,y,W-2*M,9,'F');doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);
  doc.text('Descrição',cx[0]+3,y+6);doc.text('Qtd.',cx[1]+16,y+6,{align:'right'});doc.text('Valor unit.',cx[2]+24,y+6,{align:'right'});doc.text('Total',W-M-3,y+6,{align:'right'});
  y+=9;doc.setFont('helvetica','normal');doc.setTextColor(17,19,24);
  var sub=0;
  o.itens.forEach(function(i,k){
    var desc=i.descricao+(i.variacao?' ('+i.variacao+')':''),linhas=doc.splitTextToSize(desc,98),h=Math.max(9,linhas.length*5+4);
    if(y+h>270){doc.addPage();y=20;}
    if(k%2===0){doc.setFillColor(245,246,248);doc.rect(M,y,W-2*M,h,'F');}
    doc.text(linhas,cx[0]+3,y+6);doc.text(qtdTxt(i.qtd),cx[1]+16,y+6,{align:'right'});doc.text(brl(i.preco),cx[2]+24,y+6,{align:'right'});doc.text(brl(i.qtd*i.preco),W-M-3,y+6,{align:'right'});
    sub+=i.qtd*i.preco;y+=h;
  });
  y+=4;doc.setDrawColor(228,231,235);doc.line(M+100,y,W-M,y);y+=6;
  function tot(rot,val,neg){doc.setFont('helvetica','normal');doc.setTextColor(91,98,112);doc.text(rot,W-M-50,y,{align:'right'});doc.setTextColor(17,19,24);doc.text((neg?'− ':'')+brl(val),W-M-3,y,{align:'right'});y+=6;}
  if(o.desconto||o.frete)tot('Subtotal',sub);
  if(o.desconto)tot('Desconto',o.desconto,true);
  if(o.frete)tot('Frete',o.frete);
  doc.setFillColor(242,194,48);doc.rect(W-M-80,y-4,80,11,'F');doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(17,19,24);doc.text('TOTAL',W-M-50,y+3.5,{align:'right'});doc.text(brl(totalOrc(o)),W-M-3,y+3.5,{align:'right'});
  y+=18;doc.setFontSize(10);
  if(o.prazo){doc.setFont('helvetica','bold');doc.text('Prazo de produção',M,y);doc.setFont('helvetica','normal');var lp=doc.splitTextToSize(o.prazo,W-2*M);doc.text(lp,M,y+5);y+=6+lp.length*5;}
  if(o.obs){if(y>250){doc.addPage();y=20;}doc.setFont('helvetica','bold');doc.text('Observações',M,y);doc.setFont('helvetica','normal');var lo=doc.splitTextToSize(o.obs,W-2*M);doc.text(lo,M,y+5);y+=6+lo.length*5;}
  doc.setFontSize(9);doc.setTextColor(91,98,112);doc.text('LP Personalizados · (19) 99650-7490',W/2,288,{align:'center'});
  var nome='Orcamento-LP-'+String(o.num).padStart(4,'0')+'.pdf';
  var blob=doc.output('blob');
  try{
    var arq=new File([blob],nome,{type:'application/pdf'});
    if(navigator.canShare&&navigator.canShare({files:[arq]})&&/Android|iPhone|iPad/i.test(navigator.userAgent)){await navigator.share({files:[arq],title:nome});return;}
  }catch(e){if(e&&e.name==='AbortError')return;}
  doc.save(nome);
}
async function copiarTexto(t){
  try{await navigator.clipboard.writeText(t);aviso('Mensagem copiada. É só colar no WhatsApp.');return true;}
  catch(e){modal('<h2>Copie a mensagem</h2><textarea style="width:100%;height:240px;border:1.5px solid var(--prata);border-radius:12px;padding:10px;font-size:14px" readonly>'+esc(t)+'</textarea><p class="dica" style="margin:0">Segure o dedo no texto e escolha copiar.</p><button type="button" class="btn contorno" data-acao="fechar">Fechar</button>');return false;}
}

/* =====================================================================
   Caixa e resultado por pedido
   ===================================================================== */
function telaCaixa(){
  if(!estado.mesCaixa){var d=new Date();estado.mesCaixa=[d.getFullYear(),d.getMonth()];}
  var a=estado.mesCaixa[0],m=estado.mesCaixa[1],r=resumoMes(a,m),aba=estado.caixaAba;
  var cab='<div class="cab"><div><h1>Caixa</h1><p>Só entra aqui o dinheiro que foi recebido ou pago de verdade.</p></div>'+
  '<div class="mes"><button type="button" data-acao="mes" data-d="-1" aria-label="Mês anterior">‹</button><b>'+MESES[m]+' '+a+'</b><button type="button" data-acao="mes" data-d="1" aria-label="Próximo mês">›</button></div></div>'+
  '<div class="grade"><div class="tile teal"><b>'+brl(r.ent)+'</b><span>Entradas</span></div><div class="tile verm"><b>'+brl(r.sai)+'</b><span>Saídas</span></div><div class="tile"><b>'+brl(r.ent-r.sai)+'</b><span>Saldo do mês</span></div></div>'+
  '<div class="filtros" role="group" aria-label="Ver"><button type="button" data-acao="caixa-aba" data-a="lanc" class="'+(aba==='lanc'?'ativo':'')+'">Lançamentos</button><button type="button" data-acao="caixa-aba" data-a="cat" class="'+(aba==='cat'?'ativo':'')+'">Por categoria</button><button type="button" data-acao="caixa-aba" data-a="ped" class="'+(aba==='ped'?'ativo':'')+'">Resultado por pedido</button></div>';
  if(aba==='cat')return cab+telaCaixaCategorias(r);
  if(aba==='ped')return cab+telaResultadoPedidos(a,m);
  var lst=r.itens.slice().sort(function(x,y){return x.data<y.data?1:x.data>y.data?-1:0;});
  var cats=estado.tipoNovo==='entrada'?CAT_ENTRADA:CAT_SAIDA;
  return cab+'<div class="dupla"><section class="card larga"><h2>Lançamentos</h2><div class="tabela"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th class="num">Valor</th><th><span class="sr">Ações</span></th></tr></thead><tbody>'+
  (lst.length?lst.map(function(c){var pd=c.pedidoId?acharPedidoId(c.pedidoId):null;return '<tr><td>'+dataCurta(c.data)+'</td><td>'+esc(c.descricao)+(pd?' <a href="#pedido-'+pd.num+'" style="font-size:12px">ver pedido</a>':'')+'</td><td>'+esc(c.categoria)+'</td><td>'+esc(c.forma)+'</td><td class="num '+(c.tipo==='entrada'?'pos':'neg')+'" style="font-weight:600">'+(c.tipo==='entrada'?'+ ':'− ')+brl(c.valor)+'</td><td class="num"><button type="button" class="btn perigo peq" data-acao="excluir-lanc" data-id="'+c.id+'">Excluir</button></td></tr>';}).join(''):'<tr><td colspan="6" class="vazio">Nenhum lançamento neste mês.</td></tr>')+
  '</tbody></table></div><p class="dica" style="margin:0">Recebimentos de pedidos são lançados pela tela do pedido, para não duplicar.</p></section>'+
  '<form class="card estreita" data-form="lanc"><h2>Novo lançamento</h2>'+
    '<div class="filtros" role="group" aria-label="Tipo"><button type="button" data-acao="tipo" data-t="entrada" class="'+(estado.tipoNovo==='entrada'?'ativo':'')+'">Entrada</button><button type="button" data-acao="tipo" data-t="saida" class="'+(estado.tipoNovo==='saida'?'ativo':'')+'">Saída</button></div>'+
    '<div class="campo"><label for="lc-de">Descrição</label><input id="lc-de" name="descricao" required placeholder="'+(estado.tipoNovo==='entrada'?'Ex.: Repasse Shopee da semana':'Ex.: Compra de canecas')+'"></div>'+
    '<div class="campo"><label for="lc-ca">Categoria</label><select id="lc-ca" name="categoria">'+opcoes(cats)+'</select></div>'+
    '<div class="campo"><label for="lc-va">Valor (R$)</label><input id="lc-va" name="valor" type="number" min="0.01" step="0.01" required></div>'+
    '<div class="campo"><label for="lc-fo">Forma de pagamento</label><select id="lc-fo" name="forma">'+opcoes(FORMAS)+'</select></div>'+
    '<div class="campo"><label for="lc-pe">Pedido (opcional)</label><select id="lc-pe" name="pedido"><option value="">—</option>'+db.pedidos.filter(function(p){return !p.excluido;}).map(function(p){return '<option value="'+p.id+'">'+numPedido(p.num)+' · '+esc(p.cliente)+'</option>';}).join('')+'</select></div>'+
    '<div class="campo"><label for="lc-da">Data</label><input id="lc-da" name="data" type="date" required value="'+hoje()+'"></div>'+
    '<button class="btn" type="submit">Lançar '+(estado.tipoNovo==='entrada'?'entrada':'saída')+'</button></form></div>';
}
function telaCaixaCategorias(r){
  var mapa={};r.itens.forEach(function(c){var k=c.tipo+'|'+c.categoria;mapa[k]=(mapa[k]||0)+num(c.valor);});
  var ks=Object.keys(mapa).sort();
  return '<section class="card"><h2>Totais por categoria</h2><div class="tabela"><table style="min-width:360px"><thead><tr><th>Tipo</th><th>Categoria</th><th class="num">Total</th></tr></thead><tbody>'+
    (ks.length?ks.map(function(k){var p=k.split('|');return '<tr><td>'+(p[0]==='entrada'?'Entrada':'Saída')+'</td><td>'+esc(p[1])+'</td><td class="num '+(p[0]==='entrada'?'pos':'neg')+'" style="font-weight:600">'+brl(mapa[k])+'</td></tr>';}).join(''):'<tr><td colspan="3" class="vazio">Nada neste mês.</td></tr>')+'</tbody></table></div></section>';
}
function telaResultadoPedidos(a,m){
  var lst=db.pedidos.filter(function(p){if(p.excluido||p.status==='cancelado')return false;var d=paraData(p.criado);return d.getFullYear()===a&&d.getMonth()===m;}).sort(function(x,y){return x.num-y.num;});
  var T={fat:0,mat:0,ext:0,tx:0,luc:0,rec:0,lucR:0};
  var linhas=lst.map(function(p){
    var fat=totalPedido(p),mat=teveBaixa(p)?custoMateriaisReal(p):custoMateriaisEst(p),ext=custoExtras(p)+num(p.custo),tx=num(p.taxa),luc=fat-mat-ext-tx,rec=recebidoPedido(p),lucR=rec-custoMateriaisReal(p)-ext-tx;
    T.fat+=fat;T.mat+=mat;T.ext+=ext;T.tx+=tx;T.luc+=luc;T.rec+=rec;T.lucR+=lucR;
    return '<tr><td><a href="#pedido-'+p.num+'">'+numPedido(p.num)+'</a> '+esc(p.cliente)+'</td><td class="num">'+brl(fat)+'</td><td class="num">'+brl(mat)+'</td><td class="num">'+brl(ext)+'</td><td class="num">'+brl(tx)+'</td><td class="num '+(luc>=0?'pos':'neg')+'" style="font-weight:600">'+brl(luc)+'</td><td class="num">'+brl(rec)+'</td><td class="num '+(lucR>=0?'pos':'neg')+'">'+brl(lucR)+'</td></tr>';
  }).join('');
  return '<section class="card"><h2>Pedidos abertos no mês</h2><div class="tabela"><table style="min-width:760px"><thead><tr><th>Pedido</th><th class="num">Faturamento</th><th class="num">Materiais</th><th class="num">Outros custos</th><th class="num">Taxas Shopee</th><th class="num">Lucro estimado</th><th class="num">Recebido</th><th class="num">Lucro realizado</th></tr></thead><tbody>'+
    (lst.length?linhas+'<tr><td><b>Total</b></td><td class="num"><b>'+brl(T.fat)+'</b></td><td class="num"><b>'+brl(T.mat)+'</b></td><td class="num"><b>'+brl(T.ext)+'</b></td><td class="num"><b>'+brl(T.tx)+'</b></td><td class="num"><b>'+brl(T.luc)+'</b></td><td class="num"><b>'+brl(T.rec)+'</b></td><td class="num"><b>'+brl(T.lucR)+'</b></td></tr>':'<tr><td colspan="8" class="vazio">Nenhum pedido aberto neste mês.</td></tr>')+
    '</tbody></table></div><p class="dica" style="margin:0">Materiais usam a baixa real do estoque quando já aconteceu; antes disso, a estimativa da ficha. Lucro realizado = recebido − custos.</p></section>';
}

/* =====================================================================
   Estoque
   ===================================================================== */
function telaEstoque(){
  var baixos=abaixoMinimo();
  return '<div class="cab"><div><h1>Estoque de materiais</h1><p>O alerta aparece quando o material chega ao mínimo.</p></div><button type="button" class="btn ouro" data-acao="novo-mat">+ Novo material</button></div>'+
  (baixos.length?'<section class="card escuro"><h2>Lista de compras sugerida</h2>'+baixos.map(function(b){var sug=Math.max(1,num(b.minimo)*2-num(b.qtd));var emb=b.unidEmb>0?' ('+Math.ceil(sug/b.unidEmb)+' '+esc(b.embalagem||'embalagem')+')':'';return '<div class="alerta"><i class="o"></i><span><b>'+esc(b.nome)+'</b>: tem '+qtdTxt(b.qtd)+', comprar '+qtdTxt(sug)+' '+esc(b.unidade)+emb+(b.fornecedor?' · '+esc(b.fornecedor):'')+' · previsto '+brl(sug*num(b.custo))+'</span></div>';}).join('')+'</section>':'')+
  '<section class="card">'+(db.materiais.length?'<div class="tabela"><table><thead><tr><th>Material</th><th class="num">Quantidade</th><th class="num">Mínimo</th><th class="num">Custo por unidade</th><th>Fornecedor</th><th><span class="sr">Ações</span></th></tr></thead><tbody>'+
  db.materiais.map(function(m){var baixo=num(m.qtd)<=num(m.minimo);return '<tr><td><b>'+esc(m.nome)+'</b>'+(baixo?' <span class="chip red">Abaixo do mínimo</span>':'')+(m.unidEmb>0?'<div style="font-size:12.5px;color:var(--sec)">'+esc(m.embalagem||'embalagem')+' com '+qtdTxt(m.unidEmb)+' '+esc(m.unidade)+(m.valorEmb!=null?' · '+brl(m.valorEmb):'')+'</div>':'')+'</td><td class="num">'+qtdTxt(m.qtd)+' '+esc(m.unidade)+'</td><td class="num">'+qtdTxt(m.minimo)+'</td><td class="num">'+brl4(m.custo)+'</td><td>'+esc(m.fornecedor||'')+'</td><td class="num"><div class="acoes" style="justify-content:flex-end;flex-wrap:nowrap"><button type="button" class="btn contorno peq" data-acao="editar-mat" data-id="'+m.id+'">Editar</button><button type="button" class="btn contorno peq" data-acao="hist-mat" data-id="'+m.id+'">Histórico</button><button type="button" class="btn contorno peq" data-acao="mov" data-t="entrada" data-id="'+m.id+'">Entrada</button><button type="button" class="btn contorno peq" data-acao="mov" data-t="saida" data-id="'+m.id+'">Saída</button></div></td></tr>';}).join('')+
  '</tbody></table></div>':'<div class="vazio">Nenhum material cadastrado ainda. Toque em “+ Novo material”.</div>')+'</section>';
}
function formMaterial(m){
  var e=!!m;m=m||{nome:'',descricao:'',categoria:'',unidade:'un',qtd:0,minimo:0,fornecedor:'',embalagem:'',unidEmb:0,valorEmb:null,custo:0};
  var temPac=m.unidEmb>0;
  return '<h2>'+(e?'Editar material':'Novo material')+'</h2><form data-form="mat" '+(e?'data-id="'+m.id+'"':'')+' style="display:flex;flex-direction:column;gap:12px">'+
    '<div class="campo"><label for="nm-n">Nome</label><input id="nm-n" name="nome" required value="'+esc(m.nome)+'" placeholder="Ex.: Folha sulfite A4"></div>'+
    '<div class="campo"><label for="nm-d">Descrição</label><input id="nm-d" name="descricao" value="'+esc(m.descricao)+'" placeholder="Gramatura, cor, marca…"></div>'+
    '<div class="campos"><div class="campo"><label for="nm-u">Unidade (como você usa)</label><input id="nm-u" name="unidade" required value="'+esc(m.unidade)+'" placeholder="folha, un, adesivo, metro"></div>'+
    '<div class="campo"><label for="nm-g">Categoria</label><input id="nm-g" name="categoria" value="'+esc(m.categoria)+'" placeholder="Papéis, adesivos…"></div>'+
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
var NOME_MOV={entrada:'Entrada',consumo:'Consumo',perda:'Perda',ajuste:'Ajuste',estorno:'Devolução'};
async function mostrarHistoricoMat(m){
  carregandoSim('Carregando…');
  try{
    var r=checar(await sb.from('movimentos_estoque').select('tipo,origem,quantidade,custo_unitario,pedido_id,observacao,usuario,criado_em').eq('material_id',m.id).order('criado_em',{ascending:false}).limit(80));
    modal('<h2>Histórico · '+esc(m.nome)+'</h2><p style="margin:0;color:var(--sec)">Hoje: '+qtdTxt(m.qtd)+' '+esc(m.unidade)+' · custo '+brl4(m.custo)+'</p>'+
      (r.length?'<div class="hist">'+r.map(function(x){var pd=x.pedido_id?acharPedidoId(x.pedido_id):null;var sinal=x.tipo==='entrada'||x.tipo==='estorno'?'+ ':x.tipo==='ajuste'?'= ':'− ';
        return '<div><span>'+dataCurta(iso(new Date(x.criado_em)))+'</span><span><b>'+NOME_MOV[x.tipo]+'</b> '+sinal+qtdTxt(x.quantidade)+' '+esc(m.unidade)+(pd?' · pedido '+numPedido(pd.num):'')+(x.origem==='ficha'?' (ficha)':'')+(x.observacao?' · '+esc(x.observacao):'')+(x.usuario?' <span style="color:var(--sec)">('+esc(x.usuario)+')</span>':'')+'</span></div>';}).join('')+'</div>':'<div class="vazio">Sem movimentações ainda.</div>')+
      '<button type="button" class="btn contorno" data-acao="fechar">Fechar</button>');
  }catch(e){aviso(msgErro(e));}
  finally{carregandoNao();}
}

/* =====================================================================
   Ajustes
   ===================================================================== */
function telaAjustes(){
  var c=db.cfg;
  return '<div class="cab"><div><h1>Ajustes</h1><p>Taxas da Shopee, etapa da baixa do estoque e meta do mês.</p></div></div>'+
  '<form class="card" data-form="ajustes" style="max-width:720px"><h2>Taxas da Shopee</h2><p class="dica" style="margin:0">Informe as taxas que a Shopee cobra hoje da LP. Elas só entram em pedidos, orçamentos e preços do canal Shopee.</p><div class="campos">'+
    '<div class="campo"><label for="aj-p">Comissão e taxas (% sobre a venda)</label><input id="aj-p" name="pct" type="number" min="0" max="99" step="0.01" value="'+c.shopeePct+'"></div>'+
    '<div class="campo"><label for="aj-f">Tarifa fixa (R$)</label><input id="aj-f" name="fixo" type="number" min="0" step="0.01" value="'+c.shopeeFixo+'"></div>'+
    '<div class="campo"><label for="aj-fp">A tarifa fixa é cobrada por</label><select id="aj-fp" name="fixoPor">'+opcoes([['pedido','Pedido'],['item','Item vendido']],c.shopeeFixoPor)+'</select></div>'+
    '<div class="campo"><label for="aj-o">Outras despesas na Shopee (% da venda)</label><input id="aj-o" name="outras" type="number" min="0" max="99" step="0.01" value="'+c.outrasPct+'"></div>'+
  '</div><p class="dica" style="margin:0">Use “outras despesas” para frete subsidiado, cupons pagos pela loja etc.</p>'+
  '<h2 style="margin-top:8px">Baixa do estoque</h2><div class="campo"><label for="aj-b">Os materiais da ficha saem do estoque quando o pedido chega em</label><select id="aj-b" name="baixa">'+opcoes(STATUS.filter(function(s){return ORDEM_STATUS[s[0]]>=1;}).map(function(s){return [s[0],s[1]];}),c.statusBaixa)+'</select></div>'+
  '<h2 style="margin-top:8px">Meta de vendas</h2><div class="campo"><label for="aj-m">Meta do mês (R$)</label><input id="aj-m" name="meta" type="number" min="0" step="0.01" value="'+(c.meta||'')+'"></div>'+
  '<button class="btn" type="submit">Salvar ajustes</button></form>';
}

/* =====================================================================
   Modal e aviso
   ===================================================================== */
function modal(html){
  fecharModal();
  var f=document.createElement('div');f.className='fundo-modal';f.id='modal';
  f.innerHTML='<div class="modal" role="dialog" aria-modal="true">'+html+'</div>';
  f.addEventListener('click',function(e){if(e.target===f)fecharModal();});
  document.body.appendChild(f);
  var i=f.querySelector('input:not([type=hidden]),select');if(i)i.focus();
}
function fecharModal(){var m=document.getElementById('modal');if(m)m.remove();}
var tAviso;
function aviso(t){
  var a=document.querySelector('.toast');if(a)a.remove();
  a=document.createElement('div');a.className='toast';a.setAttribute('role','status');a.textContent=t;document.body.appendChild(a);
  clearTimeout(tAviso);tAviso=setTimeout(function(){a.remove();},3800);
}
function botoesForm(rotulo){return '<div class="acoes"><button class="btn" type="submit">'+rotulo+'</button><button type="button" class="btn contorno" data-acao="fechar">Cancelar</button></div>';}

/* =====================================================================
   Eventos: cliques
   ===================================================================== */
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-acao]');if(!b||b.tagName==='SELECT')return;
  var a=b.getAttribute('data-acao'),p,o;
  if(b.tagName==='A'&&b.getAttribute('href')==='#')e.preventDefault();
  if(a==='sair'){fecharModal();sb.auth.signOut().finally(function(){usuario=null;desenhar();});}
  else if(a==='menu'){modal('<h2>Menu</h2><div class="acoes" style="flex-direction:column">'+
      '<a class="btn contorno cheio" href="#produtos" data-acao="fechar">Produtos</a><a class="btn contorno cheio" href="#estoque" data-acao="fechar">Estoque</a><a class="btn contorno cheio" href="#caixa" data-acao="fechar">Caixa</a><a class="btn contorno cheio" href="#ajustes" data-acao="fechar">Ajustes</a></div>'+
      '<p style="margin:0;color:var(--sec)">Conectado como <b>'+esc(usuario.nome)+'</b></p><div class="acoes"><button type="button" class="btn contorno" data-acao="atualizar">Atualizar dados</button><button type="button" class="btn perigo" data-acao="sair">Sair</button></div>');}
  else if(a==='novo'){modal('<h2>Criar</h2><div class="acoes" style="flex-direction:column"><a class="btn ouro cheio" href="#novo-pedido" data-acao="fechar">Novo pedido</a><a class="btn contorno cheio" href="#novo-orcamento" data-acao="fechar">Novo orçamento</a><a class="btn contorno cheio" href="#novo-produto" data-acao="fechar">Novo produto</a></div>');}
  else if(a==='fechar'){fecharModal();}
  else if(a==='atualizar'){fecharModal();executar(async function(){},'Dados atualizados.').then(desenhar);}
  else if(a==='filtrar'){estado.filtroStatus=b.getAttribute('data-status');estado.busca='';ir('pedidos');}
  else if(a==='filtro'){estado.filtroStatus=b.getAttribute('data-status');document.querySelectorAll('.filtros [data-acao=filtro]').forEach(function(x){x.classList.toggle('ativo',x===b);});desenharListaPedidos();}
  else if(a==='filtro-orc'){estado.filtroOrc=b.getAttribute('data-s');desenhar();}
  else if(a==='caixa-aba'){estado.caixaAba=b.getAttribute('data-a');desenhar();}
  /* pedido: formulário */
  else if(a==='add-item'){var c=document.getElementById('itens');c.insertAdjacentHTML('beforeend',linhaItemPedido());atualizarFormPedido();}
  else if(a==='remover-item'){if(document.querySelectorAll('[data-item]').length>1){b.closest('[data-item]').remove();atualizarFormPedido();}else aviso('O pedido precisa de pelo menos um item.');}
  /* pedido: detalhe */
  else if(a==='receber'){p=acharPedido(b.getAttribute('data-num'));var s=saldoPedido(p);
    modal('<h2>Registrar recebimento</h2><p style="margin:0;color:var(--sec)">Pedido '+numPedido(p.num)+' · saldo de '+brl(s)+'</p><form data-form="receber" data-num="'+p.num+'" style="display:flex;flex-direction:column;gap:12px"><div class="campo"><label for="rc-v">Valor recebido (R$)</label><input id="rc-v" name="valor" type="number" min="0.01" max="'+s+'" step="0.01" required value="'+s+'"></div><div class="campo"><label for="rc-f">Forma</label><select id="rc-f" name="forma">'+opcoes(FORMAS,p.origem==='Shopee'?'Repasse Shopee':'Pix')+'</select></div><div class="campo"><label for="rc-d">Data</label><input id="rc-d" name="data" type="date" required value="'+hoje()+'"></div>'+botoesForm('Lançar no caixa')+'</form>');}
  else if(a==='custos'){p=acharPedido(b.getAttribute('data-num'));var txs=taxasCanal(p.origem,totalPedido(p),p.itens.reduce(function(s,i){return s+i.qtd;},0));
    modal('<h2>Custos e taxas do pedido</h2><form data-form="custos" data-num="'+p.num+'" style="display:flex;flex-direction:column;gap:12px"><div class="campo"><label for="cu-c">Outros custos do pedido (R$)</label><input id="cu-c" name="custo" type="number" min="0" step="0.01" value="'+num(p.custo)+'"></div><div class="campo"><label for="cu-t">Taxas e despesas da Shopee (R$)</label><input id="cu-t" name="taxa" type="number" min="0" step="0.01" value="'+num(p.taxa)+'"></div>'+(p.origem==='Shopee'?'<p class="dica" style="margin:0">Estimativa pelas taxas em Ajustes: '+brl(txs.total)+'.</p>':'')+botoesForm('Salvar')+'</form>');}
  else if(a==='envio'){p=acharPedido(b.getAttribute('data-num'));
    modal('<h2>Dados de envio</h2><form data-form="envio" data-num="'+p.num+'" style="display:flex;flex-direction:column;gap:12px"><div class="campo"><label for="ev-t">Transportadora</label><input id="ev-t" name="transportadora" value="'+esc(p.transportadora)+'"></div><div class="campo"><label for="ev-r">Código de rastreio</label><input id="ev-r" name="rastreio" value="'+esc(p.rastreio)+'"></div>'+botoesForm('Salvar')+'</form>');}
  else if(a==='excluir-pedido'){p=acharPedido(b.getAttribute('data-num'));abrirCancelamento(p,true);}
  else if(a==='repetir'){p=acharPedido(b.getAttribute('data-num'));
    modal('<h2>Repetir pedido '+numPedido(p.num)+'?</h2><p style="margin:0;color:var(--sec)">Cria um pedido novo para '+esc(p.cliente)+' com os mesmos itens e valores, prazo de produção em 7 dias.</p><div class="acoes"><button type="button" class="btn" data-acao="repetir-ok" data-num="'+p.num+'">Criar pedido</button><button type="button" class="btn contorno" data-acao="fechar">Cancelar</button></div>');}
  else if(a==='repetir-ok'){p=acharPedido(b.getAttribute('data-num'));fecharModal();
    var dados={cliente_nome:p.cliente,telefone:p.telefone,origem:p.origem,status:'novo',prazo_producao:maisDias(7),prazo_entrega:maisDias(9),frete:p.frete,desconto:p.desconto,custo:p.custo,taxa_shopee:p.taxa,
      observacoes:'Repetição do pedido '+numPedido(p.num),itens:p.itens.map(function(i){return {produto_id:i.produtoId,produto:i.produto,variacao:i.variacao,quantidade:i.qtd,valor_unitario:i.valor,personalizacao:i.pers,custo_unitario:i.cMat+i.cExt,insumos:i.produtoId?[]:i.insumos};})};
    var novo=null;
    executar(async function(){novo=checar(await sb.rpc('salvar_pedido',{p:dados}));}).then(function(ok){if(ok){aviso('Pedido '+numPedido(novo)+' criado.');ir('pedido-'+novo);}});}
  else if(a==='ordem'){p=acharPedido(b.getAttribute('data-num'));var nc=necessidades(p.itens);
    modal('<h2>Ordem de produção '+numPedido(p.num)+'</h2><div class="valores"><div><span>Cliente</span><span>'+esc(p.cliente)+'</span></div><div><span>Prazo de produção</span><b>'+dataLonga(p.prazoProducao)+'</b></div></div><div class="lista">'+p.itens.map(function(i){return '<div class="item"><div class="info"><b>'+qtdTxt(i.qtd)+'× '+esc(i.produto)+(i.variacao?' ('+esc(i.variacao)+')':'')+'</b><span style="white-space:normal">'+esc(i.pers||'Sem personalização')+'</span></div></div>';}).join('')+'</div>'+
      (nc.length?'<div class="hist">'+nc.map(function(n){return '<div><span>'+qtdTxt(n.q)+' '+esc(n.m.unidade)+'</span><span>'+esc(n.m.nome)+'</span></div>';}).join('')+'</div>':'')+
      (p.obs?'<p style="margin:0;font-size:14px;white-space:pre-line"><b>Obs.:</b> '+esc(p.obs)+'</p>':'')+'<div class="acoes"><button type="button" class="btn" data-acao="imprimir">Imprimir</button><button type="button" class="btn contorno" data-acao="fechar">Fechar</button></div>');}
  else if(a==='imprimir'){window.print();}
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
  /* produtos */
  else if(a==='add-insumo'){document.getElementById('insumos').insertAdjacentHTML('beforeend',linhaInsumo());atualizarFormProduto();}
  else if(a==='remover-insumo'){b.closest('[data-insumo]').remove();atualizarFormProduto();}
  else if(a==='canal-prod'){var fp=document.querySelector('[data-form="produto"]');fp.canal.value=b.getAttribute('data-c');b.parentNode.querySelectorAll('button').forEach(function(x){x.classList.toggle('ativo',x===b);});atualizarFormProduto();}
  else if(a==='usar-preco'){var fpp=document.querySelector('[data-form="produto"]');fpp.preco.value=num(b.getAttribute('data-preco')).toFixed(2);if(b.getAttribute('data-pc'))fpp.acrescimo.value=b.getAttribute('data-pc');atualizarFormProduto();aviso('Preço aplicado. Toque em Salvar produto para guardar.');}
  else if(a==='excluir-produto'){var idp=b.getAttribute('data-id'),pr=acharProduto(idp);
    modal('<h2>Excluir '+esc(pr.nome)+'?</h2><p style="margin:0;color:var(--sec)">A ficha técnica é apagada. Pedidos e orçamentos antigos continuam com os itens e custos que já tinham. Se preferir só esconder dos novos pedidos, marque o produto como inativo.</p><div class="acoes"><button type="button" class="btn perigo" data-acao="excluir-produto-ok" data-id="'+idp+'">Excluir</button><button type="button" class="btn contorno" data-acao="fechar">Cancelar</button></div>');}
  else if(a==='excluir-produto-ok'){var idx=b.getAttribute('data-id');fecharModal();executar(async function(){checar(await sb.from('produtos').delete().eq('id',idx));},'Produto excluído.').then(function(ok){if(ok)ir('produtos');});}
  /* orçamentos */
  else if(a==='add-item-orc'){document.getElementById('itens-orc').insertAdjacentHTML('beforeend',linhaItemOrc());atualizarFormOrc();}
  else if(a==='remover-item-orc'){if(document.querySelectorAll('[data-item-orc]').length>1){b.closest('[data-item-orc]').remove();atualizarFormOrc();}else aviso('O orçamento precisa de pelo menos um item.');}
  else if(a==='orc-add-mat'){if(!db.materiais.length){aviso('Cadastre os materiais no Estoque primeiro.');return;}b.closest('.campo-mats').querySelector('.orc-mats').insertAdjacentHTML('beforeend',linhaMatOrc('',1));}
  else if(a==='orc-rem-mat'){var it=b.closest('[data-item-orc]');b.closest('.orc-mat').remove();atualizarFormOrc(it.querySelector('[name=acrescimo]'));}
  else if(a==='orc-copiar'){o=acharOrc(b.getAttribute('data-num'));copiarTexto(textoOrc(o));
    var dg=digitosWpp(o.contato);if(dg){setTimeout(function(){modal('<h2>Mensagem copiada</h2><p style="margin:0">Quer abrir a conversa com '+esc(o.cliente)+' no WhatsApp?</p><div class="acoes"><a class="btn" href="https://wa.me/'+dg+'?text='+encodeURIComponent(textoOrc(o))+'" target="_blank" rel="noopener">'+icone('wpp')+'Abrir WhatsApp</a><button type="button" class="btn contorno" data-acao="fechar">Fechar</button></div>');},400);}}
  else if(a==='orc-pdf'){o=acharOrc(b.getAttribute('data-num'));gerarPdfOrc(o).catch(function(err){aviso(msgErro(err));});}
  else if(a==='orc-converter'){o=acharOrc(b.getAttribute('data-num'));
    modal('<h2>Transformar em pedido?</h2><p style="margin:0;color:var(--sec)">Cria um pedido para '+esc(o.cliente)+' com os mesmos itens, valores e quantidades ('+brl(totalOrc(o))+'). O orçamento fica como aprovado. O estoque só baixa quando o pedido chegar em “'+esc(etapaBaixaNome())+'”.</p><div class="acoes"><button type="button" class="btn" data-acao="orc-converter-ok" data-num="'+o.num+'">Criar pedido</button><button type="button" class="btn contorno" data-acao="fechar">Cancelar</button></div>');}
  else if(a==='orc-converter-ok'){o=acharOrc(b.getAttribute('data-num'));fecharModal();var np=null;
    executar(async function(){np=checar(await sb.rpc('converter_orcamento',{p_orcamento:o.id}));}).then(function(ok){if(ok){aviso('Pedido '+numPedido(np)+' criado a partir do orçamento.');ir('editar-pedido-'+np);}});}
  else if(a==='orc-excluir'){o=acharOrc(b.getAttribute('data-num'));
    modal('<h2>Excluir orçamento '+numPedido(o.num)+'?</h2><p style="margin:0;color:var(--sec)">Ele some da lista. Se só não foi aceito, prefira marcar como “Recusado”.</p><div class="acoes"><button type="button" class="btn perigo" data-acao="orc-excluir-ok" data-num="'+o.num+'">Excluir</button><button type="button" class="btn contorno" data-acao="fechar">Cancelar</button></div>');}
  else if(a==='orc-excluir-ok'){o=acharOrc(b.getAttribute('data-num'));fecharModal();executar(async function(){checar(await sb.from('orcamentos').delete().eq('id',o.id));},'Orçamento excluído.').then(function(ok){if(ok)ir('orcamentos');});}
  /* caixa */
  else if(a==='mes'){var d=+b.getAttribute('data-d'),mm=estado.mesCaixa[1]+d,aa=estado.mesCaixa[0];if(mm<0){mm=11;aa--;}if(mm>11){mm=0;aa++;}estado.mesCaixa=[aa,mm];desenhar();}
  else if(a==='tipo'){estado.tipoNovo=b.getAttribute('data-t');desenhar();}
  else if(a==='excluir-lanc'){var id=b.getAttribute('data-id'),c2=db.caixa.filter(function(x){return x.id===id;})[0];
    modal('<h2>Excluir lançamento?</h2><p style="margin:0;color:var(--sec)">'+esc(c2.descricao)+' · '+brl(c2.valor)+(c2.pedidoId?'<br>Este valor também sai do pedido ligado a ele.':'')+'<br>Use só para lançamentos feitos por engano. Para devolver dinheiro a um cliente, lance uma saída.</p><div class="acoes"><button type="button" class="btn perigo" data-acao="excluir-ok" data-id="'+id+'">Excluir</button><button type="button" class="btn contorno" data-acao="fechar">Cancelar</button></div>');}
  else if(a==='excluir-ok'){var id2=b.getAttribute('data-id');fecharModal();executar(async function(){checar(await sb.from('caixa').delete().eq('id',id2));},'Lançamento excluído.').then(desenhar);}
  /* estoque */
  else if(a==='mov'){var mt=acharMaterial(b.getAttribute('data-id')),t=b.getAttribute('data-t'),pac=t==='entrada'&&mt.unidEmb>0;
    modal('<h2>'+(t==='entrada'?'Entrada':'Saída')+' de material</h2><p style="margin:0;color:var(--sec)">'+esc(mt.nome)+' · hoje: '+qtdTxt(mt.qtd)+' '+esc(mt.unidade)+'</p><form data-form="mov" data-id="'+mt.id+'" data-t="'+t+'" style="display:flex;flex-direction:column;gap:12px">'+
      (pac?'<div class="campo"><label for="mv-q">Quantas embalagens? ('+esc(mt.embalagem||'embalagem')+' com '+qtdTxt(mt.unidEmb)+' '+esc(mt.unidade)+')</label><input id="mv-q" name="qtd" type="number" min="1" step="1" required value="1"></div><input type="hidden" name="pacote" value="1">':'<div class="campo"><label for="mv-q">Quantidade ('+esc(mt.unidade)+')</label><input id="mv-q" name="qtd" type="number" min="0.01" step="0.01" required value="1"></div>')+
      (t==='saida'?'<div class="campo"><label for="mv-m">Motivo</label><select id="mv-m" name="motivo"><option value="consumo">Consumo</option><option value="perda">Perda ou erro</option></select></div><div class="campo"><label for="mv-p">Pedido (opcional)</label><select id="mv-p" name="pedido"><option value="">—</option>'+db.pedidos.filter(aberto).map(function(x){return '<option value="'+x.id+'">'+numPedido(x.num)+' · '+esc(x.cliente)+'</option>';}).join('')+'</select></div>':
      '<div class="campo"><label for="mv-c">Valor total pago (R$)</label><input id="mv-c" name="valor" type="number" min="0" step="0.01" placeholder="Deixe vazio para não lançar no caixa"></div><div class="campo"><label for="mv-f">Forma de pagamento</label><select id="mv-f" name="forma">'+opcoes(FORMAS)+'</select></div><p class="dica" style="margin:0">Com o valor, a compra entra no caixa e o custo por unidade é atualizado.</p>')+
      botoesForm('Confirmar')+'</form>');}
  else if(a==='novo-mat'){modal(formMaterial(null));atualizarPreviaMat();}
  else if(a==='editar-mat'){modal(formMaterial(acharMaterial(b.getAttribute('data-id'))));atualizarPreviaMat();}
  else if(a==='hist-mat'){mostrarHistoricoMat(acharMaterial(b.getAttribute('data-id')));}
});

/* cancelamento ou exclusão de pedido */
function abrirCancelamento(p,excluir){
  var baixou=teveBaixa(p),rec=recebidoPedido(p);
  modal('<h2>'+(excluir?'Excluir':'Cancelar')+' o pedido '+numPedido(p.num)+'?</h2>'+
    '<p style="margin:0">'+esc(p.cliente)+' · '+esc(resumoItens(p))+' · '+brl(totalPedido(p))+'</p>'+
    '<div class="aviso-demo">'+(excluir?'O pedido sai das listas e não gera mais baixas no estoque. Ele fica guardado para consulta (filtro “Excluídos”), com data, motivo e quem excluiu. Depois você pode cadastrar outro pedido normalmente.':'O pedido fica como cancelado e não gera mais baixas no estoque.')+(rec>0?' Os '+brl(rec)+' já recebidos continuam no caixa.':'')+'</div>'+
    '<form data-form="cancelar" data-num="'+p.num+'" data-excluir="'+(excluir?'1':'')+'" style="display:flex;flex-direction:column;gap:12px">'+
    '<div class="campo"><label for="cx-m">Motivo</label><input id="cx-m" name="motivo" required placeholder="'+(excluir?'Ex.: lançado por engano':'Ex.: cliente desistiu')+'"></div>'+
    (baixou?'<div class="campo"><label for="cx-d">Os materiais que saíram do estoque…</label><select id="cx-d" name="devolver"><option value="1">Não foram usados: devolver ao estoque</option><option value="0">Já foram usados: manter como consumo</option></select></div>':'<input type="hidden" name="devolver" value="1">')+
    (rec>0?'<div class="campo"><label for="cx-v">Devolver dinheiro ao cliente? (R$, opcional)</label><input id="cx-v" name="devolucao" type="number" min="0" max="'+rec+'" step="0.01" placeholder="0,00"></div><div class="campo"><label for="cx-f">Forma da devolução</label><select id="cx-f" name="forma">'+opcoes(FORMAS)+'</select></div><p class="dica" style="margin:0">A devolução entra como saída no caixa, sem apagar o recebimento.</p>':'')+
    '<div class="acoes"><button class="btn perigo" type="submit">'+(excluir?'Excluir pedido':'Cancelar pedido')+'</button><button type="button" class="btn contorno" data-acao="fechar">Voltar</button></div></form>');
}

/* =====================================================================
   Eventos: mudanças e digitação
   ===================================================================== */
document.addEventListener('change',function(e){
  var s=e.target;
  if(s.closest&&s.closest('[data-form="uso"]')){atualizarPreviaUso();return;}
  if(s.getAttribute&&s.getAttribute('data-acao')==='mudar-status'){
    var p=acharPedido(s.getAttribute('data-num')),novo=s.value;
    if(novo==='cancelado'){s.value=p.status;abrirCancelamento(p,false);return;}
    executar(async function(){checar(await sb.from('pedidos').update({status:novo}).eq('id',p.id));},'Situação atualizada: '+statusInfo(novo)[1]+'.').then(function(ok){desenhar();});
    return;
  }
  if(s.getAttribute&&s.getAttribute('data-acao')==='orc-status'){
    var o=acharOrc(s.getAttribute('data-num')),st=s.value;
    executar(async function(){checar(await sb.from('orcamentos').update({status:st,atualizado_em:new Date().toISOString()}).eq('id',o.id));},'Situação do orçamento atualizada.').then(desenhar);
    return;
  }
  var row;
  if(s.getAttribute&&s.getAttribute('data-acao-mudar')==='item-produto'){
    row=s.closest('[data-item]');var pr=s.value?acharProduto(s.value):null;
    row.querySelector('.campo-desc').style.display=pr?'none':'';row.querySelector('.campo-var').style.display=pr?'':'none';row.querySelector('.campo-custo').style.display=pr?'none':'';
    row.querySelector('[name=variacao]').innerHTML=opcoesVariacao(s.value,'');
    if(pr&&pr.preco)row.querySelector('[name=valor]').value=pr.preco.toFixed(2);
    row.setAttribute('data-insumos','[]');
    atualizarFormPedido();return;
  }
  if(s.getAttribute&&s.getAttribute('data-acao-mudar')==='orc-produto'){
    row=s.closest('[data-item-orc]');var po=s.value?acharProduto(s.value):null;
    row.querySelector('.campo-var').style.display=po?'':'none';row.querySelector('.campo-mats').style.display=po?'none':'';
    row.querySelector('[name=variacao]').innerHTML=opcoesVariacao(s.value,'');
    row.querySelector('[name=custo]').readOnly=!!po;
    if(po){row.querySelector('[name=descricao]').value=po.nome;var c=custoProduto(po);row.querySelector('[name=custo]').value=r2(c);
      if(po.preco){row.querySelector('[name=preco]').value=po.preco.toFixed(2);row.querySelector('[name=acrescimo]').value=c>0?Math.round((po.preco/c-1)*100):'';}
      atualizarFormOrc();}
    else atualizarFormOrc(row.querySelector('[name=acrescimo]'));
    return;
  }
  if(s.closest&&s.closest('[data-form="pedido"]'))atualizarFormPedido();
  if(s.closest&&s.closest('[data-form="produto"]')){
    if(s.name==='arquivo'&&s.files&&s.files[0]){var u=URL.createObjectURL(s.files[0]);document.getElementById('pf-foto').innerHTML='<img src="'+u+'" alt="Foto do produto" style="width:100%;height:100%;object-fit:cover">';}
    atualizarFormProduto();
  }
  if(s.closest&&s.closest('[data-form="orcamento"]'))atualizarFormOrc(s);
});
document.addEventListener('input',function(e){
  var t=e.target;
  if(t.id==='busca'){estado.busca=t.value;desenharListaPedidos();return;}
  if(t.id==='busca-prod'){estado.buscaProd=t.value;var pos=t.selectionStart;desenhar();var nb=document.getElementById('busca-prod');if(nb){nb.focus();try{nb.setSelectionRange(pos,pos);}catch(x){}}return;}
  if(t.id==='np-cli'||t.id==='oc-cli'){
    var nome=t.value.trim().toLowerCase(),tel=document.getElementById(t.id==='np-cli'?'np-tel':'oc-con');
    var c=db.clientes.filter(function(x){return x.nome.toLowerCase()===nome;})[0];
    if(c&&c.telefone&&tel&&!tel.value)tel.value=c.telefone;
  }
  if(t.closest&&t.closest('[data-form="pedido"]')){if(t.name==='taxa')t.setAttribute('data-manual','1');atualizarFormPedido();}
  if(t.closest&&t.closest('[data-form="mat"]'))atualizarPreviaMat();
  if(t.closest&&t.closest('[data-form="uso"]'))atualizarPreviaUso();
  if(t.closest&&t.closest('[data-form="produto"]')){
    if(t.name==='acrescimo'){var f=t.form,cu=custoProduto(Object.assign({},lerProdutoForm(f),{insumos:lerProdutoForm(f).insumos}));if(t.value!=='')f.preco.value=r2(cu*(1+num(t.value)/100)).toFixed(2);}
    if(t.name==='lucroDesejado'&&t.value!=='')t.form.lucroPct.value='';
    if(t.name==='lucroPct'&&t.value!=='')t.form.lucroDesejado.value='';
    atualizarFormProduto();
  }
  if(t.closest&&t.closest('[data-form="orcamento"]'))atualizarFormOrc(t);
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')fecharModal();});

/* =====================================================================
   Eventos: envio de formulários
   ===================================================================== */
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
      if(r.error)throw r.error;estado.configurado=true;return sb.auth.signInWithPassword({email:em,password:se});
    }).then(function(r){if(r.error)throw r.error;return aposLogin(r.data.user);}).catch(function(err){estado.erroLogin=msgErro(err);desenhar();});
    return;
  }
  if(t==='pedido'){salvarPedidoForm(f);return;}
  if(t==='produto'){if(!f.nome.value.trim()){aviso('Informe o nome do produto.');return;}salvarProdutoForm(f);return;}
  if(t==='orcamento'){salvarOrcForm(f);return;}
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
  else if(t==='envio'){
    var p3=acharPedido(f.getAttribute('data-num'));
    executar(async function(){checar(await sb.from('pedidos').update({transportadora:f.transportadora.value.trim()||null,rastreio:f.rastreio.value.trim()||null}).eq('id',p3.id));},'Dados de envio salvos.').then(fim);
  }
  else if(t==='cancelar'){
    var pc=acharPedido(f.getAttribute('data-num')),exc=f.getAttribute('data-excluir')==='1';
    executar(async function(){checar(await sb.rpc('cancelar_pedido',{p_pedido:pc.id,p_devolver:f.devolver.value==='1',p_motivo:f.motivo.value.trim(),p_excluir:exc,p_devolucao:f.devolucao?num(f.devolucao.value):0,p_forma:f.forma?f.forma.value:'Pix'}));},exc?'Pedido excluído.':'Pedido cancelado.')
      .then(function(ok){if(ok){fecharModal();if(exc){estado.filtroStatus='abertos';ir('pedidos');}else desenhar();}});
  }
  else if(t==='ajustes'){
    executar(async function(){checar(await sb.from('configuracoes').update({shopee_percentual:num(f.pct.value),shopee_fixo:num(f.fixo.value),shopee_fixo_por:f.fixoPor.value,outras_despesas_percentual:num(f.outras.value),status_baixa:f.baixa.value,meta_mensal:num(f.meta.value)}).eq('id',1));},'Ajustes salvos.').then(function(ok){if(ok)desenhar();});
  }
  else if(t==='lanc'){
    var tipo=estado.tipoNovo,dt=f.data.value;
    executar(async function(){checar(await sb.from('caixa').insert({data:dt,tipo:tipo,categoria:f.categoria.value,descricao:f.descricao.value.trim(),valor:num(f.valor.value),forma:f.forma.value,pedido_id:f.pedido.value||null}));},(tipo==='entrada'?'Entrada':'Saída')+' lançada.')
      .then(function(ok){if(ok){var d=paraData(dt);estado.mesCaixa=[d.getFullYear(),d.getMonth()];desenhar();}});
  }
  else if(t==='uso'){
    var pu=acharPedido(f.getAttribute('data-num')),mu=acharMaterial(f.material.value),qu=num(f.qtd.value);
    if(qu<=0){aviso('Informe a quantidade.');return;}
    if(qu>num(mu.qtd)){aviso('Só tem '+qtdTxt(mu.qtd)+' '+mu.unidade+' de '+mu.nome+' no estoque.');return;}
    executar(async function(){checar(await sb.from('movimentos_estoque').insert({material_id:mu.id,tipo:f.tipo.value,quantidade:qu,pedido_id:pu.id}));},'Material lançado no pedido.').then(fim);
  }
  else if(t==='mov'){
    var m=acharMaterial(f.getAttribute('data-id')),tp=f.getAttribute('data-t'),q=num(f.qtd.value);
    var pac=!!f.pacote,emb=q;if(pac)q=emb*m.unidEmb;
    if(tp==='saida'&&q>num(m.qtd)){aviso('Não há '+qtdTxt(q)+' '+m.unidade+' em estoque.');return;}
    executar(async function(){
      if(tp==='entrada'){
        checar(await sb.from('movimentos_estoque').insert({material_id:m.id,tipo:'entrada',quantidade:q,observacao:pac?emb+' '+(m.embalagem||'embalagem'):null}));
        var valor=num(f.valor.value);
        if(valor>0){
          checar(await sb.from('caixa').insert({tipo:'saida',categoria:'Materiais',descricao:'Compra: '+(pac?emb+' '+(m.embalagem||'embalagem')+' ('+qtdTxt(q)+' '+m.unidade+')':qtdTxt(q)+' '+m.unidade)+' de '+m.nome,valor:valor,forma:f.forma.value}));
          if(pac)checar(await sb.from('materiais').update({valor_embalagem:r2(valor/emb)}).eq('id',m.id));
          else checar(await sb.from('materiais').update({custo_unitario:Math.round(valor/q*10000)/10000,valor_embalagem:null,unidades_embalagem:null}).eq('id',m.id));
        }
      } else {
        checar(await sb.from('movimentos_estoque').insert({material_id:m.id,tipo:f.motivo.value,quantidade:q,pedido_id:f.pedido.value||null}));
      }
    },tp==='entrada'?'Entrada registrada.':'Saída registrada.').then(fim);
  }
  else if(t==='mat'){
    var idm=f.getAttribute('data-id'),c=calcCustoMat(f);
    var dadosM={nome:f.nome.value.trim(),descricao:f.descricao.value.trim()||null,unidade:f.unidade.value.trim(),categoria:f.categoria.value.trim()||null,minimo:num(f.minimo.value),fornecedor:f.fornecedor.value.trim()||null,
      embalagem:f.embalagem.value.trim()||null,unidades_embalagem:c.pacote?c.u:null,valor_embalagem:c.pacote?c.v:null,custo_unitario:c.custo};
    var novaQ=num(f.qtd.value);
    if(!idm){
      dadosM.quantidade=novaQ;
      executar(async function(){checar(await sb.from('materiais').insert(dadosM));},'Material cadastrado.').then(fim);
    } else {
      var mAnt=acharMaterial(idm);
      executar(async function(){
        checar(await sb.from('materiais').update(dadosM).eq('id',idm));
        if(Math.abs(novaQ-num(mAnt.qtd))>0.0001)checar(await sb.from('movimentos_estoque').insert({material_id:idm,tipo:'ajuste',quantidade:novaQ,observacao:'Ajuste na edição (antes: '+qtdTxt(mAnt.qtd)+')'}));
      },'Material atualizado.').then(fim);
    }
  }
});

/* atualiza ao voltar para o app (a outra pessoa pode ter mudado algo) */
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState!=='visible'||!usuario||ocupado||document.getElementById('modal')||document.querySelector('form[data-form="pedido"],form[data-form="produto"],form[data-form="orcamento"]'))return;
  recarregar().then(desenhar).catch(function(){});
});

/* =====================================================================
   Início
   ===================================================================== */
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

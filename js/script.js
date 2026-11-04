(function(){
/* ===== CONFIGURAÇÃO: Supabase > Project Settings > API ===== */
var SUPABASE_URL='https://zgtigddajjenemcqctwy.supabase.co';
var SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpndGlnZGRhamplbmVtY3FjdHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3ODU2OTQsImV4cCI6MjEwOTM2MTY5NH0.qdbdqtkiM7N-F6hagrKBhDFtyxg5r24bATQfES7oZ6c';
var POLL_MS=3000;
/* =========================================================== */

var configured=!/SEU-PROJETO/.test(SUPABASE_URL)&&window.supabase;
var sb=configured?window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
var session=null,view='pais',pending='cad',cur=null,curData=null,seen=0,busy=false,students=[];

function $(i){return document.getElementById(i)}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function digits(s){return String(s).replace(/\D/g,'')}
function fmt(c){c=digits(c);return c.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/,function(_,a,b,d,e){return a+'.'+b+'.'+d+(e?'-'+e:'')})}
function validCpf(c){c=digits(c);if(c.length!==11||/^(\d)\1+$/.test(c))return false;
 for(var t=9;t<11;t++){var s=0;for(var i=0;i<t;i++)s+=c[i]*(t+1-i);var d=(s*10)%11%10;if(d!=c[t])return false}return true}
function mask(el){el.addEventListener('input',function(){el.value=fmt(el.value.slice(0,14))})}
mask($('cpfLogin'));mask($('cCpf'));
function ms(ts){return typeof ts==='number'?ts:Date.parse(ts)}
function dt(ts){return new Date(ms(ts)).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function msg(id,t,k){var e=$(id);e.textContent=t;e.className='msg '+(k||'')}
function lock(b,on){b.disabled=on}

/* ---------- toasts / notificações ---------- */
function toast(title,text,small){
 var d=document.createElement('div');d.className='toast';
 d.innerHTML='<b>'+esc(title)+'</b>'+esc(text)+(small?'<br><small>'+esc(small)+'</small>':'');
 $('toasts').appendChild(d);setTimeout(function(){d.remove()},7000)}
function notifyParent(e){
 var tx=curData.name+' — CPF '+fmt(curData.cpf);
 toast((e.dir==='entrada'?'Entrada':'Saída')+' registrada',tx,e.ant+' · '+dt(e.ts));
 try{if('Notification' in window&&Notification.permission==='granted')new Notification('Nectar: '+(e.dir==='entrada'?'entrada':'saída'),{body:tx+' · '+e.ant})}catch(x){}}

/* ---------- navegação ---------- */
var btns=document.querySelectorAll('nav button[data-v]');
btns.forEach(function(b){b.onclick=function(){showView(b.dataset.v)}});
function showView(v){
 if((v==='cad'||v==='ant')&&!session){pending=v;v='login'}
 view=v;
 ['pais','login','cad','ant'].forEach(function(x){$('v-'+x).hidden=(x!==v)});
 var act=v==='login'?pending:v;
 btns.forEach(function(b){b.classList.toggle('on',b.dataset.v===act)});
 refresh()}
function refresh(){
 if(!sb)return;
 if(view==='pais')renderPais();
 if(view==='cad')loadStudents();
 if(view==='ant')loadAntenna(true)}

/* ---------- autenticação da equipe ---------- */
function setSession(s){
 session=s;$('btnAuth').textContent=s?'Sair ('+(s.user.email||'equipe')+')':'Entrar (equipe)';
 if(!s&&(view==='cad'||view==='ant'))showView('login')}
$('btnAuth').onclick=async function(){
 if(!sb)return;
 if(session){await sb.auth.signOut();showView('pais')}else showView('login')};
async function staffLogin(){
 var em=$('sEmail').value.trim(),pw=$('sPass').value;
 if(!em||!pw){msg('staffMsg','Informe e-mail e senha.','er');return}
 lock($('btnStaff'),true);
 var r=await sb.auth.signInWithPassword({email:em,password:pw});
 lock($('btnStaff'),false);
 if(r.error){msg('staffMsg','E-mail ou senha incorretos.','er');return}
 $('sPass').value='';msg('staffMsg','');setSession(r.data.session);showView(pending)}
$('btnStaff').onclick=staffLogin;
$('sPass').addEventListener('keydown',function(e){if(e.key==='Enter')staffLogin()});

/* ---------- pais: busca por CPF (RPC parent_lookup) ---------- */
async function login(){
 var c=digits($('cpfLogin').value);
 if(!validCpf(c)){msg('loginMsg','CPF inválido. Confira os números.','er');return}
 lock($('btnLogin'),true);msg('loginMsg','Buscando...');
 var r=await sb.rpc('parent_lookup',{p_cpf:c});
 lock($('btnLogin'),false);
 if(r.error){msg('loginMsg','Não foi possível consultar agora. Tente novamente.','er');return}
 if(!r.data){msg('loginMsg','CPF não encontrado. Peça à escola para cadastrar a tag do estudante.','er');return}
 cur=c;curData=r.data;seen=maxTs(r.data.events);msg('loginMsg','');renderPais()}
function maxTs(evs){return (evs||[]).reduce(function(m,e){return Math.max(m,ms(e.ts))},0)}
$('btnLogin').onclick=function(){if(sb)login()};
$('cpfLogin').addEventListener('keydown',function(e){if(e.key==='Enter'&&sb)login()});
$('btnSair').onclick=function(){cur=null;curData=null;renderPais()};
$('btnNotif').onclick=function(){
 if(!('Notification' in window)){alert('Seu navegador não suporta avisos.');return}
 Notification.requestPermission().then(function(p){$('btnNotif').textContent=p==='granted'?'Avisos ativados ✓':'Avisos bloqueados'})};

async function pollParent(){
 var r=await sb.rpc('parent_lookup',{p_cpf:cur});
 if(r.error||!cur)return;
 if(!r.data){cur=null;curData=null;renderPais();return}
 var novos=(r.data.events||[]).filter(function(e){return ms(e.ts)>seen}).sort(function(a,b){return ms(a.ts)-ms(b.ts)});
 curData=r.data;
 novos.forEach(function(e){notifyParent(e);seen=Math.max(seen,ms(e.ts))});
 renderPais()}

function evView(e){return {ts:e.ts,dir:e.dir,ant:e.ant,tag:e.tag,name:e.name,cpf:e.cpf}}
function evHtml(e){return '<div class="ev"><span class="dot '+(e.dir==='entrada'?'in':'out')+'" style="margin-top:6px"></span><div><b>'+esc(e.name)+' · CPF '+fmt(e.cpf)+'</b>'+
 (e.dir==='entrada'?'Entrou':'Saiu')+' — '+esc(e.ant)+'<br><small>'+dt(e.ts)+' · tag <span class="tag">'+esc(e.tag)+'</span></small></div></div>'}

function renderPais(){
 var s=curData;
 $('loginBox').hidden=!!s;$('painel').hidden=!s;
 if(!s)return;
 $('pNome').textContent=s.name;$('pCpf').textContent=fmt(s.cpf);$('pTag').textContent=s.tag;
 var ev=(s.events||[]).slice().sort(function(a,b){return ms(b.ts)-ms(a.ts)});
 var l=ev[0];
 $('pDot').className='dot'+(l?(l.dir==='entrada'?' in':' out'):'');
 $('pStatus').textContent=l?(l.dir==='entrada'?'Na colmeia (na escola)':'Fora da escola'):'Sem registros ainda';
 $('pSub').textContent=l?('Último registro: '+l.dir+' em '+l.ant+' — '+dt(l.ts)):'Nenhuma passagem pelas antenas foi detectada.';
 $('pHist').innerHTML=ev.length?ev.map(function(e){return evHtml({ts:e.ts,dir:e.dir,ant:e.ant,tag:e.tag,name:s.name,cpf:s.cpf})}).join(''):'<div class="empty">Nenhuma passagem registrada.</div>'}

/* ---------- cadastro (tabela students, só equipe logada) ---------- */
async function loadStudents(){
 var r=await sb.from('students').select('id,name,cpf,tag,guardian').order('name');
 if(r.error){$('lista').innerHTML='<div class="empty">Erro ao carregar: '+esc(r.error.message)+'</div>';return}
 students=r.data||[];renderLista()}
$('btnCad').onclick=async function(){
 var n=$('cNome').value.trim(),c=digits($('cCpf').value),t=$('cTag').value.trim().toUpperCase(),r=$('cResp').value.trim();
 if(!n||!c||!t){msg('cadMsg','Preencha nome, CPF e ID da tag.','er');return}
 if(!validCpf(c)){msg('cadMsg','CPF inválido.','er');return}
 lock($('btnCad'),true);
 var res=await sb.from('students').insert({name:n,cpf:c,tag:t,guardian:r||null});
 lock($('btnCad'),false);
 if(res.error){
  var m=res.error.message||'';
  if(res.error.code==='23505')msg('cadMsg',m.indexOf('cpf')>-1?'Este CPF já está cadastrado.':'Esta tag já está vinculada a outro estudante.','er');
  else msg('cadMsg','Erro ao cadastrar: '+m,'er');
  return}
 ['cNome','cCpf','cTag','cResp'].forEach(function(i){$(i).value=''});
 msg('cadMsg','Tag '+t+' vinculada a '+n+'.','ok');loadStudents()};
$('btnDemo').onclick=function(){
 $('cNome').value='Ana Souza';$('cCpf').value='529.982.247-25';$('cTag').value='E200-3412-0001';$('cResp').value='Marcos Souza'};
function renderLista(){
 if(!students.length){$('lista').innerHTML='<div class="empty">Nenhum estudante cadastrado.</div>';return}
 $('lista').innerHTML='<table><tr><th>Nome</th><th>CPF</th><th>Tag</th><th>Responsável</th><th></th></tr>'+
 students.map(function(s){return '<tr><td>'+esc(s.name)+'</td><td>'+fmt(s.cpf)+'</td><td><span class="tag">'+esc(s.tag)+'</span></td><td>'+esc(s.guardian||'—')+'</td><td><button class="btn g" style="margin:0;padding:5px 10px" data-d="'+esc(s.id)+'">Remover</button></td></tr>'}).join('')+'</table>';
 $('lista').querySelectorAll('[data-d]').forEach(function(b){b.onclick=async function(){
  if(!confirm('Remover este estudante e todo o histórico dele?'))return;
  var r=await sb.from('students').delete().eq('id',b.dataset.d);
  if(r.error){msg('cadMsg','Erro ao remover: '+r.error.message,'er');return}
  loadStudents()}})}

/* ---------- antena (RPC register_read + leitura de events) ---------- */
async function loadAntenna(withStudents){
 if(!session)return;
 if(withStudents){
  var rs=await sb.from('students').select('name,tag').order('name');
  if(!rs.error)students=rs.data||[];
  var sel=$('aTag'),v=sel.value;
  sel.innerHTML=students.length?students.map(function(s){return '<option value="'+esc(s.tag)+'">'+esc(s.tag)+' — '+esc(s.name)+'</option>'}).join(''):'<option value="">Nenhuma tag cadastrada</option>';
  if(v)sel.value=v}
 var r=await sb.from('events').select('id,tag,antenna,direction,created_at,students(name,cpf)').order('created_at',{ascending:false}).limit(15);
 if(r.error){$('log').innerHTML='<div class="empty">Erro ao carregar: '+esc(r.error.message)+'</div>';return}
 var ev=(r.data||[]).map(function(e){var st=e.students||{};return {ts:e.created_at,dir:e.direction,ant:e.antenna,tag:e.tag,name:st.name||'(removido)',cpf:st.cpf||''}});
 $('log').innerHTML=ev.length?ev.map(evHtml).join(''):'<div class="empty">Nenhuma leitura ainda.</div>'}
$('btnLer').onclick=async function(){
 var t=($('aTagManual').value.trim()||$('aTag').value).toUpperCase();
 if(!t){msg('antMsg','Selecione ou digite uma tag.','er');return}
 lock($('btnLer'),true);
 var r=await sb.rpc('register_read',{p_tag:t,p_antenna:$('aAnt').value});
 lock($('btnLer'),false);
 if(r.error){msg('antMsg','Erro: '+r.error.message,'er');return}
 var d=r.data||{};
 if(!d.ok){
  msg('antMsg',d.reason==='leitura_duplicada'?'Leitura repetida ignorada (menos de 10 s desde a última).':'Tag '+t+' lida, mas não cadastrada. Nenhuma notificação enviada.','er');return}
 msg('antMsg','Leitura enviada: '+d.name+' ('+d.dir+').','ok');
 toast((d.dir==='entrada'?'Entrada':'Saída')+' registrada',d.name+' — CPF '+fmt(d.cpf),d.ant+' · '+dt(d.ts));
 loadAntenna(false)};

/* ---------- atualização periódica ---------- */
setInterval(async function(){
 if(!sb||busy||document.hidden)return;
 busy=true;
 try{
  if(view==='pais'&&cur)await pollParent();
  else if(view==='ant'&&session)await loadAntenna(false);
 }catch(e){}
 busy=false},POLL_MS);

/* ---------- início ---------- */
if(!sb){$('cfgWarn').hidden=false}
else{
 sb.auth.getSession().then(function(r){setSession(r.data.session)});
 sb.auth.onAuthStateChange(function(_e,s){setSession(s)})}
showView('pais');
})();
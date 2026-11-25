const $=s=>document.querySelector(s);
const clock=()=>$('#clock').textContent=new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
clock();setInterval(clock,1000);$('#year').textContent=new Date().getFullYear();
$('#themeBtn').addEventListener('click',()=>{document.body.classList.toggle('light');localStorage.setItem('tafei-theme',document.body.classList.contains('light')?'light':'dark')});
if(localStorage.getItem('tafei-theme')==='light')document.body.classList.add('light');
$('#menuBtn').addEventListener('click',()=>$('#navlinks').classList.toggle('open'));
document.querySelectorAll('#navlinks a').forEach(a=>a.addEventListener('click',()=>$('#navlinks').classList.remove('open')));
const modal=$('#modal');document.querySelectorAll('.detailBtn').forEach(b=>b.addEventListener('click',()=>{$('#modalTitle').textContent=b.dataset.title;$('#modalDesc').textContent=b.dataset.desc;modal.classList.add('show')}));
$('#closeModal').addEventListener('click',()=>modal.classList.remove('show'));modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('show')});
const out=$('#termout');$('#termform').addEventListener('submit',e=>{e.preventDefault();const input=$('#command'),cmd=input.value.trim().toLowerCase();if(!cmd)return;let result='未知命令：'+cmd+'。输入 help 查看帮助。';if(cmd==='help')result='可用命令：\nhelp   显示帮助\nabout  关于挞飞\n time  显示当前时间\nclear  清空终端';if(cmd==='about')result='我是挞飞。这里记录学习、实验和作品。';if(cmd==='time')result='当前时间：'+new Date().toLocaleString('zh-CN');if(cmd==='clear'){out.textContent='';input.value='';return;}out.textContent+='visitor@tafei:~$ '+cmd+'\n'+result+'\n\n';input.value='';out.scrollTop=out.scrollHeight;});
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
const canvas=$('#stars'),ctx=canvas.getContext('2d');let stars=[];
function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0);stars=Array.from({length:Math.min(100,Math.floor(innerWidth/8))},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.5+.3,v:Math.random()*.22+.04,a:Math.random()*.6+.2}))}
function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);for(const s of stars){s.y-=s.v;if(s.y<0){s.y=innerHeight;s.x=Math.random()*innerWidth}ctx.globalAlpha=s.a;ctx.fillStyle='#9bdfff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;requestAnimationFrame(draw)}addEventListener('resize',resize);resize();draw();

// TAFEI 6.0: cloud guestbook
(()=>{
 const $id=id=>document.getElementById(id);
 const safeRead=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}};
 const safeWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
 const projectsKey='tafei5-projects';
 const projects=safeRead(projectsKey);
 const API='https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1/tafei-cloud';
 const KEY='sb_publishable_tyeDf4FmwSW6j7C7s0Gdfg_Me5HqXkV';
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

 function renderProjects(){
  const root=$id('userProjects');
  if(!root)return;
  $id('projectCount').textContent=projects.length;
  if(!projects.length){root.innerHTML='<div class="empty-state">还没有添加作品，试着添加你的第一个项目吧。</div>';return;}
  root.innerHTML=projects.map((p,i)=>`<article class="user-item"><h4>${esc(p.name)}</h4><p>${esc(p.desc)}</p>${p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">打开作品 ↗</a>`:''}<div class="item-tools"><span class="local-note">${esc(p.date)}</span><button class="action-btn" data-remove-project="${i}" type="button">删除</button></div></article>`).join('');
 }

 function renderMessages(rows){
  const root=$id('messages');
  if(!root)return;
  root.replaceChildren();
  if(!rows.length){root.textContent='还没有留言。欢迎写下第一条。';return;}
  rows.forEach(m=>{
   const article=document.createElement('article');
   article.className='message-item';
   const h=document.createElement('h4');
   h.textContent=m.nickname||'访客';
   const content=document.createElement('p');
   content.textContent=m.content||'';
   const date=document.createElement('div');
   date.className='local-note';
   date.textContent=m.created_at?new Date(m.created_at).toLocaleString('zh-CN'):'';
   article.append(h,content,date);
   root.append(article);
  });
 }

 async function loadMessages(){
  const root=$id('messages');
  if(root)root.textContent='正在加载云端留言……';
  try{
   const r=await fetch(API+'?select=id,nickname,content,created_at&order=created_at.desc&limit=100',{
    headers:{apikey:KEY,Authorization:'Bearer '+KEY}
   });
   if(!r.ok)throw new Error(await r.text());
   renderMessages(await r.json());
  }catch(e){
   console.error(e);
   if(root)root.textContent='云端留言加载失败，请检查网络后刷新。';
  }
 }

 $id('addProject')?.addEventListener('click',()=>{
  const name=$id('projectName').value.trim();
  const desc=$id('projectDesc').value.trim();
  const url=$id('projectUrl').value.trim();
  if(!name||!desc){alert('请先填写作品名称和介绍。');return;}
  if(url&&!/^https:\/\//i.test(url)){alert('网址请以 https:// 开头。');return;}
  projects.push({name,desc,url,date:new Date().toLocaleDateString('zh-CN')});
  if(!safeWrite(projectsKey,projects)){projects.pop();alert('保存失败。');return;}
  $id('projectName').value='';
  $id('projectDesc').value='';
  $id('projectUrl').value='';
  renderProjects();
 });

 $id('userProjects')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-remove-project]');
  if(!b)return;
  const i=Number(b.dataset.removeProject);
  if(!Number.isInteger(i)||i<0||i>=projects.length)return;
  projects.splice(i,1);
  safeWrite(projectsKey,projects);
  renderProjects();
 });

 $id('sendMessage')?.addEventListener('click',async()=>{
  const button=$id('sendMessage');
  const name=$id('messageName').value.trim()||'访客';
  const content=$id('messageText').value.trim();
  if(!content){alert('先写点留言内容吧。');return;}
  if(name.length>30||content.length>500){alert('昵称最多30字，留言最多500字。');return;}
  button.disabled=true;
  button.textContent='正在发布……';
  try{
   const r=await fetch(API,{
    method:'POST',
    headers:{
     apikey:KEY,
     Authorization:'Bearer '+KEY,
     'Content-Type':'application/json',
     Prefer:'return=minimal'
    },
    body:JSON.stringify({nickname:name,content:content})
   });
   if(!r.ok)throw new Error(await r.text());
   $id('messageText').value='';
   await loadMessages();
   alert('留言发布成功！');
  }catch(e){
   console.error(e);
   alert('发布失败，请检查网络和数据库权限。');
  }finally{
   button.disabled=false;
   button.textContent='发布留言';
  }
 });


 const ARTICLES_API='https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1/tafei_articles';
 const REPORTS_API='https://kwkewmhmxyjmzdjyutwa.supabase.co/rest/v1/tafei_reports';

 async function loadArticles(){
  const root=$id('articlesList');
  if(!root)return;
  root.textContent='正在加载文章……';
  try{
   const r=await fetch(ARTICLES_API+'?select=id,nickname,title,content,created_at&order=created_at.desc&limit=50',{
    headers:{apikey:KEY,Authorization:'Bearer '+KEY}
   });
   if(!r.ok)throw new Error('读取文章失败');
   const rows=await r.json();
   root.replaceChildren();
   if(!rows.length){
    const empty=document.createElement('div');
    empty.className='article-empty';
    empty.textContent='还没有文章，欢迎分享第一篇知识。';
    root.append(empty);
    return;
   }
   rows.forEach(m=>{
    const card=document.createElement('article');
    card.className='article-card';
    const title=document.createElement('h4');
    title.textContent=m.title||'未命名文章';
    const content=document.createElement('p');
    content.textContent=m.content||'';
    const meta=document.createElement('div');
    meta.className='article-meta';
    meta.textContent=(m.nickname||'访客')+' · '+(m.created_at?new Date(m.created_at).toLocaleString('zh-CN'):'');
    const reportButton=document.createElement('button');
    reportButton.type='button';
    reportButton.textContent='举报这篇文章';
    reportButton.style.cssText='margin-top:12px;padding:7px 12px;border:1px solid #999;border-radius:8px;background:transparent;cursor:pointer;';

    const reportForm=document.createElement('form');
    reportForm.hidden=true;
    reportForm.style.cssText='margin-top:12px;padding:12px;border:1px solid #999;border-radius:10px;';

    const reason=document.createElement('select');
    reason.required=true;
    reason.style.cssText='display:block;width:100%;padding:9px;margin-bottom:9px;';
    [
     ['','请选择举报原因'],
     ['spam','垃圾广告或 spam'],
     ['abuse','辱骂、骚扰或攻击'],
     ['misinformation','疑似虚假或误导信息'],
     ['privacy','泄露个人隐私'],
     ['other','其他问题']
    ].forEach(([value,label])=>{
     const option=document.createElement('option');
     option.value=value;
     option.textContent=label;
     reason.append(option);
    });

    const description=document.createElement('textarea');
    description.maxLength=500;
    description.rows=3;
    description.placeholder='补充说明（选填，最多500字）';
    description.style.cssText='display:block;width:100%;box-sizing:border-box;padding:9px;margin-bottom:9px;';

    const submitReport=document.createElement('button');
    submitReport.type='submit';
    submitReport.textContent='提交举报';
    submitReport.style.cssText='padding:8px 14px;border:0;border-radius:8px;cursor:pointer;';

    const reportStatus=document.createElement('p');
    reportStatus.setAttribute('role','status');

    reportForm.append(reason,description,submitReport,reportStatus);

    reportButton.addEventListener('click',()=>{
     reportForm.hidden=!reportForm.hidden;
    });

    reportForm.addEventListener('submit',async ev=>{
     ev.preventDefault();
     const articleId=Number(m.id);
     const detail=description.value.trim();

     if(!Number.isSafeInteger(articleId)||articleId<=0){
      reportStatus.textContent='文章编号无效，无法提交。';
      return;
     }
     if(!reason.value){
      reportStatus.textContent='请先选择举报原因。';
      return;
     }
     if(detail.length>500){
      reportStatus.textContent='补充说明最多500字。';
      return;
     }

     submitReport.disabled=true;
     submitReport.textContent='正在提交……';
     reportStatus.textContent='';

     try{
      const response=await fetch(REPORTS_API,{
       method:'POST',
       headers:{
        apikey:KEY,
        Authorization:'Bearer '+KEY,
        'Content-Type':'application/json',
        Prefer:'return=minimal'
       },
       body:JSON.stringify({
        article_id:articleId,
        reason:reason.value,
        description:detail||null
       })
      });

      if(!response.ok)throw new Error(await response.text());

      reportStatus.textContent='举报已提交，感谢你帮助维护社区。';
      submitReport.textContent='已提交';
      submitReport.disabled=true;
      reportButton.disabled=true;
     }catch(error){
      console.error(error);
      reportStatus.textContent='提交失败，请稍后重试。';
      submitReport.disabled=false;
      submitReport.textContent='重新提交';
     }
    });

    card.append(title,content,meta,reportButton,reportForm);
    root.append(card);
   });
  }catch(e){
   console.error(e);
   root.textContent='文章加载失败，请检查网络后刷新。';
  }
 }

 $id('articleForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const button=$id('publishArticle');
  const status=$id('articleStatus');
  const nickname=$id('articleName').value.trim();
  const title=$id('articleTitle').value.trim();
  const content=$id('articleContent').value.trim();

  if(!nickname||!title||!content){
   status.textContent='请填写昵称、标题和正文。';
   return;
  }
  if(nickname.length>30||title.length>100||content.length>5000){
   status.textContent='昵称最多30字，标题最多100字，正文最多5000字。';
   return;
  }

  const contactKind=privateContactKind(content);
  if(contactKind){
   status.textContent='正文里不能留'+contactKind+'等站外联系方式。有问题请在「信息 → 私信」找站长。';
   return;
  }

  button.disabled=true;
  button.textContent='正在发布……';
  status.textContent='正在提交文章……';

  try{
   const r=await fetch(ARTICLES_API,{
    method:'POST',
    headers:{
     apikey:KEY,
     Authorization:'Bearer '+KEY,
     'Content-Type':'application/json',
     Prefer:'return=minimal'
    },
    body:JSON.stringify({nickname,title,content})
   });
   if(!r.ok)throw new Error(await r.text());
   $id('articleTitle').value='';
   $id('articleContent').value='';
   status.textContent='发布成功！你的文章已经公开。';
   await loadArticles();
  }catch(err){
   console.error(err);
   status.textContent='发布失败，请检查网络或数据库权限。';
  }finally{
   button.disabled=false;
   button.textContent='发布文章 ↗';
  }
 });


 // TAFEI 13.0 AUTH MODULE
const AUTH_URL = 'https://kwkewmhmxyjmzdjyutwa.supabase.co/auth/v1';
const AUTH_STORAGE = 'tafei-auth-session';
let authSession = null;

const authStatus = $id('tafeiAuthStatus');
const authLoggedOut = $id('tafeiAuthLoggedOut');
const authLoggedIn = $id('tafeiAuthLoggedIn');

function authMessage(message) {
  if (authStatus) authStatus.textContent = message;
}

function showAuth(session) {
  authSession = session;

  if (session) {
    const user = session.user || {};
    const nickname =
      user.user_metadata?.nickname ||
      user.email?.split('@')[0] ||
      '挞飞用户';

    authLoggedOut.hidden = true;
    authLoggedIn.hidden = false;
    $id('tafeiCurrentNickname').textContent = nickname;
    const nickInput = $id('tafeiNickInput');
    if (nickInput) nickInput.value = nickname;

    const upgradeForm = $id('tafeiUpgradeForm');
    if (upgradeForm) {
      upgradeForm.hidden = !!user.email;
    }

    syncIdentity(session);
    loadAvatar();
    loadBalance(false);

    authMessage('登录成功！欢迎回到挞飞。');
  } else {
    authLoggedOut.hidden = false;
    authLoggedIn.hidden = true;
    const valueNode = $id('tafeiBalanceValue');
    if (valueNode) valueNode.textContent = '—';
    syncIdentity(null);
    authMessage('未登录也可以浏览社区，登录后即可发布动态。');
  }
}

// TAFEI 21.1 BALANCE MODULE
const BALANCE_API = API.replace('/tafei-cloud', '/tafei_balance');
const AVATAR_API = API.replace('/tafei-cloud', '/tafei_profiles');
const AVATAR_CACHE = 'tafei-avatar-cache';

function nicknameOf(session) {
  const user = session?.user || {};
  return user.user_metadata?.nickname || (user.email || '').split('@')[0] || '挞飞用户';
}

function initialOf(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase() || '?';
}

function readAvatarCache(uid) {
  if (!uid) return '';
  try {
    const cache = JSON.parse(localStorage.getItem(AVATAR_CACHE) || '{}');
    return cache[uid] || '';
  } catch (error) {
    return '';
  }
}

function writeAvatarCache(uid, url) {
  if (!uid) return;
  try {
    const cache = JSON.parse(localStorage.getItem(AVATAR_CACHE) || '{}');
    if (url) cache[uid] = url;
    else delete cache[uid];
    localStorage.setItem(AVATAR_CACHE, JSON.stringify(cache));
  } catch (error) { /* 本地缓存失败不影响云端 */ }
}

function applyAvatar(url, name) {
  const pairs = [
    ['communityAvatarImg', 'communityAvatarFallback'],
    ['tafeiAvatarImg', 'tafeiAvatarFallback']
  ];
  pairs.forEach(([imgId, fallbackId]) => {
    const img = document.getElementById(imgId);
    const fallback = document.getElementById(fallbackId);
    if (!img || !fallback) return;
    if (url) {
      img.src = url;
      img.hidden = false;
      fallback.hidden = true;
    } else {
      img.removeAttribute('src');
      img.hidden = true;
      fallback.hidden = false;
      fallback.textContent = initialOf(name);
    }
  });
}

function syncIdentity(session) {
  const nameNode = document.getElementById('communityNickname');
  const metaNode = document.getElementById('communityMeta');
  const balanceNode = document.getElementById('communityBalance');
  const user = session?.user || {};
  const nickname = session ? nicknameOf(session) : '未登录';
  document.body.dataset.tafeiEmail = session ? (user.email || '').toLowerCase() : '';

  if (nameNode) nameNode.textContent = nickname;
  if (metaNode) {
    metaNode.textContent = session
      ? (user.email || '已登录') + ' · 可发帖、私信站长、查看额度'
      : '登录后可发帖、私信站长、查看额度';
  }
  if (balanceNode && !session) balanceNode.textContent = '—';
  applyAvatar(session ? readAvatarCache(user.id) : '', session ? nickname : '访客');
}

async function loadAvatar() {
  const userId = authSession?.user?.id;
  const token = authSession?.access_token;
  const nickname = nicknameOf(authSession);
  if (!userId || !token) return;

  const cached = readAvatarCache(userId);
  if (cached) applyAvatar(cached, nickname);

  try {
    const response = await fetch(
      AVATAR_API + '?select=avatar_url&id=eq.' + encodeURIComponent(userId),
      { headers: { apikey: KEY, Authorization: 'Bearer ' + token } }
    );
    if (!response.ok) return;
    const rows = await response.json();
    const url = Array.isArray(rows) && rows.length ? rows[0].avatar_url : '';
    if (url) {
      writeAvatarCache(userId, url);
      applyAvatar(url, nickname);
    }
  } catch (error) {
    console.warn('头像读取失败：', error);
  }
}

function resizeAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      reject(new Error('请选择 JPG、PNG 或 WebP 图片。'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('图片不能超过 8MB。'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败。'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解码失败，请换一张。'));
      img.onload = () => {
        try {
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0b1224';
          ctx.fillRect(0, 0, 256, 256);
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (error) {
          reject(new Error('头像裁剪失败。'));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function saveAvatar(dataUrl) {
  const userId = authSession?.user?.id;
  const token = authSession?.access_token;
  if (!userId || !token) throw new Error('请先登录后再更换头像。');

  const response = await fetch(
    AVATAR_API + '?id=eq.' + encodeURIComponent(userId),
    {
      method: 'PATCH',
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ avatar_url: dataUrl })
    }
  );

  if (!response.ok) {
    throw new Error('云端头像保存失败（HTTP ' + response.status + '）');
  }

  let rows = await response.json().catch(() => []);
  if (!Array.isArray(rows)) rows = [];

  if (!rows.length) {
    const created = await fetch(
      AVATAR_API + '?on_conflict=id',
      {
        method: 'POST',
        headers: {
          apikey: KEY,
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({
          id: userId,
          nickname: nicknameOf(authSession),
          avatar_url: dataUrl
        })
      }
    );
    if (!created.ok) {
      throw new Error('资料行不存在，自动创建失败（HTTP ' + created.status + '）');
    }
    rows = await created.json().catch(() => []);
  }

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('资料行没有匹配到，头像未写入云端');
  }
  if (!rows[0] || !rows[0].avatar_url) {
    throw new Error('云端没有返回 avatar_url');
  }

  writeAvatarCache(userId, dataUrl);
}

function balanceNode(id) {
  return document.getElementById(id);
}

async function loadBalance(manual) {
  const valueNode = balanceNode('tafeiBalanceValue');
  const updatedNode = balanceNode('tafeiBalanceUpdated');
  const statusNode = balanceNode('tafeiBalanceStatus');
  const userId = authSession?.user?.id;
  const token = authSession?.access_token;

  if (!userId || !token) {
    if (valueNode) valueNode.textContent = '—';
    if (updatedNode) updatedNode.textContent = '未登录';
    return;
  }

  if (statusNode && manual) statusNode.textContent = '正在刷新额度…';

  try {
    const response = await fetch(
      BALANCE_API + '?select=current_amount,updated_at&user_id=eq.' + encodeURIComponent(userId),
      {
        headers: {
          apikey: KEY,
          Authorization: 'Bearer ' + token
        }
      }
    );

    if (!response.ok) {
      throw new Error('额度读取失败（HTTP ' + response.status + '）');
    }

    const rows = await response.json();
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    const amount = row && typeof row.current_amount === 'number' ? row.current_amount : null;

    if (valueNode) valueNode.textContent = amount === null ? '—' : String(amount);
    const compactValue = balanceNode('communityBalance');
    if (compactValue) compactValue.textContent = amount === null ? '—' : String(amount);
    if (updatedNode) {
      const date = row?.updated_at ? new Date(row.updated_at) : null;
      updatedNode.textContent = date && !Number.isNaN(date.getTime())
        ? '更新于 ' + date.toLocaleDateString('zh-CN')
        : (row ? '已开通' : '未初始化');
    }
    if (statusNode) {
      statusNode.textContent = row
        ? (manual ? '额度已刷新。' : '')
        : '额度账户尚未初始化，请联系站长处理。';
    }
  } catch (error) {
    console.error(error);
    if (statusNode) statusNode.textContent = '额度暂时读不到：' + (error.message || '网络异常');
  }
}

const balanceRefreshBtn = balanceNode('tafeiBalanceRefresh');
if (balanceRefreshBtn) {
  balanceRefreshBtn.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = '刷新中…';
    await loadBalance(true);
    button.disabled = false;
    button.textContent = '刷新额度';
  });
}

const avatarFileInput = document.getElementById('tafeiAvatarInput');
const avatarEditBtn = document.getElementById('tafeiAvatarBtn');

if (avatarEditBtn && avatarFileInput) {
  avatarEditBtn.addEventListener('click', () => {
    if (!authSession?.access_token) {
      const status = document.getElementById('tafeiAvatarStatus');
      if (status) status.textContent = '请先登录后再更换头像。';
      return;
    }
    avatarFileInput.click();
  });
}

if (avatarFileInput) {
  avatarFileInput.addEventListener('change', async event => {
    const input = event.currentTarget;
    const file = input.files && input.files[0];
    const status = document.getElementById('tafeiAvatarStatus');
    if (!file) return;

    if (status) status.textContent = '正在处理头像…';

    let dataUrl = '';
    try {
      dataUrl = await resizeAvatar(file);
    } catch (error) {
      if (status) status.textContent = error.message || '头像处理失败。';
      input.value = '';
      return;
    }

    try {
      await saveAvatar(dataUrl);
      applyAvatar(dataUrl, nicknameOf(authSession));
      if (status) status.textContent = '头像已更新，云端已保存。';
    } catch (error) {
      console.warn(error);
      const userId = authSession?.user?.id;
      if (userId) writeAvatarCache(userId, dataUrl);
      applyAvatar(dataUrl, nicknameOf(authSession));
      if (status) status.textContent = '头像已在本设备生效；云端未写入：' + (error.message || '未知错误');
    } finally {
      input.value = '';
    }
  });
}

async function authRequest(path, data, token, method = 'POST') {
  const headers = {
    apikey: KEY,
    'Content-Type': 'application/json'
  };

  if (token) headers.Authorization = 'Bearer ' + token;

  const response = await fetch(AUTH_URL + path, {
    method,
    headers,
    body: JSON.stringify(data)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.msg ||
      result.message ||
      result.error_description ||
      result.error ||
      '请求失败，请稍后重试。'
    );
  }

  return result;
}

function saveAuth(session) {
  try {
    localStorage.setItem(AUTH_STORAGE, JSON.stringify(session));
  } catch (error) {
    authSession = null;
    showAuth(null);
    throw new Error('无法安全保存登录状态，请检查手机存储权限或空间。');
  }

  authSession = session;
  showAuth(session);
}

async function updateAuthNickname(nickname) {
  if (!authSession?.access_token) {
    throw new Error('登录状态已失效，请重新登录。');
  }

  const metadata = {
    ...(authSession.user?.user_metadata || {}),
    nickname
  };

  const updated = await authRequest(
    '/user',
    { data: metadata },
    authSession.access_token,
    'PUT'
  );

  const user = {
    ...(authSession.user || {}),
    ...(updated || {}),
    user_metadata: {
      ...metadata,
      ...((updated && updated.user_metadata) || {}),
      nickname
    }
  };

  authSession = { ...authSession, user };
  try {
    localStorage.setItem(AUTH_STORAGE, JSON.stringify(authSession));
  } catch (error) {
    throw new Error('无法保存登录状态，请检查手机存储权限。');
  }

  const nameNode = $id('tafeiCurrentNickname');
  if (nameNode) nameNode.textContent = nickname;
  const communityName = $id('communityNickname');
  if (communityName) communityName.textContent = nickname;
  const inputNode = $id('tafeiNickInput');
  if (inputNode) inputNode.value = nickname;

  return user;
}

async function updateProfileNickname(nickname) {
  const userId = authSession?.user?.id;
  if (!userId) throw new Error('登录状态已失效，请重新登录。');

  await t12Request(
    T12_PROFILE_API + '?id=eq.' + userId,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ nickname })
    }
  );

  if (t12Profiles[userId]) {
    t12Profiles[userId] = { ...t12Profiles[userId], nickname };
  }
  try { t12Render(); } catch (error) { /* 社区还没加载完时忽略 */ }
}

const nickForm = $id('tafeiNickForm');
if (nickForm) {
  nickForm.addEventListener('submit', async event => {
    event.preventDefault();

    const input = $id('tafeiNickInput');
    const status = $id('tafeiNickStatus');
    const button = event.submitter;
    const nickname = input ? input.value.trim() : '';

    if (!nickname || nickname.length > 30) {
      if (status) status.textContent = '昵称不能为空，最多30个字。';
      return;
    }
    if (!authSession?.access_token) {
      if (status) status.textContent = '登录状态已失效，请重新登录。';
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = '保存中…';
    }
    if (status) status.textContent = '正在保存昵称…';

    try {
      await updateProfileNickname(nickname);
    } catch (error) {
      console.error(error);
      if (status) status.textContent = '保存失败：' + (error.message || '请稍后重试。');
      if (button) {
        button.disabled = false;
        button.textContent = '保存昵称 ↗';
      }
      return;
    }

    try {
      await updateAuthNickname(nickname);
      if (status) status.textContent = '昵称已更新为「' + nickname + '」。';
    } catch (error) {
      console.error(error);
      if (status) status.textContent = '社区昵称已更新，但账户资料同步失败：' + (error.message || '请重新登录后再试。');
    }

    if (button) {
      button.disabled = false;
      button.textContent = '保存昵称 ↗';
    }
  });
}

// TAFEI 17.0 SECURE LOGOUT
$id('tafeiLogoutBtn').addEventListener('click', async event => {
  const button = event.currentTarget;
  const session = authSession;

  if (!session?.access_token) {
    let cleared = true;
    try {
      localStorage.removeItem(AUTH_STORAGE);
    } catch (error) {
      cleared = false;
      console.warn('本地会话清理失败：', error);
    }

    authSession = null;
    showAuth(null);
    authMessage(
      cleared
        ? '登录状态已清除。'
        : '页面已退出，但本地凭证未能清除，请检查存储权限。'
    );
    return;
  }

  button.disabled = true;
  authMessage('正在安全退出……');

  let remoteLogoutSucceeded = false;

  const logoutController = new AbortController();
  const logoutTimeout = setTimeout(() => logoutController.abort(), 10000);

  try {
    const response = await fetch(AUTH_URL + '/logout', {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + session.access_token
      },
      signal: logoutController.signal
    });
    remoteLogoutSucceeded = response.ok;
  } catch (error) {
    console.warn('远程注销请求失败或超时：', error);
  } finally {
    clearTimeout(logoutTimeout);
    authSession = null;
    showAuth(null);

    let localLogoutSucceeded = true;
    try {
      localStorage.removeItem(AUTH_STORAGE);
    } catch (error) {
      localLogoutSucceeded = false;
      console.warn('本地会话清理失败：', error);
    }

    if (!localLogoutSucceeded) {
      authMessage('页面已退出，但手机未能清除本地登录凭证，请检查存储权限。');
    } else if (remoteLogoutSucceeded) {
      authMessage('已安全退出登录。');
    } else {
      authMessage('本地登录状态已清除；远程注销未能确认，请检查网络。');
    }

    button.disabled = false;
  }
});

// TAFEI 13.0 AUTH BASE END

// TAFEI 13.0 SIGNUP
$id('tafeiGuestForm').addEventListener('submit', async event => {
  event.preventDefault();

  const username = $id('tafeiSignupUsername').value.trim();
  const nickname = $id('tafeiSignupNickname').value.trim();
  const bindMail = $id('tafeiSignupEmail').value.trim();
  const email = username.toLowerCase() + '@tafei.local';
  const password = $id('tafeiSignupPassword').value;
  const confirm = $id('tafeiSignupPasswordConfirm').value;

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    authMessage('用户名格式不正确。');
    return;
  }

  if (!nickname || nickname.length > 30) {
    authMessage('昵称不能为空，最多30个字。');
    return;
  }

  if (password.length < 8) {
    authMessage('密码至少需要8位。');
    return;
  }

  if (password !== confirm) {
    authMessage('两次输入的密码不一致。');
    return;
  }

  const consent = $id('tafeiSignupConsent');
  if (!consent || !consent.checked) {
    authMessage('请先勾选同意《社区规范与信息中心使用公告》。');
    return;
  }

  const button = event.submitter;
  if (button) button.disabled = true;
  authMessage('正在创建挞飞账户……');

  try {
    const result = await authRequest('/signup', {
      email,
      password,
      data: { username, nickname, email_bind: bindMail, agreed_at: new Date().toISOString() }
    });

    if (result.access_token && result.user) {
      saveAuth(result);
      authMessage('注册成功！欢迎来到挞飞。');
    } else {
      authMessage('账户已提交，请检查邮箱或尝试登录。');
    }
  } catch (error) {
    authMessage('注册失败：' + error.message);
  } finally {
    if (button) button.disabled = false;
  }
});

// TAFEI 13.0 LOGIN
$id('tafeiLoginForm').addEventListener('submit', async event => {
  event.preventDefault();

  const rawLogin = $id('tafeiLoginEmail').value.trim();
  const email = rawLogin.indexOf('@') > 0 ? rawLogin.toLowerCase() : rawLogin.toLowerCase() + '@tafei.local';
  const password = $id('tafeiLoginPassword').value;
  const button = event.submitter;

  if (button) button.disabled = true;
  authMessage('正在登录挞飞……');

  try {
    const result = await authRequest(
      '/token?grant_type=password',
      { email, password }
    );

    if (!result.access_token || !result.user) {
      throw new Error('登录信息不完整，请重试。');
    }

    saveAuth(result);
    authMessage('登录成功！欢迎回来。');
  } catch (error) {
    authMessage('登录失败：' + error.message);
  } finally {
    if (button) button.disabled = false;
  }
});

// TAFEI 13.0 UPGRADE
$id('tafeiUpgradeForm').addEventListener('submit', async event => {
  event.preventDefault();

  if (!authSession?.access_token) {
    authMessage('登录状态已失效，请重新登录。');
    return;
  }

  const username = $id('tafeiUpgradeUsername').value.trim();
  const nickname = $id('tafeiUpgradeNickname').value.trim();
  const email = $id('tafeiUpgradeEmail').value.trim();
  const password = $id('tafeiUpgradePassword').value;
  const button = event.submitter;

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    authMessage('用户名必须是3至20位英文字母、数字或下划线。');
    return;
  }

  if (!nickname || nickname.length > 30 || password.length < 8) {
    authMessage('请检查昵称和密码，密码至少8位。');
    return;
  }

  if (button) button.disabled = true;
  authMessage('正在完善账户……');

  try {
    await authRequest('/user', {
      email,
      password,
      data: { username, nickname }
    }, authSession.access_token, 'PUT');

    const response = await fetch(AUTH_URL + '/user', {
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + authSession.access_token
      }
    });

    if (!response.ok) {
      throw new Error('账户已更新，但读取资料失败。请重新登录确认。');
    }

    authSession.user = await response.json();
    saveAuth(authSession);
    authMessage('账户完善成功！原账户已保留。');
  } catch (error) {
    authMessage('账户完善失败：' + error.message);
  } finally {
    if (button) button.disabled = false;
  }
});

// TAFEI 13.0 RESTORE SESSION
(async () => {
  try {
    const saved = localStorage.getItem(AUTH_STORAGE);

    if (!saved) {
      showAuth(null);
      return;
    }

    let session = JSON.parse(saved);

    if (
      session.refresh_token &&
      session.expires_at &&
      session.expires_at * 1000 <= Date.now() + 60000
    ) {
      session = await authRequest('/token?grant_type=refresh_token', {
        refresh_token: session.refresh_token
      });
    }

    if (!session.access_token) {
      throw new Error('登录凭证已失效。');
    }

    const response = await fetch(AUTH_URL + '/user', {
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + session.access_token
      }
    });

    if (!response.ok) {
      throw new Error('无法恢复登录状态。');
    }

    session.user = await response.json();
    saveAuth(session);
    authMessage('登录状态已恢复，欢迎回来！');

  } catch (error) {
    try {
      localStorage.removeItem(AUTH_STORAGE);
    } catch (storageError) {
      console.warn('恢复登录失败，且本地凭证清理失败：', storageError);
    }

    authSession = null;
    showAuth(null);
  }
})();


 // TAFEI 11.0 FEED MODULE
 const FEED_API=API.replace('/tafei-cloud','/tafei_posts');
 const PROFILE_API=API.replace('/tafei-cloud','/tafei_profiles');
 const feedForm=$id('tafeiFeedForm');
 const feedList=$id('tafeiFeedList');
 const feedStatus=$id('tafeiFeedStatus');

 const feedCategories={
  daily:'生活日常',
  learning:'学习成长',
  tech:'科技技术',
  help:'寻求帮助',
  knowledge:'知识分享'
 };

 async function loadFeed(){ return t12LoadData(); }
 // TAFEI 12.0 接管动态加载
 // TAFEI 11.0 FEED MODULE END

 // TAFEI 11.0 AUTH MODULE END


 // TAFEI 12.0 MODULE START
// TAFEI 12.0 COMMUNITY MODULE

const T12_FEED_API = API.replace('/tafei-cloud', '/tafei_posts');
const T12_PROFILE_API = API.replace('/tafei-cloud', '/tafei_profiles');
const T12_COMMENTS_API = API.replace('/tafei-cloud', '/tafei_comments');
const T12_LIKES_API = API.replace('/tafei-cloud', '/tafei_likes');

let t12Posts = [];
let t12Profiles = {};
let t12Comments = [];
let t12Likes = [];

const t12Headers = () => ({
  apikey: KEY,
  Authorization: 'Bearer ' + (authSession?.access_token || KEY)
});

async function t12Request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...t12Headers(), ...(options.headers || {}) }
    });

    if (!response.ok) {
      throw new Error('请求失败，HTTP ' + response.status);
    }

    if (response.status === 204) return null;

    const result = await response.text();
    return result ? JSON.parse(result) : null;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('云端请求超时（15秒），请检查网络或 Supabase 服务。');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function t12Element(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}

// TAFEI 12.0 BASE END

// TAFEI 12.0 SEARCH CONTROLS

function t12BuildControls() {
  const list = document.getElementById('tafeiFeedList');
  if (!list || document.getElementById('t12Toolbar')) return;

  const toolbar = t12Element('div', 't12-toolbar');
  toolbar.id = 't12Toolbar';

  const search = document.createElement('input');
  search.id = 't12Search';
  search.type = 'search';
  search.placeholder = '搜索动态内容或用户昵称';

  const category = document.createElement('select');
  category.id = 't12Category';

  const categories = [
    ['all', '全部内容'],
    ['daily', '讨论'],
    ['learning', '讨论'],
    ['tech', '讨论'],
    ['help', '求助'],
    ['knowledge', '知识']
  ];

  categories.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    category.appendChild(option);
  });

  const sort = document.createElement('select');
  sort.id = 't12Sort';

  [['newest', '最新发布'], ['hottest', '最受欢迎']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    sort.appendChild(option);
  });

  toolbar.append(search, sort);
  list.parentNode.insertBefore(toolbar, list);

  search.addEventListener('input', t12Render);
  category.addEventListener('change', t12Render);
  sort.addEventListener('change', t12Render);
}

// TAFEI 12.0 SEARCH END


// TAFEI 18.0 COMMUNITY CATEGORY BRIDGE
let t18CommunityFilter = 'all';

function t18SetCommunityFilter(filter) {
  const category = document.getElementById('t12Category');
  const search = document.getElementById('t12Search');
  const list = document.getElementById('tafeiFeedList');

  if (!list) return;

  t18CommunityFilter = filter || 'all';

  if (category) {
    category.value = 'all';
  }

  if (search) search.value = '';

  document.querySelectorAll('.community-tab').forEach(tab => {
    const active = tab.dataset.communityTab === t18CommunityFilter;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  t12Render();

  list.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

document.querySelectorAll('.community-filter-btn').forEach(button => {
  button.addEventListener('click', () => {
    t18SetCommunityFilter(button.dataset.filter);
  });
});

document.querySelectorAll('.community-tab').forEach(button => {
  button.setAttribute(
    'aria-selected',
    button.classList.contains('active') ? 'true' : 'false'
  );

  button.addEventListener('click', () => {
    t18SetCommunityFilter(button.dataset.communityTab);
  });
});

// TAFEI 18.0 COMMUNITY CATEGORY BRIDGE END

// TAFEI 18.0 COMMUNITY CATEGORY BRIDGE END

// TAFEI 12.0 DATA LOADER

async function t12LoadData() {
  const list = document.getElementById('tafeiFeedList');
  if (!list) return;

  list.textContent = '正在加载社区动态……';

  try {
    const posts = await t12Request(
      T12_FEED_API +
      '?select=id,user_id,category,content,created_at&order=created_at.desc&limit=50'
    );

    t12Posts = posts || [];

    const postIds = t12Posts.map(post => post.id);
    const userIds = t12Posts.map(post => post.user_id).filter(Boolean);

    t12Comments = [];
    t12Likes = [];
    t12Profiles = {};

    if (postIds.length) {
      const ids = postIds.join(',');

      const results = await Promise.all([
        t12Request(
          T12_COMMENTS_API +
          '?select=id,post_id,user_id,content,created_at&post_id=in.(' +
          ids + ')&order=created_at.asc&limit=500'
        ),
        t12Request(
          T12_LIKES_API +
          '?select=post_id,user_id&post_id=in.(' + ids + ')&limit=2000'
        )
      ]);

      t12Comments = results[0] || [];
      t12Likes = results[1] || [];

      userIds.push(...t12Comments.map(item => item.user_id).filter(Boolean));
    }

    const uniqueUsers = [...new Set(userIds)];

    if (uniqueUsers.length) {
      const profiles = await t12Request(
        T12_PROFILE_API +
        '?select=id,nickname,bio&id=in.(' +
        uniqueUsers.join(',') + ')'
      );

      (profiles || []).forEach(profile => {
        t12Profiles[profile.id] = profile;
      });
    }

    t12Render();
  } catch (error) {
    console.error('TAFEI 12.0 加载错误：', error);
    list.textContent = '社区内容暂时无法加载，请检查网络后重试。';
  }
}

// TAFEI 12.0 DATA END

// TAFEI 12.0 POST RENDERER

function t12Render() {
  const list = document.getElementById('tafeiFeedList');
  if (!list) return;

  const keyword = (document.getElementById('t12Search')?.value || '').trim().toLowerCase();
  const category = document.getElementById('t12Category')?.value || 'all';
  const sort = document.getElementById('t12Sort')?.value || 'newest';

  let posts = t12Posts.filter(post => {
    const nickname = t12Profiles[post.user_id]?.nickname || '';
    const content = String(post.content || '').toLowerCase();

    const communityMatch =
      t18CommunityFilter === 'all' ||
      (t18CommunityFilter === 'help' && post.category === 'help') ||
      (t18CommunityFilter === 'knowledge' && post.category === 'knowledge') ||
      (t18CommunityFilter === 'discussion' &&
        ['daily', 'learning', 'tech'].includes(post.category));

    return (!keyword || content.includes(keyword) || nickname.toLowerCase().includes(keyword)) &&
      (category === 'all' || post.category === category) &&
      communityMatch;
  });

  const likeCount = id => t12Likes.filter(item => item.post_id === id).length;

  posts.sort((a, b) => {
    if (sort === 'hottest') {
      return likeCount(b.id) - likeCount(a.id) ||
        new Date(b.created_at) - new Date(a.created_at);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  list.replaceChildren();

  if (!posts.length) {
    list.appendChild(t12Element('div', 'feed-empty', '没有找到符合条件的动态。'));
    return;
  }

  posts.forEach(post => {
    const article = t12Element('article', 'feed-post');
    const head = t12Element('div', 'feed-post-head');

    const nickname = t12Profiles[post.user_id]?.nickname || '挞飞用户';
    const author = t12Element('button', 'feed-author t12-author', nickname);
    author.type = 'button';
    author.addEventListener('click', () => t12ShowProfile(post.user_id));

    const date = new Date(post.created_at);
    const meta = t12Element('span', 'feed-meta',
      Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN'));

    head.append(author, meta);

    const categoryNames = {
      daily: '讨论',
      learning: '讨论',
      tech: '讨论',
      help: '求助',
      knowledge: '知识'
    };

    const tag = t12Element('span', 'feed-category',
      categoryNames[post.category] || '社区动态');

    const content = t12Element('p', 'feed-content', post.content || '');

    const actions = t12Element('div', 't12-actions');
    const userId = authSession?.user?.id;
    const liked = t12Likes.some(item =>
      item.post_id === post.id && item.user_id === userId);

    const likeButton = t12Element('button', 't12-action',
      (liked ? '♥ 已点赞 ' : '♡ 点赞 ') + likeCount(post.id));
    likeButton.type = 'button';
    likeButton.addEventListener('click', () => t12ToggleLike(post.id));

    const comments = t12Comments.filter(item => item.post_id === post.id);
    actions.append(likeButton,
      t12Element('span', 't12-comment-count', '评论 ' + comments.length));

    const commentList = t12Element('div', 't12-comments');

    comments.forEach(comment => {
      const nickname = t12Profiles[comment.user_id]?.nickname || '挞飞用户';
      const line = t12Element('p', 't12-comment-text',
        nickname + '：' + comment.content);
      commentList.appendChild(line);

      if (userId && userId === comment.user_id) {
        const remove = t12Element('button', 't12-delete', '删除');
        remove.type = 'button';
        remove.addEventListener('click', () => t12DeleteComment(comment.id));
        commentList.appendChild(remove);
      }
    });

    const form = document.createElement('form');
    form.className = 't12-comment-form';

    const input = document.createElement('input');
    input.maxLength = 500;
    input.required = true;
    input.placeholder = '写下你的评论……';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = '发送评论';

    form.append(input, submit);
    form.addEventListener('submit', event => {
      event.preventDefault();
      t12AddComment(post.id, input.value, submit);
    });

    article.append(head, tag, content, actions, commentList, form);
    list.appendChild(article);
  });
}

// TAFEI 12.0 POST RENDERER END

// TAFEI 12.0 INTERACTIONS

async function t12ToggleLike(postId) {
  const userId = authSession?.user?.id;
  if (!userId) {
    alert('请先登录后再点赞。');
    return;
  }

  const existing = t12Likes.find(item =>
    item.post_id === postId && item.user_id === userId);

  try {
    if (existing) {
      await t12Request(
        T12_LIKES_API + '?post_id=eq.' + postId + '&user_id=eq.' + userId,
        { method: 'DELETE' }
      );
    } else {
      await t12Request(T12_LIKES_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ post_id: postId, user_id: userId })
      });
    }
    await t12LoadData();
  } catch (error) {
    console.error(error);
    alert('点赞操作失败，请稍后重试。');
  }
}

function privateContactKind(text) {
  const raw = String(text || '');
  const digits = raw.replace(/[^0-9]/g, '');
  if (/1[3-9][0-9]{9}/.test(digits)) return '手机号';
  if (/(qq|扣扣|微信|vx|v信|加我|私聊)\s*[：:号]?\s*[a-zA-Z0-9_-]{5,}/i.test(raw)) return 'QQ/微信';
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(raw)) return '邮箱';
  return '';
}

async function t12AddComment(postId, content, button) {
  const userId = authSession?.user?.id;
  const cleanContent = content.trim();

  if (!userId) {
    alert('请先登录后再评论。');
    return;
  }
  if (!cleanContent || cleanContent.length > 500) {
    alert('评论需要填写内容，且不能超过500字。');
    return;
  }

  const contactKind = privateContactKind(cleanContent);
  if (contactKind) {
    alert('评论里不能留' + contactKind + '等站外联系方式。有问题请直接在「信息 → 私信」找站长，走站内官方通道。');
    return;
  }

  button.disabled = true;
  try {
    await t12Request(T12_COMMENTS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        post_id: postId,
        user_id: userId,
        content: cleanContent
      })
    });
    const targetPost = t12Posts.find((post) => String(post.id) === String(postId));
    if (targetPost && String(targetPost.user_id) !== String(userId)) {
      window.TAFEI_TASKS?.event('comment', 'feed-comment-' + postId);
    }
    await t12LoadData();
  } catch (error) {
    console.error(error);
    alert('评论发送失败，请稍后重试。');
    button.disabled = false;
  }
}

async function t12DeleteComment(commentId) {
  const userId = authSession?.user?.id;
  if (!userId || !confirm('确定删除自己的这条评论吗？')) return;

  try {
    await t12Request(
      T12_COMMENTS_API + '?id=eq.' + commentId + '&user_id=eq.' + userId,
      { method: 'DELETE' }
    );
    await t12LoadData();
  } catch (error) {
    console.error(error);
    alert('删除评论失败，请稍后重试。');
  }
}

// TAFEI 12.0 INTERACTIONS END

// TAFEI 12.0 PROFILE

function t12ShowProfile(userId) {
  const profile = t12Profiles[userId];
  if (!profile) {
    alert('暂时找不到该用户的资料。');
    return;
  }

  let panel = document.getElementById('t12ProfilePanel');
  if (!panel) {
    panel = t12Element('section', 'feed-form');
    panel.id = 't12ProfilePanel';
    const list = document.getElementById('tafeiFeedList');
    list.parentNode.insertBefore(panel, list);
  }

  panel.replaceChildren();
  panel.appendChild(t12Element('h3', '', '用户资料'));

  const nickname = t12Element('p', '', '昵称：' + profile.nickname);
  const bio = t12Element('p', '', '简介：' + (profile.bio || '这个用户还没有填写简介。'));
  panel.append(nickname, bio);

  if (authSession?.user?.id === userId) {
    const form = document.createElement('form');
    const nameInput = document.createElement('input');
    nameInput.value = profile.nickname || '';
    nameInput.maxLength = 30;
    nameInput.required = true;
    nameInput.placeholder = '设置昵称';

    const bioInput = document.createElement('textarea');
    bioInput.value = profile.bio || '';
    bioInput.maxLength = 200;
    bioInput.placeholder = '介绍一下自己（最多200字）';

    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = '保存个人资料';

    form.append(nameInput, bioInput, save);
    form.addEventListener('submit', event => {
      event.preventDefault();
      t12SaveProfile(userId, nameInput.value, bioInput.value, save);
    });
    panel.appendChild(form);
  }
}

async function t12SaveProfile(userId, nickname, bio, button) {
  const cleanName = nickname.trim();
  const cleanBio = bio.trim();

  if (!cleanName || cleanName.length > 30 || cleanBio.length > 200) {
    alert('昵称不能为空且最多30字，简介最多200字。');
    return;
  }

  button.disabled = true;
  try {
    await t12Request(
      T12_PROFILE_API + '?id=eq.' + userId,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ nickname: cleanName, bio: cleanBio })
      }
    );

    t12Profiles[userId] = {
      ...t12Profiles[userId],
      nickname: cleanName,
      bio: cleanBio
    };

    if (authSession?.user?.id === userId) {
      try { await updateAuthNickname(cleanName); }
      catch (error) { console.warn('同步账户昵称失败：', error); }
    }

    t12Render();
    t12ShowProfile(userId);
    alert('个人资料保存成功！');
  } catch (error) {
    console.error(error);
    alert('保存失败，请稍后重试。');
    button.disabled = false;
  }
}

// TAFEI 12.0 PROFILE END

 // TAFEI 12.0 MODULE END

 t12BuildControls();
 t12LoadData();

 renderProjects();
 loadMessages();
 loadArticles();
})();

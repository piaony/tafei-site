(function(){
  var KEY = 'tafei-spirit-v1';
  var SPIRITS = {
    'xi-shi': {name:'西施', game:'王者荣耀 · 幻纱之灵', img:'assets/spirits/xi-shi.jpg', line:'水波会记住每一次相遇。', quote:'今天的水面很安静，要一起看莲花吗？'},
    'angela': {name:'安琪拉', game:'王者荣耀 · 暗夜萝莉', img:'assets/spirits/angela.jpg', line:'知识，就是力量。', quote:'书页翻到哪一页，魔法就从哪一页开始。'},
    'yao': {name:'瑶', game:'王者荣耀 · 鹿灵守心', img:'assets/spirits/yao.jpg', line:'森林里没有陌生人，只有还没认识的朋友。', quote:'小鹿说，今天适合去林子里散步。'},
    'gardener': {name:'园丁', game:'第五人格 · 艾玛·伍兹', img:'assets/spirits/gardener.jpg', line:'先把工具箱放好，再慢慢来。', quote:'你要不要看看我新种下的那棵小树？'},
    'doctor': {name:'医生', game:'第五人格 · 艾米丽·黛儿', img:'assets/spirits/doctor.jpg', line:'别紧张，我会一直在。', quote:'先坐下休息一下，伤口不会自己好。'},
    'mechanic': {name:'机械师', game:'第五人格 · 特蕾西·列兹尼克', img:'assets/spirits/mechanic.jpg', line:'齿轮转起来的时候，世界就安静了。', quote:'这个小玩偶会自己走两步，要看看吗？'},
    'perfumer': {name:'调香师', game:'第五人格 · 薇拉·奈尔', img:'assets/spirits/perfumer.jpg', line:'气味比记忆更诚实。', quote:'这一瓶是今天调的，前调有点甜。'},
    'tanluning': {name:'昙露凝', game:'纸嫁衣9 · 罗浮梦', img:'assets/spirits/tanluning-daily.jpg', altImg:'assets/spirits/tanluning.jpg', line:'我叫昙露凝。你记得我的名字吗？', quote:'如果梦会醒，你还会记得我吗？', altQuote:'红嫁衣、圆框眼镜、白昙花——都是她留下的线索。'}
  };
  var modal = document.getElementById('spiritModal');
  var img = document.getElementById('spiritModalImg');
  var nameEl = document.getElementById('spiritModalName');
  var gameEl = document.getElementById('spiritModalGame');
  var lineEl = document.getElementById('spiritModalLine');
  var bondEl = document.getElementById('spiritBond');
  var hintEl = document.getElementById('spiritBondHint');
  var forms = document.getElementById('spiritForms');
  var formButtons = document.querySelectorAll('[data-spirit-form]');
  var current = null;
  var currentForm = 'daily';
  function load(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; }
  }
  var state = load();
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }
  function get(id){ return state[id] || (state[id] = {bond:0}); }
  function render(){
    if(!current) return;
    var s=get(current);
    bondEl.textContent = s.bond;
    hintEl.textContent = s.bond >= 6 ? '她已经把你当成老朋友了' : s.bond >= 3 ? '再互动几次会更亲近' : '先摸摸她，认识一下';
  }
  function setForm(form){
    if(!current) return;
    var data=SPIRITS[current]; if(!data) return;
    currentForm = form;
    if(form === 'bridal' && data.altImg){
      img.src=data.altImg; img.alt=data.name+' Q版红嫁衣形象';
      lineEl.textContent=data.altQuote || data.quote;
    }else{
      img.src=data.img; img.alt=data.name+' Q版形象';
      lineEl.textContent=data.quote;
    }
    formButtons.forEach(function(btn){
      var on = btn.getAttribute('data-spirit-form') === form;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function open(id){
    current=id; currentForm='daily';
    var data=SPIRITS[id]; if(!data) return;
    img.src=data.img; img.alt=data.name+' Q版形象';
    nameEl.textContent=data.name; gameEl.textContent=data.game; lineEl.textContent=data.quote;
    if(forms) forms.hidden = !data.altImg;
    if(data.altImg) setForm('daily');
    render();
    modal.hidden=false; document.body.classList.add('spirit-modal-open');
  }
  function close(){ modal.hidden=true; document.body.classList.remove('spirit-modal-open'); current=null; }
  function bump(n, text){
    if(!current) return;
    var s=get(current); s.bond += n; save(); render();
    lineEl.textContent = text;
    img.classList.remove('spirit-img-bounce');
    void img.offsetWidth;
    img.classList.add('spirit-img-bounce');
  }
  document.querySelectorAll('[data-spirit-open]').forEach(function(btn){ btn.addEventListener('click', function(){ open(btn.getAttribute('data-spirit-open')); }); });
  document.getElementById('spiritModalClose').addEventListener('click', close);
  formButtons.forEach(function(btn){ btn.addEventListener('click', function(){ setForm(btn.getAttribute('data-spirit-form')); }); });
  modal.addEventListener('click', function(e){ if(e.target === modal) close(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !modal.hidden) close(); });
  document.getElementById('spiritPet').addEventListener('click', function(){ bump(1, '她轻轻蹭了蹭你的手，亲密度 +1。'); });
  document.getElementById('spiritFeed').addEventListener('click', function(){ bump(2, '一颗星糖下去，她的眼睛亮了，亲密度 +2。'); });
  document.getElementById('spiritPlay').addEventListener('click', function(){ bump(3, '她开心地转了个圈，亲密度 +3。'); });
})();

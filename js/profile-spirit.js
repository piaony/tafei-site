/* TAFEI v22.2 个人主页伙伴展示位
   Lv.8 解锁完整展示；Lv.6 私信签名、Lv.9 专属称号会在这里露出来。 */
(function () {
  'use strict';
  var core = window.TafeiSpirits;
  var card = document.getElementById('profileSpiritCard');
  var body = document.getElementById('profileSpiritBody');
  if (!core || !card || !body) return;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render() {
    var snap = core.snapshot();
    var spirit = snap.current;
    var skin = snap.skin;
    if (!spirit || !skin) {
      card.hidden = true;
      body.innerHTML = '';
      return;
    }
    card.hidden = false;
    var info = core.bondInfo(spirit.id);
    var honor = info.honor ? '<span class="ps-honor">专属称号 · ' + esc(info.honor) + '</span>' : '';
    var signature = info.signature ? '<div class="ps-signature"><span>私信专属签名</span><b>' + esc(info.signature) + '</b></div>' : '';

    if (info.level < 8) {
      body.innerHTML = '<div class="ps-locked">'
        + '<div class="ps-lock-avatar"><img src="' + esc(skin.img) + '" alt="" loading="lazy"></div>'
        + '<div class="ps-lock-copy"><b>Lv.8 解锁个人主页展示位</b>'
        + '<span>现在 Lv.' + info.level + ' ' + esc(info.title) + '，再互动 ' + info.toNext + ' 点升到 Lv.' + (info.next ? info.next.level : 8) + '</span>'
        + '<i><em style="width:' + info.progress + '%"></em></i></div>'
        + '<a href="jingling.html#bondPanel" target="_blank" rel="noopener">去升级 ↗</a>'
        + '</div>'
        + signature;
      return;
    }

    body.innerHTML = '<div class="ps-main">'
      + '<div class="ps-avatar' + (info.level >= 9 ? ' is-honored' : '') + '"><img src="' + esc(skin.img) + '" alt="' + esc(spirit.name) + '"></div>'
      + '<div class="ps-copy"><div class="ps-name"><h3>' + esc(spirit.name) + '</h3><span>Lv.' + info.level + ' ' + esc(info.title) + '</span></div>'
      + '<p>' + esc(spirit.quote || spirit.line) + '</p>'
      + '<div class="ps-tags"><span>亲密度 ' + info.bond + '</span><span>' + esc(info.reward) + '</span>' + honor + '</div></div>'
      + '<div class="ps-bond-ring"><b>' + info.level + '</b><span>/10</span></div>'
      + '</div>'
      + signature
      + '<div class="ps-foot"><span>已展示在个人主页 · 仅本地资料展示，不对外公开存档</span><a href="jingling.html#bondPanel" target="_blank" rel="noopener">管理伙伴 ↗</a></div>';
  }

  core.subscribe(render);
  render();
})();

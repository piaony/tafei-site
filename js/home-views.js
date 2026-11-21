/* TAFEI 18.0：社区整合界面 */
(()=>{
 const pages={
  home:['home','home-tools','service-entry','shop-entry','device-entry','naiwa-entry','articles','changelog','projects','about','lab','studio','contact'],
  articles:['articles'],
  info:['community'],
  community:['community'],
  shop:['shop'],
  guestbook:['guestbook'],
  profile:['community']
 };

 const sections=[...document.querySelectorAll('main > section')];
 const links=[...document.querySelectorAll('.mobile-bottom-nav a[data-view],.navlinks a[data-view]')];

 function showPage(name){
  if(!pages[name]) name='home';
  const visible=new Set(pages[name]);

  sections.forEach(section=>{
   const show=visible.has(section.id);
   section.classList.toggle('app-section-hidden',!show);
   if(show && section.classList.contains('reveal')){
    section.classList.add('visible');
   }
  });

  links.forEach(link=>{
   const active=link.dataset.view===name;
   link.classList.toggle('active',active);
   if(active) link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
  });

  window.scrollTo(0,0);
 }

 document.querySelectorAll('[data-open-view]').forEach(button=>{
  button.addEventListener('click',()=>{
   showPage(button.dataset.openView);
  });
 });

 links.forEach(link=>{
  link.addEventListener('click',event=>{
   event.preventDefault();
   showPage(link.dataset.view);
  });
 });

 window.TAFEIViews = { showPage: showPage };
 showPage('home');
})();

/* Publicity article: published backend content and static export share this renderer. */
(function (root) {
  'use strict';
  function render(d, language) {
    const lang = language === 'en' ? 'en' : 'zh';
    const t = v => typeof v === 'string' ? v : v?.[lang] || v?.zh || '';
    const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const ui = (zh,en) => lang === 'en' ? en : zh;
    const p = v => `<p>${esc(t(v))}</p>`;
    const photo = (file,alt) => /^(?:64[0-4]|wechat-source|xiaohongshu-source|events-source|application-source)\.png$/.test(file || '') ? `<figure class="article-photo"><img class="article-original" src="images/departments/publicity/${file}" alt="${esc(t(alt))}" loading="lazy" decoding="async"></figure>` : '';
    const story = values => `<div class="article-story">${values.map((v,i)=>`<div class="story-step"><span class="story-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span>${p(v)}</div>`).join('')}</div>`;
    const list = values => `<ul>${(values || []).map(v=>`<li>${esc(t(v))}</li>`).join('')}</ul>`;
    const section = (title,body,id) => `<section class="article-section" id="publicity-${id}"><h2 class="article-section-title">${esc(title)}</h2>${body}</section>`;
    let source = '';
    try {
      const url = new URL(d.sourceUrl);
      if (url.protocol === 'https:' && url.hostname === 'mp.weixin.qq.com' && !url.username && !url.password)
        source = `<a class="button primary" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${ui('查看微信招新原文','Read the original WeChat recruitment post')} ↗</a>`;
    } catch {}
    let body = `<article class="department-article publicity-article"><nav class="department-breadcrumb" aria-label="${ui('面包屑导航','Breadcrumb')}"><a href="recruitment.html">${ui('所有部门','All departments')}</a> / ${esc(t(d.name))}</nav><header class="article-heading"><span class="article-kicker">MCSA · PUBLICITY TEAM</span><h1>${esc(t(d.name))}</h1><p class="publicity-motto">${ui('用内容讲述故事 · 用创意打破边界','Tell stories. Create something new.')}</p><p class="recruitment-status">${esc(t(d.status))}</p></header>`;
    body += photo('640.png',ui('宣传部往期招新海报','Publicity recruitment poster from a past round'));
    body += `<nav class="publicity-jumps" aria-label="${ui('本页目录','On this page')}">${[['about',ui('关于我们','About')],['leaders',ui('部长寄语','Leaders')],['teams',ui('核心小组','Teams')],['roles',ui('岗位要求','Roles')],['benefits',ui('福利待遇','Benefits')]].map(([id,label])=>`<a href="#publicity-${id}">${label}</a>`).join('')}</nav>`;
    body += section(ui('关于我们','About us'),photo('641.png',ui('宣传部团建合照','Publicity team gathering'))+story(d.about || []),'about');
    body += section(ui('部长寄语','Messages from our leaders'),(d.leaders || []).map(l=>`<section class="article-leader"><header><p class="leader-role">${esc(t(l.role))}</p><h3>${esc(t(l.name))}</h3></header>${photo(l.image,l.name)}<blockquote>${esc(t(l.quote))}</blockquote></section>`).join('')+`<p class="publicity-history-note">${esc(t(d.historyNote))}</p>`,'leaders');
    body += section(ui('部门核心小组','Our core teams'),(d.groups || []).map(g=>`<section class="article-subsection"><h3>${esc(t(g.name))}</h3><p class="publicity-tagline">${esc(t(g.tagline))}</p>${story(t(g.text).split('\n\n'))}<details class="publicity-source"><summary>${ui('查看原文作品与介绍','View examples from the source article')} · ${esc(t(g.name))}</summary>${g.sourceNote?`<p class="publicity-source-note">${esc(t(g.sourceNote))}</p>`:''}${photo(g.sourceImage,ui('原文展示：','Source article examples: ')+t(g.name))}</details></section>`).join(''),'teams');
    body += section(ui('岗位要求','Roles and requirements'),(d.groups || []).map(g=>`<section class="article-subsection"><h3>${esc(t(g.name))}</h3><h4>${ui('工作内容','Responsibilities')}</h4>${list(g.duties)}<h4>${ui('入组要求','Requirements')}</h4>${list(g.requirements)}</section>`).join(''),'roles');
    body += section(ui('福利待遇','What you can gain'),(d.benefits || []).map(b=>`<section class="article-subsection"><h3>${esc(t(b.name))}</h3>${p(b.text)}</section>`).join(''),'benefits');
    body += section(ui('往期报名方式','Past application instructions'),`<p class="recruitment-status">${esc(t(d.status))}</p>${p(d.application)}<details class="publicity-source"><summary>${ui('查看往期报名原图（含二维码）','View the past application notice (with QR codes)')}</summary>${photo('application-source.png',ui('2026年2月26日至3月15日宣传部招新报名说明','Publicity application notice: 26 February–15 March 2026'))}</details>${source}`,'apply');
    return body+'</article>';
  }
  root.MCSAPublicity = {render};
})(typeof window === 'undefined' ? globalThis : window);

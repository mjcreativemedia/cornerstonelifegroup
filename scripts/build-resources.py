#!/usr/bin/env python3
"""Build the education site from repository-authored JSON and shared HTML templates."""
from pathlib import Path
from datetime import date
import html,json,math,re
ROOT=Path(__file__).resolve().parents[1]
esc=html.escape
load=lambda name:json.loads((ROOT/'content'/name).read_text())
guides=load('guides.json');topics=load('topics.json');categories=load('categories.json')
head=(ROOT/'templates/page-head.html').read_text().split('</head>')[0]+'</head>\n'
header=(ROOT/'templates/header.html').read_text();footer=(ROOT/'templates/footer.html').read_text()
all_items=guides+topics
paths={g['slug']:('/funding/' if g in topics else '/resources/')+g['slug']+'/' for g in all_items}
by_slug={g['slug']:g for g in all_items};by_category={c['slug']:c for c in categories}
urls=['/','/resources/','/inquiry/','/funding/']
def page_head(title,description,path):
 s=re.sub(r'<title>.*?</title>','<title>'+esc(title)+' | Cornerstone Life Group LLC</title>',head,flags=re.S)
 for attr,value in [('name="description"',description),('property="og:title"',title),('property="og:description"',description),('property="og:url"','https://mycornerstoneplan.com'+path)]:
  s=re.sub(r'(<meta\s+'+attr+r'\s+content=")[^"]*("\s*/?>)',lambda m:m[1]+esc(value,quote=True)+m[2],s,flags=re.S)
 s=re.sub(r'<link\s+rel="canonical"\s+href="[^"]*"\s*/?>','<link rel="canonical" href="https://mycornerstoneplan.com'+path+'" />',s)
 return s
def card(g):
 return f'''<a class="resource-card" href="{paths[g['slug']]}"><img src="/Assets/funding/{g['illustration']}.svg" width="120" height="85" alt="" loading="lazy"><div><h3>{esc(g['title'])}</h3><p>{esc(g['description'])}</p></div></a>'''
def category_card(c):
 return f'''<a class="purpose-card" href="/funding/{c['slug']}/"><img src="/Assets/funding/{c['illustration']}.svg" width="240" height="170" alt="" loading="lazy"><h3>{esc(c['title'])}</h3><p>{esc(c['description'])}</p></a>'''
def save(path,title,description,body,extra=''):
 target=ROOT/path.strip('/')/'index.html';target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(page_head(title,description,path).replace('</head>',extra+'</head>')+'<body><a class="skip" href="#main">Skip to content</a>'+header+body+footer+'</body></html>')
 if path not in urls:urls.append(path)
notice='<p class="education-notice">Educational overview. This is not a confirmed Cornerstone partner offering. Ask Carlos about current availability; providers determine eligibility and terms.</p>'
library='''<section class="section resource-section" id="resources"><div class="wrap"><div class="section-heading"><div><h2>A little knowledge.<br>A clearer decision.</h2><p class="section-intro">Start with the fundamentals.</p></div><a class="text-link" href="/resources/">All guides</a></div><div class="resource-grid">'''+''.join(card(g) for g in guides)+'''</div></div></section>'''
home=(ROOT/'templates/home.html').read_text().replace('<!-- RESOURCE_LIBRARY -->',library).replace('<!-- FUNDING_CATEGORIES -->','<div class="purpose-grid">'+''.join(category_card(c) for c in categories)+'</div>')
(ROOT/'index.html').write_text(home)
save('/resources/','Business funding guides','Beginner guides to costs, qualification factors, repayment, and funding decisions.','''<main id="main"><section class="section"><div class="wrap resource-hub"><a class="breadcrumb" href="/">Home</a><h1>Clearer questions.<br>Better-informed decisions.</h1><p class="hub-description">Learn the fundamentals, or <a href="/funding/">browse funding topics</a>.</p><div class="resource-grid">'''+''.join(card(g) for g in guides)+'''</div></div></section></main>''')
category_nav='<nav class="topic-nav" aria-label="Funding categories">'+''.join('<a href="/funding/'+c['slug']+'/">'+esc(c['title'])+'</a>' for c in categories)+'</nav>'
hub='''<main id="main"><section class="section"><div class="wrap resource-hub"><a class="breadcrumb" href="/">Home</a><h1>Find the topic<br>that fits your question.</h1><p class="hub-description">Explore how funding works before deciding what to pursue.</p>'''+notice+category_nav
for c in categories:
 group=[g for g in topics if g['category']==c['slug']]
 hub+='<section class="topic-group" id="'+c['slug']+'"><h2>'+esc(c['title'])+'</h2><div class="resource-grid">'+''.join(card(g) for g in group)+'</div></section>'
 body=f'''<main id="main"><section class="section"><div class="wrap resource-hub"><a class="breadcrumb" href="/funding/">All funding topics</a><h1>{esc(c['title'])}</h1><p class="hub-description">{esc(c['description'])}</p>{notice}{category_nav}<div class="resource-grid">{''.join(card(g) for g in group)}</div><p class="optional-help">New to funding? Start with <a href="/resources/funding-basics/">business funding in plain English</a>.</p></div></section></main>'''
 save('/funding/'+c['slug']+'/',c['title'],c['description'],body)
hub+='</div></section></main>'
save('/funding/','Business funding topics','Explore business credit lines, advances, equipment, real estate projects, startups, and restaurant financing.',hub)
for index,g in enumerate(all_items):
 is_topic=g in topics
 sections=''.join('<section id="'+esc(s['id'])+'"><h2>'+esc(s['title'])+'</h2>'+s['body']+'</section>' for s in g['sections'])
 toc=''.join('<a href="#'+s['id']+'">'+esc(s['title'])+'</a>' for s in g['sections'])
 related=[by_slug[slug] for slug in g.get('related',[]) if slug in by_slug]
 if not related:related=[guides[(index+1)%len(guides)],guides[(index+2)%len(guides)]]
 sources=''.join('<li><a href="'+esc(url,quote=True)+'">'+esc(title)+'</a></li>' for url,title in g['sources'])
 words=len(re.sub('<[^>]*>',' ',g['description']+sections).split())
 updated=date.fromisoformat(g['updated']);label=updated.strftime('%B')+f' {updated.day}, {updated.year}'
 back=('/funding/'+g['category']+'/',by_category[g['category']]['title']) if is_topic else ('/resources/','All guides')
 schema=json.dumps({'@context':'https://schema.org','@type':'Article','headline':g['title'],'description':g['description'],'author':{'@type':'Organization','name':'Cornerstone Life Group LLC'},'dateModified':g['updated'],'mainEntityOfPage':'https://mycornerstoneplan.com'+paths[g['slug']]})
 body=f'''<main id="main" class="guide-page"><div class="wrap"><a class="breadcrumb" href="{back[0]}">{esc(back[1])}</a><div class="guide-heading"><div><p class="reading-time">{max(1,math.ceil(words/200))} minute read · Updated {label}</p><h1>{esc(g['title'])}</h1><p>{esc(g['description'])}</p></div><img src="/Assets/funding/{g['illustration']}.svg" width="240" height="170" alt=""></div>{notice if is_topic else ''}<div class="reading-layout"><aside class="guide-toc" aria-label="In this guide"><strong>In this guide</strong>{toc}</aside><article class="guide-body"><div class="key-idea"><strong>The key idea</strong><p>{esc(g['takeaway'])}</p></div>{sections}<section class="guide-sources"><h2>Sources & further reading</h2><ul>{sources}</ul><p>General education, not an offer or individual financial, tax, or legal advice. Educational coverage does not establish provider availability or affiliation.</p></section></article></div><section class="related-reading"><h2>Keep learning</h2><div class="resource-grid">{''.join(card(item) for item in related)}</div><p class="optional-help">Questions for Cornerstone Life Group LLC? <a href="/inquiry/">Talk them through with Carlos</a>.</p></section></div></main>'''
 save(paths[g['slug']],g['title'],g['description'],body,'<script type="application/ld+json">'+schema+'</script>')
(ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>https://mycornerstoneplan.com'+url+'</loc></url>' for url in urls)+'</urlset>\n')
print(f'Built {len(guides)} guides, {len(topics)} topics, {len(categories)} categories; {len(urls)} sitemap routes.')

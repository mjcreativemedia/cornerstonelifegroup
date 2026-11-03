#!/usr/bin/env python3
"""Build the static resource library from content/guides.json and shared templates."""
from pathlib import Path
import json,re,html,math
from datetime import date
ROOT=Path(__file__).resolve().parents[1]
esc=html.escape
guides=json.loads((ROOT/'content/guides.json').read_text())
head=(ROOT/'templates/page-head.html').read_text().split('</head>')[0]+'</head>\n'
header=(ROOT/'templates/header.html').read_text()
footer=(ROOT/'templates/footer.html').read_text()
def page_head(title,description,path):
 s=head
 s=re.sub(r'<title>.*?</title>','<title>'+esc(title)+' | Cornerstone Life Group</title>',s,flags=re.S)
 s=re.sub(r'(<meta\s+name="description"\s+content=")[^"]*("\s*/?>)',lambda m:m[1]+esc(description,quote=True)+m[2],s,flags=re.S)
 s=re.sub(r'(<meta\s+property="og:title"\s+content=")[^"]*("\s*/?>)',lambda m:m[1]+esc(title,quote=True)+m[2],s,flags=re.S)
 s=re.sub(r'(<meta\s+property="og:description"\s+content=")[^"]*("\s*/?>)',lambda m:m[1]+esc(description,quote=True)+m[2],s,flags=re.S)
 s=s.replace('<link rel="canonical" href="https://mycornerstoneplan.com/" />','<link rel="canonical" href="https://mycornerstoneplan.com'+path+'" />')
 s=s.replace('property="og:url" content="https://mycornerstoneplan.com/"','property="og:url" content="https://mycornerstoneplan.com'+path+'"')
 return s
def card(g):
 return f'''<a class="resource-card" href="/resources/{g['slug']}/"><img src="/Assets/funding/{g['illustration']}.svg" width="120" height="85" alt="" loading="lazy"><div><h3>{esc(g['title'])}</h3><p>{esc(g['description'])}</p></div></a>'''
def save(path,title,description,body,extra=''):
 target=ROOT/path.strip('/')/'index.html';target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(page_head(title,description,path).replace('</head>',extra+'</head>')+'<body><a class="skip" href="#main">Skip to content</a>'+header+body+footer+'</body></html>')
library='''<section class="section resource-section" id="resources"><div class="wrap"><div class="section-heading"><div><h2>A little knowledge.<br>A clearer decision.</h2><p class="section-intro">Five guides to help you ask the right questions.</p></div><a class="text-link" href="/resources/">All resources</a></div><div class="resource-grid">'''+''.join(card(g) for g in guides)+'''</div></div></section>'''
home=(ROOT/'templates/home.html').read_text().replace('<!-- RESOURCE_LIBRARY -->',library)
(ROOT/'index.html').write_text(home)
save('/resources/','Business funding resources','Five clear guides to funding types, costs, preparation, repayment, and choosing a provider.','''<main id="main"><section class="section"><div class="wrap resource-hub"><a class="breadcrumb" href="/">← Home</a><h1>Business funding,<br>one clear idea at a time.</h1><p class="hub-description">Start anywhere. No inquiry needed.</p><div class="resource-grid">'''+''.join(card(g) for g in guides)+'''</div></div></section></main>''')
for index,g in enumerate(guides):
 sections=''.join('<section id="'+esc(s['id'])+'"><h2>'+esc(s['title'])+'</h2>'+s['body']+'</section>' for s in g['sections'])
 toc=''.join('<a href="#'+s['id']+'">'+esc(s['title'])+'</a>' for s in g['sections'])
 related=[guides[(index+1)%len(guides)],guides[(index+2)%len(guides)]]
 sources=''.join('<li><a href="'+esc(url,quote=True)+'">'+esc(title)+'</a></li>' for url,title in g['sources'])
 words=len(re.sub('<[^>]*>',' ',g['description']+sections).split())
 updated=date.fromisoformat(g['updated'])
 updated_label=updated.strftime('%B')+f' {updated.day}, {updated.year}'
 schema=json.dumps({'@context':'https://schema.org','@type':'Article','headline':g['title'],'description':g['description'],'author':{'@type':'Organization','name':'Cornerstone Life Group'},'dateModified':g['updated'],'mainEntityOfPage':'https://mycornerstoneplan.com/resources/'+g['slug']+'/'})
 body=f'''<main id="main" class="guide-page"><div class="wrap"><a class="breadcrumb" href="/resources/">← All resources</a><div class="guide-heading"><div><p class="reading-time">{max(1,math.ceil(words/200))} minute read · Updated {updated_label}</p><h1>{esc(g['title'])}</h1><p>{esc(g['description'])}</p></div><img src="/Assets/funding/{g['illustration']}.svg" width="240" height="170" alt=""></div><div class="reading-layout"><aside class="guide-toc" aria-label="In this guide"><strong>In this guide</strong>{toc}</aside><article class="guide-body"><div class="key-idea"><strong>The key idea</strong><p>{esc(g['takeaway'])}</p></div>{sections}<section class="guide-sources"><h2>Sources & further reading</h2><ul>{sources}</ul><p>General education, not an offer or individual financial, tax, or legal advice. Products described here are not a list of Cornerstone’s available programs.</p></section></article></div><section class="related-reading"><h2>Keep learning</h2><div class="resource-grid">{''.join(card(item) for item in related)}</div><p class="optional-help">Have a question about your own business? <a href="/inquiry/">Talk it through with Carlos</a></p></section></div></main>'''
 save('/resources/'+g['slug']+'/',g['title'],g['description'],body,'<script type="application/ld+json">'+schema+'</script>')
urls=['/','/resources/','/inquiry/']+['/resources/'+g['slug']+'/' for g in guides]
(ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>https://mycornerstoneplan.com'+url+'</loc></url>' for url in urls)+'</urlset>\n')
print(f'Built homepage, resource hub, {len(guides)} guides, and sitemap.')

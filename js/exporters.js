// Content formatters intentionally follow the supplied KHIP import templates.
export function safeName(value) {return String(value||'content').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}._-]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,72)||'content'}
export function escCsv(v) {let s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
const line=(key,v)=>v===undefined||v===null||String(v).trim()===''?'':`${key}: ${v}\n`;
export function itemMarkdown(type,item){
 const title=`# ${item.title||'Untitled'}\n`;
 if(type==='articles')return title+line('Subtitle',item.subtitle)+line('Date',item.date)+line('Category',item.category)+line('Image',item.image)+line('Excerpt',item.excerpt)+'\n'+(item.body||'').trim();
 if(type==='slides')return title+line('Subtitle',item.subtitle)+line('Tag',item.tag||item.category)+line('Image',item.image).trimEnd();
 if(type==='pages')return title+line('Service',item.service||item.category)+line('Language',item.language)+line('Subtitle',item.subtitle)+'\n'+(item.body||'').trim();
 if(type==='services'){
  let out=title+line('Service',item.service||item.category)+line('Language',item.language)+line('Brief',item.brief||item.excerpt)+line('Icon',item.icon)+line('Page file',item.pageFile)+line('Hidden',item.hidden||'no')+'\n'+(item.popup||'').trim();
  if((item.body||'').trim())out+='\n\n## Page content\n\n'+item.body.trim();
  return out;
 }
 throw Error('Unsupported content type');
}
export function toMarkdown(type,items){return items.map(x=>itemMarkdown(type,x)).join('\n\n')+'\n'}
export function toCsv(type,items){if(type!=='slides')throw Error('CSV is supported for slider imports only.');return '\uFEFFTitle,Subtitle,Tag,Image\r\n'+items.map(x=>[x.title,x.subtitle,x.tag||x.category,x.image].map(escCsv).join(',')).join('\r\n')+'\r\n'}
export function toJson(project){return JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),...project},null,2)}
export function itemBody(type,item){if(type==='services')return [item.popup||'',item.body?'## Page content\n\n'+item.body:''].filter(Boolean).join('\n\n');return type==='slides'?'':item.body||''}
function textRuns(text,isRTL=false){const d=window.docx;const runs=[];const chunks=String(text).split(/(\*\*[^*]+\*\*)/g);for(const chunk of chunks){if(!chunk)continue;const bold=chunk.startsWith('**')&&chunk.endsWith('**');runs.push(new d.TextRun({text:bold?chunk.slice(2,-2):chunk,bold,rightToLeft:isRTL}));}return runs}
function mdParagraphs(markdown,isRTL){const d=window.docx;let out=[];for(const raw of String(markdown||'').split(/\r?\n/)){
 const s=raw.trim();if(!s){out.push(new d.Paragraph({spacing:{after:70}}));continue;}
 const heading=s.match(/^(#{1,3})\s+(.+)$/);const bullet=s.match(/^[-*]\s+(.+)$/);
 let opts={children:textRuns(heading?heading[2]:bullet?bullet[1]:s,isRTL),bidirectional:isRTL,alignment:isRTL?d.AlignmentType.RIGHT:d.AlignmentType.LEFT,spacing:{after:130,line:320}};
 if(heading)opts.heading=heading[1].length===1?d.HeadingLevel.HEADING_1:heading[1].length===2?d.HeadingLevel.HEADING_2:d.HeadingLevel.HEADING_3;
 if(bullet)opts.bullet={level:0};out.push(new d.Paragraph(opts));
 }return out;
}
function wordChildren(type,items,opts={}){
 const d=window.docx;const all=[];if(opts.cover){all.push(new d.Paragraph({text:opts.brand||opts.projectName||'Content collection',heading:d.HeadingLevel.TITLE,spacing:{after:250}}));all.push(new d.Paragraph({text:`${items.length} ${type} · ${new Date().toLocaleDateString('en-GB')}`,spacing:{after:600}}));all.push(new d.Paragraph({children:[new d.PageBreak()]}));}
 items.forEach((item,i)=>{
  const rtl=item.language==='Arabic'||(!item.language&&/[\u0600-\u06ff]/.test(item.title||''));
  if(i>0)all.push(new d.Paragraph({children:[new d.PageBreak()]}));
  all.push(new d.Paragraph({text:item.title||'Untitled',heading:d.HeadingLevel.HEADING_1,bidirectional:rtl,alignment:rtl?d.AlignmentType.RIGHT:d.AlignmentType.LEFT}));
  let md=itemMarkdown(type,item).split('\n').slice(1).join('\n');
  all.push(...mdParagraphs(md,rtl));
 });return all;
}
export async function standardDocx(type,items,opts={}){
 const d=window.docx;if(!d?.Document)throw Error('Word library did not load. Check your internet connection.');
 const header=opts.brand?new d.Header({children:[new d.Paragraph({text:opts.brand,alignment:d.AlignmentType.RIGHT,style:'Header'})]}):undefined;
 const footer=new d.Footer({children:[new d.Paragraph({alignment:d.AlignmentType.CENTER,children:[new d.TextRun('Page '),new d.TextRun({children:[d.PageNumber.CURRENT]})]})]});
 const doc=new d.Document({creator:'Content Studio',title:opts.projectName||'Generated content',description:'KHIP import-ready content',sections:[{properties:{page:{margin:{top:1100,right:1050,bottom:1100,left:1050}}},headers:header?{default:header}:undefined,footers:{default:footer},children:wordChildren(type,items,opts)}]});
 return await d.Packer.toBlob(doc);
}
const xmlEscape=(s)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function xmlP(text,style,rtl=false){const props=(style?`<w:pStyle w:val="${style}"/>`:'')+(rtl?'<w:bidi/>':'');return `<w:p><w:pPr>${props}</w:pPr><w:r><w:rPr>${rtl?'<w:rtl/>':''}</w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`}
function bodyXml(type,item){const rtl=item.language==='Arabic'||/[\u0600-\u06ff]/.test(item.title||'');let xml='';for(const raw of itemBody(type,item).split('\n')){
 const s=raw.trim();if(!s){xml+=xmlP('',null,rtl);continue}const m=s.match(/^(#{1,3})\s+(.+)$/);xml+=xmlP(m?m[2]:s,m?(m[1].length===1?'Heading1':m[1].length===2?'Heading2':'Heading3'):null,rtl);
 }return xml;
}
// Branded template contract: {{BODY}} must occupy a complete paragraph and remain in one text run.
// Other placeholders also must remain unsplit in Word's XML. Header/footer/logo are preserved.
export async function brandedDocx(file,type,item){
 if(!window.JSZip)throw Error('ZIP library did not load.');
 const zip=await window.JSZip.loadAsync(file);const part=zip.file('word/document.xml');if(!part)throw Error('Invalid DOCX template: word/document.xml missing.');
 let xml=await part.async('string');const bodyToken='{{BODY}}';
 const paraPattern=/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;let found=false;
 xml=xml.replace(paraPattern,p=>{
  if(!p.includes(bodyToken))return p;
  if(!p.includes(`<w:t>${bodyToken}</w:t>`)&&!p.includes(`<w:t xml:space="preserve">${bodyToken}</w:t>`))throw Error('{{BODY}} must be typed as one uninterrupted placeholder in its own Word paragraph.');
  const allText=[...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m=>m[1]).join('').trim();
  if(allText!==bodyToken)throw Error('{{BODY}} must be alone in its paragraph.');
  found=true;return bodyXml(type,item);
 });
 if(!found)throw Error('The branded Word template must contain a {{BODY}} paragraph.');
 const replacements={TITLE:item.title,SUBTITLE:item.subtitle,CATEGORY:item.category,TAG:item.tag,DATE:item.date,IMAGE:item.image,EXCERPT:item.excerpt,SERVICE:item.service||item.category,LANGUAGE:item.language,BRIEF:item.brief||item.excerpt,ICON:item.icon,PAGE_FILE:item.pageFile,HIDDEN:item.hidden};
 for(const [k,v] of Object.entries(replacements))xml=xml.split('{{'+k+'}}').join(xmlEscape(v||''));
 zip.file('word/document.xml',xml);return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
export function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
export async function packageZip(project,opts={}){
 if(!window.JSZip)throw Error('ZIP library did not load.');const zip=new window.JSZip();const type=project.settings.type;const items=project.items||[];
 zip.file('content/import.md',toMarkdown(type,items));zip.file('content/project.json',toJson(project));
 if(type==='slides')zip.file('content/slides.csv',toCsv(type,items));
 for(let i=0;i<items.length;i++){
  const item=items[i];const name=String(i+1).padStart(2,'0')+'-'+safeName(item.title);
  zip.file('individual/'+name+'.md',itemMarkdown(type,item)+'\n');
  zip.file('word/'+name+'.docx',opts.template?await brandedDocx(opts.template,type,item):await standardDocx(type,[item],{...opts,cover:false}));
 }
 zip.file('README.txt','Content Studio export\n\ncontent/import.md: KHIP admin importer format.\ncontent/slides.csv: slider CSV (when applicable).\nword/: individual Word documents.\nindividual/: individual Markdown items.\ncontent/project.json: editable project backup.\n\nImage fields are suggested filenames, not image assets. Add the actual images before importing.\n');
 return zip.generateAsync({type:'blob'});
}

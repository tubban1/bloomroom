"""Prepare actual single cut units from downloaded GLBs.
Run with the bundled Python (NumPy and Pillow): SOURCE_DIR OUTPUT_DIR.
Source downloads stay outside public/. Recipes are explicit; no flower geometry is invented.
"""
from asset_geometry import *
import copy
source=Path(sys.argv[1]);dest=Path(sys.argv[2]);dest.mkdir(parents=True,exist_ok=True)
audit=Path('/tmp/bloomroom-assets/after');audit.mkdir(exist_ok=True,parents=True)
manifest=json.loads((dest/'units.json').read_text()) if (dest/'units.json').exists() else {};report=[]
heads={'garden-rose':10,'tulip':8,'daisy':8,'poppy':10,'peony':16,'hydrangea':18,'sunflower':18,'orchid':10,'lily':15,'anemone':9,'chamomile':4,'gerbera':10,'ivy':9}

def subset(p,ids):
 q=dict(p);q['faces']=p['faces'][ids];return q

def crop(ps,predicate):
 out=[]
 for p in ps:
  xyz=p['attrs']['POSITION'][p['faces']].mean(1);ids=np.where(predicate(xyz))[0]
  if len(ids):out.append(subset(p,ids))
 return out

def rotate(ps,r):
 for p in ps:
  p['attrs']['POSITION']=p['attrs']['POSITION']@r.T
  if 'NORMAL' in p['attrs']:p['attrs']['NORMAL']=p['attrs']['NORMAL']@r.T

def rot_x(t):return np.array([[1,0,0],[0,math.cos(t),-math.sin(t)],[0,math.sin(t),math.cos(t)]])
def rot_y(t):return np.array([[math.cos(t),0,math.sin(t)],[0,1,0],[-math.sin(t),0,math.cos(t)]])
def rot_z(t):return np.array([[math.cos(t),-math.sin(t),0],[math.sin(t),math.cos(t),0],[0,0,1]])

for file in sorted(source.glob('*.glb')):
 if len(sys.argv)>3 and file.stem not in sys.argv[3:]:continue
 name=file.stem;ps=load(file);before_faces=sum(len(p['faces']) for p in ps);note='Single botanical unit retained; unused geometry and textures removed.'
 if name=='carnation':ps=[p for p in ps if p['mesh']!=3];note='Removed the original glass bottle; retained one carnation and its stem.'
 elif name=='lavender':ps=[p for p in ps if p['mesh']<=31];note='Extracted one flower spike and its own stem; removed vase and all other spikes.'
 elif name=='calla-lily':
  ps=[p for p in ps if p['mesh'] in [0,1,3]]
  for i,p in enumerate(ps):
   if p['mesh']==3:ps[i]=subset(p,components(p)[-1][0])
  note='Retained one calla flower, spadix and their stem; removed separate leaves and petioles.'
 elif name=='snowdrop':ps=[p for p in ps if p['mesh']==22];note='Extracted one open snowdrop; removed all packs, alternate LODs and texture display planes.'
 elif name=='ivy':
  ps=[p for p in ps if p['mesh']==39];rotate(ps,rot_x(math.pi/2));p=ps[0];cs=components(p)
  c=max(cs,key=lambda c:np.linalg.norm(c[2]-c[1]));ps=[subset(p,c[0])];note='Extracted one complete ivy leaf from the vine pack; the studio supplies a cut petiole.'
 elif name=='monstera':
  p=ps[0];cs=components(p);ps=[subset(p,np.concatenate([cs[i][0] for i in [3,9,18]]))];note='Extracted one leaf blade, veins and its matching petiole; removed pot, soil and six other leaves.'
 elif name=='fern':
  p=ps[0];cs=components(p);ps=[subset(p,cs[7][0])];note='Extracted one complete frond from the fern clump.'
 elif name=='lotus':ps=[p for p in ps if 1<=p['mesh']<=12];note='Retained only the single flowering lotus and stalk; removed leaf, seedpod and scan marker.'
 elif name=='orchid':
  ps=crop(ps,lambda v:v[:,1]>-12.953)
  ps=[subset(p,components(p)[0][0]) for p in ps];note='Extracted the upper orchid flower; removed the second flower and bud.'
 elif name=='anemone':
  ps=[p for p in ps if ' A MP_' in p['name'] and not any(x in p['name'] for x in ['Leaves','Leafstalk','Stalk'])]
  calyx=next(p for p in ps if 'Flower head' in p['name']);centers=np.array([c[3] for c in components(calyx)]);chosen=int(np.argmax(centers[:,1]));picked=[]
  for p in ps:
   ids=[c[0] for c in components(p) if np.argmin(np.linalg.norm(centers-c[3],axis=1))==chosen]
   if ids:
    q=subset(p,np.concatenate(ids))
    if 'flower_0' in p['name']:
     q['material']={'name':'Natural ivory petals','pbrMetallicRoughness':{'baseColorFactor':[.94,.92,.87,1]}};q['texture']=None;q['color']=[.94,.92,.87,1]
    picked.append(q)
  ps=picked;note='Extracted one complete white anemone bloom by petal/calyx component membership.'
 elif name=='gerbera':
  center=np.array([3.65,5.8,-.25]);ps=crop(ps,lambda v:(np.linalg.norm(v-center,axis=1)<1.18)&(v[:,1]>5.35));ps=[subset(p,components(p)[0][0]) for p in ps];note='Extracted the top flower head from the scanned plant; removed the leaf clump and other flowers.'
 elif name=='chamomile':
  ps=[ps[1]];center=np.array([.28715,.69635,.08308]);ps=crop(ps,lambda v:np.linalg.norm(v-center,axis=1)<.027);note='Extracted one chamomile flower head from the bush.'
 elif name=='sunflower':
  p=ps[0];ps=[subset(p,components(p)[0][0])];note='Retained one actual sunflower head; classified as a head so the studio supplies its cut stem.'
 elif name=='hydrangea':
  pts=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in ps]);threshold=pts[:,1].min()+np.ptp(pts[:,1])*.47;ps=crop(ps,lambda v:v[:,1]>threshold);note='Removed scan stem and lower leaves; retained one hydrangea inflorescence.'
 if name=='lily-of-the-valley':
  # The source contains detached bells. Join them into one cut flowering sprig.
  p=ps[0];cs=components(p);bells=[c for c in cs if len(c[0])>=1200];pts=p['attrs']['POSITION'];lo=pts.min(0);hi=pts.max(0);span=hi[1]-lo[1]
  centers=[(c[1]+c[2])/2 for c in bells if c[3][1]>lo[1]+span*.15]
  ps=crop(ps,lambda v:v[:,1]>lo[1]+span*.15)
  stemx=float(np.mean([c[0] for c in centers]));stemz=float(np.mean([c[2] for c in centers]))+.025*span
  base=np.array([stemx,lo[1]-.2*span,stemz]);top=np.array([stemx,hi[1]-.02*span,stemz]);segments=[(base,top)]
  for c in centers:segments.append((np.array([stemx,min(c[1]+.08*span,top[1]),stemz]),c+np.array([0,.06*span,0])))
  vertices=[];normals=[];faces=[]
  for a,b in segments:
   axis=b-a;axis/=np.linalg.norm(axis);u=np.cross(axis,[0,0,1]);u/=np.linalg.norm(u);v=np.cross(axis,u);offset=len(vertices)
   for end in [a,b]:
    for i in range(8):
     n=u*math.cos(i*math.tau/8)+v*math.sin(i*math.tau/8);vertices.append(end+n*.006*span);normals.append(n)
   for i in range(8):j=(i+1)%8;faces.extend([[offset+i,offset+j,offset+8+i],[offset+j,offset+8+j,offset+8+i]])
  connector=dict(p,attrs={'POSITION':np.array(vertices),'NORMAL':np.array(normals)},faces=np.array(faces),material={'name':'Cut stem','pbrMetallicRoughness':{'baseColorFactor':[.22,.32,.13,1]}},texture=None,color=[.22,.32,.13,1]);ps.append(connector);note='Connected the original bells with a cut stem and pedicels; removed the detached spare bell.'
 # Preserve the established viewing angles for the original head-only assets.
 if name in ['garden-rose','tulip','daisy','poppy','peony','hydrangea']:
  rx=.1 if name=='tulip' else 1.22 if name=='daisy' else .35
  rotate(ps,rot_z(-.06)@rot_y(.2)@rot_x(rx))
 points=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in ps]);lo=points.min(0);hi=points.max(0);span=hi-lo
 mode='head' if name in heads else 'stem'
 scale=(heads[name]/28)/max(span) if mode=='head' else 1/span[1]
 base=points[points[:,1] < lo[1]+span[1]*.02].mean(0);base[1]=lo[1]
 if mode=='head':base[[0,2]]=(lo+hi)[[0,2]]/2
 for p in ps:p['attrs']['POSITION']=(p['attrs']['POSITION']-base)*scale
 # Join parts with the same material to reduce draw calls without altering their triangles.
 merged={}
 for p in ps:
  key=json.dumps(p['material'],sort_keys=True)
  if key not in merged:merged[key]=dict(p,attrs={k:v.copy() for k,v in p['attrs'].items()},faces=p['faces'].copy())
  else:
   q=merged[key];offset=len(q['attrs']['POSITION']);common=q['attrs'].keys()&p['attrs'].keys();q['attrs']={k:np.concatenate([q['attrs'][k],p['attrs'][k]]) for k in common};q['faces']=np.concatenate([q['faces'],p['faces']+offset])
 ps=list(merged.values());export(ps,dest/file.name)
 pts=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in ps]);bounds=pts.max(0)-pts.min(0)
 manifest[name]={'mode':mode,'height':float(bounds[1]),'width':float(bounds[0]),'base':[0,0,0],'unit':'studio unit = 28 cm'}
 report.append({'file':file.name,'mode':mode,'changes':note,'facesBefore':before_faces,'facesAfter':sum(len(p['faces']) for p in ps),'bytesBefore':file.stat().st_size,'bytesAfter':(dest/file.name).stat().st_size})
 render(ps,audit/(name+'.png'),name)
 print('PREPARED',name,mode,report[-1]['facesAfter'],flush=True)
 (dest/'units.json').write_text(json.dumps(manifest,indent=2))
 (audit/'report.json').write_text(json.dumps(report,indent=2))
imgs=sorted(audit.glob('*.png'));sheet=Image.new('RGB',(480*5,480*math.ceil(len(imgs)/5)),(255,255,255))
for i,f in enumerate(imgs):sheet.paste(Image.open(f),(i%5*480,i//5*480))
sheet.save(audit/'contact-sheet.jpg')

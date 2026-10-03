"""Prepare actual single cut units from downloaded GLBs.
Run with the bundled Python (NumPy and Pillow): SOURCE_DIR OUTPUT_DIR.
Source downloads stay outside public/. Recipes are explicit; no flower geometry is invented.
"""
from asset_geometry import *
import copy
source=Path(sys.argv[1]);dest=Path(sys.argv[2]);dest.mkdir(parents=True,exist_ok=True)
audit=Path('/tmp/bloomroom-assets/after');audit.mkdir(exist_ok=True,parents=True)
manifest=json.loads((dest/'units.json').read_text()) if (dest/'units.json').exists() else {};report=[]
# Representative cut-flower face diameters in cm. These are cultivar-scale
# presentation targets, not the largest 3-D dimension of a downloaded scan.
heads={'garden-rose':12,'tulip':6,'daisy':8,'poppy':10,'peony':16,'hydrangea':20,'sunflower':20,'orchid':11,'lily':14,'anemone':9,'chamomile':4.5,'gerbera':11}
# The widest horizontal span of a 70 cm cut unit. Downloaded stems often have
# arbitrary scan scale; matching height alone made some branches 50–80 cm wide.
stem_spans_70={'calla-lily':14,'carnation':14,'chrysanthemum':24,'delphinium':26,'eucalyptus-sprig':36,'eucalyptus':30,'fern':22,'ivy':32,'lavender':7,'lily-of-the-valley':20,'lotus':25,'monstera':30,'snowdrop':18}

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
  for p in ps:
   if p['mesh']==3:
    p['material']=copy.deepcopy(p['material']);p['material']['pbrMetallicRoughness']['baseColorFactor']=[.16,.29,.10,1];p['color']=[.16,.29,.10,1]
  for i,p in enumerate(ps):
   if p['mesh']==3:ps[i]=subset(p,components(p)[-1][0])
  note='Retained one calla flower, spadix and their stem; removed separate leaves and petioles.'
 elif name=='lily-of-the-valley':ps=[p for p in ps if p['mesh']!=0];note='Six original bells attached to one cut stem.'
 elif name=='snowdrop':ps=[p for p in ps if p['mesh']==22];note='Extracted one open snowdrop; removed all packs, alternate LODs and texture display planes.'
 elif name=='ivy':
  # One rooted shoot from the wall variant. Select whole connected leaf and
  # stem pieces so the cut excludes the other shoots without slicing leaves.
  ps=[p for p in ps if p['mesh'] in (57,58)]
  ps=[subset(p,np.concatenate([c[0] for c in components(p) if c[2][0]<35.8])) for p in ps]
  note='Extracted one complete ivy shoot with its original branching stem and leaves; removed the other shoots and LODs.'
 elif name=='monstera':
  p=ps[0];cs=components(p);ps=[subset(p,np.concatenate([cs[i][0] for i in [3,9,18]]))];note='Extracted one leaf blade, veins and its matching petiole; removed pot, soil and six other leaves.'
 elif name=='fern':
  p=ps[0];cs=components(p);ps=[subset(p,cs[7][0])];note='Extracted one complete frond from the fern clump.'
 elif name=='lotus':ps=[p for p in ps if 1<=p['mesh']<=12];note='Retained only the single flowering lotus and stalk; removed leaf, seedpod and scan marker.'
 elif name=='orchid':
  ps=crop(ps,lambda v:v[:,1]>-12.953)
  ps=[subset(p,components(p)[0][0]) for p in ps];note='Extracted the upper orchid flower; removed the second flower and bud.'
 elif name=='anemone':
  # Retain the one complete flower from the CC BY wood-anemone model. The
  # lower branching foliage and source stalk are replaced by the studio stem.
  ps=[ps[i] for i in [0,1,3]]
  for p in ps:
   if p['mesh']==3:
    p['material']={'name':'Natural ivory petals','pbrMetallicRoughness':{'baseColorFactor':[.82,.80,.74,1]}};p['texture']=None;p['color']=[.82,.80,.74,1]
  rotate(ps,rot_x(1.0))
  note='Retained one complete wood-anemone bloom and center; removed branching leaves and source stem.'
 elif name=='gerbera':
  center=np.array([3.65,5.8,-.25]);ps=crop(ps,lambda v:(np.linalg.norm(v-center,axis=1)<1.18)&(v[:,1]>5.35));ps=[subset(p,components(p)[0][0]) for p in ps];note='Extracted the top flower head from the scanned plant; removed the leaf clump and other flowers.'
 elif name=='chamomile':
  ps=[ps[1]];center=np.array([.28715,.69635,.08308]);ps=crop(ps,lambda v:np.linalg.norm(v-center,axis=1)<.027);note='Extracted one chamomile flower head from the bush.'
 elif name=='sunflower':
  p=ps[0];ps=[subset(p,components(p)[0][0])];note='Retained one actual sunflower head; classified as a head so the studio supplies its cut stem.'
 elif name=='hydrangea':
  pts=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in ps]);threshold=pts[:,1].min()+np.ptp(pts[:,1])*.47;ps=crop(ps,lambda v:v[:,1]>threshold);note='Removed scan stem and lower leaves; retained one hydrangea inflorescence.'
 if name=='lily':rotate(ps,rot_y(math.pi/4))
 # Preserve the established viewing angles for the original head-only assets.
 if name in ['garden-rose','tulip','daisy','poppy','peony','hydrangea']:
  rx=.1 if name=='tulip' else 1.22 if name=='daisy' else .35
  rotate(ps,rot_z(-.06)@rot_y(.2)@rot_x(rx))
 points=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in ps]);lo=points.min(0);hi=points.max(0);span=hi-lo
 mode='head' if name in heads else 'stem'
 scale=(heads[name]/28)/span[0] if mode=='head' else 1/span[1]
 base=points[points[:,1] < lo[1]+span[1]*.02].mean(0);base[1]=lo[1]
 if mode=='head':base[[0,2]]=(lo+hi)[[0,2]]/2
 for p in ps:p['attrs']['POSITION']=(p['attrs']['POSITION']-base)*scale
 if name=='lily-of-the-valley':
  for part in ps:part['attrs']['POSITION'][:,1]=.18+.82*part['attrs']['POSITION'][:,1]
  # Source has six disconnected bells. Give this one sprig a single cut stem and pedicels.
  bells=[]
  for part in ps:
   for ids,lo_b,hi_b,_ in components(part):
    if len(ids)>500:bells.append((lo_b+hi_b)/2)
  stemx=float(np.mean([c[0] for c in bells]));stemz=float(np.mean([c[2] for c in bells]))
  segments=[(np.array([stemx,0,stemz]),np.array([stemx,.98,stemz]))]
  for center in bells:
   if center[1]<.13:continue
   segments.append((np.array([stemx,max(.02,center[1]-.03),stemz]),center+np.array([0,.015,0])))
  vertices=[];normals=[];faces=[]
  for segment_index,(a,b) in enumerate(segments):
   direction=b-a;direction/=np.linalg.norm(direction);u=np.cross(direction,[0,0,1]);u/=np.linalg.norm(u);v=np.cross(direction,u);offset=len(vertices)
   for end in [a,b]:
    for j in range(8):
     n=u*math.cos(j*math.tau/8)+v*math.sin(j*math.tau/8);vertices.append(end+n*(.005 if segment_index==0 else .0025));normals.append(n)
   for j in range(8):k=(j+1)%8;faces.extend([[offset+j,offset+k,offset+8+j],[offset+k,offset+8+k,offset+8+j]])
  ps.append(dict(ps[0],attrs={'POSITION':np.array(vertices),'NORMAL':np.array(normals)},faces=np.array(faces),material={'name':'Cut stem','pbrMetallicRoughness':{'baseColorFactor':[.25,.34,.18,1]}},texture=None,color=[.25,.34,.18,1]))
  note='Connected the original bells with one cut stem and individual pedicels.'
 if mode=='stem':
  # Keep the calibrated cut-to-tip height intact while correcting models whose
  # scan proportions would otherwise turn a single stem into a whole shrub.
  points=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in ps])
  horizontal=max(np.ptp(points[:,0]),np.ptp(points[:,2]))
  horizontal_scale=(stem_spans_70[name]/70)/horizontal
  for p in ps:
   p['attrs']['POSITION'][:,[0,2]]*=horizontal_scale
   if 'NORMAL' in p['attrs']:
    normal=p['attrs']['NORMAL'];normal[:,[0,2]]/=horizontal_scale
    normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-8)
 if name=='lotus':
  # Width calibration must preserve the scan's petal aspect. Correct the
  # bloom vertically by the same factor, and extend only its bare stalk.
  old_bloom_base=.45;new_bloom_base=1-(1-old_bloom_base)*horizontal_scale
  for part in ps:
   y=part['attrs']['POSITION'][:,1].copy()
   part['attrs']['POSITION'][:,1]=np.where(y>=old_bloom_base,new_bloom_base+(y-old_bloom_base)*horizontal_scale,y/old_bloom_base*new_bloom_base)
   if 'NORMAL' in part['attrs']:
    normal=part['attrs']['NORMAL'];normal[:,1]/=np.where(y>=old_bloom_base,horizontal_scale,new_bloom_base/old_bloom_base)
    normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-8)
 # Join parts with the same material to reduce draw calls without altering their triangles.
 merged={}
 for p in ps:
  key=json.dumps(p['material'],sort_keys=True)
  if key not in merged:merged[key]=dict(p,attrs={k:v.copy() for k,v in p['attrs'].items()},faces=p['faces'].copy())
  else:
   q=merged[key];offset=len(q['attrs']['POSITION']);common=q['attrs'].keys()&p['attrs'].keys();q['attrs']={k:np.concatenate([q['attrs'][k],p['attrs'][k]]) for k in common};q['faces']=np.concatenate([q['faces'],p['faces']+offset])
 ps=list(merged.values());
 export(ps,dest/file.name)
 pts=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in ps]);bounds=pts.max(0)-pts.min(0)
 manifest[name]={'mode':mode,'height':float(bounds[1]),'width':float(bounds[0]),'referenceWidthCm':heads[name] if mode=='head' else stem_spans_70[name],'base':[0,0,0],'unit':'studio unit = 28 cm'}
 if name=='lotus':manifest[name].update(bloomBaseY=new_bloom_base,petalAspectRestored=True)
 report.append({'file':file.name,'mode':mode,'changes':note,'facesBefore':before_faces,'facesAfter':sum(len(p['faces']) for p in ps),'bytesBefore':file.stat().st_size,'bytesAfter':(dest/file.name).stat().st_size})
 render(ps,audit/(name+'.png'),name)
 print('PREPARED',name,mode,report[-1]['facesAfter'],flush=True)
 (dest/'units.json').write_text(json.dumps(manifest,indent=2))
 (audit/'report.json').write_text(json.dumps(report,indent=2))
imgs=sorted(audit.glob('*.png'));sheet=Image.new('RGB',(480*5,480*math.ceil(len(imgs)/5)),(255,255,255))
for i,f in enumerate(imgs):sheet.paste(Image.open(f),(i%5*480,i//5*480))
sheet.save(audit/'contact-sheet.jpg')

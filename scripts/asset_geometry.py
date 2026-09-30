import json,struct,io,sys,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path('/Users/wahaha/Documents/Me/Project/cursor/bloomroom/public/models')
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
SZ={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(path):
 raw=Path(path).read_bytes();length=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+length]);blob=raw[28+length:];parts=[];imgs={}
 def acc(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];typ=np.dtype(DT[a['componentType']]);n=SZ[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',n*typ.itemsize)
  z=np.ndarray((a['count'],n),dtype=typ,buffer=blob,offset=off,strides=(stride,typ.itemsize)).copy()
  if a.get('normalized') and typ.kind in 'ui': z=z/np.iinfo(typ).max
  return z
 def image(i):
  if i not in imgs:
   im=d['images'][i];v=d['bufferViews'][im['bufferView']];off=v.get('byteOffset',0);imgs[i]=np.array(Image.open(io.BytesIO(blob[off:off+v['byteLength']])).convert('RGBA'))
  return imgs[i]
 def walk(i,parent):
  n=d['nodes'][i]
  if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4).T
  else:
   x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0])
  world=parent@m
  if 'mesh' in n:
   for prim in d['meshes'][n['mesh']]['primitives']:
    attrs={k:acc(v) for k,v in prim['attributes'].items() if k in ['POSITION','NORMAL','TEXCOORD_0','COLOR_0']};p=attrs['POSITION'];p=p@world[:3,:3].T+world[:3,3];attrs['POSITION']=p
    if 'NORMAL' in attrs:
     norms=attrs['NORMAL']@np.linalg.inv(world[:3,:3]);attrs['NORMAL']=norms/np.maximum(np.linalg.norm(norms,axis=1,keepdims=True),1e-8)
    inds=acc(prim['indices']).flatten().astype(int) if 'indices' in prim else np.arange(len(p));faces=inds.reshape(-1,3)
    mat=d.get('materials',[{}])[prim.get('material',0)];pbr=mat.get('pbrMetallicRoughness',{});legacy=mat.get('extensions',{}).get('KHR_materials_pbrSpecularGlossiness',{});tex=pbr.get('baseColorTexture',legacy.get('diffuseTexture',{})).get('index');texture=image(d['textures'][tex]['source']) if tex is not None else None
    parts.append(dict(doc=d,blob=blob,node=i,name=n.get('name',''),mesh=n['mesh'],attrs=attrs,faces=faces,material=mat,texture=texture,color=pbr.get('baseColorFactor',legacy.get('diffuseFactor',[1,1,1,1]))))
  for c in n.get('children',[]):walk(c,world)
 for i in d['scenes'][d.get('scene',0)]['nodes']:walk(i,np.eye(4))
 return parts

def render(parts,path,name='',size=480):
 if not parts:return
 points=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in parts]);lo=points.min(0);hi=points.max(0);span=hi-lo;scale=(size-50)/max(span[0],span[1],1e-5);center=(lo+hi)/2
 areas=[]
 for p in parts:
  tri=p['attrs']['POSITION'][p['faces']];a=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)/2;areas.append(a)
 total=sum(a.sum() for a in areas);rng=np.random.default_rng(7);cloud=[];colors=[]
 for p,a in zip(parts,areas):
  count=max(300,int(650000*a.sum()/max(total,1e-20)));idx=rng.choice(len(a),count,p=a/a.sum()) if a.sum()>0 else np.zeros(count,int);faces=p['faces'][idx];u=rng.random(count);v=rng.random(count);u=np.sqrt(u);b=np.stack([1-u,u*(1-v),u*v],axis=1)
  xyz=(p['attrs']['POSITION'][faces]*b[:,:,None]).sum(1)
  color=np.tile(np.array(p['color'],dtype=float),(count,1))
  if p['texture'] is not None and 'TEXCOORD_0' in p['attrs']:
   uv=(p['attrs']['TEXCOORD_0'][faces]*b[:,:,None]).sum(1);im=p['texture'];pix=im[(np.mod(uv[:,1],1)*(len(im)-1)).astype(int),(np.mod(uv[:,0],1)*(im.shape[1]-1)).astype(int)]/255;color*=pix
  keep=color[:,3]>.35;xyz=xyz[keep];color=color[keep,:3]
  cloud.append(xyz);colors.append(np.clip(color*255,0,255).astype(np.uint8))
 xyz=np.concatenate(cloud);rgb=np.concatenate(colors);order=np.argsort(xyz[:,2]);xyz=xyz[order];rgb=rgb[order];px=np.round((xyz[:,0]-center[0])*scale+size/2).astype(int);py=np.round(-(xyz[:,1]-center[1])*scale+size/2+8).astype(int)
 canvas=np.full((size,size,3),(236,233,224),dtype=np.uint8)
 for ox,oy in [(0,0),(1,0),(0,1),(1,1)]:
  x=px+ox;y=py+oy;keep=(x>=0)&(x<size)&(y>=20)&(y<size);canvas[y[keep],x[keep]]=rgb[keep]
 im=Image.fromarray(canvas);draw=ImageDraw.Draw(im);draw.text((12,9),name,fill=(35,40,30));im.save(path)
 return lo,hi

def components(part):
 p=part['attrs']['POSITION'];faces=part['faces'];eps=max(np.ptp(p,axis=0).max()*1e-6,1e-9);_,labels=np.unique(np.round(p/eps).astype(np.int64),axis=0,return_inverse=True);parent=list(range(labels.max()+1))
 def find(x):
  while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
  return x
 for a,b,c in labels[faces]:
  ra=find(a);rb=find(b);rc=find(c);parent[rb]=ra;parent[rc]=ra
 roots=np.array([find(i) for i in labels]);face_roots=roots[faces[:,0]];groups=[]
 for label in np.unique(face_roots):
  ids=np.where(face_roots==label)[0];v=p[np.unique(faces[ids])];groups.append((ids,v.min(0),v.max(0),v.mean(0)))
 return sorted(groups,key=lambda x:len(x[0]),reverse=True)

def export(parts,path):
 import copy
 out={'asset':{'version':'2.0','generator':'Bloomroom single-unit preparation'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'accessors':[],'bufferViews':[],'buffers':[],'materials':[],'textures':[],'images':[],'samplers':[]};blob=bytearray();textures={};materials={}
 def view(data):
  blob.extend(b'\0'*(-len(blob)%4));idx=len(out['bufferViews']);out['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data);return idx
 def accessor(a,typ):
  a=np.asarray(a,dtype='<u4' if typ=='SCALAR' else '<f4');idx=len(out['accessors']);entry={'bufferView':view(a.tobytes()),'componentType':5125 if typ=='SCALAR' else 5126,'count':len(a),'type':typ}
  if typ=='VEC3':entry.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  out['accessors'].append(entry);return idx
 def texture(part,i):
  key=(id(part['doc']),i)
  if key in textures:return textures[key]
  d=part['doc'];t=copy.deepcopy(d['textures'][i]);im=d['images'][t['source']];v=d['bufferViews'][im['bufferView']];off=v.get('byteOffset',0);pil=Image.open(io.BytesIO(part['blob'][off:off+v['byteLength']]));pil.thumbnail((1024,1024));buf=io.BytesIO();alpha='A' in pil.getbands() or 'transparency' in pil.info;pil=pil.convert('RGBA' if alpha else 'RGB');pil.save(buf,format='PNG' if alpha else 'JPEG',quality=90)
  t['source']=len(out['images']);out['images'].append({'bufferView':view(buf.getvalue()),'mimeType':'image/png' if alpha else 'image/jpeg'})
  if 'sampler' in t:t['sampler']=len(out['samplers']);out['samplers'].append(copy.deepcopy(d.get('samplers',[{}])[d['textures'][i].get('sampler',0)]))
  idx=len(out['textures']);out['textures'].append(t);textures[key]=idx;return idx
 def remap(part,value):
  for k,c in value.items():
   if k.endswith('Texture') and isinstance(c,dict) and 'index' in c:c['index']=texture(part,c['index'])
   elif isinstance(c,dict):remap(part,c)
 for p in parts:
  if not len(p['faces']):continue
  used,inv=np.unique(p['faces'],return_inverse=True);attrs={k:accessor(a[used],{2:'VEC2',3:'VEC3',4:'VEC4'}[a.shape[1]]) for k,a in p['attrs'].items()};mat=copy.deepcopy(p['material']);legacy=mat.get('extensions',{}).pop('KHR_materials_pbrSpecularGlossiness',None)
  if legacy:
   mat['pbrMetallicRoughness']={'baseColorFactor':legacy.get('diffuseFactor',[1,1,1,1]),'metallicFactor':0,'roughnessFactor':.85}
   if 'diffuseTexture' in legacy:mat['pbrMetallicRoughness']['baseColorTexture']=legacy['diffuseTexture']
  mat.setdefault('pbrMetallicRoughness',{}).update(metallicFactor=0,roughnessFactor=.85);mat['doubleSided']=True;mat.pop('extensions',None);remap(p,mat)
  out['materials'].append(mat);mi=len(out['meshes']);out['meshes'].append({'name':p['name'],'primitives':[{'attributes':attrs,'indices':accessor(inv.reshape(-1,1),'SCALAR'),'material':len(out['materials'])-1}]});out['nodes'].append({'mesh':mi,'name':p['name']});out['scenes'][0]['nodes'].append(mi)
 blob.extend(b'\0'*(-len(blob)%4));out['buffers']=[{'byteLength':len(blob)}];js=json.dumps(out,separators=(',',':')).encode();js+=b' '*(-len(js)%4);total=28+len(js)+len(blob);Path(path).write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(blob),0x004e4942)+blob)

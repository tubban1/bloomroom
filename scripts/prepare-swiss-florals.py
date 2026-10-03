"""Extract verified cut-flower units. Originals must remain in SOURCE_DIR.
Usage: python prepare-swiss-florals.py ORIGINAL_DIR REPLACEMENT_DIR OUTPUT_DIR
"""
import sys,json,copy
from pathlib import Path
import numpy as np
from asset_geometry import load,export,render
source,replacements,dest=map(Path,sys.argv[1:4]);dest.mkdir(parents=True,exist_ok=True)
units=json.loads((dest/'units.json').read_text());audit=Path('/tmp/bloomroom-swiss-audit/prepared');audit.mkdir(parents=True,exist_ok=True)

def crop(parts,predicate):
 result=[]
 for p in parts:
  ids=np.flatnonzero(predicate(p['attrs']['POSITION'][p['faces']].mean(1)))
  if len(ids):result.append(dict(p,faces=p['faces'][ids]))
 return result

def merge(parts):
 # Hundreds of botanical petal nodes become a handful of material batches.
 groups={}
 for p in parts:
  key=json.dumps(p['material'],sort_keys=True)
  groups.setdefault(key,[]).append(p)
 result=[]
 for group in groups.values():
  attrs={};faces=[];offset=0
  for p in group:
   used,indices=np.unique(p['faces'],return_inverse=True)
   for k,v in p['attrs'].items():attrs.setdefault(k,[]).append(v[used])
   faces.append(indices.reshape(-1,3)+offset);offset+=len(used)
  result.append(dict(group[0],attrs={k:np.concatenate(v) for k,v in attrs.items()},faces=np.concatenate(faces)))
 return result

def save(name,parts,diameter,mode='head',anchor=None):
 parts=merge(parts);xyz=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in parts]);low,high=xyz.min(0),xyz.max(0)
 if anchor is None:
  base=xyz[xyz[:,1]<low[1]+(high[1]-low[1])*.012]
  anchor=np.array([base[:,0].mean(),low[1],base[:,2].mean()])
 if mode=='head':scale=diameter/28/(high[0]-low[0])
 else:scale=1/(high[1]-low[1])
 for p in parts:p['attrs']['POSITION']=(p['attrs']['POSITION']-anchor)*scale
 xyz=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in parts]);low,high=xyz.min(0),xyz.max(0)
 units[name]={'mode':mode,'height':float(high[1]),'width':float(np.ptp(xyz[:,0])),'referenceWidthCm':float(diameter if mode=='head' else max(np.ptp(xyz[:,0]),np.ptp(xyz[:,2]))*70),'minY':float(low[1]),'base':[0,0,0],'unit':'studio unit = 28 cm','attachment':'single cut unit; bloom geometry remains rigid','naturalTexture':True}
 export(parts,dest/(name+'.glb'),texture_size=512);render(parts,audit/(name+'.png'),name,420)
 print(name,len(parts),sum(len(p['faces']) for p in parts),(dest/(name+'.glb')).stat().st_size,flush=True)

# One bloom from the five-color pack. Leaves and the source stalk are excluded.
parts=load(source/'ranunculus.glb');save('ranunculus',crop([parts[9]],lambda p:p[:,1]>14.15),8,anchor=np.array([-.9,14.15,-2.83]))
# All seven texture patches of the isolated scan, excluding bulbs and leaves.
parts=load(source/'narcissus.glb');save('narcissus',parts[5:12],5)
# True CC BY dahlia replacement. Separate lower leaves are outside this cut.
parts=load(replacements/'dahlia.glb');save('dahlia',crop(parts,lambda p:p[:,1]>-.026),12)
# Amaryllis naturally carries several bells on ONE cut stem, retained intact.
parts=load(replacements/'amaryllis.glb');save('amaryllis',parts,0,'stem')
# One complete masterwort flower, including its original central florets/bracts.
parts=load(source/'astrantia.glb');save('astrantia',parts[395:755],4,anchor=np.array([1.337,9.18,.843]))
# The CC BY bouquet scan contains one identifiable sea-holly cone at this location.
parts=load(replacements/'eryngium.glb');save('eryngium',crop(parts,lambda p:np.linalg.norm(p-np.array([-3,53,9]),axis=1)<3),7)
# One real cone from the source's lower-detail mesh; remove all other cones/needles.
parts=load(source/'pine-cone.glb');save('pine-cone',[parts[5]],8)
# Decimate complete textured surfaces, rather than discarding texture patches.
import subprocess
blender=Path('/Applications/Blender.app/Contents/MacOS/Blender')
if not blender.exists():raise RuntimeError('Blender required to simplify complete narcissus/cone surfaces')
script=audit/'decimate.py'
script.write_text("""import bpy
from pathlib import Path
root=Path(%r)
for name,ratio in [('narcissus',.12),('pine-cone',.24)]:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(root/(name+'.glb')))
 for obj in bpy.context.scene.objects:
  if obj.type=='MESH':
   mod=obj.modifiers.new('Preserve flower surface','DECIMATE');mod.ratio=ratio;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.export_scene.gltf(filepath=str(root/(name+'.glb')),export_format='GLB',export_yup=True)
""" % str(dest.resolve()))
subprocess.run([str(blender),'--background','--python',str(script)],check=True,stdout=subprocess.DEVNULL)
for name in ('narcissus','pine-cone'):
 parts=load(dest/(name+'.glb'));xyz=np.concatenate([p['attrs']['POSITION'][np.unique(p['faces'])] for p in parts]);units[name].update(height=float(xyz[:,1].max()),minY=float(xyz[:,1].min()),width=float(np.ptp(xyz[:,0])),referenceWidthCm=float(np.ptp(xyz[:,0])*28))
 export(parts,dest/(name+'.glb'),texture_size=512);render(parts,audit/(name+'.png'),name,420)
(dest/'units.json').write_text(json.dumps(units,ensure_ascii=False,indent=2)+'\n')

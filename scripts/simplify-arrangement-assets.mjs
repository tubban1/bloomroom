// Run after prepare-arrangement-assets.py: node scripts/simplify-arrangement-assets.mjs DIRECTORY
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';
await MeshoptSimplifier.ready;
for (const name of fs.readdirSync(process.argv[2]).filter(x=>x.endsWith('.glb'))) {
 const file=path.join(process.argv[2],name),raw=fs.readFileSync(file),jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl)),bin=raw.subarray(28+jl);
 const parts=[],views=[],accessors=[];let length=0;
 function view(data){const pad=(4-length%4)%4;parts.push(Buffer.alloc(pad));length+=pad;const id=views.length;views.push({buffer:0,byteOffset:length,byteLength:data.length});parts.push(data);length+=data.length;return id;}
 function read(id){const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],off=(v.byteOffset||0)+(a.byteOffset||0);return a.componentType===5125?new Uint32Array(bin.buffer.slice(bin.byteOffset+off,bin.byteOffset+off+a.count*n*4)):new Float32Array(bin.buffer.slice(bin.byteOffset+off,bin.byteOffset+off+a.count*n*4));}
 function acc(data,source){const a={...source,bufferView:view(Buffer.from(data.buffer,data.byteOffset,data.byteLength)),count:data.length/({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[source.type])};delete a.byteOffset;if(a.type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.length;i++){const k=i%3;a.min[k]=Math.min(a.min[k],data[i]);a.max[k]=Math.max(a.max[k],data[i]);}}accessors.push(a);return accessors.length-1;}
 let before=0,after=0;
 for(const mesh of doc.meshes)for(const p of mesh.primitives){let indices=read(p.indices);before+=indices.length/3;const pos=read(p.attributes.POSITION),target=18000*3;
  if(indices.length>target){const uv=p.attributes.TEXCOORD_0===undefined?null:read(p.attributes.TEXCOORD_0);[indices]=uv?MeshoptSimplifier.simplifyWithAttributes(indices,pos,3,uv,2,[.2,.2],null,target,.005,['LockBorder']):MeshoptSimplifier.simplify(indices,pos,3,target,.005,['LockBorder']);}
  after+=indices.length/3;
  const used=[...new Set(indices)],map=new Map(used.map((v,i)=>[v,i]));indices=Uint32Array.from(indices,v=>map.get(v));
  for(const [key,id] of Object.entries(p.attributes)){const old=read(id),n=old.length/doc.accessors[id].count,next=new Float32Array(used.length*n);used.forEach((v,i)=>next.set(old.subarray(v*n,v*n+n),i*n));p.attributes[key]=acc(next,doc.accessors[id]);}
  p.indices=acc(indices,doc.accessors[p.indices]);
 }
 for(const im of doc.images||[]){const v=doc.bufferViews[im.bufferView];im.bufferView=view(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));}
 parts.push(Buffer.alloc((4-length%4)%4));const body=Buffer.concat(parts);doc.bufferViews=views;doc.accessors=accessors;doc.buffers=[{byteLength:body.length}];let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const header=Buffer.alloc(20),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+body.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(body.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(file,Buffer.concat([header,json,bh,body]));console.log(name,before,'→',after);
}

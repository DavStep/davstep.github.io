"""Summarize the browser pass, preserving raw measurements and matched images."""
import gzip, hashlib, json, shutil, statistics, sys
from pathlib import Path
from PIL import Image, ImageChops
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

source, destination = map(Path, sys.argv[1:3])
destination.mkdir(parents=True, exist_ok=True)
(destination/'graphs').mkdir(exist_ok=True)
(destination/'evidence').mkdir(exist_ok=True)
raw=json.loads((source/'metrics.json').read_text())
with gzip.open(destination/'evidence/measurements.json.gz','wt') as f: json.dump(raw,f)
comparisons=[]
for mobile in [False,True]:
 for fixture in raw['fixtures']:
  records=[s for s in raw['sessions'] if s['mobile']==mobile and s['fixture']==fixture and s['role']=='AB']
  if not records:continue
  metrics={}
  for metric in ['frameCPU','projection','renderIntervals','submission']:
   for stat in ['mean','p95','p99']:
    key=f'{metric}_{stat}'
    values={control:[s['summary'][metric][stat] for s in records if s['control']==control] for control in ['before','after']}
    medians={control:statistics.median(v) for control,v in values.items()}
    metrics[key]={'units':'ms','sessions':values,**medians,'changePercent':(medians['after']/medians['before']-1)*100 if medians['before'] else None}
  comparisons.append({'layout':'mobile' if mobile else 'desktop','fixture':fixture,'metrics':metrics,'errors':list(set(e for s in records for e in s['errors']))})
visual=[]
for p in source.glob('*-before.png'):
 a=Image.open(p).convert('RGB');after=Path(str(p).replace('-before','-after'));b=Image.open(after).convert('RGB');d=ImageChops.difference(a,b)
 changed=sum(1 for pixel in d.get_flattened_data() if pixel!=(0,0,0))
 before_hash=hashlib.sha256(p.read_bytes()).hexdigest();after_hash=hashlib.sha256(after.read_bytes()).hexdigest()
 visual.append({'fixture':p.stem.replace('-before',''),'size':a.size,'changedPixels':changed,'totalPixels':a.width*a.height,'beforeSHA256':before_hash,'afterSHA256':after_hash,'artifact':f'evidence/{after.name}'})
 shutil.copy2(after,destination/'evidence'/after.name)
 if before_hash!=after_hash:shutil.copy2(p,destination/'evidence'/p.name)
 else:(destination/'evidence'/p.name).unlink(missing_ok=True)
summary={'aggregation':'Median of three per-window AB statistics; adjacent AA windows retained separately in raw evidence. No pooled device statistics.','comparisons':comparisons,'visual':visual,'sessionCount':len(raw['sessions']),'missing':{'presentedFrames':{'value':None,'reason':'rAF cadence is not GPU presentation timing'},'physicalPhone':{'value':None,'reason':'Desktop Chrome with a mobile viewport uses Apple M3 Max hardware'},'productionLoad':{'value':None,'reason':'Timing pass uses development modules and existing debug access'}}}
(destination/'metrics.json').write_text(json.dumps(summary,indent=2)+'\n')
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(2,3,figsize=(13,7),layout='constrained')
for row,mobile in enumerate([False,True]):
 rows=[c for c in comparisons if c['layout']==('mobile' if mobile else 'desktop')]
 for col,(metric,label) in enumerate([('frameCPU_p95','Full callback CPU · p95 (ms)'),('projection_mean','Projection bookkeeping · mean (ms)'),('renderIntervals_p95','Render callback interval · p95 (ms)')]):
  ax=axes[row,col]
  if not rows:
   ax.text(.5,.5,'Not measured in this focused repeat',ha='center',va='center',transform=ax.transAxes);ax.axis('off');continue
  for offset,control,color in [(-.18,'before','#ad6d44'),(.18,'after','#378a91')]:
   values=[c['metrics'][metric][control] for c in rows]
   ax.bar([i+offset for i in range(len(rows))],values,width=.34,color=color,label=control)
   for i,value in enumerate(values):ax.text(i+offset,value,f'{value:.2f}',ha='center',va='bottom',fontsize=8)
  ax.set_xticks(range(len(rows)),[c['fixture'].capitalize() for c in rows]);ax.set_title(label);ax.set_ylim(bottom=0);ax.grid(axis='y',alpha=.15)
  if col==2:ax.axhline(1000/(30 if mobile else 60),color='#777777',linestyle='--',linewidth=1,label='configured cadence')
  if col==0:ax.set_ylabel('Mobile layout (Mac GPU)' if mobile else 'Desktop layout')
  ax.legend(fontsize=8)
fig.suptitle(f"Town website · alternating same-session A/B · Chrome / Apple M3 Max\nThree {raw['windowMs']/1000:g}-second windows per path and workload; rAF intervals are not presented-frame measurements",fontsize=12)
fig.savefig(destination/'graphs/comparison.png',dpi=150);plt.close(fig)
if (source/'lifecycle.json').exists():
 lifecycle=json.loads((source/'lifecycle.json').read_text())
 shutil.copy2(source/'lifecycle.json',destination/'evidence/lifecycle.json')
 fig,axes=plt.subplots(1,3,figsize=(13,3.5),layout='constrained')
 time=[(s['time']-lifecycle['soak'][0]['time'])/1000 for s in lifecycle['soak']]
 axes[0].plot(time,[float(s['profile']['frameP99']) for s in lifecycle['soak']],color='#378a91');axes[0].axhline(1000/60,color='#777777',linestyle='--');axes[0].set(title='Render callback interval p99 (ms)',xlabel='Seconds since first soak sample',ylim=(0,20))
 axes[1].plot(time,[s['heap']/1048576 for s in lifecycle['soak']],color='#378a91');axes[1].set(title='Uncollected JS heap (MiB)',xlabel='Seconds since first soak sample')
 axes[2].plot([s['cycle']+1 for s in lifecycle['cycles']],[s['heap']['usedSize']/1048576 for s in lifecycle['cycles']],color='#378a91',marker='o');axes[2].set(title='Collected heap after restart (MiB)',xlabel='Complete play/restart cycle')
 fig.suptitle('Separate desktop lifecycle diagnostic · two-minute soak / six restart cycles\nCollected restart heaps belong to the pre-reload session; soak heaps belong to the reloaded session',fontsize=11)
 fig.savefig(destination/'graphs/lifecycle.png',dpi=150);plt.close(fig)
hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path('src').rglob('*')) if p.is_file()}
metadata={k:v for k,v in raw.items() if k not in ['sessions','visuals']}
metadata['sourceHashes']=hashes
metadata['sourceFingerprint']=hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest()
metadata['conditions']={'os':'macOS 26.0.1','model':'Mac15,11','gpu':'Apple M3 Max / ANGLE Metal','RAMBytes':38654705664,'desktopViewport':[1440,900],'mobileViewport':[390,844],'desktopDPR':1,'mobileDPR':2,'gameMobileDPR':1.5,'softwareCPUSampling':'Separate 5-second CDP profiles outside comparison windows','build':'Unreleased dirty development source, not a frozen release artifact','backgroundJobs':'No build or test jobs during alternating timing windows; normal user host activity was not controlled','rawRetention':'Lossless gzip of all per-window samples and fixture identities'}
(destination/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
for c in comparisons:
 print(c['layout'],c['fixture'],'CPU p95',c['metrics']['frameCPU_p95'],'projection mean',c['metrics']['projection_mean'])
print('Visual comparisons:',visual)

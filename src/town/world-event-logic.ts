import { DEVELOPMENT_RULES, CAPABILITY_NAMES } from './action-rules';
import { IDEAS, type Idea, type Levels, type TownEvent } from './game';
import { copyWorldEventState, initialWorldEventState, type ArtifactId, type WorldEvent, type WorldEventKind, type WorldEventState } from './world-event-types';

export type ProgressionStep = { kind:'development'; event:TownEvent; world:WorldEventState } | { kind:'world'; event:WorldEvent };
export interface PendingDevelopment { idea:Idea; name:string; missing:string[] }
export interface WorldProgression {
  levels:Levels; projects:readonly string[]; events:TownEvent[]; world:WorldEventState;
  worldEvents:WorldEvent[]; history:WorldEvent[]; timeline:ProgressionStep[]; pending:PendingDevelopment[];
}

/** Supply closure and authored events are evaluated only on a committed choice. */
export function evaluateWorld(order:readonly Idea[]):WorldProgression {
  const levels=Object.fromEntries(IDEAS.map(idea=>[idea,0])) as Levels;
  const world=initialWorldEventState(),completed=new Set<string>(),history:WorldEvent[]=[];
  let events:TownEvent[]=[],timeline:ProgressionStep[]=[],worldEvents:WorldEvent[]=[],wave=0;
  const has=(capability:string)=>world.capabilities.includes(capability);
  function refreshCapabilities(){
    const caps=new Set<string>();
    if(levels.settlers)caps.add('workers');
    if(levels.observatory)caps.add('creature-calming');
    if(world.mountainPass!=='blocked')caps.add('pass-open');
    for(const rule of DEVELOPMENT_RULES)if(completed.has(rule.id))for(const cap of rule.provides)caps.add(cap);
    if(world.mountainPass==='blocked')for(const cap of ['trade','imported-food','glass','freight'])caps.delete(cap);
    if(caps.has('orchard-planted')&&world.orchard!=='burned')caps.add('orchard-food');
    if(['orchard-food','fish','flour','imported-food'].some(cap=>caps.has(cap)))caps.add('food');
    if(world.expedition==='returned')caps.add('expedition-records');
    for(const artifact of world.installed)caps.add(`${artifact}-installed`);
    if(world.beacon)caps.add('beacon');
    world.capabilities=[...caps].sort();
  }
  function emit(kind:WorldEventKind,title:string,description:string,change:()=>void,artifact?:ArtifactId){
    refreshCapabilities();const before=copyWorldEventState(world);
    change();refreshCapabilities();
    const event:WorldEvent={id:`${world.turn}:${kind}${artifact?`:${artifact}`:''}`,kind,turn:world.turn,title,description,artifact,before,after:copyWorldEventState(world)};
    history.push(event);worldEvents.push(event);timeline.push({kind:'world',event});
  }
  function develop(){
    refreshCapabilities();let changed=true;
    while(changed){
      changed=false;
      for(const rule of DEVELOPMENT_RULES){
        if(!levels[rule.idea]||completed.has(rule.id)||!rule.requires.every(has))continue;
        // A later stage cannot skip a site's own unfinished earlier function.
        if(DEVELOPMENT_RULES.some(earlier=>earlier.idea===rule.idea&&earlier.level<rule.level&&!completed.has(earlier.id)))continue;
        const sourceIdeas=new Set<Idea>();
        for(const cap of rule.requires){
          if(cap==='workers')sourceIdeas.add('settlers');
          for(const source of DEVELOPMENT_RULES)if(completed.has(source.id)&&source.provides.includes(cap))sourceIdeas.add(source.idea);
          if(cap==='food')for(const [supply,idea] of [['orchard-food','grove'],['fish','river'],['flour','windmill'],['imported-food','market']] as const)if(has(supply))sourceIdeas.add(idea);
        }
        sourceIdeas.delete(rule.idea);
        const sources=[...sourceIdeas].map(idea=>({idea,level:levels[idea],purpose:rule.name}));
        completed.add(rule.id);refreshCapabilities();
        while(levels[rule.idea]<rule.level){
          const event:TownEvent={idea:rule.idea,level:++levels[rule.idea],wave:++wave,sources,project:rule.id,title:rule.name,description:rule.description};
          events.push(event);timeline.push({kind:'development',event,world:copyWorldEventState(world)});
        }
        changed=true;
      }
    }
  }
  function installArtifacts(){
    if(!levels.observatory)return;
    for(const artifact of ['lens','core','gold'] as const){
      if(world.installed.includes(artifact))continue;
      const location=world.artifacts[artifact];
      // Gold remains bait until the encounter. A small share is installed only after taming.
      if(artifact==='gold'?world.dragon!=='tamed':location!=='town')continue;
      const names={lens:'Sky Lens',core:'Ember Core',gold:'Gold rune rings'};
      emit('artifact-installed',`${names[artifact]} installed`,artifact==='gold'?'The friendly dragon shares gold for the tower’s rune circuit.':`The Wizard fits the ${names[artifact]} into its waiting socket.`,()=>{
        world.installed.push(artifact);world.artifacts[artifact]=artifact==='gold'?'friendly-dragon':'installed';
      },artifact);
      develop();
    }
    if(world.installed.length===3&&has('calendar')&&!world.beacon){
      emit('beacon-lit','The summit beacon awakens','The Ember Core sends power through the gold rings and Sky Lens; the dragon curls beside the shining tower.',()=>{world.beacon=true;});
      develop();
    }
  }
  function dragonEncounter(){
    if(world.dragon!=='approaching')return;
    if(levels.observatory){
      emit('dragon-tamed','A dragon makes itself at home','The Wizard calms the dragon. It carries the hoard to the tower and settles beside it.',()=>{
        world.dragon='tamed';world.dragonDueTurn=null;world.artifacts.gold='friendly-dragon';
      });
    }else{
      emit('dragon-raid','The dragon steals the hoard','With no Wizard to calm it, the dragon takes the gold and scorches the harbor orchard.',()=>{
        world.dragon='departed';world.dragonDueTurn=null;world.artifacts.gold='departed-dragon';world.orchard='burned';world.burnedTurn=world.turn;
      });
    }
  }
  for(const [index,idea] of order.entries()){
    if(!IDEAS.includes(idea)||levels[idea]!==0)throw new Error(`Invalid idea sequence: ${idea}`);
    world.turn=index+1;events=[];timeline=[];worldEvents=[];wave=0;
    const dragonDue=world.dragon==='approaching'&&world.dragonDueTurn!==null&&world.dragonDueTurn<=world.turn;
    levels[idea]=1;refreshCapabilities();
    const arrival:TownEvent={idea,level:1,wave:0,sources:[]};
    events.push(arrival);timeline.push({kind:'development',event:arrival,world:copyWorldEventState(world)});
    develop();
    if(!world.minePrepared&&has('diversion-works')&&world.eruptionTurn===null){
      emit('mine-prepared','Dwarves prepare the mountain','Miners reinforce diversion channels and excavate a safe lava basin.',()=>{world.minePrepared=true;});
    }
    if(world.turn===6)emit('volcano-warning','The mountain is stirring','Smoke thickens and the ground trembles. The eruption comes after choice eight; dwarven channels can protect the pass.',()=>{world.volcano='warning';});
    if(world.turn===8){
      if(world.minePrepared){
        emit('eruption-safe','Lava follows the dwarf channels','The mountain erupts into the reinforced channels, leaving the wagon pass open.',()=>{world.volcano='contained';world.eruptionTurn=world.turn;});
        emit('core-recovered','The Ember Core emerges','A dwarf cart retrieves the glowing core from the safe collection basin.',()=>{world.artifacts.core='town';},'core');
      }else{
        emit('eruption-damage','Lava cuts off the mountain pass','Unchannelled lava crosses the wagon route. Mountain caravans must wait for a bypass.',()=>{world.volcano='overflowed';world.eruptionTurn=world.turn;world.mountainPass='blocked';});
      }
    }
    if(dragonDue)dragonEncounter();
    if(world.mountainPass==='blocked'&&world.eruptionTurn!==null&&world.turn>world.eruptionTurn&&has('heavy-tools')&&has('surveys')){
      emit('pass-repaired','Dwarves excavate a bypass','Local mining tools carve a route around the cooled lava. The original road remains buried.',()=>{world.mountainPass='bypass';});
      emit('core-recovered','The buried core is recovered','Miners reach the exposed crystal seam beyond the cooled lava.',()=>{world.artifacts.core='town';},'core');
    }
    if(world.orchard==='burned'&&world.burnedTurn!==null&&world.turn>world.burnedTurn&&levels.grove&&has('irrigation')&&has('tools')){
      emit('orchard-restored','The orchard grows again','Gardeners replant the watered ground. A charred trunk remains beside the new fruit trees.',()=>{world.orchard='restored';});
    }
    develop();
    if(has('wagons')&&world.caravan!=='delivered'){
      if(world.mountainPass==='blocked'){
        if(world.caravan!=='waiting')emit('caravan-waiting','The shrine caravan is waiting','The wagon stops before the lava-covered pass. It can reach the Sky Lens when a bypass opens.',()=>{world.caravan='waiting';});
      }else emit('lens-delivery','The shrine’s Sky Lens arrives','A caravan crosses the completed route, retrieves the lens from its old shrine and delivers it to town.',()=>{world.caravan='delivered';world.artifacts.lens='town';},'lens');
    }
    if(has('ship')&&world.expedition==='unavailable'){
      emit('expedition','The island treasure returns','The crew sails to the island, lifts its waiting chest aboard and brings the gold home.',()=>{world.expedition='returned';world.artifacts.gold='town';},'gold');
      emit('dragon-warning','Something saw the gold','A dragon turns toward the harbor. It will arrive after your next choice; a Wizard can calm it.',()=>{world.dragon='approaching';world.dragonDueTurn=world.turn+1;});
    }
    develop();installArtifacts();
    // A last-turn expedition still has an ending, with the final building already present.
    if(world.turn===IDEAS.length&&world.dragon==='approaching'){dragonEncounter();develop();installArtifacts();}
    refreshCapabilities();
  }
  const pending:PendingDevelopment[]=[];
  for(const idea of IDEAS){
    if(!levels[idea])continue;
    const next=DEVELOPMENT_RULES.find(rule=>rule.idea===idea&&!completed.has(rule.id));
    if(next)pending.push({idea,name:next.name,missing:next.requires.filter(cap=>!has(cap)&&cap!=='beacon').map(cap=>CAPABILITY_NAMES[cap]??cap)});
  }
  return {levels,projects:[...completed],events,world,worldEvents,history,timeline,pending};
}

export function worldNextEvent(world:WorldEventState):string {
  const notices:string[]=[];
  if(world.dragon==='approaching')notices.push('Dragon arrives after your next choice · a Wizard can calm it');
  if(world.volcano==='warning')notices.push(`Eruption after choice 8 · ${world.minePrepared?'dwarf channels ready':'dwarf channels needed'}`);
  if(world.mountainPass==='blocked')notices.push('Mountain pass blocked · mining machinery and surveys can open a bypass');
  return notices.join(' · ');
}

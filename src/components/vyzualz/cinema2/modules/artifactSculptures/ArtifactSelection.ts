import { Cinema2MainframePatternController } from '../mainframe/Cinema2MainframePatternController'
import type { Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import type { ArtifactSpec } from './ArtifactDomain'

export interface ArtifactSelectionInput {
  authored:string; revision:number; patternChange:boolean; trigger:Cinema2AfterhoursTriggerId
  event:string|null; auto:boolean; buildEvent:string|null; dropEvent:string|null; time:number; beat:number; active:boolean; reset:boolean
}
export class ArtifactSelection {
  private base:Cinema2MainframePatternController<string>
  private revision:number|null=null
  private auto:boolean|null=null
  private build:string|null=null
  private drop:string|null=null
  private override:{pattern:string;kind:'build'|'drop';until:number}|null=null
  private performing:string
  private previous:string
  constructor(private readonly spec:ArtifactSpec){this.performing=this.previous=spec.patterns[0]!;this.base=new Cinema2MainframePatternController<string>(spec.patterns,spec.patterns[0]!)}
  private start=0
  update(i:ArtifactSelectionInput){
    const rebase=i.reset||i.revision!==this.revision,authority=this.auto!==i.auto
    const base=this.base.update({authoredPattern:i.authored,patternChange:i.patternChange,trigger:i.trigger,triggerEventId:i.active?i.event:null,absoluteBeat:i.beat,reset:rebase||authority}).activePattern
    if(rebase||authority||!i.auto)this.override=null
    if(this.override&&(i.time>=this.override.until||(this.override.kind==='build'&&!i.buildEvent)))this.override=null
    if(!rebase&&!authority&&i.auto&&i.active){
      if(i.dropEvent&&i.dropEvent!==this.drop)this.override={pattern:this.spec.drop,kind:'drop',until:i.time+1.5}
      else if(i.buildEvent&&i.buildEvent!==this.build&&this.override?.kind!=='drop')this.override={pattern:this.spec.build,kind:'build',until:i.time+4}
    }
    if(i.buildEvent)this.build=i.buildEvent
    if(i.dropEvent)this.drop=i.dropEvent
    this.revision=i.revision;this.auto=i.auto
    const next=this.override?.pattern??base
    if(rebase||authority||next!==this.performing){this.previous=rebase||authority?next:this.performing;this.performing=next;this.start=i.time}
    return {base,performing:next,previous:this.previous,transition:rebase||authority?1:Math.min(1,Math.max(0,(i.time-this.start)/.55)),overridden:this.override!==null}
  }
  reset(){this.base.reset();this.revision=this.auto=this.build=this.drop=null;this.override=null;this.performing=this.previous=this.spec.patterns[0]!;this.start=0}
}

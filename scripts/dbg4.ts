import { rollBirth, startRun, act, createAccount } from '../src/engine';
import { pickForTrace } from './policy';
const acc=createAccount(); const c:Record<string,number>={}; let at=0;
for(let i=0;i<200;i++){const seed=500+i;
 let {run}=startRun(acc,'deer',{},[],rollBirth('deer',seed),seed+1); let n=0;
 while(!run.ended&&n++<80){const a=pickForTrace(run);run=act(run,a.id,a.target);}
 for(const l of run.history) if(/herd-mate/.test(l)) c[l]=(c[l]??0)+1;
 if(run.loc==='sheltered_glen') at++;}
console.log(c,at);

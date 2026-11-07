/** Projections only: inputs must come from a successful benchmark or be labelled scenarios. */
export function videoCapacity({quotaSeconds=108000,setupSeconds=0,videoSeconds,sessionSeconds=43200,reserveFraction=0,successFraction=1}) {
  if (![quotaSeconds,setupSeconds,videoSeconds,sessionSeconds,reserveFraction,successFraction].every(Number.isFinite) || quotaSeconds<0 || setupSeconds<0 || videoSeconds<=0 || sessionSeconds<=0 || reserveFraction<0 || reserveFraction>=1 || successFraction<0 || successFraction>1) throw new Error('invalid_capacity_inputs');
  let remaining=quotaSeconds*(1-reserveFraction), attempts=0, sessions=0, consumedSeconds=0;
  if(setupSeconds+videoSeconds>sessionSeconds)return {attempts:0,successfulVideos:0,sessions:0,consumedSeconds:0,unusedSeconds:remaining,perDay:0};
  while(remaining>=setupSeconds+videoSeconds){
    const budget=Math.min(remaining,sessionSeconds);
    const count=Math.floor((budget-setupSeconds)/videoSeconds);
    if(count<1)break;
    const consumed=setupSeconds+count*videoSeconds;
    attempts+=count;sessions++;remaining-=consumed;consumedSeconds+=consumed;
  }
  const successfulVideos=Math.floor(attempts*successFraction);
  return {attempts,successfulVideos,sessions,consumedSeconds,unusedSeconds:remaining,perDay:successfulVideos/7};
}

export function scenarioTable(){
  return [5,10,15,20,30,60].map(minutes=>({minutesPerVideo:minutes,...videoCapacity({videoSeconds:minutes*60,reserveFraction:0.2})}));
}

if(process.argv[1]&&import.meta.url===new URL(process.argv[1],'file:').href){
 console.log(JSON.stringify({kind:'hypothetical_scenarios_not_measured_throughput',quotaHours:30,reserveFraction:0.2,setupSeconds:0,scenarios:scenarioTable(),target15PerDay:{videosPerWeek:105,maxMinutesPerVideoWithoutReserve:1800/105,maxMinutesPerVideoWith20PercentReserve:1440/105},pixels:{portrait4k:2160*3840,portrait480:480*854,ratio4kTo480:(2160*3840)/(480*854)},oneminObserved:{required:1632960,available:280000,deficit:1632960-280000}},null,2));
}
